import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Rhino3dmLoader } from "ek3d/addons/loaders/3DMLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

interface Layer {
  name: string;
  visible: boolean;
}

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing Rhino 3DM example canvas");
const canvas: HTMLCanvasElement = selected;
const spinner = document.querySelector<HTMLElement>("#loader");
const scene = new Scene();
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 1, 1000);
camera.up.set(0, 0, 1);
camera.position.set(26, -40, 5);
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    LineBasicMaterial: basicShader,
    PointsMaterial: pointsShader,
    SpriteMaterial: spriteShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const light = new DirectionalLight(0xffffff, 6);
light.position.set(0, 0, 2);
scene.add(light);
const controls = new OrbitControls(camera, canvas);
const manager = new LoadingManager();
const loader = new Rhino3dmLoader(manager).setLibraryPath("/examples/libs/rhino3dm/");
let model: Object3D | undefined;
let gui: GUI | undefined;
let disposed = false;
let frames = 0;
canvas.dataset.state = "loading";
loader.load(
  "/examples/models/3dm/Rhino_Logo.3dm",
  (object) => {
    if (disposed) {
      disposeObject(object);
      return;
    }
    model = object;
    scene.add(object);
    const layers = object.userData.layers as Layer[];
    gui = new GUI({ title: "layers" });
    layers.forEach((layer, index) => {
      gui
        ?.add(layer, "visible")
        .name(layer.name)
        .onChange((value: unknown) => {
          object.traverse((child) => {
            const attributes = child.userData.attributes as { layerIndex?: number } | undefined;
            if (attributes?.layerIndex === index) child.visible = Boolean(value);
          });
        });
    });
    if (spinner !== null) spinner.hidden = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    if (spinner !== null) spinner.hidden = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error("Failed to load Rhino model", error);
  },
);
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
  loader.dispose();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui?.destroy();
  if (model !== undefined) disposeObject(model);
  dfgLUT.dispose();
  renderer.dispose();
});
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (model !== undefined && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
