import type { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLArrayRenderTarget } from "ek3d/renderers/WebGLArrayRenderTarget";
import { WebGL3DRenderTarget } from "ek3d/renderers/WebGL3DRenderTarget";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GLSL, TextureFilter, Side } from "ek3d/constants";

/** Two panels sample independent slices; key 4 cycles off / array / volume. */
export function createLayerTargets(renderer: WebGLRenderer) {
  const object = new Group();
  object.name = "Layered target samples";
  object.visible = false;
  object.position.set(0, 3.4, -1);
  const geometry = new PlaneGeometry(2, 1.25);
  const quad = new PlaneGeometry(2, 2);
  const array = new WebGLArrayRenderTarget(64, 64, 2, {
    minFilter: TextureFilter.Nearest,
    magFilter: TextureFilter.Nearest,
  });
  const volume = new WebGL3DRenderTarget(64, 64, 2, {
    minFilter: TextureFilter.Nearest,
    magFilter: TextureFilter.Nearest,
  });
  const targets = [array, volume];
  const paint = new RawShaderMaterial({
    glslVersion: GLSL.GLSL3,
    uniforms: { tint: { value: [1, 0.15, 0.03] }, phase: { value: 0 } },
    vertexShader:
      "precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }",
    fragmentShader:
      "precision highp float; in vec2 vUv; uniform vec3 tint; uniform float phase; out vec4 color; void main() { float stripe = 0.3 + 0.7 * step(0.5, fract(vUv.x * 5.0 + vUv.y + phase)); color = vec4(tint * stripe, 1.0); }",
  });
  const offscreen = new Scene();
  offscreen.add(new Mesh(quad, paint));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const materials: RawShaderMaterial[] = [];
  for (let layer = 0; layer < 2; layer++) {
    const material = new RawShaderMaterial({
      glslVersion: GLSL.GLSL3,
      side: Side.Double,
      uniforms: {
        arrayMap: { value: array.texture },
        volumeMap: { value: volume.texture },
        mode: { value: 1 },
        layer: { value: layer },
      },
      vertexShader:
        "precision highp float; in vec3 position; in vec2 uv; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "precision highp float; precision highp sampler2DArray; precision highp sampler3D; in vec2 vUv; uniform sampler2DArray arrayMap; uniform sampler3D volumeMap; uniform int mode; uniform float layer; out vec4 color; void main() { color = mode == 1 ? texture(arrayMap, vec3(vUv, layer)) : texture(volumeMap, vec3(vUv, (layer + 0.5) / 2.0)); }",
    });
    const panel = new Mesh(geometry, material);
    panel.name = `Target slice ${layer}`;
    panel.position.x = layer === 0 ? -1.15 : 1.15;
    materials.push(material);
    object.add(panel);
  }
  let mode = 0;
  const colors = [
    [1, 0.15, 0.03],
    [0.03, 0.4, 1],
  ];
  return {
    object,
    cycle() {
      mode = (mode + 1) % 3;
      object.visible = mode !== 0;
      for (const material of materials) material.uniforms.mode.value = mode;
      return ["off", "array layers", "3D slices"][mode];
    },
    update() {
      if (!object.visible) return;
      const previous = renderer.getRenderTarget();
      const face = renderer.getActiveCubeFace();
      const mip = renderer.getActiveMipmapLevel();
      const autoClear = renderer.autoClear;
      try {
        renderer.autoClear = true;
        paint.uniforms.phase.value += 0.01;
        // Initialize both sampler bindings: a program may keep both sampler types active.
        for (const target of targets) {
          for (let layer = 0; layer < 2; layer++) {
            paint.uniforms.tint.value = colors[layer];
            renderer.setRenderTarget(target, layer);
            renderer.render(offscreen, camera);
          }
        }
      } finally {
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previous, face, mip);
      }
    },
    dispose() {
      object.removeFromParent();
      array.dispose();
      volume.dispose();
      paint.dispose();
      for (const material of materials) material.dispose();
      geometry.dispose();
      quad.dispose();
    },
  };
}
