import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RectAreaLightHelper } from "ek3d/addons/helpers/RectAreaLightHelper";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { NearestFilter, RepeatWrapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { RectAreaLight } from "ek3d/lights/RectAreaLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing rect area light canvas");
const scene = new Scene();
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 5, -15);
const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: { MeshStandardMaterial: standardShader, MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);

const lights = [
  new RectAreaLight(0xff0000, 5, 4, 10),
  new RectAreaLight(0x00ff00, 5, 4, 10),
  new RectAreaLight(0x0000ff, 5, 4, 10),
];
const helpers = lights.map((light, index) => {
  light.position.set((index - 1) * 5, 6, 5);
  scene.add(light);
  const helper = new RectAreaLightHelper(light);
  scene.add(helper);
  return helper;
});

const checkerCanvas = document.createElement("canvas");
checkerCanvas.width = checkerCanvas.height = 2;
const ctx = checkerCanvas.getContext("2d");
if (!ctx) throw new Error("Could not create checker texture");
ctx.fillStyle = "#000";
ctx.fillRect(0, 0, 2, 2);
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, 1, 1);
ctx.fillRect(1, 1, 1, 1);
const checker = new CanvasTexture(checkerCanvas);
checker.repeat.set(400, 400);
checker.magFilter = NearestFilter;
checker.wrapS = checker.wrapT = RepeatWrapping;
const floorGeometry = new BoxGeometry(2000, 0.1, 2000);
const floorMaterial = new MeshStandardMaterial({ color: 0x444444, roughnessMap: checker });
scene.add(new Mesh(floorGeometry, floorMaterial));
const knotGeometry = new TorusKnotGeometry(1.5, 0.5, 200, 16);
const knotMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0, metalness: 0 });
const knot = new Mesh(knotGeometry, knotMaterial);
knot.position.set(0, 5.5, 0);
scene.add(knot);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(knot.position);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
const timer = new Timer();
timer.connect(document);
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  lights[0].rotation.y -= delta;
  lights[1].rotation.y += delta * 0.5;
  lights[2].rotation.y += delta;
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  stats.update();
});
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  stats.dom.remove();
  for (const helper of helpers) helper.dispose();
  floorGeometry.dispose();
  floorMaterial.dispose();
  checker.dispose();
  knotGeometry.dispose();
  knotMaterial.dispose();
  dfgLUT.dispose();
  for (const texture of Object.values(ltcTextures)) texture.dispose();
  renderer.dispose();
});
