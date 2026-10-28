import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { NRRDLoader } from "ek3d/addons/loaders/NRRDLoader";
import type { NRRDGzipDecoder } from "ek3d/addons/loaders/NRRDLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing NRRD example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1e10);
camera.position.z = 300;
scene.add(camera);
const hemiLight = new HemisphereLight(0xffffff, 0x000000, 3);
const dirLight = new DirectionalLight(0xffffff, 1.5);
dirLight.position.set(200, 200, 200);
scene.add(hemiLight, dirLight);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new TrackballControls(camera, canvas);
controls.minDistance = 100;
controls.maxDistance = 500;
controls.rotateSpeed = 5;
controls.zoomSpeed = 5;
controls.panSpeed = 2;
const gui = new GUI();
const stats = new Stats();
document.body.appendChild(stats.dom);
const objects = new Group();
scene.add(objects);
const manager = new LoadingManager();
let disposed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";

function reportFailure(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function loadVolume(): Promise<void> {
  try {
    const response = await fetch("/examples/libs/fflate.module.js");
    if (!response.ok) throw new Error(`Unable to load fflate: HTTP ${response.status}`);
    const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
    let runtime: unknown;
    try {
      // Vite cannot statically import publicDir vendor assets.
      runtime = await import(/* @vite-ignore */ url);
    } finally {
      URL.revokeObjectURL(url);
    }
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      !("gunzipSync" in runtime) ||
      typeof runtime.gunzipSync !== "function"
    ) {
      throw new Error("fflate runtime must export gunzipSync");
    }
    if (disposed) return;
    new NRRDLoader(manager, runtime as NRRDGzipDecoder).load(
      "/examples/models/nrrd/I.nrrd",
      (volume) => {
        if (disposed) return;
        try {
          const cube = new Mesh(
            new BoxGeometry(volume.xLength, volume.yLength, volume.zLength),
            new MeshBasicMaterial({ color: 0x00ff00 }),
          );
          cube.visible = false;
          objects.add(cube);
          const box = new BoxHelper(cube);
          box.applyMatrix4(volume.matrix);
          objects.add(box);

          const sliceZ = volume.extractSlice("z", Math.floor(volume.RASDimensions[2] / 4));
          objects.add(sliceZ.mesh);
          const sliceY = volume.extractSlice("y", Math.floor(volume.RASDimensions[1] / 2));
          objects.add(sliceY.mesh);
          const sliceX = volume.extractSlice("x", Math.floor(volume.RASDimensions[0] / 2));
          objects.add(sliceX.mesh);
          gui
            .add(sliceX, "index", 0, volume.RASDimensions[0], 1)
            .name("indexX")
            .onChange(() => sliceX.repaint());
          gui
            .add(sliceY, "index", 0, volume.RASDimensions[1], 1)
            .name("indexY")
            .onChange(() => sliceY.repaint());
          gui
            .add(sliceZ, "index", 0, volume.RASDimensions[2], 1)
            .name("indexZ")
            .onChange(() => sliceZ.repaint());
          gui
            .add(volume, "lowerThreshold", volume.min, volume.max, 1)
            .name("Lower Threshold")
            .onChange(() => volume.repaintAllSlices());
          gui
            .add(volume, "upperThreshold", volume.min, volume.max, 1)
            .name("Upper Threshold")
            .onChange(() => volume.repaintAllSlices());
          gui
            .add(volume, "windowLow", volume.min, volume.max, 1)
            .name("Window Low")
            .onChange(() => volume.repaintAllSlices());
          gui
            .add(volume, "windowHigh", volume.min, volume.max, 1)
            .name("Window High")
            .onChange(() => volume.repaintAllSlices());
          loaded = true;
        } catch (error) {
          reportFailure(error);
        }
      },
      undefined,
      reportFailure,
    );
  } catch (error) {
    reportFailure(error);
  }
}
void loadVolume();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
  stats.update();
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  gui.destroy();
  disposeObject(objects);
  stats.dom.remove();
  hemiLight.dispose();
  dirLight.dispose();
  renderer.dispose();
});
