import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const drawingCanvas = document.querySelector<HTMLCanvasElement>("#drawing-canvas");
if (!canvas || !drawingCanvas) throw new Error("Missing canvas texture example canvas");
const context = drawingCanvas.getContext("2d");
if (!context) throw new Error("Canvas drawing is not supported");
context.fillStyle = "#fff";
context.fillRect(0, 0, 128, 128);
const texture = new CanvasTexture(drawingCanvas);
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 2000);
camera.position.z = 500;
const mesh = new Mesh(new BoxGeometry(200, 200, 200), new MeshBasicMaterial({ map: texture }));
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
let paint = false;
let x = 0;
let y = 0;
function down(event: PointerEvent): void {
  paint = true;
  x = event.offsetX;
  y = event.offsetY;
}
function move(event: PointerEvent): void {
  if (!paint || !context) return;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(event.offsetX, event.offsetY);
  context.strokeStyle = "#000";
  context.stroke();
  x = event.offsetX;
  y = event.offsetY;
  texture.needsUpdate = true;
}
function stop(): void {
  paint = false;
}
drawingCanvas.addEventListener("pointerdown", down);
drawingCanvas.addEventListener("pointermove", move);
drawingCanvas.addEventListener("pointerup", stop);
drawingCanvas.addEventListener("pointercancel", stop);
drawingCanvas.addEventListener("pointerleave", stop);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let frames = 0;
renderer.setAnimationLoop(() => {
  mesh.rotation.x += 0.01;
  mesh.rotation.y += 0.01;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  drawingCanvas.removeEventListener("pointerdown", down);
  drawingCanvas.removeEventListener("pointermove", move);
  drawingCanvas.removeEventListener("pointerup", stop);
  drawingCanvas.removeEventListener("pointercancel", stop);
  drawingCanvas.removeEventListener("pointerleave", stop);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
