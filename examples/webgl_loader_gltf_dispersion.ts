import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { NeutralToneMapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import type { Group } from "ek3d/objects/Group";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing gltf dispersion example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const scene = new Scene();
scene.backgroundBlurriness = 0.5;

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 5);
camera.position.set(0.1, 0.05, 0.15);

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
renderer.toneMapping = NeutralToneMapping;
renderer.toneMappingExposure = 1;

const environment = new RoomEnvironment();
const pmremGenerator = new PMREMGenerator(renderer);

const env = pmremGenerator.fromScene(environment, 0.04).texture;
scene.background = env;
scene.environment = env;
environment.dispose();

new GLTFLoader().setPath("/examples/models/gltf/").load("DispersionTest.glb", function (gltf: { scene: Group }) {
  scene.add(gltf.scene);
  render();
});

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.addEventListener("change", render); // use if there is no animation loop
controls.minDistance = 0.1;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);
controls.update();

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
    pmremGenerator.dispose();
  },
  { once: true },
);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

//

function render(): void {
  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
