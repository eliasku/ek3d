import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const container = document.querySelector<HTMLDivElement>("#wrapper");
const slider = document.querySelector<HTMLDivElement>("#slider");
if (!canvas || !container || !slider) throw new Error("Missing scene comparison elements");
const sceneL = new Scene();
sceneL.background = new Color(0xbcd48f);
const sceneR = new Scene();
sceneR.background = new Color(0x8fbcd4);
const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 6;
const controls = new OrbitControls(camera, container);
const light = new HemisphereLight(0xffffff, 0x444444, 3);
light.position.set(-2, 2, 2);
sceneL.add(light.clone());
sceneR.add(light.clone());
const geometry = new IcosahedronGeometry(1, 3);
sceneL.add(new Mesh(geometry, new MeshStandardMaterial()));
sceneR.add(new Mesh(geometry, new MeshStandardMaterial({ wireframe: true })));
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
let sliderPos = innerWidth / 2;
let pointerId: number | null = null;
function pointerDown(event: PointerEvent): void {
  if (!event.isPrimary) return;
  event.stopPropagation();
  pointerId = event.pointerId;
  controls.enabled = false;
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);
}
function pointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return;
  sliderPos = Math.max(0, Math.min(innerWidth, event.clientX));
  slider!.style.left = `${sliderPos - slider!.offsetWidth / 2}px`;
}
function pointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  controls.enabled = true;
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  window.removeEventListener("pointercancel", pointerUp);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  sliderPos = Math.min(sliderPos, innerWidth);
  slider!.style.left = `${sliderPos - slider!.offsetWidth / 2}px`;
}
function animate(): void {
  renderer.setScissor(0, 0, sliderPos, innerHeight);
  renderer.render(sceneL, camera);
  renderer.setScissor(sliderPos, 0, innerWidth, innerHeight);
  renderer.render(sceneR, camera);
}
slider.addEventListener("pointerdown", pointerDown);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  slider.removeEventListener("pointerdown", pointerDown);
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  window.removeEventListener("pointercancel", pointerUp);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  const group = new Group();
  group.add(sceneL, sceneR);
  disposeObject(group);
  renderer.dispose();
});
