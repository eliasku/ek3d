import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import type { Object3D } from "ek3d/core/Object3D";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf anisotropy example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.set(-0.35, -0.2, 0.35);

const scene = new Scene();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

let environment: DataTexture | null = null;
let model: Object3D | null = null;
let loaded = false;
let disposed = false;
let frames = 0;

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.target.set(0, -0.08, 0.11);
controls.minDistance = 0.1;
controls.maxDistance = 2;
controls.addEventListener("change", render);
controls.update();

init().catch(function (error: unknown) {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  const hdrLoader = new UltraHDRLoader().setPath("/examples/textures/equirectangular/");
  const gltfLoader = new GLTFLoader().setPath("/examples/models/gltf/");

  const [texture, gltf] = await Promise.all([
    hdrLoader.loadAsync("royal_esplanade_2k.hdr.jpg"),
    gltfLoader.loadAsync("AnisotropyBarnLamp.glb"),
  ]);

  // A response arriving after pagehide must not resurrect disposed renderer state.
  if (disposed) {
    texture.dispose();
    disposeObject(gltf.scene);
    return;
  }

  environment = texture;
  texture.mapping = EquirectangularReflectionMapping;

  scene.background = texture;
  scene.backgroundBlurriness = 0.5;
  scene.environment = texture;

  model = gltf.scene;
  scene.add(model);
  loaded = true;

  render();
}

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
  environment?.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
