import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Fog } from "ek3d/scenes/Fog";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { DoubleSide } from "ek3d/constants";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing uint canvas");
const camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500);
camera.position.z = 2750;
const scene = new Scene();
scene.background = new Color(0x050505);
scene.fog = new Fog(0x050505, 2000, 3500);
scene.add(new AmbientLight(0xcccccc));
const light1 = new DirectionalLight(0xffffff, 1.5);
light1.position.set(1, 1, 1);
scene.add(light1);
const light2 = new DirectionalLight(0xffffff, 4.5);
light2.position.set(0, -1, 0);
scene.add(light2);
const triangles = 500000;
const positions = new Float32Array(triangles * 9);
const normals = new Int16Array(triangles * 9);
const colors = new Uint8Array(triangles * 9);
const color = new Color();
const a = new Vector3(),
  b = new Vector3(),
  c = new Vector3();
const cb = new Vector3(),
  ab = new Vector3();
for (let i = 0; i < triangles; i++) {
  const x = Math.random() * 800 - 400;
  const y = Math.random() * 800 - 400;
  const z = Math.random() * 800 - 400;
  a.set(x + Math.random() * 12 - 6, y + Math.random() * 12 - 6, z + Math.random() * 12 - 6);
  b.set(x + Math.random() * 12 - 6, y + Math.random() * 12 - 6, z + Math.random() * 12 - 6);
  c.set(x + Math.random() * 12 - 6, y + Math.random() * 12 - 6, z + Math.random() * 12 - 6);
  const offset = i * 9;
  positions[offset] = a.x;
  positions[offset + 1] = a.y;
  positions[offset + 2] = a.z;
  positions[offset + 3] = b.x;
  positions[offset + 4] = b.y;
  positions[offset + 5] = b.z;
  positions[offset + 6] = c.x;
  positions[offset + 7] = c.y;
  positions[offset + 8] = c.z;
  cb.subVectors(c, b).cross(ab.subVectors(a, b)).normalize();
  color.setRGB(x / 800 + 0.5, y / 800 + 0.5, z / 800 + 0.5);
  for (let j = 0; j < 3; j++) {
    const index = offset + j * 3;
    normals[index] = cb.x * 32767;
    normals[index + 1] = cb.y * 32767;
    normals[index + 2] = cb.z * 32767;
    colors[index] = color.r * 255;
    colors[index + 1] = color.g * 255;
    colors[index + 2] = color.b * 255;
  }
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setAttribute("normal", new BufferAttribute(normals, 3, true));
geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
geometry.computeBoundingSphere();
const material = new MeshPhongMaterial({
  color: 0xd5d5d5,
  specular: 0xffffff,
  shininess: 250,
  side: DoubleSide,
  vertexColors: true,
});
const mesh = new Mesh(geometry, material);
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
let frames = 0,
  disposed = false;
renderer.setAnimationLoop(() => {
  const time = Date.now() * 0.001;
  mesh.rotation.x = time * 0.25;
  mesh.rotation.y = time * 0.5;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
