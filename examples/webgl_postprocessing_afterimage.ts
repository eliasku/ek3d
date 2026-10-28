import { AfterimagePass } from "ek3d/addons/postprocessing/AfterimagePass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 400;

const scene = new Scene();
scene.fog = new Fog(0x000000, 1, 1000);

const geometry = new BoxGeometry(150, 150, 150, 2, 2, 2);
const material = new MeshNormalMaterial();
const mesh = new Mesh(geometry, material);
scene.add(mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const afterimagePass = new AfterimagePass();
composer.addPass(afterimagePass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// Page check hooks (instead of lil-gui): 1 toggles the effect, 2/3 adjust damp.

let frames = 0;
let publishedFrames = -1;
let passEnabled = true;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.enabled = String(passEnabled);
  canvas.dataset.damp = String(afterimagePass.damp);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  mesh.rotation.x += 0.005;
  mesh.rotation.y += 0.01;

  afterimagePass.enabled = passEnabled;

  composer.render();
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") passEnabled = !passEnabled;
  else if (event.code === "Digit2") afterimagePass.damp = Math.max(0.5, afterimagePass.damp - 0.1);
  else if (event.code === "Digit3") afterimagePass.damp = Math.min(0.9, afterimagePass.damp + 0.1);
});

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
