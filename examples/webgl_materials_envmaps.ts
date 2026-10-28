import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import {
  CubeReflectionMapping,
  CubeRefractionMapping,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
  SRGBColorSpace,
} from "ek3d/constants";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing environment canvas");
const canvas = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 2.5);
const manager = new LoadingManager();
let disposed = false;
let failed = false;
let loaded = 0;
canvas.dataset.state = "loading";
function onLoad(): void {
  if (!disposed && ++loaded === 2 && !failed) canvas.dataset.state = "rendered";
}
function onError(error: unknown): void {
  if (!disposed) {
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
}
const cube = new CubeTextureLoader(manager).setPath("/examples/textures/cube/Bridge2/").load(
  ["posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", "posz.jpg", "negz.jpg"],
  (texture) => {
    if (disposed) texture.dispose();
    else onLoad();
  },
  undefined,
  onError,
);
const equirect = new TextureLoader(manager).load(
  "/examples/textures/2294472375_24a3b8ef46_o.jpg",
  (texture) => {
    if (disposed) texture.dispose();
    else onLoad();
  },
  undefined,
  onError,
);
equirect.mapping = EquirectangularReflectionMapping;
equirect.colorSpace = SRGBColorSpace;
scene.background = cube;
const material = new MeshBasicMaterial({ envMap: cube });
const sphere = new Mesh(new IcosahedronGeometry(1, 15), material);
scene.add(sphere);
const renderer = new WebGLRenderer({
  canvas,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1.5;
controls.maxDistance = 6;
const params = {
  Cube: () => {
    scene.background = cube;
    material.envMap = cube;
    material.needsUpdate = true;
  },
  Equirectangular: () => {
    scene.background = equirect;
    material.envMap = equirect;
    material.needsUpdate = true;
  },
  Refraction: false,
  backgroundRotationX: false,
  backgroundRotationY: false,
  backgroundRotationZ: false,
  syncMaterial: false,
};
const gui = new GUI({ width: 300 });
gui.add(params, "Cube");
gui.add(params, "Equirectangular");
gui.add(params, "Refraction").onChange(() => {
  equirect.mapping = params.Refraction ? EquirectangularRefractionMapping : EquirectangularReflectionMapping;
  cube.mapping = params.Refraction ? CubeRefractionMapping : CubeReflectionMapping;
  material.needsUpdate = true;
});
gui.add(params, "backgroundRotationX");
gui.add(params, "backgroundRotationY");
gui.add(params, "backgroundRotationZ");
gui.add(params, "syncMaterial");
gui.open();
let frames = 0;
renderer.setAnimationLoop(() => {
  if (params.backgroundRotationX) scene.backgroundRotation.x += 0.001;
  if (params.backgroundRotationY) scene.backgroundRotation.y += 0.001;
  if (params.backgroundRotationZ) scene.backgroundRotation.z += 0.001;
  if (params.syncMaterial) material.envMapRotation.copy(scene.backgroundRotation);
  camera.lookAt(scene.position);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  scene.background = null;
  disposeObject(scene);
  cube.dispose();
  equirect.dispose();
  renderer.dispose();
});
