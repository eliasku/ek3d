import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { GlitchPass } from "ek3d/addons/postprocessing/GlitchPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Color } from "ek3d/math/Color";
import { Object3D } from "ek3d/core/Object3D";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing glitch example canvas");

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 400;

const scene = new Scene();
scene.fog = new Fog(0x000000, 1, 1000);

const object = new Object3D();
scene.add(object);

const geometry = new SphereGeometry(1, 4, 4);
const material = new MeshPhongMaterial({ flatShading: true });

const mesh = new InstancedMesh(geometry, material, 100);
const dummy = new Object3D();
const color = new Color();

for (let i = 0; i < 100; i++) {
  dummy.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  dummy.position.multiplyScalar(Math.random() * 400);
  dummy.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);

  const scale = Math.random() * 50;
  dummy.scale.set(scale, scale, scale);

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);

  color.setHex(0xffffff * Math.random());
  mesh.setColorAt(i, color);
}

object.add(mesh);

scene.add(new AmbientLight(0xcccccc));

const light = new DirectionalLight(0xffffff, 3);
light.position.set(1, 1, 1);
scene.add(light);

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// postprocessing

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const glitchPass = new GlitchPass();
composer.addPass(glitchPass);

composer.addPass(new OutputPass());

// Page starts on the epilepsy warning; initializing late matches the upstream flow.
let running = false;

function publishState(): void {
  canvas!.dataset.state = "rendered";
  canvas!.dataset.running = String(running);
  canvas!.dataset.wild = String(glitchPass.goWild);
  canvas!.dataset.frames = String(frames);
}

let frames = 0;

function animate(): void {
  object.rotation.x += 0.005;
  object.rotation.y += 0.01;

  composer.render();
  frames++;
  publishState();
}

function start(): void {
  if (running) return;
  running = true;
  document.querySelector("#warning")!.remove();
  renderer.setAnimationLoop(animate);
}

const startButton = document.querySelector("#startButton");
startButton?.addEventListener("click", start);
const wildGlitch = document.querySelector<HTMLInputElement>("#wildGlitch");
wildGlitch?.addEventListener("change", () => {
  glitchPass.goWild = wildGlitch.checked;
});
publishState();

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    geometry.dispose();
    material.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
