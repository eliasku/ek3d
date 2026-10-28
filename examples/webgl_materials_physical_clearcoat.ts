import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { HDRCubeTextureLoader } from "ek3d/addons/loaders/HDRCubeTextureLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { Group } from "ek3d/objects/Group";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing clearcoat canvas");
const canvas = selected;
const camera = new PerspectiveCamera(27, innerWidth / innerHeight, 0.25, 50);
camera.position.z = 10;
const scene = new Scene();
const group = new Group();
scene.add(group);
const particleLight = new Mesh(new SphereGeometry(0.05, 8, 8), new MeshBasicMaterial({ color: 0xffffff }));
particleLight.add(new PointLight(0xffffff, 30));
scene.add(particleLight);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshPhysicalMaterial: physicalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 3;
controls.maxDistance = 30;
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
let disposed = false;
let failed = false;
let frames = 0;
canvas.dataset.state = "loading";
manager.onLoad = () => {
  if (!disposed && !failed) canvas.dataset.state = "rendered";
};
function error(cause: unknown): void {
  if (!disposed) {
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(cause);
    console.error(cause);
  }
}
const env = new HDRCubeTextureLoader(manager).setPath("/examples/textures/cube/pisaHDR/").load(
  ["px.hdr", "nx.hdr", "py.hdr", "ny.hdr", "pz.hdr", "nz.hdr"],
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    scene.background = texture;
    scene.environment = texture;
  },
  undefined,
  error,
);
const loader = new TextureLoader(manager);
function load(path: string) {
  return loader.load(
    path,
    (texture) => {
      if (disposed) texture.dispose();
    },
    undefined,
    error,
  );
}
const diffuse = load("/examples/textures/carbon/Carbon.png");
diffuse.colorSpace = SRGBColorSpace;
diffuse.wrapS = diffuse.wrapT = RepeatWrapping;
diffuse.repeat.set(10, 10);
const normal = load("/examples/textures/carbon/Carbon_Normal.png");
normal.wrapS = normal.wrapT = RepeatWrapping;
normal.repeat.set(10, 10);
const water = load("/examples/textures/water/Water_1_M_Normal.jpg");
const golf = load("/examples/textures/golfball.jpg");
const clearcoat = load("/examples/textures/pbr/Scratched_gold/Scratched_gold_01_1K_Normal.png");
const flakesCanvas = document.createElement("canvas");
flakesCanvas.width = flakesCanvas.height = 512;
const context = flakesCanvas.getContext("2d");
if (!context) throw new Error("Unable to create flakes texture");
context.fillStyle = "rgb(127,127,255)";
context.fillRect(0, 0, 512, 512);
for (let i = 0; i < 4000; i++) {
  const x = Math.random() * 512,
    y = Math.random() * 512,
    radius = Math.random() * 3 + 3;
  let nx = Math.random() * 2 - 1,
    ny = Math.random() * 2 - 1,
    nz = 1.5;
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  nx /= length;
  ny /= length;
  nz /= length;
  context.fillStyle = `rgb(${nx * 127 + 127},${ny * 127 + 127},${nz * 255})`;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}
const flakes = new CanvasTexture(flakesCanvas);
flakes.wrapS = flakes.wrapT = RepeatWrapping;
flakes.repeat.set(10, 6);
flakes.anisotropy = 16;
const geometry = new SphereGeometry(0.8, 64, 32);
const materials = [
  new MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    metalness: 0.9,
    roughness: 0.5,
    color: 0x0000ff,
    normalMap: flakes,
    normalScale: new Vector2(0.15, 0.15),
  }),
  new MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.1, map: diffuse, normalMap: normal }),
  new MeshPhysicalMaterial({
    metalness: 0,
    roughness: 0.1,
    clearcoat: 1,
    normalMap: golf,
    clearcoatNormalMap: clearcoat,
    clearcoatNormalScale: new Vector2(2, -2),
  }),
  new MeshPhysicalMaterial({
    clearcoat: 1,
    metalness: 1,
    color: 0xff0000,
    normalMap: water,
    normalScale: new Vector2(0.15, 0.15),
    clearcoatNormalMap: clearcoat,
    clearcoatNormalScale: new Vector2(2, -2),
  }),
];
for (let i = 0; i < materials.length; i++) {
  const mesh = new Mesh(geometry, materials[i]);
  mesh.position.set(i % 2 ? 1 : -1, i < 2 ? 1 : -1, 0);
  group.add(mesh);
}
renderer.setAnimationLoop(() => {
  const timer = Date.now() * 0.00025;
  particleLight.position.set(Math.sin(timer * 7) * 3, Math.cos(timer * 5) * 4, Math.cos(timer * 3) * 3);
  for (const child of group.children) child.rotation.y += 0.005;
  renderer.render(scene, camera);
  stats.update();
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
  scene.background = null;
  scene.environment = null;
  disposeObject(scene);
  env.dispose();
  dfg.dispose();
  stats.dom.remove();
  renderer.dispose();
});
