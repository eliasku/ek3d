import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ThreeMFLoader } from "ek3d/addons/loaders/3MFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import type { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { loadZipRuntime } from "./zip-runtime";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing 3MF example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0x333333);
scene.add(new AmbientLight(0xffffff, 0.6));
const light = new DirectionalLight(0xffffff, 2);
light.position.set(-1, -2.5, 1);
scene.add(light);
const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 500);
camera.up.set(0, 0, 1);
camera.position.set(-100, -250, 100);
scene.add(camera);
const dfg = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  getDFGLUT: () => dfg,
  ltcTextures,
  shaders: { MeshPhongMaterial: phongShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 50;
controls.maxDistance = 400;
controls.enablePan = false;
controls.update();
const params = { asset: "cube_gears" };
const assets = [
  "cube_gears",
  "facecolors",
  "multipletextures",
  "pyramid",
  "spinal implant",
  "variable voronoi",
  "vertexcolors",
];
const gui = new GUI();
let model: Group | undefined;
let manager: LoadingManager | undefined;
let disposed = false;
let sequence = 0;
let frames = 0;
let failure: string | null = null;
canvas.dataset.state = "loading";
let pending = true;

function release(object: Group): void {
  disposeObject(object);
  scene.remove(object);
}
function reportFailure(error: unknown, request: number): void {
  if (disposed || request !== sequence) return;
  failure = error instanceof Error ? error.message : String(error);
  canvas.dataset.error = failure;
  canvas.dataset.state = "error";
  console.error(error);
}
async function loadAsset(asset: string): Promise<void> {
  const request = ++sequence;
  manager?.abort();
  failure = null;
  canvas.dataset.state = "loading";
  pending = true;
  delete canvas.dataset.error;
  try {
    const runtime = await loadZipRuntime();
    if (disposed || request !== sequence) return;
    const current = new LoadingManager(undefined, undefined, (url) => reportFailure(`Failed to load ${url}`, request));
    manager = current;
    new ThreeMFLoader(current).setZipRuntime(runtime).load(
      `/examples/models/3mf/${asset}.3mf`,
      (object) => {
        if (disposed || request !== sequence) {
          release(object);
          return;
        }
        if (model !== undefined) release(model);
        model = object;
        const center = new Box3().setFromObject(object).getCenter(new Vector3());
        object.position.sub(center);
        pending = false;
        controls.reset();
        scene.add(object);
      },
      undefined,
      (error) => reportFailure(error, request),
    );
  } catch (error) {
    reportFailure(error, request);
  }
}
gui.add(params, "asset", assets).onChange((value: unknown) => {
  if (typeof value === "string") void loadAsset(value);
});
void loadAsset(params.asset);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.asset = params.asset;
  if (failure !== null) canvas.dataset.state = "error";
  else if (!pending && model !== undefined) canvas.dataset.state = "rendered";
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
  sequence++;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager?.abort();
  controls.dispose();
  gui.destroy();
  if (model !== undefined) release(model);
  light.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltcTextures)) texture.dispose();
  renderer.dispose();
});
