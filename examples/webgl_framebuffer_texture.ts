import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferUsage } from "ek3d/constants";
import { BufferAttribute, Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Line } from "ek3d/objects/Line";
import { Sprite } from "ek3d/objects/Sprite";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { FramebufferTexture } from "ek3d/textures/FramebufferTexture";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
const selection = document.querySelector<HTMLDivElement>("#selection");
if (!canvasSel || !selection) throw new Error("Missing framebuffer texture elements");
const canvas: HTMLCanvasElement = canvasSel;
const dpr = window.devicePixelRatio;
const textureSize = 128 * dpr;
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 20;
const cameraOrtho = new OrthographicCamera(
  -window.innerWidth / 2,
  window.innerWidth / 2,
  window.innerHeight / 2,
  -window.innerHeight / 2,
  1,
  10,
);
cameraOrtho.position.z = 10;
const scene = new Scene();
const sceneOrtho = new Scene();
let fractal = "A";
for (let i = 0; i < 4; i++) {
  let output = "";
  for (const char of fractal)
    output += char === "A" ? "A+BF++BF-FA--FAFA-BF+" : char === "B" ? "-FA+BFBF++BF+FA--FA-B" : char;
  fractal = output;
}
const points = [0, 0, 0];
let x = 0,
  y = 0,
  angle = 0;
for (const char of fractal) {
  if (char === "+") angle += Math.PI / 3;
  else if (char === "-") angle -= Math.PI / 3;
  else if (char === "F") {
    x += 8 * Math.cos(angle);
    y -= 8 * Math.sin(angle);
    points.push(x, y, 0);
  }
}
const geometry = new BufferGeometry();
const positions = new Float32BufferAttribute(points, 3);
geometry.setAttribute("position", positions);
geometry.center();
const colors = new BufferAttribute(new Float32Array(positions.array.length), 3);
colors.setUsage(BufferUsage.DynamicDraw);
geometry.setAttribute("color", colors);
const line = new Line(geometry, new LineBasicMaterial({ vertexColors: true }));
line.scale.setScalar(0.05);
scene.add(line);
const texture = new FramebufferTexture(textureSize, textureSize);
const sprite = new Sprite(new SpriteMaterial({ map: texture }));
sprite.scale.set(textureSize, textureSize, 1);
sceneOrtho.add(sprite);
function updateSpritePosition(): void {
  sprite.position.set(-window.innerWidth / 2 + textureSize / 2, window.innerHeight / 2 - textureSize / 2, 1);
}
updateSpritePosition();
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
const controls = new OrbitControls(camera, selection);
controls.enablePan = false;
function resize(): void {
  const width = window.innerWidth,
    height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  cameraOrtho.left = -width / 2;
  cameraOrtho.right = width / 2;
  cameraOrtho.top = height / 2;
  cameraOrtho.bottom = -height / 2;
  cameraOrtho.updateProjectionMatrix();
  renderer.setSize(width, height);
  updateSpritePosition();
}
window.addEventListener("resize", resize);
const vector = new Vector2();
const color = new Color();
let offset = 0;
renderer.setAnimationLoop(() => {
  for (let i = 0; i < colors.count; i++) {
    color.setHSL(((offset + i) % colors.count) / colors.count, 1, 0.5);
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  colors.needsUpdate = true;
  offset -= 25;
  renderer.clear();
  renderer.render(scene, camera);
  vector.set((window.innerWidth * dpr) / 2 - textureSize / 2, (window.innerHeight * dpr) / 2 - textureSize / 2);
  renderer.copyFramebufferToTexture(texture, vector);
  renderer.clearDepth();
  renderer.render(sceneOrtho, cameraOrtho);
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  disposeObject(scene);
  disposeObject(sceneOrtho);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
