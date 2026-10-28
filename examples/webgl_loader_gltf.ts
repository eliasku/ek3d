import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFAnimationPointerExtension } from "ek3d/addons/loaders/GLTFAnimationPointerExtension";
import { GLTFLoader, type GLTF, type MeshoptDecoderLike } from "ek3d/addons/loaders/GLTFLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Mapping } from "ek3d/constants";
import type { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { Box3 } from "ek3d/math/Box3";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";
import catalogData from "./gltf-catalog.json";
import { catalogURL, defaultVariant, type CatalogModel } from "./gltf-catalog";
import { disposeObject } from "./dispose-object";
import { loadExporterRuntime } from "./exporter-runtime";
import { loadZstdDecoder } from "./zstd";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing glTF catalog canvas");
const canvas: HTMLCanvasElement = canvasSel;
const statusSel = document.querySelector<HTMLElement>("#status");
if (statusSel === null) throw new Error("Missing glTF catalog status");
const status: HTMLElement = statusSel;
const models: CatalogModel[] = catalogData;
const initial = models.find((model) => model.name === "DamagedHelmet")!;
const params = { model: initial.name, variant: defaultVariant(initial) };
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    MeshBasicMaterial: basicShader,
    PointsMaterial: pointsShader,
    MeshLambertMaterial: lambertShader,
    MeshPhongMaterial: phongShader,
    LineBasicMaterial: basicShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
camera.position.set(-1.8, 0.6, 2.7);
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.target.set(0, 0, -0.2);
controls.update();
const timer = new Timer();
timer.connect(document);
const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
const ktx = new KTX2Loader().setTranscoderPath("/libs/basis/").detectSupport(renderer);
const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx);
loader.register((parser) => new GLTFAnimationPointerExtension(parser));
const codecs = Promise.all([
  loadExporterRuntime<{ MeshoptDecoder: MeshoptDecoderLike }>("/examples/libs/meshopt_decoder.module.js", [
    "MeshoptDecoder",
  ]),
  loadZstdDecoder(),
]).then(([meshopt, zstd]) => {
  loader.setMeshoptDecoder(meshopt.MeshoptDecoder);
  ktx.setZSTDDecoder(zstd);
});
let current: GLTF | null = null;
let mixer: AnimationMixer | null = null;
let environment: DataTexture | null = null;
let disposed = false;
let request = 0;
let frames = 0;
const gui = new GUI();
const variantControl = gui.add(params, "variant", Object.keys(initial.variants)).name("Variant");
gui
  .add(
    params,
    "model",
    models.map((model) => model.name),
  )
  .name("Model")
  .onChange(() => {
    const model = models.find((entry) => entry.name === params.model)!;
    params.variant = defaultVariant(model);
    variantControl.options(Object.keys(model.variants));
    variantControl.updateDisplay();
    void loadModel(model, params.variant);
  });
variantControl.onChange(() => {
  const model = models.find((entry) => entry.name === params.model)!;
  void loadModel(model, params.variant);
});
gui.add(scene, "backgroundBlurriness", 0, 1);

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  canvas.dataset.state = "error";
  canvas.dataset.error = message;
  status.textContent = message;
  console.error(error);
}

async function loadModel(model: CatalogModel, variant: string): Promise<void> {
  const id = ++request;
  mixer?.stopAllAction();
  mixer = null;
  if (current !== null) {
    scene.remove(current.scene);
    disposeGLTF(current);
    current = null;
  }
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  status.textContent = `Loading ${model.name} (${variant})…`;
  let loaded: GLTF | null = null;
  try {
    await Promise.all([codecs, environmentReady]);
    if (disposed || id !== request) return;
    const gltf = await loader.loadAsync(catalogURL(model, variant));
    loaded = gltf;
    if (disposed || id !== request) return;
    await renderer.compileAsync(gltf.scene, camera, scene);
    if (disposed || id !== request) return;
    current = loaded;
    loaded = null;
    scene.add(gltf.scene);
    fitCamera(gltf.scene);
    if (gltf.animations.length > 0) {
      mixer = new AnimationMixer(gltf.scene);
      for (const animation of gltf.animations) mixer.clipAction(animation).play();
    }
    canvas.dataset.model = model.name;
    canvas.dataset.variant = variant;
    canvas.dataset.state = "ready";
    status.textContent = `${model.name} (${variant})`;
  } catch (error) {
    if (!disposed && id === request) {
      const notice = catalogData.find((entry) => entry.name === model.name);
      const message = error instanceof Error ? error.message : String(error);
      reportError(
        notice?.localCopy === "not-copied-rights-review"
          ? new Error(`${model.name}: resources are not supplied pending rights review. ${message}`)
          : error,
      );
    }
  } finally {
    if (loaded !== null) disposeGLTF(loaded);
  }
}

function disposeGLTF(gltf: GLTF): void {
  const root = new Group();
  root.add(...new Set([...gltf.scenes, gltf.scene]));
  disposeObject(root);
}

function fitCamera(model: Object3D): void {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maximum = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maximum) || maximum <= 0) return;
  const distance = (1.3 * maximum) / (2 * Math.tan((Math.PI * camera.fov) / 360));
  const direction = controls.target.clone().sub(camera.position).normalize().multiplyScalar(distance);
  controls.maxDistance = distance * 10;
  controls.minDistance = distance / 10;
  controls.target.copy(center);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  camera.position.copy(center).sub(direction);
  controls.update();
}

const environmentReady = new UltraHDRLoader()
  .loadAsync("/examples/textures/equirectangular/royal_esplanade_2k.hdr.jpg")
  .then((texture) => {
    if (disposed) {
      texture.dispose();
    } else {
      environment = texture;
      texture.mapping = Mapping.EquirectangularReflection;
      scene.background = texture;
      scene.environment = texture;
    }
  });
void loadModel(initial, params.variant);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  if (disposed) return;
  timer.update();
  controls.update();
  mixer?.update(timer.getDelta());
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state === "ready") canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  ++request;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  gui.destroy();
  mixer?.stopAllAction();
  if (current !== null) disposeGLTF(current);
  environment?.dispose();
  draco.dispose();
  ktx.dispose();
  renderer.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
});
