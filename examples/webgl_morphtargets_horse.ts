import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing morph horse canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.y = 300;
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const light1 = new DirectionalLight(0xefefff, 5);
light1.position.set(1, 1, 1).normalize();
const light2 = new DirectionalLight(0xffefef, 5);
light2.position.set(-1, -1, -1).normalize();
scene.add(light1, light2);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshPhongMaterial: phongShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let disposed = false;
let model: Object3D | undefined;
let mixer: AnimationMixer | undefined;
let theta = 0;
let previous = Date.now();
let frames = 0;
canvas.dataset.state = "loading";
new GLTFLoader().load(
  "/examples/models/gltf/Horse.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    model = gltf.scene;
    const horse = gltf.scene.children[0];
    horse.scale.set(1.5, 1.5, 1.5);
    scene.add(gltf.scene);
    mixer = new AnimationMixer(horse);
    mixer.clipAction(gltf.animations[0]).setDuration(1).play();
    previous = Date.now();
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
renderer.setAnimationLoop(() => {
  theta += 0.1;
  camera.position.x = 600 * Math.sin((theta * Math.PI) / 180);
  camera.position.z = 600 * Math.cos((theta * Math.PI) / 180);
  camera.lookAt(0, 150, 0);
  if (mixer) {
    const now = Date.now();
    mixer.update((now - previous) * 0.001);
    previous = now;
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (model) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  mixer?.stopAllAction();
  if (model) disposeObject(model);
  light1.dispose();
  light2.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  renderer.dispose();
  stats.dom.remove();
  canvas.dataset.state = "disposed";
});
