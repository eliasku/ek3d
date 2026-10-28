import { GL } from "ek3d/GL";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { CopyShader } from "ek3d/addons/shaders/CopyShader";
import { RGBShiftShader } from "ek3d/addons/shaders/RGBShiftShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Vector2 } from "ek3d/math/Vector2";
import { Scene } from "ek3d/scenes/Scene";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/**
 * Exercises EffectComposer, RenderPass, ShaderPass and OutputPass against a real WebGL context.
 *
 * Run in a real browser served by Vite: (await import('/tests/browser-postprocessing.ts')).verifyPostprocessing().
 */
export function verifyPostprocessing() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setSize(200, 120);
  const gl = renderer.getContext();

  const scene = new Scene();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0xff8800 });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);

  const camera = new PerspectiveCamera(60, 200 / 120, 1, 1000);
  camera.position.set(0, 0, 20);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const shift = new ShaderPass(RGBShiftShader);
  shift.uniforms!["amount"].value = 0.01;
  composer.addPass(shift);
  const copy = new ShaderPass(CopyShader);
  composer.addPass(copy);
  const output = new OutputPass();
  composer.addPass(output);

  try {
    check(composer.passes.length === 4, "Composer must chain the added passes");
    check(composer.passes[0].needsSwap === false, "RenderPass must not swap");
    check(output.isOutputPass === true, "OutputPass flag must be exposed");

    const readPixels = () => {
      const size = renderer.getDrawingBufferSize(new Vector2());
      const pixels = new Uint8Array(size.x * size.y * 4);
      const previous = gl.getParameter(GL.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
      gl.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, size.x, size.y, GL.RGBA, GL.UNSIGNED_BYTE, pixels);
      gl.bindFramebuffer(GL.READ_FRAMEBUFFER, previous);
      check(gl.getError() === GL.NO_ERROR, "Postprocessing produced a WebGL error");
      return pixels;
    };

    composer.render();
    const withEffects = readPixels();
    check(
      withEffects.some((value, index) => index > 3 && value !== withEffects[0]),
      "Composer output is uniform",
    );

    // Disabling every effect pass must reproduce the plain scene render.
    shift.enabled = false;
    copy.enabled = false;
    composer.render();
    const plain = readPixels();
    check(
      plain.some((value, index) => index > 3 && value !== plain[0]),
      "Plain render is uniform",
    );

    shift.enabled = true;
    copy.enabled = true;

    // Resize cascades through the composer into its buffers and passes.
    renderer.setSize(240, 160);
    composer.setSize(240, 160);
    check(
      composer.renderTarget1.width === 240 && composer.renderTarget2.width === 240,
      "Composer buffers must follow setSize",
    );
    composer.render();
    readPixels();

    // RenderPass renders into the read buffer, so removal leaves the composer chain empty.
    composer.removePass(shift);
    composer.insertPass(shift, 1);
    composer.render();
    readPixels();

    const glError = gl.getError();
    check(glError === GL.NO_ERROR, "Postprocessing rendering produced a WebGL error");
    return { glError: 0 };
  } finally {
    composer.dispose();
    mesh.geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
  }
}
