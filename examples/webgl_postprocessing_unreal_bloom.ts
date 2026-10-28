import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { UnrealBloomPass } from "ek3d/addons/postprocessing/UnrealBloomPass";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Vector2 } from "ek3d/math/Vector2";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { ACESFilmicToneMapping } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const params = {
  threshold: 0.85,
  strength: 0.5,
  radius: 0.5,
  exposure: 1,
};

const timer = new Timer();
timer.connect(document);

const scene = new Scene();

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
camera.position.set(-5, 2.5, -3.5);
scene.add(camera);

scene.add(new AmbientLight(0xcccccc));

const pointLight = new PointLight(0xffffff, 100);
camera.add(pointLight);

const loader = new GLTFLoader();
const gltf = await loader.loadAsync("/examples/models/gltf/PrimaryIonDrive.glb");

const model = gltf.scene as Object3D;
scene.add(model);
const mixer = new AnimationMixer(model);
const clip = gltf.animations[0];
mixer.clipAction(clip.optimize()).play();

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 3;
controls.maxDistance = 8;

let frames = 0;
let publishedFrames = -1;
let rotate = true;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.bloomStrength = String(bloomPass.strength);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  timer.update();

  const delta = timer.getDelta();

  mixer.update(delta);

  if (rotate) controls.update();

  composer.render();
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

// Page check hooks (instead of lil-gui): 1/2 bloom strength, 3/4 threshold, 5/6 radius.

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") bloomPass.strength = Math.min(3, bloomPass.strength + 0.25);
  else if (event.code === "Digit2") bloomPass.strength = Math.max(0, bloomPass.strength - 0.25);
  else if (event.code === "Digit3") bloomPass.threshold = Math.min(1, bloomPass.threshold + 0.05);
  else if (event.code === "Digit4") bloomPass.threshold = Math.max(0, bloomPass.threshold - 0.05);
  else if (event.code === "Digit5") bloomPass.radius = Math.min(1, bloomPass.radius + 0.1);
  else if (event.code === "Digit6") bloomPass.radius = Math.max(0, bloomPass.radius - 0.1);
});

function onWindowResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    mixer.stopAllAction();
    renderer.dispose();
  },
  { once: true },
);
