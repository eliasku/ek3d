import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Raycaster } from "ek3d/core/Raycaster";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasElement === null) throw new Error("Missing interactive buffergeometry canvas");
const canvas: HTMLCanvasElement = canvasElement;
const camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 3500);
camera.position.z = 2750;
const scene = new Scene();
scene.background = new Color(0x050505);
scene.fog = new Fog(0x050505, 2000, 3500);
scene.add(new AmbientLight(0x444444, 3));
const light1 = new DirectionalLight(0xffffff, 1.5);
light1.position.set(1, 1, 1);
scene.add(light1);
const light2 = new DirectionalLight(0xffffff, 4.5);
light2.position.set(0, -1, 0);
scene.add(light2);

const positions = new Float32Array(5000 * 9);
const normals = new Float32Array(positions.length);
const colors = new Float32Array(positions.length);
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const cb = new Vector3();
const ab = new Vector3();
const color = new Color();
for (let i = 0; i < positions.length; i += 9) {
  const x = Math.random() * 800 - 400;
  const y = Math.random() * 800 - 400;
  const z = Math.random() * 800 - 400;
  a.set(x + Math.random() * 120 - 60, y + Math.random() * 120 - 60, z + Math.random() * 120 - 60);
  b.set(x + Math.random() * 120 - 60, y + Math.random() * 120 - 60, z + Math.random() * 120 - 60);
  c.set(x + Math.random() * 120 - 60, y + Math.random() * 120 - 60, z + Math.random() * 120 - 60);
  cb.subVectors(c, b).cross(ab.subVectors(a, b)).normalize();
  color.setRGB(x / 800 + 0.5, y / 800 + 0.5, z / 800 + 0.5);
  positions.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], i);
  for (let j = 0; j < 9; j += 3) {
    normals.set([cb.x, cb.y, cb.z], i + j);
    colors.set([color.r, color.g, color.b], i + j);
  }
}
const geometry = new BufferGeometry();
const meshPositions = new BufferAttribute(positions, 3);
geometry.setAttribute("position", meshPositions);
geometry.setAttribute("normal", new BufferAttribute(normals, 3));
geometry.setAttribute("color", new BufferAttribute(colors, 3));
geometry.computeBoundingSphere();
const mesh = new Mesh(
  geometry,
  new MeshPhongMaterial({
    color: 0xaaaaaa,
    specular: 0xffffff,
    shininess: 250,
    side: Side.Double,
    vertexColors: true,
  }),
);
scene.add(mesh);
const lineGeometry = new BufferGeometry();
const linePositions = new BufferAttribute(new Float32Array(12), 3);
lineGeometry.setAttribute("position", linePositions);
const line = new Line(lineGeometry, new LineBasicMaterial({ color: 0xffffff, transparent: true }));
scene.add(line);
const raycaster = new Raycaster();
const pointer = new Vector2();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let frames = 0;
let disposed = false;
function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
function animate(): void {
  const time = Date.now() * 0.001;
  mesh.rotation.x = time * 0.15;
  mesh.rotation.y = time * 0.25;
  raycaster.setFromCamera(pointer, camera);
  const face = raycaster.intersectObject(mesh)[0]?.face;
  if (face) {
    linePositions.copyAt(0, meshPositions, face.a);
    linePositions.copyAt(1, meshPositions, face.b);
    linePositions.copyAt(2, meshPositions, face.c);
    linePositions.copyAt(3, meshPositions, face.a);
    mesh.updateMatrix();
    lineGeometry.applyMatrix4(mesh.matrix);
    line.visible = true;
  } else {
    line.visible = false;
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
}
window.addEventListener("resize", onResize);
document.addEventListener("pointermove", onPointerMove);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onResize);
  document.removeEventListener("pointermove", onPointerMove);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
