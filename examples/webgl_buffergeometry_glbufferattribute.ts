import { GL } from "ek3d/GL";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Fog } from "ek3d/scenes/Fog";
import { Color } from "ek3d/math/Color";
import { Sphere } from "ek3d/math/Sphere";
import { Vector3 } from "ek3d/math/Vector3";
import { ColorSpace } from "ek3d/constants";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { GLBufferAttribute } from "ek3d/core/GLBufferAttribute";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing GLBufferAttribute canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
let frames = 0;
let drawCount = 10000;
const particles = 300000;
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, shaders: { PointsMaterial: pointsShader } });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 5, 3500);
camera.position.z = 2750;
const scene = new Scene();
scene.background = new Color(0x050505);
scene.fog = new Fog(0x050505, 2000, 3500);
const positions = new Float32Array(particles * 3);
const positions2 = new Float32Array(particles * 3);
const colors = new Uint8Array(particles * 3);
const color = new Color();
for (let i = 0; i < particles; i++) {
  const x = Math.random() * 1000 - 500;
  const y = Math.random() * 1000 - 500;
  const z = Math.random() * 1000 - 500;
  const j = i * 3;
  positions[j] = x;
  positions[j + 1] = y;
  positions[j + 2] = z;
  positions2[j] = z * 0.3;
  positions2[j + 1] = x * 0.3;
  positions2[j + 2] = y * 0.3;
  color.setRGB(x / 1000 + 0.5, y / 1000 + 0.5, z / 1000 + 0.5, ColorSpace.SRGB);
  const hex = color.getHex(ColorSpace.LinearSRGB);
  colors[j] = (hex >> 16) & 255;
  colors[j + 1] = (hex >> 8) & 255;
  colors[j + 2] = hex & 255;
}
const gl = renderer.getContext();
function upload(data: Float32Array | Uint8Array): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Could not create GPU buffer");
  gl.bindBuffer(GL.ARRAY_BUFFER, buffer);
  gl.bufferData(GL.ARRAY_BUFFER, data, GL.STATIC_DRAW);
  return buffer;
}
const pos = upload(positions);
const pos2 = upload(positions2);
const rgb = upload(colors);
const geometry = new BufferGeometry();
const attr1 = new GLBufferAttribute(pos, GL.FLOAT, 3, 4, particles);
const attr2 = new GLBufferAttribute(pos2, GL.FLOAT, 3, 4, particles);
geometry.setAttribute("position", attr1);
geometry.setAttribute("color", new GLBufferAttribute(rgb, GL.UNSIGNED_BYTE, 3, 1, particles, true));
geometry.boundingSphere = new Sphere().set(new Vector3(), 500);
const points = new Points(geometry, new PointsMaterial({ size: 15, vertexColors: true }));
scene.add(points);
const interval = window.setInterval(() => {
  geometry.setAttribute("position", geometry.getAttribute("position") === attr1 ? attr2 : attr1);
}, 2000);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  drawCount = (Math.max(5000, drawCount) + Math.floor(500 * Math.random())) % particles;
  geometry.setDrawRange(0, drawCount);
  const time = Date.now() * 0.001;
  points.rotation.x = time * 0.1;
  points.rotation.y = time * 0.2;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.clearInterval(interval);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  gl.deleteBuffer(pos);
  gl.deleteBuffer(pos2);
  gl.deleteBuffer(rgb);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
