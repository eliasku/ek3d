import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { Mesh } from "ek3d/objects/Mesh";
import { Color } from "ek3d/math/Color";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 200;
const scene = new Scene();
scene.background = new Color(0xffffff);
const renderer = new WebGLRenderer({ canvas, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(window.devicePixelRatio);

function createImage(): HTMLCanvasElement {
  const image = document.createElement("canvas");
  image.width = image.height = 256;
  const context = image.getContext("2d");
  if (context === null) throw new Error("Canvas 2D context unavailable");
  context.fillStyle = `rgb(${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)},${Math.floor(Math.random() * 256)})`;
  context.fillRect(0, 0, 256, 256);
  return image;
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  const geometry = new SphereGeometry(50, Math.random() * 64, Math.random() * 32);
  const texture = new CanvasTexture(createImage());
  const material = new MeshBasicMaterial({ map: texture, wireframe: true });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);
  renderer.render(scene, camera);
  scene.remove(mesh);
  geometry.dispose();
  material.dispose();
  texture.dispose();
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  canvas.dataset.geometries = String(renderer.info.memory.geometries);
  canvas.dataset.textures = String(renderer.info.memory.textures);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
