import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { TDSLoader } from "ek3d/addons/loaders/TDSLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import type { Group } from "ek3d/objects/Group";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing 3DS loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10);
camera.position.z = 2;

const scene = new Scene();
scene.add(new AmbientLight(0xffffff, 3));

const directionalLight = new DirectionalLight(0xffeedd, 3);
directionalLight.position.set(0, 0, 2);
scene.add(directionalLight);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new TrackballControls(camera, canvas);

renderer.setAnimationLoop(animate);

let model: Group | undefined;
let disposed = false;
let frames = 0;
/** First failure message, or `null` while everything has loaded cleanly. */
let failure: string | null = null;

/** Reports the first failure once; later failures would only repeat the same page state. */
function reportFailure(detail: unknown): void {
  if (disposed || failure !== null) return;
  failure = detail instanceof Error ? detail.message : String(detail);
  canvas.dataset.state = "error";
  canvas.dataset.error = failure;
  console.error(detail);
}

canvas.dataset.state = "loading";

// The model file and its textures share one manager so a missing texture is reported too.
const manager = new LoadingManager(undefined, undefined, (url) => reportFailure(`failed to load ${url}`));

// 3DS files do not store normal maps, so the example supplies one explicitly.
const normal = new TextureLoader(manager).load("/examples/models/3ds/portalgun/textures/normal.jpg");

const loader = new TDSLoader(manager);
loader.setResourcePath("/examples/models/3ds/portalgun/textures/");

/** Releases the geometry, materials and maps a loaded 3DS group owns. */
function release(object: Group): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!(material instanceof MeshPhongMaterial)) continue;
      const maps: Array<Texture | null> = [material.map, material.bumpMap, material.alphaMap, material.specularMap];
      material.dispose();
      for (const map of maps) if (map !== null && map !== normal) map.dispose();
    }
  });
  scene.remove(object);
}

loader.load(
  "/examples/models/3ds/portalgun/portalgun.3ds",
  (object) => {
    if (disposed) {
      release(object);
      return;
    }

    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (!(material instanceof MeshPhongMaterial)) continue;
        material.specular.setScalar(0.1);
        material.normalMap = normal;
      }
    });

    model = object;
    scene.add(object);
  },
  undefined,
  reportFailure,
);

function animate(): void {
  controls.update();

  renderer.render(scene, camera);

  frames++;
  canvas.dataset.frames = String(frames);
  canvas.dataset.models = String(model === undefined ? 0 : model.children.length);
  // A texture may fail after the model arrived, so the error state is reasserted every frame.
  if (failure !== null) canvas.dataset.state = "error";
  else if (model !== undefined) canvas.dataset.state = "rendered";
}

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
  if (model !== undefined) release(model);
  normal.dispose();
  directionalLight.dispose();
  renderer.dispose();
});
