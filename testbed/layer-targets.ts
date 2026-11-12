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
export class LayerTargets {
  object: Group;
  private group: Group;
  private geometry: PlaneGeometry;
  private quad: PlaneGeometry;
  private array: WebGLArrayRenderTarget;
  private volume: WebGL3DRenderTarget;
  private targets: (WebGLArrayRenderTarget | WebGL3DRenderTarget)[];
  private paint: RawShaderMaterial;
  private offscreen: Scene;
  private camera: OrthographicCamera;
  private materials: RawShaderMaterial[];
  private mode: number;
  private colors: number[][];

  constructor(private renderer: WebGLRenderer) {
    this.group = new Group();
    this.group.name = "Layered target samples";
    this.group.visible = false;
    this.group.position.set(0, 3.4, -1);
    this.geometry = new PlaneGeometry(2, 1.25);
    this.quad = new PlaneGeometry(2, 2);
    this.array = new WebGLArrayRenderTarget(64, 64, 2, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
    });
    this.volume = new WebGL3DRenderTarget(64, 64, 2, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
    });
    this.targets = [this.array, this.volume];
    this.paint = new RawShaderMaterial({
      glslVersion: GLSL.GLSL3,
      uniforms: { tint: { value: [1, 0.15, 0.03] }, phase: { value: 0 } },
      vertexShader:
        "precision highp float; in vec3 position; in vec2 uv; out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }",
      fragmentShader:
        "precision highp float; in vec2 vUv; uniform vec3 tint; uniform float phase; out vec4 color; void main() { float stripe = 0.3 + 0.7 * step(0.5, fract(vUv.x * 5.0 + vUv.y + phase)); color = vec4(tint * stripe, 1.0); }",
    });
    this.offscreen = new Scene();
    this.offscreen.add(new Mesh(this.quad, this.paint));
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;
    this.materials = [];
    for (let layer = 0; layer < 2; layer++) {
      const material = new RawShaderMaterial({
        glslVersion: GLSL.GLSL3,
        side: Side.Double,
        uniforms: {
          arrayMap: { value: this.array.texture },
          volumeMap: { value: this.volume.texture },
          mode: { value: 1 },
          layer: { value: layer },
        },
        vertexShader:
          "precision highp float; in vec3 position; in vec2 uv; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "precision highp float; precision highp sampler2DArray; precision highp sampler3D; in vec2 vUv; uniform sampler2DArray arrayMap; uniform sampler3D volumeMap; uniform int mode; uniform float layer; out vec4 color; void main() { color = mode == 1 ? texture(arrayMap, vec3(vUv, layer)) : texture(volumeMap, vec3(vUv, (layer + 0.5) / 2.0)); }",
      });
      const panel = new Mesh(this.geometry, material);
      panel.name = `Target slice ${layer}`;
      panel.position.x = layer === 0 ? -1.15 : 1.15;
      this.materials.push(material);
      this.group.add(panel);
    }
    this.mode = 0;
    this.colors = [
      [1, 0.15, 0.03],
      [0.03, 0.4, 1],
    ];
    this.object = this.group;
    this.cycle = this.cycle.bind(this);
    this.update = this.update.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  cycle() {
    this.mode = (this.mode + 1) % 3;
    this.group.visible = this.mode !== 0;
    for (const material of this.materials) material.uniforms.mode.value = this.mode;
    return ["off", "array layers", "3D slices"][this.mode];
  }

  update() {
    if (!this.group.visible) return;
    const previous = this.renderer.getRenderTarget();
    const face = this.renderer.getActiveCubeFace();
    const mip = this.renderer.getActiveMipmapLevel();
    const autoClear = this.renderer.autoClear;
    try {
      this.renderer.autoClear = true;
      this.paint.uniforms.phase.value += 0.01;
      // Initialize both sampler bindings: a program may keep both sampler types active.
      for (const target of this.targets) {
        for (let layer = 0; layer < 2; layer++) {
          this.paint.uniforms.tint.value = this.colors[layer];
          this.renderer.setRenderTarget(target, layer);
          this.renderer.render(this.offscreen, this.camera);
        }
      }
    } finally {
      this.renderer.autoClear = autoClear;
      this.renderer.setRenderTarget(previous, face, mip);
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.array.dispose();
    this.volume.dispose();
    this.paint.dispose();
    for (const material of this.materials) material.dispose();
    this.geometry.dispose();
    this.quad.dispose();
  }
}
