import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { BufferGeometryLoader } from "ek3d/loaders/BufferGeometryLoader";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { GLBufferAttribute } from "ek3d/core/GLBufferAttribute";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Group } from "ek3d/objects/Group";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { mergeGeometries } from "ek3d/addons/utils/BufferGeometryUtils";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100);
camera.position.z = 30;
const scene = new Scene();
scene.background = new Color(0xffffff);
const content = new Group();
scene.add(content);
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { MeshNormalMaterial: normalShader } });
renderer.setPixelRatio(window.devicePixelRatio);
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const methods = { INSTANCED: "INSTANCED", MERGED: "MERGED", NAIVE: "NAIVE" };
const api = { method: methods.INSTANCED, count: 1000 };
gui.add(api, "method", methods).onChange(initMesh);
gui.add(api, "count", 1, 10000).step(1).onChange(initMesh);
const performanceFolder = gui.addFolder("Performance");
const display = document.createElement("div");
display.style.cssText = "padding:8px;white-space:pre-line";
performanceFolder.$children.appendChild(display);
performanceFolder.open();
const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
function randomizeMatrix(matrix: Matrix4): void {
  position.set(Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * 40 - 20);
  quaternion.random();
  scale.setScalar(Math.random());
  matrix.compose(position, quaternion, scale);
}
function byteLength(geometry: BufferGeometry): number {
  let bytes = geometry.index?.array.byteLength ?? 0;
  for (const attribute of Object.values(geometry.attributes)) {
    if (attribute instanceof GLBufferAttribute) throw new Error("Comparison requires CPU geometry attributes");
    bytes += attribute.array.byteLength;
  }
  return bytes;
}
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 bytes";
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(2)} ${["bytes", "KB", "MB", "GB"][index]}`;
}
let request = 0;
function initMesh(): void {
  const current = ++request;
  disposeObject(content);
  for (const object of content.children) if (object instanceof InstancedMesh) object.dispose();
  content.clear();
  canvas.dataset.state = "loading";
  new BufferGeometryLoader().load(
    "/examples/models/json/suzanne_buffergeometry.json",
    (geometry) => {
      if (disposed || current !== request) {
        geometry.dispose();
        return;
      }
      const material = new MeshNormalMaterial();
      geometry.computeVertexNormals();
      const matrix = new Matrix4();
      const label = api.method + " (build)";
      console.time(label);
      let bytes = byteLength(geometry);
      if (api.method === methods.INSTANCED) {
        const mesh = new InstancedMesh(geometry, material, api.count);
        for (let i = 0; i < api.count; i++) {
          randomizeMatrix(matrix);
          mesh.setMatrixAt(i, matrix);
        }
        content.add(mesh);
        bytes += api.count * 16 * Float32Array.BYTES_PER_ELEMENT;
      } else if (api.method === methods.MERGED) {
        const geometries: BufferGeometry[] = [];
        for (let i = 0; i < api.count; i++) {
          randomizeMatrix(matrix);
          geometries.push(geometry.clone().applyMatrix4(matrix));
        }
        const merged = mergeGeometries(geometries);
        for (const item of geometries) item.dispose();
        geometry.dispose();
        if (merged === null) {
          material.dispose();
          throw new Error("Could not merge comparison geometries");
        }
        content.add(new Mesh(merged, material));
        bytes = byteLength(merged);
      } else {
        for (let i = 0; i < api.count; i++) {
          randomizeMatrix(matrix);
          const mesh = new Mesh(geometry, material);
          mesh.applyMatrix4(matrix);
          content.add(mesh);
        }
      }
      console.timeEnd(label);
      display.textContent = `GPU draw calls: ${api.method === methods.NAIVE ? api.count : 1}
GPU memory: ${formatBytes(bytes)}`;
      canvas.dataset.method = api.method;
      canvas.dataset.count = String(api.count);
      canvas.dataset.state = "ready";
    },
    undefined,
    (cause: unknown) => {
      if (disposed || current !== request) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(cause);
      console.error(cause);
    },
  );
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
  controls.update();
  renderer.render(scene, camera);
  stats.update();
  if (content.children.length > 0) {
    canvas.dataset.state = "rendered";
    canvas.dataset.frames = String(++frames);
  }
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(content);
  for (const object of content.children) if (object instanceof InstancedMesh) object.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
