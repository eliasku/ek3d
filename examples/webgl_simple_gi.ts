import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, BufferUsage } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing GI canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 4;
const scene = new Scene();
const geometry = new TorusKnotGeometry(0.75, 0.3, 128, 32, 1);
const torus = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true }));
scene.add(torus);
const roomMaterials = Array.from(
  { length: 8 },
  () => new MeshBasicMaterial({ color: Math.random() * 0xffffff, side: Side.Back }),
);
scene.add(new Mesh(new BoxGeometry(3, 3, 3), roomMaterials));
const renderer = new WebGLRenderer({ canvas, shaders: { MeshBasicMaterial: basicShader } });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 10;
scene.updateMatrixWorld(true);
let clone = scene.clone();
clone.matrixWorldAutoUpdate = false;
// The GI snapshot must not share the writable torus geometry.
let cloneTorus = clone.children[0] as Mesh;
cloneTorus.geometry = geometry.clone();
const target = new WebGLRenderTarget(32, 32);
const position = new Vector3(),
  normal = new Vector3(),
  normalMatrix = new Matrix3();
const giCamera = new PerspectiveCamera(90, 1, 0.01, 100);
const buffer = new Uint8Array(32 * 32 * 4);
const positionAttribute = geometry.getAttribute("position");
const normalAttribute = geometry.getAttribute("normal");
if (!(positionAttribute instanceof BufferAttribute) || !(normalAttribute instanceof BufferAttribute))
  throw new Error("Missing torus attributes");
const positions: BufferAttribute = positionAttribute;
const normals: BufferAttribute = normalAttribute;
const colors = new BufferAttribute(new Float32Array(positions.count * 3), 3).setUsage(BufferUsage.DynamicDraw);
geometry.setAttribute("color", colors);
let vertex = 0,
  bounces = 0,
  frame = 0,
  computeFrame = 0;
function compute(): void {
  if (bounces === 3) return;
  const start = vertex;
  for (let i = 0; i < 32 && vertex < positions.count; i++, vertex++) {
    position.fromBufferAttribute(positions, vertex).applyMatrix4(torus.matrixWorld);
    normal
      .fromBufferAttribute(normals, vertex)
      .applyMatrix3(normalMatrix.getNormalMatrix(torus.matrixWorld))
      .normalize();
    giCamera.position.copy(position);
    giCamera.lookAt(position.add(normal));
    renderer.setRenderTarget(target);
    renderer.render(clone, giCamera);
    renderer.readRenderTargetPixels(target, 0, 0, 32, 32, buffer);
    let r = 0,
      g = 0,
      b = 0;
    for (let k = 0; k < buffer.length; k += 4) {
      r += buffer[k];
      g += buffer[k + 1];
      b += buffer[k + 2];
    }
    colors.setXYZ(vertex, r / (1024 * 255), g / (1024 * 255), b / (1024 * 255));
  }
  colors.addUpdateRange(start * 3, (vertex - start) * 3);
  colors.needsUpdate = true;
  if (vertex >= positions.count) {
    cloneTorus.geometry.dispose();
    clone = scene.clone();
    clone.matrixWorldAutoUpdate = false;
    cloneTorus = clone.children[0] as Mesh;
    cloneTorus.geometry = geometry.clone();
    vertex = 0;
    bounces++;
  }
  computeFrame = requestAnimationFrame(compute);
}
computeFrame = requestAnimationFrame(compute);
renderer.setAnimationLoop(() => {
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frame);
  canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  cancelAnimationFrame(computeFrame);
  renderer.setAnimationLoop(null);
  controls.dispose();
  cloneTorus.geometry.dispose();
  target.dispose();
  disposeObject(scene);
  renderer.dispose();
});
