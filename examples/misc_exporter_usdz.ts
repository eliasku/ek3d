import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { USDZExporter, type USDZZipRuntime } from "ek3d/addons/exporters/USDZExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import * as WebGLTextureUtils from "ek3d/addons/utils/WebGLTextureUtils";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ACESFilmicToneMapping, LoopRepeat } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadExporterRuntime } from "./exporter-runtime";

const selectedCanvas = document.querySelector<HTMLCanvasElement>("#scene");
const selectedLink = document.querySelector<HTMLAnchorElement>("#link");
const selectedStatus = document.querySelector<HTMLElement>("#status");
if (!selectedCanvas || !selectedLink || !selectedStatus) throw new Error("Missing USDZ exporter page elements");
const canvas: HTMLCanvasElement = selectedCanvas;
const link: HTMLAnchorElement = selectedLink;
const status: HTMLElement = selectedStatus;
const lut = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => lut,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    PointsMaterial: pointsShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;

const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.25, 20);
camera.position.set(-2.5, 1.6, 3);
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const room = new RoomEnvironment();
const pmrem = new PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.04);
room.dispose();
scene.environment = environment.texture;

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 2;
controls.maxDistance = 10;
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.update();
const timer = new Timer();
timer.connect(document);
const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
const ktx2 = new KTX2Loader().setTranscoderPath("/libs/basis/").detectSupport(renderer);
const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
let mixer: AnimationMixer | null = null;
let disposed = false;
let url: string | null = null;
const gui = /iPad|iPhone|iPod/.test(navigator.userAgent) ? null : new GUI();
if (gui) {
  gui
    .add(
      {
        exportUSDZ: () => {
          if (link.href) link.click();
        },
      },
      "exportUSDZ",
    )
    .name("Export USDZ");
  gui.open();
}
canvas.dataset.state = "loading";

async function load(): Promise<void> {
  const gltf = await loader.loadAsync("/examples/models/gltf/CarbonFrameBike.glb");
  if (disposed) {
    disposeObject(gltf.scene);
    return;
  }
  scene.add(gltf.scene);
  if (gltf.animations.length > 0) {
    mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]!).setLoop(LoopRepeat, Infinity).play();
  }
  status.textContent = "Exporting USDZ…";
  const zip = await loadExporterRuntime<USDZZipRuntime>("/examples/libs/fflate.module.js", ["zipSync"]);
  if (disposed) return;
  if (typeof zip.zipSync !== "function") throw new Error("fflate runtime must export zipSync");
  const exporter = new USDZExporter(zip);
  exporter.setTextureUtils(WebGLTextureUtils);
  const result = await exporter.parseAsync(gltf.scene, { animations: gltf.animations });
  if (disposed) return;
  url = URL.createObjectURL(new Blob([result.slice().buffer as ArrayBuffer], { type: "application/octet-stream" }));
  link.href = url;
  status.textContent = "USDZ ready";
  canvas.dataset.state = "ready";
}
void load().catch((error: unknown) => {
  if (disposed) return;
  status.textContent = `Unable to load or export USDZ: ${String(error)}`;
  canvas.dataset.state = "error";
  console.error(error);
});

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  mixer?.update(timer.getDelta());
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  timer.dispose();
  gui?.destroy();
  mixer?.stopAllAction();
  draco.dispose();
  ktx2.dispose();
  disposeObject(scene);
  environment.dispose();
  pmrem.dispose();
  lut.dispose();
  ltc.LTC_FLOAT_1.dispose();
  ltc.LTC_FLOAT_2.dispose();
  ltc.LTC_HALF_1.dispose();
  ltc.LTC_HALF_2.dispose();
  renderer.dispose();
  if (url !== null) URL.revokeObjectURL(url);
  canvas.dataset.state = "disposed";
});
