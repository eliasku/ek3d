import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import { DRACOLoader, DRACO_GLTF_CONFIG } from "ek3d/addons/loaders/DRACOLoader";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { GLTFAnimationPointerExtension } from "ek3d/addons/loaders/GLTFAnimationPointerExtension";
import { Stats } from "ek3d/addons/libs/Stats";
import { Timer } from "ek3d/core/Timer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { Color } from "ek3d/math/Color";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { ToneMapping } from "ek3d/constants";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import type { Object3D } from "ek3d/core/Object3D";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing animation pointer example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const timer = new Timer();
timer.connect(document);

const stats = new Stats();
document.body.appendChild(stats.dom);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
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
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ToneMapping.Neutral;

const pmremGenerator = new PMREMGenerator(renderer);

const scene = new Scene();
scene.background = new Color(0xbfe3dd);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.2, 100);
camera.position.set(-3, 2, 6);

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.update();
controls.enablePan = false;
controls.enableDamping = true;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG);

const ktx2Loader = new KTX2Loader().detectSupport(renderer);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.setKTX2Loader(ktx2Loader);

loader.register((p) => {
  return new GLTFAnimationPointerExtension(p);
});

// The glTF-Sample-Assets DragonDispersion model, copied unmodified from needle's asset CDN into
// the package's example assets (upstream three.js examples load the CDN URL directly).
loader.load(
  "/examples/models/gltf/DragonDispersion.glb",
  function (gltf: GLTF) {
    const model = gltf.scene;
    scene.add(model);

    const mixer = new AnimationMixer(model as Object3D);
    mixer.clipAction(gltf.animations[0]!).play();
    mixers.push(mixer);

    renderer.setAnimationLoop(animate);
  },
  function (event: ProgressEvent) {
    canvas.dataset.progress = String(Math.round((event.loaded / Number(event.total || 1)) * 100));
  },
  function (e: unknown) {
    console.error(e);
  },
);

const mixers: AnimationMixer[] = [];

window.onresize = function (): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
};

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  for (const mixer of mixers) {
    mixer.update(delta);
  }

  controls.update();

  stats.update();

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
