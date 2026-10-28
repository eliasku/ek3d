import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { clamp, degToRad } from "ek3d/math/MathUtils";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing panorama canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(75, innerWidth / innerHeight, 1, 1100);
const scene = new Scene();
let disposed = false,
  loaded = false,
  frames = 0;
let interacting = false,
  downX = 0,
  downY = 0,
  lon = 0,
  downLon = 0,
  lat = 0,
  downLat = 0;
canvas.dataset.state = "loading";
canvas.style.touchAction = "none";
const geometry = new SphereGeometry(500, 60, 40);
geometry.scale(-1, 1, 1);
const texture = new TextureLoader().load(
  "/examples/textures/2294472375_24a3b8ef46_o.jpg",
  (value) => {
    if (disposed) value.dispose();
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
texture.colorSpace = SRGBColorSpace;
scene.add(new Mesh(geometry, new MeshBasicMaterial({ map: texture })));
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function pointerDown(event: PointerEvent): void {
  if (!event.isPrimary) return;
  interacting = true;
  downX = event.clientX;
  downY = event.clientY;
  downLon = lon;
  downLat = lat;
  document.addEventListener("pointermove", pointerMove);
  document.addEventListener("pointerup", pointerUp);
  document.addEventListener("pointercancel", pointerUp);
}
function pointerMove(event: PointerEvent): void {
  if (!event.isPrimary) return;
  lon = (downX - event.clientX) * 0.1 + downLon;
  lat = (event.clientY - downY) * 0.1 + downLat;
}
function pointerUp(event: PointerEvent): void {
  if (!event.isPrimary) return;
  interacting = false;
  removeDragListeners();
}
function removeDragListeners(): void {
  document.removeEventListener("pointermove", pointerMove);
  document.removeEventListener("pointerup", pointerUp);
  document.removeEventListener("pointercancel", pointerUp);
}
function wheel(event: WheelEvent): void {
  camera.fov = clamp(camera.fov + event.deltaY * 0.05, 10, 75);
  camera.updateProjectionMatrix();
}
canvas.addEventListener("pointerdown", pointerDown);
document.addEventListener("wheel", wheel);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  if (!interacting) lon += 0.1;
  lat = clamp(lat, -85, 85);
  const phi = degToRad(90 - lat),
    theta = degToRad(lon);
  camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointerdown", pointerDown);
  document.removeEventListener("wheel", wheel);
  removeDragListeners();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
