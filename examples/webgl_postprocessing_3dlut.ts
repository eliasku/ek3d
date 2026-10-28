import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { LUT3dlLoader } from "ek3d/addons/loaders/LUT3dlLoader";
import { LUTCubeLoader } from "ek3d/addons/loaders/LUTCubeLoader";
import { LUTImageLoader } from "ek3d/addons/loaders/LUTImageLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { LUTPass } from "ek3d/addons/postprocessing/LUTPass";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, EquirectangularReflectionMapping } from "ek3d/constants";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import type { Data3DTexture } from "ek3d/textures/Data3DTexture";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing 3D LUT example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const names = [
  "Bourbon 64.CUBE",
  "Chemical 168.CUBE",
  "Clayton 33.CUBE",
  "Cubicle 99.CUBE",
  "Remy 24.CUBE",
  "Presetpro-Cinematic.3dl",
  "NeutralLUT",
  "B&WLUT",
  "NightLUT",
];
const params = { enabled: true, lut: names[0], intensity: 1 };
const luts = new Map<string, Data3DTexture>();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
camera.position.set(-1.8, 0.6, 2.7);
const scene = new Scene();
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const outputPass = new OutputPass();
const lutPass = new LUTPass();
composer.addPass(renderPass);
composer.addPass(outputPass);
composer.addPass(lutPass);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 2;
controls.maxDistance = 10;
controls.target.set(0, 0, -0.2);
controls.update();
const gui = new GUI({ width: 350 });
gui.add(params, "enabled");
gui.add(params, "lut", names);
gui.add(params, "intensity").min(0).max(1);
let disposed = false;
let loaded = false;
let failed = false;
let environment: DataTexture | null = null;
let frames = 0;
canvas.dataset.state = "loading";
canvas.dataset.lutCount = "0";

function reportError(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function loadScene(): Promise<void> {
  const texture = await new UltraHDRLoader().loadAsync("/examples/textures/equirectangular/royal_esplanade_2k.hdr.jpg");
  if (disposed) {
    texture.dispose();
    return;
  }
  environment = texture;
  texture.mapping = EquirectangularReflectionMapping;
  scene.background = texture;
  scene.environment = texture;
  const gltf = await new GLTFLoader().loadAsync("/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf");
  if (disposed) {
    disposeObject(gltf.scene);
    return;
  }
  scene.add(gltf.scene);
  loaded = true;
}
loadScene().catch(reportError);

for (const name of names) {
  const loader = name.endsWith(".CUBE")
    ? new LUTCubeLoader()
    : name.endsWith(".3dl")
      ? new LUT3dlLoader()
      : new LUTImageLoader();
  const path = `/examples/luts/${name}${name.endsWith("LUT") ? ".png" : ""}`;
  loader
    .loadAsync(path)
    .then((result) => {
      if (disposed) {
        result.texture3D.dispose();
        return;
      }
      luts.set(name, result.texture3D);
      canvas.dataset.lutCount = String(luts.size);
    })
    .catch(reportError);
}

renderer.setAnimationLoop(() => {
  const lut = luts.get(params.lut);
  lutPass.enabled = params.enabled && lut !== undefined;
  lutPass.lut = lut ?? null;
  lutPass.intensity = params.intensity;
  composer.render();
  canvas.dataset.frames = String(++frames);
  if (loaded && luts.size === names.length && !failed) canvas.dataset.state = "rendered";
});

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onResize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  for (const texture of luts.values()) texture.dispose();
  disposeObject(scene);
  environment?.dispose();
  renderPass.dispose();
  outputPass.dispose();
  lutPass.dispose();
  composer.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
