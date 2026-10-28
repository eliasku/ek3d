import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { VOXLoader } from "ek3d/addons/loaders/VOXLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import type { Object3D } from "ek3d/core/Object3D";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing VOX loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.set(0.175, 0.075, 0.175);

const scene = new Scene();
scene.add(camera);

const hemiLight = new HemisphereLight(0xcccccc, 0x444444, 3);
scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 2.5);
dirLight.position.set(1.5, 3, 2.5);
scene.add(dirLight);

const dirLight2 = new DirectionalLight(0xffffff, 1.5);
dirLight2.position.set(-1.5, -3, -2.5);
scene.add(dirLight2);

// MeshStandardMaterial declares a dfgLUT uniform, so the renderer needs its lookup texture.
const dfgLUT = createDFGLUT();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0.1;
controls.maxDistance = 0.5;

renderer.setAnimationLoop(animate);

let model: Object3D | undefined;
let disposed = false;
let frames = 0;
let error: unknown = null;

function release(object: Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
  });
  scene.remove(object);
}

canvas.dataset.state = "loading";
new VOXLoader().load(
  "/examples/models/vox/monu10.vox",
  (result) => {
    const mesh = result?.scene?.children[0];
    if (mesh === undefined) {
      if (disposed) return;
      error = new Error("VOX file has no scene graph");
      canvas.dataset.state = "error";
      canvas.dataset.error = "VOX file has no scene graph";
      return;
    }

    if (disposed) {
      release(mesh);
      return;
    }

    mesh.position.y = 0;
    mesh.scale.setScalar(0.0015);
    model = mesh;
    scene.add(mesh);
  },
  undefined,
  (reason) => {
    if (disposed) return;
    error = reason;
    canvas.dataset.state = "error";
    canvas.dataset.error = reason instanceof Error ? reason.message : String(reason);
    console.error(reason);
  },
);

function animate(): void {
  controls.update();

  renderer.render(scene, camera);

  frames++;
  canvas.dataset.frames = String(frames);
  if (error !== null) return;
  if (model !== undefined) canvas.dataset.state = "rendered";
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  if (model !== undefined) release(model);
  dirLight.dispose();
  dirLight2.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
