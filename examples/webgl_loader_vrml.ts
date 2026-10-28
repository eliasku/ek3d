import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { VRMLLoader } from "ek3d/addons/loaders/VRMLLoader";
import type { ChevrotainRuntime } from "ek3d/addons/loaders/vrml-parser";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing VRML example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1e10);
camera.position.set(-10, 5, 10);
scene.add(camera, new AmbientLight(0xffffff, 1.2));
const light = new DirectionalLight(0xffffff, 2);
light.position.set(200, 200, 200);
scene.add(light);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: {
    MeshPhongMaterial: phongShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    PointsMaterial: pointsShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 200;
controls.enableDamping = true;
const assets = [
  "creaseAngle",
  "crystal",
  "house",
  "elevationGrid1",
  "elevationGrid2",
  "extrusion1",
  "extrusion2",
  "extrusion3",
  "lines",
  "linesTransparent",
  "meshWithLines",
  "meshWithTexture",
  "pixelTexture",
  "points",
  "camera",
  "multilineString",
];
const settings = { asset: "house" };
const gui = new GUI();
gui.add(settings, "asset", assets).onChange(loadAsset);
let disposed = false,
  request = 0,
  frames = 0;
let model: Scene | undefined;
let manager: LoadingManager | undefined;
let runtime: ChevrotainRuntime | undefined;
function reportFailure(error: unknown, current: number): void {
  if (disposed || current !== request) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
function clear(): void {
  if (model !== undefined) {
    scene.remove(model);
    disposeObject(model);
    model = undefined;
  }
}
async function loadAsset(): Promise<void> {
  const current = ++request;
  manager?.abort();
  clear();
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  try {
    if (runtime === undefined) {
      const response = await fetch("/examples/libs/chevrotain.module.min.js");
      if (!response.ok) throw new Error(`Unable to load Chevrotain: HTTP ${response.status}`);
      const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
      let imported: unknown;
      try {
        // Public vendor resources must be imported through a runtime Blob URL in Vite dev.
        imported = await import(/* @vite-ignore */ url);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (typeof imported !== "object" || imported === null || !("default" in imported))
        throw new Error("Invalid Chevrotain module");
      const api = imported.default;
      if (
        typeof api !== "object" ||
        api === null ||
        !("createToken" in api) ||
        typeof api.createToken !== "function" ||
        !("Lexer" in api) ||
        typeof api.Lexer !== "function" ||
        !("CstParser" in api) ||
        typeof api.CstParser !== "function"
      )
        throw new Error("Invalid Chevrotain runtime");
      runtime = api as ChevrotainRuntime;
    }
    if (disposed || current !== request) return;
    const asset = settings.asset;
    manager = new LoadingManager(undefined, undefined, (url) => reportFailure(`Failed to load ${url}`, current));
    new VRMLLoader(runtime, manager).load(
      `/examples/models/vrml/${asset}.wrl`,
      (object) => {
        if (disposed || current !== request) {
          disposeObject(object);
          return;
        }
        model = object;
        scene.add(object);
        controls.reset();
        canvas.dataset.asset = asset;
        if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
      },
      undefined,
      (error) => reportFailure(error, current),
    );
  } catch (error) {
    reportFailure(error, current);
  }
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  request++;
  manager?.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  clear();
  light.dispose();
  renderer.dispose();
});
void loadAsset();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
