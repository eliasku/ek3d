import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { Stats } from "ek3d/addons/libs/Stats";
import { ParametricGeometry } from "ek3d/addons/geometries/ParametricGeometry";
import {
  klein as kleinFunction,
  mobius as mobiusFunction,
  plane as planeFunction,
} from "ek3d/addons/geometries/ParametricFunctions";
import { disposeObject } from "./dispose-object";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { LatheGeometry } from "ek3d/geometries/LatheGeometry";
import { OctahedronGeometry } from "ek3d/geometries/OctahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { RingGeometry } from "ek3d/geometries/RingGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing geometries canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 2000);
camera.position.y = 500;
const scene = new Scene();
scene.add(new AmbientLight(0xcccccc, 1.5));
camera.add(new PointLight(0xffffff, 2.5, 0, 0));
scene.add(camera);
const map = new TextureLoader().load(
  "/examples/textures/uv_grid_opengl.jpg",
  (texture) => {
    if (disposed) texture.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
map.wrapS = map.wrapT = RepeatWrapping;
map.anisotropy = 16;
map.colorSpace = SRGBColorSpace;
const material = new MeshPhongMaterial({ map, side: DoubleSide });
const points: Vector2[] = [];
for (let i = 0; i < 50; i++) points.push(new Vector2(Math.sin(i * 0.2) * Math.sin(i * 0.1) * 15 + 50, (i - 5) * 2));
const plane = new ParametricGeometry(planeFunction, 10, 10);
plane.scale(100, 100, 100);
plane.center();
const klein = new ParametricGeometry(kleinFunction, 20, 20);
const mobius = new ParametricGeometry(mobiusFunction, 20, 20);
const geometries = [
  new SphereGeometry(75, 20, 10),
  new IcosahedronGeometry(75),
  new OctahedronGeometry(75),
  new TetrahedronGeometry(75),
  new PlaneGeometry(100, 100, 4, 4),
  new BoxGeometry(100, 100, 100, 4, 4, 4),
  new CircleGeometry(50, 20, 0, Math.PI * 2),
  new RingGeometry(10, 50, 20, 5, 0, Math.PI * 2),
  new CylinderGeometry(25, 75, 100, 40, 5),
  new LatheGeometry(points, 20),
  new TorusGeometry(50, 20, 20, 20),
  new TorusKnotGeometry(50, 10, 50, 20),
  new CapsuleGeometry(20, 50),
  plane,
  klein,
  mobius,
];
const meshes = geometries.map((geometry, i) => {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(-300 + (i % 4) * 200, 0, 300 - Math.floor(i / 4) * 200);
  if (i === 14) mesh.scale.multiplyScalar(5);
  if (i === 15) mesh.scale.multiplyScalar(30);
  scene.add(mesh);
  return mesh;
});
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const timer = Date.now() * 0.0001;
  camera.position.x = Math.cos(timer) * 800;
  camera.position.z = Math.sin(timer) * 800;
  camera.lookAt(scene.position);
  for (const mesh of meshes) {
    mesh.rotation.x = timer * 5;
    mesh.rotation.y = timer * 2.5;
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  stats.dom.remove();
  canvas.dataset.state = "disposed";
});
