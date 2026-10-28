import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { BatchedMesh, type BatchedMeshDrawRange } from "ek3d/objects/BatchedMesh";
import { Group } from "ek3d/objects/Group";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { Euler } from "ek3d/math/Euler";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { Vector4 } from "ek3d/math/Vector4";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { radixSort, type RadixSortOptions } from "ek3d/addons/utils/SortUtils";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100);
camera.position.z = 30;
const scene = new Scene();
scene.background = new Color(0xffffff);
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshPhongMaterial: phongShader } });
renderer.setPixelRatio(window.devicePixelRatio);
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
controls.autoRotateSpeed = 1;
const light = new DirectionalLight(0xffffff, 2);
light.position.set(1, 1, 1);
scene.add(light, new AmbientLight(0xffffff, 2));
const stats = new Stats();
document.body.appendChild(stats.dom);
const geometries = [new ConeGeometry(1, 2), new BoxGeometry(2, 2, 2), new SphereGeometry(1, 16, 8)];
for (const geometry of geometries) {
  const attribute = new BufferAttribute(new Float32Array(geometry.getAttribute("position")!.count * 3).fill(1), 3);
  geometry.setAttribute("color", attribute);
}
const api = {
  method: "BATCHED",
  count: 256,
  dynamic: 16,
  transparent: true,
  sortObjects: true,
  perObjectFrustumCulled: true,
  useCustomSort: true,
};
const gui = new GUI();
gui.add(api, "count", 1, 20000).step(1).onChange(initMesh);
gui.add(api, "dynamic", 0, 20000).step(1);
gui.add(api, "method", { BATCHED: "BATCHED", NAIVE: "NAIVE" }).onChange(initMesh);
gui.add(api, "transparent").onChange(() => {
  for (const material of materials) {
    material.transparent = api.transparent;
    material.depthWrite = !api.transparent;
    material.needsUpdate = true;
  }
});
gui.add(api, "sortObjects");
gui.add(api, "perObjectFrustumCulled");
gui.add(api, "useCustomSort");
const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Euler();
const quaternion = new Quaternion();
const scale = new Vector3();
const color = new Color();
const colorWithAlpha = new Vector4();
let mesh: Group | BatchedMesh;
const ids: number[] = [];
const speeds: Matrix4[] = [];
const regular: { mesh: Mesh; speed: Euler }[] = [];
const materials: MeshPhongMaterial[] = [];
const sortOptions: RadixSortOptions<BatchedMeshDrawRange> & { get(value: BatchedMeshDrawRange): number } = {
  get: (item) => item.z,
  aux: [],
};
function sortFunction(this: BatchedMesh, list: BatchedMeshDrawRange[]): void {
  let min = Infinity;
  let max = -Infinity;
  for (const item of list) {
    min = Math.min(min, item.z);
    max = Math.max(max, item.z);
  }
  const factor = max > min ? 0xffffffff / (max - min) : 0;
  for (const item of list) item.z = (item.z - min) * factor;
  sortOptions.reversed = api.transparent;
  radixSort(list, sortOptions);
}
function randomizeMatrix(target: Matrix4): Matrix4 {
  position.set(Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * 40 - 20);
  rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  quaternion.setFromEuler(rotation);
  scale.setScalar(0.5 + Math.random() * 0.5);
  return target.compose(position, quaternion, scale);
}
function randomizeSpeed(): Euler {
  return new Euler(Math.random() * 0.01, Math.random() * 0.01, Math.random() * 0.01);
}
function createMaterial(): MeshPhongMaterial {
  const material = new MeshPhongMaterial({
    vertexColors: true,
    transparent: api.transparent,
    depthWrite: !api.transparent,
  });
  materials.push(material);
  return material;
}
function cleanup(): void {
  if (mesh !== undefined) {
    mesh.removeFromParent();
    if (mesh instanceof BatchedMesh) mesh.dispose();
  }
  for (const material of materials) material.dispose();
  materials.length = ids.length = speeds.length = regular.length = 0;
}
function initMesh(): void {
  cleanup();
  if (api.method === "BATCHED") {
    const batch = new BatchedMesh(api.count, geometries.length * 512, geometries.length * 1024, createMaterial());
    batch.frustumCulled = false;
    const geometryIds = geometries.map((geometry) => batch.addGeometry(geometry));
    for (let i = 0; i < api.count; i++) {
      color.setHSL(Math.random() * 0.5, 0.6, 0.5);
      colorWithAlpha.set(color.r, color.g, color.b, Math.random() > 0.8 ? 0.5 : 1);
      const id = batch.addInstance(geometryIds[i % geometries.length]!);
      batch.setMatrixAt(id, randomizeMatrix(matrix));
      batch.setColorAt(id, colorWithAlpha);
      ids.push(id);
      speeds.push(new Matrix4().makeRotationFromEuler(randomizeSpeed()));
    }
    mesh = batch;
  } else {
    mesh = new Group();
    for (let i = 0; i < api.count; i++) {
      const material = createMaterial();
      material.color.setHSL(Math.random() * 0.5, 0.6, 0.5);
      material.opacity = Math.random() > 0.8 ? 0.5 : 1;
      const child = new Mesh(geometries[i % geometries.length]!, material);
      randomizeMatrix(child.matrix).decompose(child.position, child.quaternion, child.scale);
      regular.push({ mesh: child, speed: randomizeSpeed() });
      mesh.add(child);
    }
  }
  scene.add(mesh);
  canvas.dataset.method = api.method;
  canvas.dataset.count = String(api.count);
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
initMesh();
renderer.setAnimationLoop(() => {
  const count = Math.min(api.count, api.dynamic);
  if (mesh instanceof BatchedMesh) {
    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(ids[i]!, matrix);
      mesh.setMatrixAt(ids[i]!, matrix.multiply(speeds[i]!));
    }
    mesh.sortObjects = api.sortObjects;
    mesh.perObjectFrustumCulled = api.perObjectFrustumCulled;
    mesh.setCustomSort(api.useCustomSort ? sortFunction : null);
  } else {
    for (let i = 0; i < count; i++) {
      const item = regular[i]!;
      item.mesh.rotation.x += item.speed.x;
      item.mesh.rotation.y += item.speed.y;
      item.mesh.rotation.z += item.speed.z;
    }
  }
  controls.update();
  stats.update();
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  cleanup();
  for (const geometry of geometries) geometry.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
