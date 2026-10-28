import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { ClearPass } from "ek3d/addons/postprocessing/ClearPass";
import { CubeTexturePass } from "ek3d/addons/postprocessing/CubeTexturePass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { TexturePass } from "ek3d/addons/postprocessing/TexturePass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing backgrounds canvas");
const scene = new Scene();
const camera = new PerspectiveCamera(65, innerWidth / innerHeight, 1, 10);
camera.position.z = 7;
for (const [color, x, y] of [
  [0xefffef, -10, -10],
  [0xffefef, -10, 10],
  [0xefefff, 10, -10],
]) {
  const light = new PointLight(color, 500);
  light.position.set(x, y, 10);
  scene.add(light);
}
const material = new MeshStandardMaterial({ roughness: 0.5 * Math.random() + 0.25, metalness: 0 });
material.color.setHSL(Math.random(), 1, 0.3);
scene.add(new Mesh(new SphereGeometry(1, 48, 24), material));
const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
const params = {
  clearPass: true,
  clearColor: "white",
  clearAlpha: 1,
  texturePass: true,
  texturePassOpacity: 1,
  cubeTexturePass: true,
  cubeTexturePassOpacity: 1,
  renderPass: true,
};
const gui = new GUI();
gui.add(params, "clearPass");
gui.add(params, "clearColor", ["black", "white", "blue", "green", "red"]);
gui.add(params, "clearAlpha", 0, 1);
gui.add(params, "texturePass");
gui.add(params, "texturePassOpacity", 0, 1);
gui.add(params, "cubeTexturePass");
gui.add(params, "cubeTexturePassOpacity", 0, 1);
gui.add(params, "renderPass");
const composer = new EffectComposer(renderer);
const clearPass = new ClearPass(params.clearColor, params.clearAlpha);
let disposed = false;
const texture = new TextureLoader().load("/examples/textures/hardwood2_diffuse.jpg", (map) => {
  if (disposed) {
    map.dispose();
    return;
  }
  map.colorSpace = ColorSpace.SRGB;
});
const texturePass = new TexturePass(texture);
const cubePass = new CubeTexturePass(camera, null);
const renderPass = new RenderPass(scene, camera);
renderPass.clear = false;
composer.addPass(clearPass);
composer.addPass(texturePass);
composer.addPass(cubePass);
composer.addPass(renderPass);
composer.addPass(new OutputPass());
const cube = new CubeTextureLoader().load(
  ["px", "nx", "py", "ny", "pz", "nz"].map((side) => `/examples/textures/cube/pisa/${side}.png`),
  (map) => {
    if (disposed) {
      map.dispose();
      return;
    }
    cubePass.tCube = map;
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  camera.updateMatrixWorld(true);
  const colors: Record<string, number> = { black: 0, white: 0xffffff, blue: 0x0000ff, green: 0x00ff00, red: 0xff0000 };
  clearPass.enabled = params.clearPass;
  clearPass.clearColor = colors[params.clearColor];
  clearPass.clearAlpha = params.clearAlpha;
  texturePass.enabled = params.texturePass;
  texturePass.opacity = params.texturePassOpacity;
  cubePass.enabled = params.cubeTexturePass && cubePass.tCube !== null;
  cubePass.opacity = params.cubeTexturePassOpacity;
  renderPass.enabled = params.renderPass;
  composer.render();
  stats.end();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  for (const pass of composer.passes) pass.dispose();
  composer.dispose();
  texture.dispose();
  cube.dispose();
  disposeObject(scene);
  dfgLUT.dispose();
  for (const lut of Object.values(ltcTextures)) lut.dispose();
  renderer.dispose();
});
