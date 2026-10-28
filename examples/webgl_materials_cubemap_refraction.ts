import { Stats } from "ek3d/addons/libs/Stats";
import { PLYLoader } from "ek3d/addons/loaders/PLYLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Mapping } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing refraction canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100000);
camera.position.z = -4000;
const scene = new Scene();
scene.add(new AmbientLight(0xffffff, 3.5));
const manager = new LoadingManager();
let disposed = false;
let failure = false;
let loaded = 0;
let frames = 0;
let mouseX = 0;
let mouseY = 0;
let halfX = window.innerWidth / 2;
let halfY = window.innerHeight / 2;
canvas.dataset.state = "loading";
function reportFailure(cause: unknown): void {
  if (disposed) return;
  failure = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
const urls = ["px", "nx", "py", "ny", "pz", "nz"].map((face) => `/examples/textures/cube/Park3Med/${face}.jpg`);
const cube = new CubeTextureLoader(manager).load(
  urls,
  () => {
    if (!disposed) loaded++;
  },
  undefined,
  reportFailure,
);
cube.mapping = Mapping.CubeRefraction;
scene.background = cube;
const materials = [
  new MeshPhongMaterial({ color: 0xffffff, envMap: cube, refractionRatio: 0.98 }),
  new MeshPhongMaterial({ color: 0xccfffd, envMap: cube, refractionRatio: 0.985 }),
  new MeshPhongMaterial({ color: 0xccddff, envMap: cube, refractionRatio: 0.98, reflectivity: 0.9 }),
];
new PLYLoader(manager).load(
  "/examples/models/ply/binary/Lucy100k.ply",
  (geometry) => {
    if (disposed) {
      geometry.dispose();
      return;
    }
    geometry.computeVertexNormals();
    materials.forEach((material, index) => {
      const mesh = new Mesh(geometry, material);
      mesh.scale.setScalar(1.5);
      mesh.position.x = index === 1 ? -1500 : index === 2 ? 1500 : 0;
      scene.add(mesh);
    });
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
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
renderer.setAnimationLoop(() => {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failure && loaded === 2) canvas.dataset.state = "rendered";
});
function resize(): void {
  halfX = window.innerWidth / 2;
  halfY = window.innerHeight / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function onMove(event: MouseEvent): void {
  mouseX = (event.clientX - halfX) * 4;
  mouseY = (event.clientY - halfY) * 4;
}
document.addEventListener("mousemove", onMove);
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  document.removeEventListener("mousemove", onMove);
  renderer.setAnimationLoop(null);
  manager.abort();
  disposeObject(scene);
  for (const material of materials) material.dispose();
  cube.dispose();
  stats.dom.remove();
  renderer.dispose();
});
