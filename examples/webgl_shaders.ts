import { CopyShader } from "ek3d/addons/shaders/CopyShader";
import { LuminosityShader } from "ek3d/addons/shaders/LuminosityShader";
import { ColorifyShader } from "ek3d/addons/shaders/ColorifyShader";
import { ExposureShader } from "ek3d/addons/shaders/ExposureShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { cloneUniforms } from "ek3d/renderers/shaders/UniformsUtils";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing shader example canvas");
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new PlaneGeometry(2, 2);
const texture = new DataTexture(
  new Uint8Array([255, 64, 32, 255, 32, 192, 64, 255, 32, 64, 255, 255, 192, 128, 64, 255]),
  2,
  2,
);
texture.needsUpdate = true;
const materials = [CopyShader, LuminosityShader, ColorifyShader, ExposureShader].map((shader) => {
  const material = new ShaderMaterial({ ...shader, uniforms: cloneUniforms(shader.uniforms) });
  material.uniforms.tDiffuse.value = texture;
  return material;
});
materials[2].uniforms.color.value.setRGB(0.25, 1, 0.5);
materials[3].uniforms.exposure.value = 0.5;
const scene = new Scene();
const mesh = new Mesh(geometry, materials[0]);
scene.add(mesh);

// Clockwise from top left: copy, grayscale, half exposure, green tint.
function render(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const left = Math.floor(window.innerWidth / 2);
  const bottom = Math.floor(window.innerHeight / 2);
  const viewports = [
    [0, bottom, left, window.innerHeight - bottom],
    [left, bottom, window.innerWidth - left, window.innerHeight - bottom],
    [0, 0, left, bottom],
    [left, 0, window.innerWidth - left, bottom],
  ];
  renderer.setScissorTest(true);
  for (let i = 0; i < materials.length; i++) {
    const [x, y, width, height] = viewports[i];
    renderer.setViewport(x, y, width, height);
    renderer.setScissor(x, y, width, height);
    mesh.material = materials[i];
    renderer.render(scene, camera);
  }
  renderer.setScissorTest(false);
  canvas!.dataset.state = "rendered";
}

window.addEventListener("resize", render);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", render);
    for (const material of materials) material.dispose();
    geometry.dispose();
    texture.dispose();
    renderer.dispose();
  },
  { once: true },
);
render();
