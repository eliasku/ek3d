import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GCodeLoader } from "ek3d/addons/loaders/GCodeLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Material } from "ek3d/materials/Material";
import type { Group } from "ek3d/objects/Group";
import { LineSegments } from "ek3d/objects/LineSegments";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing GCode loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 0, 70);
const scene = new Scene();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 100;
controls.addEventListener("change", render);
const loader = new GCodeLoader();
let model: Group | undefined;
let disposed = false;
let request = 0;
let frames = 0;
const params = { asset: "benchy" };
const gui = new GUI();
gui.add(params, "asset", ["benchy", "test_m82", "test_m83"]).onChange(() => loadAsset(params.asset));
gui.open();
loadAsset(params.asset);
render();

function release(object: Group): void {
  const materials = new Set<Material>();
  object.traverse((child) => {
    if (!(child instanceof LineSegments)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
  scene.remove(object);
}

function loadAsset(asset: string): void {
  const current = ++request;
  if (model) release(model);
  model = undefined;
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  loader.load(
    `/examples/models/gcode/${asset}.gcode`,
    (object) => {
      if (disposed || current !== request) {
        release(object);
        return;
      }
      model = object;
      if (asset === "benchy") model.position.set(-100, -20, 100);
      scene.add(model);
      controls.reset();
      canvas.dataset.asset = asset;
      render();
      canvas.dataset.state = "rendered";
    },
    undefined,
    (error) => {
      if (disposed || current !== request) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
  render();
}

function render(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  if (model) release(model);
  renderer.dispose();
});
