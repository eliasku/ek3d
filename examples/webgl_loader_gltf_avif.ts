import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Color } from "ek3d/math/Color";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { Object3D } from "ek3d/core/Object3D";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf avif example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.5, 4, 9);

const scene = new Scene();
scene.background = new Color(0xf6eedc);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

let model: Object3D | null = null;
let disposed = false;
let loaded = false;
let frames = 0;

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.addEventListener("change", render);
controls.target.set(0, 2, 0);
controls.update();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.setPath("/examples/models/gltf/AVIFTest/");

loader.load(
  "forest_house.glb",
  (gltf) => {
    // A response arriving after pagehide must not resurrect disposed renderer state.
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }

    model = gltf.scene;
    scene.add(model);
    loaded = true;

    render();
  },
  undefined,
  function (error: unknown) {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

render();

function render(): void {
  if (disposed) return;

  renderer.render(scene, camera);

  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  controls.removeEventListener("change", render);
  controls.dispose();
  if (model !== null) disposeObject(model);
  dracoLoader.dispose();
  renderer.dispose();
});
