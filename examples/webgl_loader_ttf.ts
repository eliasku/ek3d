import { Font } from "ek3d/addons/loaders/FontLoader";
import { TTFLoader } from "ek3d/addons/loaders/TTFLoader";
import type { TTFParser } from "ek3d/addons/loaders/TTFLoader";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing TTF example canvas");
const canvas: HTMLCanvasElement = selected;
const parser = (window as Window & { opentype?: TTFParser }).opentype;
if (!parser) throw new Error("Missing opentype parser");
const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 1500);
camera.position.set(0, 400, 700);
const target = new Vector3(0, 150, 0);
const scene = new Scene();
scene.background = new Color(0);
scene.fog = new Fog(0, 250, 1400);
const light1 = new DirectionalLight(0xffffff, 0.4);
light1.position.set(0, 0, 1).normalize();
scene.add(light1);
const light2 = new DirectionalLight(0xffffff, 2);
light2.position.set(0, 30, 10).normalize();
light2.color.setHSL(Math.random(), 1, 0.5);
scene.add(light2);
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true });
const group = new Group();
group.position.y = 100;
scene.add(group);
const plane = new Mesh<MeshBasicMaterial>(
  new PlaneGeometry(10000, 10000),
  new MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }),
);
plane.position.y = 100;
plane.rotation.x = -Math.PI / 2;
scene.add(plane);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
let text = "three.js";
let font: Font | undefined;
let firstLetter = true;
let disposed = false;
let geometry: TextGeometry | undefined;
let rotation = 0;
let startRotation = 0;
let startX = 0;
canvas.dataset.state = "loading";

function refresh(): void {
  group.clear();
  geometry?.dispose();
  geometry = undefined;
  canvas.dataset.text = text;
  if (!font || !text) return;
  geometry = new TextGeometry(text, {
    font,
    size: 70,
    depth: 20,
    curveSegments: 4,
    bevelThickness: 2,
    bevelSize: 1.5,
    bevelEnabled: true,
  });
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  const offset = -0.5 * (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
  const front = new Mesh(geometry, material);
  front.position.set(offset, 30, 0);
  group.add(front);
  const mirror = new Mesh(geometry, material);
  mirror.position.set(offset, -30, 20);
  mirror.rotation.x = Math.PI;
  group.add(mirror);
}
function onKey(event: KeyboardEvent): void {
  const backspace = event.key === "Backspace";
  const printable = !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1;
  if (!backspace && !printable) return;
  if (firstLetter) {
    firstLetter = false;
    text = "";
  }
  if (backspace) {
    event.preventDefault();
    text = text.slice(0, -1);
  } else text += event.key;
  refresh();
}
function onMove(event: PointerEvent): void {
  if (event.isPrimary) rotation = startRotation + (event.clientX - startX) * 0.02;
}
function onUp(event: PointerEvent): void {
  if (!event.isPrimary) return;
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onUp);
  document.removeEventListener("pointercancel", onUp);
}
function onDown(event: PointerEvent): void {
  if (!event.isPrimary) return;
  startX = event.clientX;
  startRotation = rotation;
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
canvas.style.touchAction = "none";
canvas.addEventListener("pointerdown", onDown);
document.addEventListener("keydown", onKey);
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  document.removeEventListener("keydown", onKey);
  canvas.removeEventListener("pointerdown", onDown);
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", onUp);
  document.removeEventListener("pointercancel", onUp);
  geometry?.dispose();
  material.dispose();
  plane.geometry.dispose();
  plane.material.dispose();
  renderer.dispose();
});
new TTFLoader(parser).load(
  "/examples/fonts/ttf/kenpixel.ttf",
  (data) => {
    if (disposed) return;
    font = new Font(data);
    refresh();
    canvas.dataset.state = "loaded";
  },
  undefined,
  (cause) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = cause instanceof Error ? cause.message : String(cause);
    console.error(cause);
  },
);
renderer.setAnimationLoop(() => {
  group.rotation.y += (rotation - group.rotation.y) * 0.05;
  camera.lookAt(target);
  renderer.clear();
  renderer.render(scene, camera);
  if (font) canvas.dataset.state = "rendered";
});
