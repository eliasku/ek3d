import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { ToneMapping, Mapping, TextureType } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing UltraHDR texture loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  autoRotate: true,
  metalness: 1.0,
  roughness: 0.0,
  exposure: 1.0,
  resolution: "2k",
  type: "HalfFloatType",
};

const dfgLUT = createDFGLUT();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = params.exposure;

const scene = new Scene();

const torusMaterial = new MeshStandardMaterial({ roughness: params.roughness, metalness: params.metalness });
const torusMesh = new Mesh(new TorusKnotGeometry(1, 0.4, 128, 128, 1, 3), torusMaterial);
scene.add(torusMesh);

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(0.0, 0.0, -6.0);

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);

const loader = new UltraHDRLoader();

let environment: DataTexture | null = null;
let request = 0;
let disposed = false;
let frames = 0;

function loadEnvironment(resolution = "2k", type = "HalfFloatType"): void {
  const current = ++request;

  canvas.dataset.state = "loading";
  delete canvas.dataset.error;

  loader.setDataType(type === "FloatType" ? TextureType.Float : TextureType.HalfFloat);

  loader.load(
    `/examples/textures/equirectangular/spruit_sunrise_${resolution}.hdr.jpg`,
    function (texture: DataTexture) {
      // A response arriving after pagehide or after a newer selection must not be used.
      if (disposed || current !== request) {
        texture.dispose();
        return;
      }

      texture.mapping = Mapping.EquirectangularReflection;
      texture.needsUpdate = true;

      const previous = environment;
      environment = texture;

      scene.background = texture;
      scene.environment = texture;

      // Replace both references before releasing the previous texture.
      previous?.dispose();

      canvas.dataset.resolution = resolution;
      canvas.dataset.type = type;
      canvas.dataset.state = "ready";
      delete canvas.dataset.error;

      render();
    },
    undefined,
    function (error: unknown) {
      if (disposed || current !== request) return;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}

loadEnvironment(params.resolution, params.type);

const gui = new GUI();

gui.add(params, "autoRotate");
gui.add(params, "metalness", 0, 1, 0.01);
gui.add(params, "roughness", 0, 1, 0.01);
gui.add(params, "exposure", 0, 4, 0.01);
gui.add(params, "resolution", ["2k", "4k"]).onChange((value: unknown) => {
  loadEnvironment(String(value), params.type);
});
gui.add(params, "type", ["HalfFloatType", "FloatType"]).onChange((value: unknown) => {
  loadEnvironment(params.resolution, String(value));
});

gui.open();

renderer.setAnimationLoop(render);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render(): void {
  if (disposed) return;

  torusMaterial.roughness = params.roughness;
  torusMaterial.metalness = params.metalness;

  if (params.autoRotate) {
    torusMesh.rotation.y += 0.005;
  }

  renderer.toneMappingExposure = params.exposure;

  controls.update();

  renderer.render(scene, camera);

  canvas.dataset.frames = String(++frames);
  // A failed environment request keeps its error state visible; only a successful load clears it.
  if (environment !== null && canvas.dataset.state === "ready") canvas.dataset.state = "rendered";
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  gui.destroy();
  controls.dispose();
  renderer.setAnimationLoop(null);
  environment?.dispose();
  dfgLUT.dispose();
  torusMesh.geometry.dispose();
  torusMaterial.dispose();
  renderer.dispose();
});
