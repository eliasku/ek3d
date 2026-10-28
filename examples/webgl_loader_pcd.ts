import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PCDLoader } from "ek3d/addons/loaders/PCDLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import type { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing PCD loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { PointsMaterial: pointsShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();

const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 40);
camera.position.set(0, 0, 1);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
controls.minDistance = 0.5;
controls.maxDistance = 10;

const assets = [
  "ascii/simple.pcd",
  "binary/Zaghetto.pcd",
  "binary/Zaghetto_8bit.pcd",
  "binary_compressed/pcl_logo.pcd",
];
const loader = new PCDLoader();

let points: Points | undefined;
let gui: GUI | undefined;
let disposed = false;
let request = 0;
let frames = 0;

loadPointCloud("binary/Zaghetto.pcd");
render();

function release(object: Points): void {
  object.geometry.dispose();
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
  scene.remove(object);
}

function loadPointCloud(file: string): void {
  const current = ++request;
  if (gui) gui.destroy();
  gui = undefined;
  if (points) release(points);
  points = undefined;
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  loader.load(
    `/examples/models/pcd/${file}`,
    (object) => {
      if (disposed || current !== request) {
        release(object);
        return;
      }

      object.geometry.center();
      object.geometry.rotateX(Math.PI);
      object.name = file;
      scene.add(object);
      points = object;

      const material = object.material;
      if (!(material instanceof PointsMaterial)) throw new Error("PCD loader returned a non-points material");

      gui = new GUI();
      gui.add(material, "size", 0.001, 0.01).onChange(render);
      // lil-gui mutates the nested Color in place; a wrapper keeps the target an index-typed record.
      gui.addColor({ color: material.color }, "color").onChange(render);
      gui
        .add(object, "name", assets)
        .name("type")
        .onChange((value) => loadPointCloud(String(value)));
      gui.open();

      canvas.dataset.asset = file;
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
  if (gui) gui.destroy();
  if (points) release(points);
  renderer.dispose();
});
