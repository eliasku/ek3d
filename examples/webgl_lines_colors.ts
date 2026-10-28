import { hilbert3D } from "ek3d/addons/utils/GeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing colored lines canvas");
const canvas = selected;
const camera = new PerspectiveCamera(33, innerWidth / innerHeight, 1, 10000);
camera.position.z = 1000;
const scene = new Scene();
const hilbert = hilbert3D(new Vector3(), 200, 1);
const spline = new CatmullRomCurve3(hilbert);
const color = new Color();
const material = new LineBasicMaterial({ color: 0xffffff, vertexColors: true });
const lines: Line[] = [];
for (let row = 0; row < 2; row++) {
  const vertices: number[] = [];
  const colors: number[][] = [[], [], []];
  const count = row === 0 ? hilbert.length * 6 : hilbert.length;
  for (let i = 0; i < count; i++) {
    const point = row === 0 ? spline.getPoint(i / count) : hilbert[i];
    vertices.push(point.x, point.y, point.z);
    if (row === 0) {
      color.setHSL(0.6, 1, Math.max(0, -point.x / 200) + 0.5, SRGBColorSpace);
      colors[0].push(color.r, color.g, color.b);
      color.setHSL(0.9, 1, Math.max(0, -point.y / 200) + 0.5, SRGBColorSpace);
    } else {
      color.setHSL(0.6, 1, Math.max(0, (200 - point.x) / 400) * 0.5 + 0.5, SRGBColorSpace);
      colors[0].push(color.r, color.g, color.b);
      color.setHSL(0.3, 1, Math.max(0, (200 + point.x) / 400) * 0.5, SRGBColorSpace);
    }
    colors[1].push(color.r, color.g, color.b);
    color.setHSL(i / count, 1, 0.5, SRGBColorSpace);
    colors[2].push(color.r, color.g, color.b);
  }
  for (let column = 0; column < 3; column++) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors[column], 3));
    const line = new Line(geometry, material);
    line.scale.setScalar(0.45);
    line.position.set((column - 1) * 225, row === 0 ? -112.5 : 112.5, 0);
    scene.add(line);
    lines.push(line);
  }
}
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
let mouseX = 0,
  mouseY = 0,
  frames = 0,
  disposed = false;
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
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY + 200 - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  const time = Date.now() * 0.0005;
  lines.forEach((line, i) => {
    line.rotation.y = time * (i % 2 ? 1 : -1);
  });
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
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
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
