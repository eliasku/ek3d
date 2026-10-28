import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { USDLoader } from "ek3d/addons/loaders/USDLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";
import type { Group } from "ek3d/objects/Group";
import { disposeObject } from "./dispose-object";
import { loadZipRuntime } from "./zip-runtime";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing USDZ example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.75, -1.5);
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshStandardMaterial: standardShader, MeshPhysicalMaterial: physicalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 2;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 8;
let disposed = false;
let environment: DataTexture | undefined;
let model: Group | undefined;
let frames = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
const manager = new LoadingManager(undefined, undefined, (url) => fail(`Failed to load ${url}`));
new HDRLoader(manager).setPath("/examples/textures/equirectangular/").load(
  "venice_sunset_1k.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = EquirectangularReflectionMapping;
    scene.background = texture;
    scene.backgroundBlurriness = 0.5;
    scene.environment = texture;
  },
  undefined,
  fail,
);
void loadZipRuntime().then((runtime) => {
  if (disposed) return;
  new USDLoader(manager)
    .setZipRuntime(runtime)
    .setPath("/examples/models/usdz/")
    .load(
      "saeukkang.usdz",
      (object) => {
        if (disposed) {
          disposeObject(object);
          return;
        }
        model = object;
        object.position.y = 0.25;
        object.position.z = -0.25;
        scene.add(object);
      },
      undefined,
      fail,
    );
}, fail);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  if (model !== undefined) disposeObject(model);
  environment?.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (model !== undefined && environment !== undefined && canvas.dataset.state !== "error")
    canvas.dataset.state = "rendered";
});
