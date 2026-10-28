import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing billboards canvas");
const canvas = selected;
let disposed = false,
  loaded = false,
  frames = 0,
  mouseX = 0,
  mouseY = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(55, innerWidth / innerHeight, 2, 2000);
camera.position.z = 1000;
const scene = new Scene();
scene.fog = new FogExp2(0x000000, 0.001);
const vertices: number[] = [];
for (let i = 0; i < 10000; i++)
  vertices.push(2000 * Math.random() - 1000, 2000 * Math.random() - 1000, 2000 * Math.random() - 1000);
const geometry = new BufferGeometry();
geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
const sprite = new TextureLoader().load(
  "/examples/textures/sprites/disc.png",
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
sprite.colorSpace = SRGBColorSpace;
const material = new PointsMaterial({
  size: 35,
  sizeAttenuation: true,
  map: sprite,
  alphaTest: 0.5,
  transparent: true,
});
material.color.setHSL(1, 0.3, 0.7, SRGBColorSpace);
scene.add(new Points(geometry, material));
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, shaders: { PointsMaterial: pointsShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
gui.add(material, "sizeAttenuation").onChange(() => {
  material.needsUpdate = true;
});
gui.open();
function pointer(event: PointerEvent): void {
  if (!event.isPrimary) return;
  mouseX = event.clientX - innerWidth / 2;
  mouseY = event.clientY - innerHeight / 2;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.00005;
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  material.color.setHSL(((360 * (1 + time)) % 360) / 360, 0.5, 0.5);
  renderer.render(scene, camera);
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  stats.update();
}
document.body.style.touchAction = "none";
document.body.addEventListener("pointermove", pointer);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.body.removeEventListener("pointermove", pointer);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  sprite.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
