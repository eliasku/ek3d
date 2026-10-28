import { FlyControls } from "ek3d/addons/controls/FlyControls";
import { Lensflare, LensflareElement } from "ek3d/addons/objects/Lensflare";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing lensflares canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  failed = false,
  loaded = 0,
  frames = 0;
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 15000);
camera.position.z = 250;
const scene = new Scene();
scene.background = new Color().setHSL(0.51, 0.4, 0.01, SRGBColorSpace);
scene.fog = new Fog(scene.background, 3500, 15000);
const geometry = new BoxGeometry(250, 250, 250);
const material = new MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 50 });
for (let i = 0; i < 3000; i++) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(8000 * (2 * Math.random() - 1), 8000 * (2 * Math.random() - 1), 8000 * (2 * Math.random() - 1));
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
}
const directional = new DirectionalLight(0xffffff, 0.15);
directional.position.set(0, -1, 0).normalize();
directional.color.setHSL(0.1, 0.7, 0.5);
scene.add(directional);
const loader = new TextureLoader();
function fail(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
function loadedTexture(): void {
  if (!disposed) loaded++;
}
const flare0 = loader.load(
  "/examples/textures/lensflare/lensflare0.png",
  (texture) => {
    if (disposed) texture.dispose();
    else loadedTexture();
  },
  undefined,
  fail,
);
const flare3 = loader.load(
  "/examples/textures/lensflare/lensflare3.png",
  (texture) => {
    if (disposed) texture.dispose();
    else loadedTexture();
  },
  undefined,
  fail,
);
const flares: Lensflare[] = [];
function addLight(h: number, s: number, l: number, x: number, y: number, z: number): void {
  const light = new PointLight(0xffffff, 1.5, 2000, 0);
  light.color.setHSL(h, s, l);
  light.position.set(x, y, z);
  scene.add(light);
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(flare0, 700, 0, light.color));
  flare.addElement(new LensflareElement(flare3, 60, 0.6));
  flare.addElement(new LensflareElement(flare3, 70, 0.7));
  flare.addElement(new LensflareElement(flare3, 120, 0.9));
  flare.addElement(new LensflareElement(flare3, 70, 1));
  light.add(flare);
  flares.push(flare);
}
addLight(0.55, 0.9, 0.5, 5000, 0, -1000);
addLight(0.08, 0.8, 0.5, 0, 0, -1000);
addLight(0.995, 0.5, 0.9, 5000, 5000, -1000);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new FlyControls(camera, canvas);
controls.movementSpeed = 2500;
controls.rollSpeed = Math.PI / 6;
controls.autoForward = false;
controls.dragToLook = false;
const timer = new Timer();
timer.connect(document);
renderer.setAnimationLoop(() => {
  timer.update();
  controls.update(timer.getDelta());
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (!failed && loaded === 2) canvas.dataset.state = "rendered";
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
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  timer.dispose();
  for (const flare of flares) flare.dispose();
  Lensflare.Geometry.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
