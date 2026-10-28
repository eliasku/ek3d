import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { WebGLArrayRenderTarget } from "ek3d/renderers/WebGLArrayRenderTarget";
import { WebGL3DRenderTarget } from "ek3d/renderers/WebGL3DRenderTarget";
import { DepthTexture } from "ek3d/textures/DepthTexture";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Scene } from "ek3d/scenes/Scene";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Mesh } from "ek3d/objects/Mesh";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GLSL3, NearestFilter } from "ek3d/constants";

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type LayeredTarget = WebGLArrayRenderTarget | WebGL3DRenderTarget;

interface TargetAllocation {
  color: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  depth?: WebGLRenderbuffer;
  depthTexture?: WebGLTexture;
}

/** Shared depth is deliberately cleared per slice, as required by upstream WebGL targets. */
export async function verifyLayeredTargets(canvas?: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
  renderer.setSize(8, 8, false);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  const gl = renderer.getContext();
  const geometry = new PlaneGeometry(2, 2);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const scene = new Scene();
  const paint = new RawShaderMaterial({
    glslVersion: GLSL3,
    uniforms: { tint: { value: [1, 0, 0, 1] }, z: { value: -0.5 } },
    vertexShader:
      "precision highp float; in vec3 position; uniform float z; void main() { gl_Position = vec4(position.xy, z, 1.0); }",
    fragmentShader: "precision highp float; uniform vec4 tint; out vec4 color; void main() { color = tint; }",
  });
  const sampler = (kind: string, coordinate: string) =>
    new RawShaderMaterial({
      glslVersion: GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: { map: { value: null }, layer: { value: 0 } },
      vertexShader: "precision highp float; in vec3 position; void main() { gl_Position = vec4(position, 1.0); }",
      fragmentShader: `precision highp float; precision highp ${kind}; uniform ${kind} map; uniform float layer; out vec4 color; void main() { color = texture(map, ${coordinate}); }`,
    });
  const arraySampler = sampler("sampler2DArray", "vec3(0.5, 0.5, layer)");
  const volumeSampler = sampler("sampler3D", "vec3(0.5, 0.5, layer)");
  const mesh = new Mesh(geometry, paint);
  scene.add(mesh);
  const targets = [
    new WebGLArrayRenderTarget(8, 8, 2, { minFilter: NearestFilter, magFilter: NearestFilter }),
    new WebGL3DRenderTarget(8, 8, 2, { minFilter: NearestFilter, magFilter: NearestFilter }),
  ];
  const output = new WebGLRenderTarget(8, 8, { depthBuffer: false });
  const pixel = new Uint8Array(4);
  const expect = (actual: Uint8Array, expected: number[], label: string) =>
    check(
      actual.every((value, index) => Math.abs(value - expected[index]) <= 1),
      `${label}: ${actual.join(",")} != ${expected.join(",")}`,
    );
  const red = [255, 0, 0, 255];
  const blue = [0, 0, 255, 255];
  const draw = (color: number[], z: number) => {
    mesh.material = paint;
    paint.uniforms.tint.value = color;
    paint.uniforms.z.value = z;
    renderer.render(scene, camera);
  };
  const fill = (target: LayeredTarget) => {
    for (let layer = 0; layer < target.depth; layer++) {
      renderer.setRenderTarget(target, layer);
      check(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE, "Layer framebuffer is incomplete");
      renderer.clear();
      draw(layer % 2 === 0 ? [1, 0, 0, 1] : [0, 0, 1, 1], -0.5);
      draw([0, 1, 0, 1], 0.5);
    }
    renderer.setRenderTarget(null);
  };
  const sample = (target: LayeredTarget, layer: number, expected: number[], label: string) => {
    const material = target instanceof WebGLArrayRenderTarget ? arraySampler : volumeSampler;
    material.uniforms.map.value = target.texture;
    material.uniforms.layer.value = target instanceof WebGLArrayRenderTarget ? layer : (layer + 0.5) / target.depth;
    mesh.material = material;
    renderer.setRenderTarget(output);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(output, 4, 4, 1, 1, pixel);
    expect(pixel, expected, label);
    renderer.setRenderTarget(null);
  };
  const handles = (target: LayeredTarget) => ({
    color: renderer.properties.get(target.texture).__webglTexture as WebGLTexture,
    framebuffer: renderer.properties.get(target).__webglFramebuffer as WebGLFramebuffer,
    depth: renderer.properties.get(target).__webglDepthbuffer as WebGLRenderbuffer | undefined,
    depthTexture: target.depthTexture
      ? (renderer.properties.get(target.depthTexture).__webglTexture as WebGLTexture)
      : undefined,
  });
  const deleted = (allocation: TargetAllocation, label: string) => {
    check(!gl.isTexture(allocation.color), `${label}: retained color texture`);
    check(!gl.isFramebuffer(allocation.framebuffer), `${label}: retained framebuffer`);
    if (allocation.depth) check(!gl.isRenderbuffer(allocation.depth), `${label}: retained depth renderbuffer`);
    if (allocation.depthTexture)
      check(!gl.isTexture(allocation.depthTexture), `${label}: retained owned depth texture`);
  };
  try {
    for (const target of targets) {
      fill(target);
      sample(target, 0, red, "independent layer zero sampling");
      sample(target, 1, blue, "independent layer one sampling");
      renderer.setRenderTarget(target, 0);
      renderer.clear(false, true, false);
      draw([1, 0, 0, 1], -0.75);
      renderer.setRenderTarget(target, 1);
      renderer.clear(true, false, false);
      draw([0, 1, 0, 1], -0.6);
      sample(target, 1, [0, 0, 0, 255], "shared depth persists until explicitly cleared for another slice");
      fill(target);
      renderer.setRenderTarget(target, 1);
      const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      renderer.readRenderTargetPixels(target, 4, 4, 1, 1, pixel, 0);
      expect(pixel, red, "explicit readback selects layer zero, not last rendered layer");
      check(
        renderer.getActiveCubeFace() === 1 && gl.getParameter(gl.FRAMEBUFFER_BINDING) === framebuffer,
        "Synchronous readback changed the active target/layer",
      );
      check(
        gl.getFramebufferAttachmentParameter(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER,
        ) === 1,
        "Synchronous readback did not restore the active layer attachment",
      );
      const pending = renderer.readRenderTargetPixelsAsync(target, 4, 4, 1, 1, new Uint8Array(4), 0);
      check(
        gl.getFramebufferAttachmentParameter(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER,
        ) === 1,
        "Asynchronous readback did not restore attachment before waiting",
      );
      renderer.setRenderTarget(output);
      expect(await pending, red, "asynchronous layer zero readback");
      check(renderer.getRenderTarget() === output, "Async completion reverted a subsequent render target change");
      renderer.readRenderTargetPixels(target, 4, 4, 1, 1, pixel, 1);
      expect(pixel, blue, "explicit layer one readback");
      const untouched = new Uint8Array([11, 22, 33, 44]);
      renderer.readRenderTargetPixels(target, -1, 0, 1, 1, untouched, 0);
      expect(untouched, [11, 22, 33, 44], "out-of-bounds sync readback leaves destination intact");
      let invalidLayer = false;
      try {
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel, target.depth);
      } catch (error) {
        invalidLayer = error instanceof RangeError;
      }
      check(invalidLayer, "Invalid synchronous layer must fail before changing the framebuffer");
      let invalidAsyncLayer = false;
      try {
        await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1, pixel, -1);
      } catch (error) {
        invalidAsyncLayer = error instanceof RangeError;
      }
      check(invalidAsyncLayer && renderer.getRenderTarget() === output, "Invalid async layer changed active target");
      check(
        gl.getParameter(gl.FRAMEBUFFER_BINDING) === renderer.properties.get(output).__webglFramebuffer,
        "Invalid layer readback changed framebuffer binding",
      );
      renderer.setRenderTarget(null);

      const original = handles(target);
      target.setSize(6, 4, 3);
      deleted(original, "resize");
      check(
        target.texture.image.depth === 3 && target.viewport.z === 6 && target.viewport.w === 4,
        "Resize lost dimensions/viewport",
      );
      fill(target);
      sample(target, 2, red, "new slice after resize");
      const resized = handles(target);
      check(resized.color !== original.color, "Resize reused deleted storage");
      target.dispose();
      deleted(resized, "dispose");
      check(target.texture.image.width === 6, "Disposal destroyed CPU dimensions");
      fill(target);
      sample(target, 1, blue, "reallocation after dispose");

      // A depth texture is a shared 2D attachment, not independent per-layer depth storage.
      target.dispose();
      target.depthTexture = new DepthTexture(6, 4);
      fill(target);
      sample(target, 0, red, "depth texture occlusion on slice zero");
      sample(target, 1, blue, "depth texture occlusion on slice one");
      const owned = handles(target);
      check(owned.depthTexture !== undefined && gl.isTexture(owned.depthTexture), "Depth texture was not allocated");
      const borrower = new WebGLArrayRenderTarget(6, 4, 2, { depthTexture: target.depthTexture });
      try {
        fill(borrower);
        const borrowedColor = handles(borrower).color;
        borrower.dispose();
        check(
          !gl.isTexture(borrowedColor) && gl.isTexture(owned.depthTexture),
          "Borrower disposal must release its color without deleting another target’s depth",
        );
        fill(target);
        sample(target, 1, blue, "depth owner remains usable after borrower disposal");
      } finally {
        borrower.dispose();
      }
      target.dispose();
      deleted(owned, "owned depth texture disposal");
      fill(target);
    }
    const extension = gl.getExtension("WEBGL_lose_context");
    check(extension !== null, "Layered target restoration requires WEBGL_lose_context");
    const event = (name: string, action: () => void) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timeout);
          resolve();
        };
        const timeout = setTimeout(() => {
          renderer.domElement.removeEventListener(name, done);
          reject(new Error(`Timed out waiting for ${name}`));
        }, 10000);
        renderer.domElement.addEventListener(name, done, { once: true });
        action();
      });
    await event("webglcontextlost", () => extension.loseContext());
    await event("webglcontextrestored", () => setTimeout(() => extension.restoreContext(), 0));
    for (const target of targets) {
      fill(target);
      sample(target, 0, red, "restored layer zero");
      sample(target, 1, blue, "restored layer one");
      const restored = handles(target);
      target.dispose();
      deleted(restored, "post-restoration disposal");
      fill(target);
    }
    const live = targets.map(handles);
    renderer.dispose();
    live.forEach((allocation) => deleted(allocation, "renderer disposal with live targets"));
    check(gl.getError() === gl.NO_ERROR, "Layered target lifecycle produced a WebGL error");
    return {
      arrayLayers: true,
      volumeSlices: true,
      sampling: true,
      sharedDepth: true,
      readback: true,
      asyncReadback: true,
      resize: true,
      ownership: true,
      reallocation: true,
      contextRestore: true,
      glError: gl.getError(),
    };
  } finally {
    renderer.setRenderTarget(null);
    for (const target of targets) target.dispose();
    output.dispose();
    for (const material of [paint, arraySampler, volumeSampler]) material.dispose();
    geometry.dispose();
    renderer.dispose();
  }
}
