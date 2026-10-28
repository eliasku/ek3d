import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { AMFLoader } from "ek3d/addons/loaders/AMFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import type { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { loadZipRuntime } from "./zip-runtime";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing AMF example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0x999999);
scene.add(new AmbientLight(0x999999));
const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 500);
camera.up.set(0, 0, 1);
camera.position.set(0, -9, 6);
const light = new PointLight(0xffffff, 250);
camera.add(light);
scene.add(camera);
const grid = new GridHelper(50, 50, 0xffffff, 0x555555);
grid.rotateOnAxis(new Vector3(1, 0, 0), Math.PI / 2);
scene.add(grid);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 2);
controls.enableZoom = false;
controls.update();
const manager = new LoadingManager();
let model: Group | undefined;
let disposed = false;
let failure: string | null = null;
let frames = 0;
canvas.dataset.state = "loading";

function release(object: Group): void {
  disposeObject(object);
  scene.remove(object);
}
function reportFailure(error: unknown): void {
  if (disposed || failure !== null) return;
  failure = error instanceof Error ? error.message : String(error);
  canvas.dataset.state = "error";
  canvas.dataset.error = failure;
  console.error(error);
}
void loadZipRuntime()
  .then((runtime) => {
    if (disposed) return;
    new AMFLoader(manager).setZipRuntime(runtime).load(
      "/examples/models/amf/rook.amf",
      (object) => {
        if (disposed) {
          release(object);
          return;
        }
        model = object;
        scene.add(object);
      },
      undefined,
      reportFailure,
    );
  })
  .catch(reportFailure);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.models = String(model === undefined ? 0 : model.children.length);
  if (failure !== null) canvas.dataset.state = "error";
  else if (model !== undefined) canvas.dataset.state = "rendered";
});
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
  manager.abort();
  controls.dispose();
  if (model !== undefined) release(model);
  grid.geometry.dispose();
  grid.material.dispose();
  light.dispose();
  renderer.dispose();
});
