import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { MTLLoader } from "ek3d/addons/loaders/MTLLoader";
import type { MaterialCreator } from "ek3d/addons/loaders/MTLLoader";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import type { Material } from "ek3d/materials/Material";
import type { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing OBJ loader canvas");
const canvas: HTMLCanvasElement = canvasSel;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.z = 2.5;
const scene = new Scene();
scene.add(new AmbientLight(0xffffff));
camera.add(new PointLight(0xffffff, 15));
scene.add(camera);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 5;
let disposed = false;
let frames = 0;
let object: Group | undefined;
let materials: MaterialCreator | undefined;
const manager = new LoadingManager();
canvas.dataset.state = "loading";
manager.onError = (url) => fail(new Error(`Failed to load ${url}`));
manager.onLoad = () => {
  if (!disposed && object && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
};

function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

function release(): void {
  const owned = new Set<Material>();
  const textures = new Set<Texture>();
  object?.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) owned.add(material);
  });
  if (materials) for (const material of Object.values(materials.materials)) owned.add(material);
  for (const material of owned) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  if (object) scene.remove(object);
  object = undefined;
  materials = undefined;
}

async function load(): Promise<void> {
  try {
    const path = "/examples/models/obj/male02/";
    const creator = await new MTLLoader(manager).setPath(path).loadAsync("male02.mtl");
    if (disposed) return;
    materials = creator;
    materials.preload();
    const model = await new OBJLoader(manager).setPath(path).setMaterials(creator).loadAsync("male02.obj");
    object = model;
    if (disposed) {
      release();
      return;
    }
    model.position.y = -0.95;
    model.scale.setScalar(0.01);
    scene.add(model);
    if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  } catch (error) {
    fail(error);
  }
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  release();
  manager.abort();
  renderer.dispose();
});
void load();
