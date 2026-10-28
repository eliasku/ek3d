import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { InterleavedBuffer } from "ek3d/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { ColorSpace } from "ek3d/constants";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing interleaved instancing canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 1000);
const scene = new Scene();
scene.background = new Color(0x101010);
const geometry = new InstancedBufferGeometry();
const vertices = new InterleavedBuffer(
  new Float32Array([
    -1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, -1, -1, 1, 0, 0, 1, 0, 0, 1, -1, 1, 0, 1, 1, 0, 0, 1, 1, -1, 0, 1,
    0, 0, 0, -1, 1, -1, 0, 0, 0, 0, 0, 1, -1, -1, 0, 1, 1, 0, 0, -1, -1, -1, 0, 0, 1, 0, 0, -1, 1, -1, 0, 1, 1, 0, 0,
    -1, 1, 1, 0, 1, 0, 0, 0, -1, -1, -1, 0, 0, 1, 0, 0, -1, -1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, -1, 0,
    1, 1, 0, 0, 1, -1, 1, 0, 0, 0, 0, 0, 1, -1, -1, 0, 0, 1, 0, 0, -1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, -1,
    1, -1, 0, 0, 1, 0, 0, 1, 1, -1, 0, 1, 1, 0, 0, 1, -1, 1, 0, 1, 0, 0, 0, -1, -1, 1, 0, 0, 0, 0, 0, 1, -1, -1, 0, 1,
    1, 0, 0, -1, -1, -1, 0, 0, 1, 0, 0,
  ]),
  8,
);
geometry.setAttribute("position", new InterleavedBufferAttribute(vertices, 3, 0));
geometry.setAttribute("uv", new InterleavedBufferAttribute(vertices, 2, 4));
geometry.setIndex(
  new BufferAttribute(
    new Uint16Array([
      0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5, 8, 10, 9, 10, 11, 9, 12, 14, 13, 14, 15, 13, 16, 17, 18, 18, 17, 19, 20, 21,
      22, 22, 21, 23,
    ]),
    1,
  ),
);
const texture = new TextureLoader().load(
  "/examples/textures/crate.gif",
  (map) => {
    if (disposed) map.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
texture.colorSpace = ColorSpace.SRGB;
texture.flipY = false;
const material = new MeshBasicMaterial({ map: texture });
const instances = 5000;
const mesh = new InstancedMesh(geometry, material, instances);
const matrix = new Matrix4();
const offset = new Vector3();
const orientation = new Quaternion();
const scale = new Vector3(1, 1, 1);
for (let i = 0; i < instances; i++) {
  const x = Math.random() * 100 - 50;
  const y = Math.random() * 100 - 50;
  const z = Math.random() * 100 - 50;
  offset.set(x, y, z).normalize().multiplyScalar(5);
  offset.set(x + offset.x, y + offset.y, z + offset.z);
  orientation
    .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
    .normalize();
  matrix.compose(offset, orientation, scale);
  mesh.setMatrixAt(i, matrix);
}
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const moveQ = new Quaternion(0.5, 0.5, 0.5, 0).normalize();
const tmpQ = new Quaternion();
const tmpM = new Matrix4();
const currentM = new Matrix4();
let lastTime = 0;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const time = performance.now();
  mesh.rotation.y = time * 0.00005;
  const delta = (time - lastTime) / 5000;
  tmpQ.set(moveQ.x * delta, moveQ.y * delta, moveQ.z * delta, 1).normalize();
  tmpM.makeRotationFromQuaternion(tmpQ);
  for (let i = 0; i < instances; i++) {
    mesh.getMatrixAt(i, currentM);
    currentM.multiply(tmpM);
    mesh.setMatrixAt(i, currentM);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  lastTime = time;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  mesh.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
