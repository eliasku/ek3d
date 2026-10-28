import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { frameCorners } from "ek3d/addons/utils/CameraUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping } from "ek3d/constants";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing portal canvas");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.localClippingEnabled = true;
renderer.toneMapping = ACESFilmicToneMapping;
const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.set(0, 75, 160);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 40, 0);
controls.maxDistance = 400;
controls.minDistance = 10;
controls.update();
const planeGeo = new PlaneGeometry(100.1, 100.1);
const sphereGeometry = new IcosahedronGeometry(5, 0);
const sphereMaterial = new MeshPhongMaterial({
  color: 0xffffff,
  emissive: 0x333333,
  flatShading: true,
  clippingPlanes: [new Plane(new Vector3(0, 0, 1), 0)],
  clipShadows: true,
});
const spheres = [new Mesh(sphereGeometry, sphereMaterial), new Mesh(sphereGeometry, sphereMaterial)];
scene.add(...spheres);
const portalCamera = new PerspectiveCamera(45, 1, 0.1, 500);
scene.add(portalCamera);
const targets = [new WebGLRenderTarget(256, 256), new WebGLRenderTarget(256, 256)];
const portals = targets.map((target, i) => {
  const mesh = new Mesh(planeGeo, new MeshBasicMaterial({ map: target.texture }));
  mesh.position.set(i === 0 ? -30 : 30, 20, 0);
  mesh.scale.set(0.35, 0.35, 0.35);
  scene.add(mesh);
  return mesh;
});
function wall(color: number, x: number, y: number, z: number, rx: number, ry: number): void {
  const mesh = new Mesh(planeGeo, new MeshPhongMaterial({ color }));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, 0);
  scene.add(mesh);
}
wall(0xffffff, 0, 100, 0, Math.PI / 2, 0);
wall(0xffffff, 0, 0, 0, -Math.PI / 2, 0);
wall(0x7f7fff, 0, 50, 50, 0, Math.PI);
wall(0xff7fff, 0, 50, -50, 0, 0);
wall(0x00ff00, 50, 50, 0, 0, -Math.PI / 2);
wall(0xff0000, -50, 50, 0, 0, Math.PI / 2);
for (const [color, intensity, distance, x, y, z] of [
  [0xe7e7e7, 2.5, 250, 0, 60, 0],
  [0x00ff00, 0.5, 1000, 550, 50, 0],
  [0xff0000, 0.5, 1000, -550, 50, 0],
  [0xbbbbfe, 0.5, 1000, 0, 50, 550],
]) {
  const light = new PointLight(color, intensity, distance, 0);
  light.position.set(x, y, z);
  scene.add(light);
}
const reflected = new Vector3(),
  bl = new Vector3(),
  br = new Vector3(),
  tl = new Vector3();
function renderPortal(index: number): void {
  const current = portals[index],
    other = portals[1 - index],
    target = targets[index];
  current.worldToLocal(reflected.copy(camera.position));
  reflected.x *= -1;
  reflected.z *= -1;
  other.localToWorld(reflected);
  portalCamera.position.copy(reflected);
  other.localToWorld(bl.set(50.05, -50.05, 0));
  other.localToWorld(br.set(-50.05, -50.05, 0));
  other.localToWorld(tl.set(50.05, 50.05, 0));
  frameCorners(portalCamera, bl, br, tl);
  target.texture.colorSpace = renderer.outputColorSpace;
  renderer.setRenderTarget(target);
  renderer.state.buffers.depth.setMask(true);
  if (!renderer.autoClear) renderer.clear();
  current.visible = false;
  renderer.render(scene, portalCamera);
  current.visible = true;
}
let frames = 0;
renderer.setAnimationLoop(() => {
  spheres.forEach((sphere, i) => {
    const t = Date.now() * 0.01 + i * Math.PI * 10;
    sphere.position.set(Math.cos(t * 0.1) * 30, Math.abs(Math.cos(t * 0.2)) * 20 + 5, Math.sin(t * 0.1) * 30);
    sphere.rotation.y = Math.PI / 2 - t * 0.1;
    sphere.rotation.z = t * 0.8;
  });
  const target = renderer.getRenderTarget();
  renderPortal(0);
  renderPortal(1);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  disposeObject(scene);
  targets.forEach((target) => target.dispose());
  renderer.dispose();
});
