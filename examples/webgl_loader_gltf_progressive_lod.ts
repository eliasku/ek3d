import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { NEEDLE_progressive, useNeedleProgressive } from "ek3d/addons/loaders/GLTFProgressive";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Mapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import type { Object3D } from "ek3d/core/Object3D";
import { Color } from "ek3d/math/Color";
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
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
const statusElement = document.querySelector<HTMLElement>("#status");
if (canvasElement === null || statusElement === null) throw new Error("Missing progressive glTF example elements");
const canvas: HTMLCanvasElement = canvasElement;
const status: HTMLElement = statusElement;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
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
renderer.toneMappingExposure = 1;

const scene = new Scene();
scene.fog = new Fog("#131055", 15, 50);
const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 40);
camera.position.set(-9, 2, -13);
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.minDistance = 0.1;
controls.maxDistance = 20;
controls.target.set(-1, 2.1, 0);
controls.update();

const timer = new Timer();
timer.connect(document);
const mixer = new AnimationMixer(scene);
const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
const ktx2 = new KTX2Loader().detectSupport(renderer);
const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
const progressive = useNeedleProgressive(loader, renderer);
const removeLODListener = progressive.addEventListener("changed", (event) => {
  const key = event.type === "mesh" ? "meshLodChanges" : "textureLodChanges";
  canvas.dataset[key] = String(Number(canvas.dataset[key] ?? 0) + 1);
});
let environment: Texture | undefined;
let airship: Object3D | undefined;
let disposed = false;
let time = 0;
let loaded = 0;
const failures: string[] = [];
const modelScenes = new Set<Object3D>();
const loadedNames: string[] = [];

function disposeScenes(scenes: Iterable<Object3D>): void {
  const root = new Group();
  for (const model of new Set(scenes)) root.add(model);
  disposeObject(root);
}

new HDRLoader().load(
  "/examples/textures/equirectangular/quarry_01_1k.hdr",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = Mapping.EquirectangularReflection;
    scene.background = new Color("#192022");
    scene.backgroundBlurriness = 0.5;
    scene.environment = texture;
    scene.environmentRotation.set(0, Math.PI / -2, 0, "XYZ");
  },
  undefined,
  (error) => reportFailure("Quarry 01 environment", error),
);

const sources = [
  { name: "Mobile Home", path: "mobile-home/file", scale: 0.1, position: [0, 0, 0], rotation: 0 },
  {
    name: "Peachy Balloon",
    path: "peachy-balloon/file",
    scale: 0.0005,
    position: [1.6, 6, 7],
    rotation: Math.PI * 1.4,
  },
  { name: "The Forgotten Knight", path: "knight/file", scale: 0.5, position: [2, 5.15, 2.3], rotation: Math.PI },
] as const;

for (const source of sources) {
  loader.load(
    `/examples/models/gltf/progressive/${source.path}`,
    (gltf) => {
      if (disposed) {
        NEEDLE_progressive.dispose();
        disposeScenes(gltf.scenes);
        return;
      }
      const model = gltf.scene;
      model.scale.multiplyScalar(source.scale);
      model.position.set(source.position[0], source.position[1], source.position[2]);
      model.rotation.set(0, source.rotation, 0);
      scene.add(model);
      for (const modelScene of gltf.scenes) modelScenes.add(modelScene);
      modelScenes.add(model);
      loadedNames.push(source.name);
      canvas.dataset.loaded = JSON.stringify(loadedNames);
      if (source.name === "Peachy Balloon") airship = model;
      for (const animation of gltf.animations) mixer.clipAction(animation).play();
      loaded++;
      updateStatus();
    },
    undefined,
    (error) => reportFailure(source.name, error),
  );
}

function reportFailure(name: string, error: unknown): void {
  if (disposed) return;
  failures.push(name);
  console.error(`Failed to load ${name}`, error);
  updateStatus();
}

function updateStatus(): void {
  if (failures.length > 0) {
    canvas!.dataset.state = "error";
    status!.textContent = `Failed to load: ${failures.join(", ")}. The Mobile Home and Peachy Balloon resource graphs require redistribution permission; see the resource manifest.`;
  } else if (loaded === sources.length) {
    status!.textContent = "All models loaded; mesh and texture detail streams as needed.";
    canvas!.dataset.state = "rendered";
  } else {
    status!.textContent = `Loading models (${loaded}/${sources.length}).`;
    canvas!.dataset.state = "loading";
  }
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

updateStatus();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  time += delta;
  mixer.update(delta);
  if (airship) airship.position.y += Math.sin(time) * 0.002;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  progressive.disable();
  NEEDLE_progressive.dispose();
  removeLODListener();
  timer.dispose();
  mixer.stopAllAction();
  controls.dispose();
  disposeScenes(modelScenes);
  environment?.dispose();
  draco.dispose();
  ktx2.dispose();
  dfgLUT.dispose();
  for (const texture of Object.values(ltcTextures)) texture.dispose();
  renderer.dispose();
});
