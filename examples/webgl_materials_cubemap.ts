import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Mapping, Combine } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cubemap canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 13;
const scene = new Scene();
const manager = new LoadingManager();
let disposed = false;
let failure = false;
let loaded = 0;
let frames = 0;
canvas.dataset.state = "loading";
function reportFailure(cause: unknown): void {
  if (disposed) return;
  failure = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
const urls = ["px", "nx", "py", "ny", "pz", "nz"].map(
  (face) => `/examples/textures/cube/SwedishRoyalCastle/${face}.jpg`,
);
const loader = new CubeTextureLoader(manager);
const reflection = loader.load(
  urls,
  () => {
    if (!disposed) loaded++;
  },
  undefined,
  reportFailure,
);
const refraction = loader.load(
  urls,
  () => {
    if (!disposed) loaded++;
  },
  undefined,
  reportFailure,
);
refraction.mapping = Mapping.CubeRefraction;
scene.background = reflection;
scene.add(new AmbientLight(0xffffff, 3));
const pointLight = new PointLight(0xffffff, 200);
scene.add(pointLight);
const materials = [
  new MeshLambertMaterial({ color: 0xffffff, envMap: reflection }),
  new MeshLambertMaterial({ color: 0xfff700, envMap: refraction, refractionRatio: 0.95 }),
  new MeshLambertMaterial({ color: 0xffaa00, envMap: reflection, combine: Combine.Mix, reflectivity: 0.3 }),
];
new OBJLoader(manager).load(
  "/examples/models/obj/walt/WaltHead.obj",
  (object) => {
    if (disposed) {
      disposeObject(object);
      return;
    }
    const head = object.children[0];
    if (!(head instanceof Mesh)) {
      disposeObject(object);
      reportFailure(new Error("Missing Walt head mesh"));
      return;
    }
    for (const material of Array.isArray(head.material) ? head.material : [head.material]) disposeMaterial(material);
    head.material = materials[0];
    head.scale.setScalar(0.1);
    head.position.y = -3;
    const head2 = head.clone();
    head2.position.x = -6;
    head2.material = materials[1];
    const head3 = head.clone();
    head3.position.x = 6;
    head3.material = materials[2];
    scene.add(head, head2, head3);
    disposeObject(object);
    loaded++;
  },
  undefined,
  reportFailure,
);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enablePan = false;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 1.5;
const stats = new Stats();
document.body.appendChild(stats.dom);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failure && loaded === 3) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  disposeObject(scene);
  for (const material of materials) material.dispose();
  reflection.dispose();
  refraction.dispose();
  pointLight.dispose();
  stats.dom.remove();
  renderer.dispose();
});
