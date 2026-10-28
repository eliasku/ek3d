import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping, HalfFloatType } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cubemap canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.rotation.y = 0.5;
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000);
camera.position.z = 75;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
const target = new WebGLCubeRenderTarget(256);
target.texture.type = HalfFloatType;
const cubeCamera = new CubeCamera(1, 1000, target);
const material = new MeshStandardMaterial({ envMap: target.texture, roughness: 0.05, metalness: 1 });
const sphere = new Mesh(new IcosahedronGeometry(15, 8), material);
const material2 = new MeshStandardMaterial({ roughness: 0.1, metalness: 0 });
const cube = new Mesh(new BoxGeometry(15, 15, 15), material2);
const torus = new Mesh(new TorusKnotGeometry(8, 3, 128, 16), material2);
scene.add(sphere, cube, torus);
const gui = new GUI();
gui.add(material, "roughness", 0, 1);
gui.add(material, "metalness", 0, 1);
gui.add(renderer, "toneMappingExposure", 0, 2).name("exposure");
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
let disposed = false;
let loaded = false;
let failed = false;
let frames = 0;
canvas.dataset.state = "loading";
const hdr = new HDRLoader(manager).load(
  "/examples/textures/equirectangular/quarry_01_1k.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.mapping = EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop((msTime) => {
  const time = msTime / 1000;
  cube.position.set(Math.cos(time) * 30, Math.sin(time) * 30, Math.sin(time) * 30);
  cube.rotation.x += 0.02;
  cube.rotation.y += 0.03;
  torus.position.set(Math.cos(time + 10) * 30, Math.sin(time + 10) * 30, Math.sin(time + 10) * 30);
  torus.rotation.x += 0.02;
  torus.rotation.y += 0.03;
  cubeCamera.update(renderer, scene);
  controls.update();
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (loaded && !failed) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  hdr.dispose();
  target.dispose();
  dfg.dispose();
  renderer.dispose();
});
