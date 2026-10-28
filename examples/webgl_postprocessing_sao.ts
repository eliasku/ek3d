import { SAOPass } from "ek3d/addons/postprocessing/SAOPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { Color } from "ek3d/math/Color";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const width = window.innerWidth;
const height = window.innerHeight;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

const camera = new PerspectiveCamera(65, width / height, 3, 10);
camera.position.z = 7;

const scene = new Scene();

const group = new Object3D();
scene.add(group);

const light = new PointLight(0xefffef, 500);
light.position.z = 10;
light.position.y = -10;
light.position.x = -10;
scene.add(light);

const light2 = new PointLight(0xffefef, 500);
light2.position.z = 10;
light2.position.x = -10;
light2.position.y = 10;
scene.add(light2);

const light3 = new PointLight(0xefefff, 500);
light3.position.z = 10;
light3.position.x = 10;
light3.position.y = -10;
scene.add(light3);

const light4 = new AmbientLight(0xffffff, 0.2);
scene.add(light4);

const geometry = new SphereGeometry(3, 48, 24);
const material = new MeshStandardMaterial();
material.roughness = 0.5;
material.metalness = 0;

const mesh = new InstancedMesh(geometry, material, 120);
const dummy = new Object3D();
const color = new Color();

for (let i = 0; i < 120; i++) {
  dummy.position.x = Math.random() * 4 - 2;
  dummy.position.y = Math.random() * 4 - 2;
  dummy.position.z = Math.random() * 4 - 2;
  dummy.rotation.x = Math.random();
  dummy.rotation.y = Math.random();
  dummy.rotation.z = Math.random();

  const scale = Math.random() * 0.2 + 0.05;
  dummy.scale.set(scale, scale, scale);

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);

  color.setHSL(Math.random(), 1.0, 0.3);
  mesh.setColorAt(i, color);
}

group.add(mesh);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const saoPass = new SAOPass(scene, camera);
composer.addPass(saoPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.output = String(saoPass.params.output);
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  const timer = performance.now();
  group.rotation.x = timer * 0.0002;
  group.rotation.y = timer * 0.0001;

  composer.render();
  publishState();
  frames++;
}

renderer.setAnimationLoop(animate);

// Page check hooks (instead of lil-gui): 1–3 set output mode, 4/5 blur radius, 6 toggle blur.

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") saoPass.params.output = 0; /* SAOPass.OUTPUT.Default */
  else if (event.code === "Digit2") saoPass.params.output = 1; /* SAOPass.OUTPUT.SAO */
  else if (event.code === "Digit3") saoPass.params.output = 2; /* SAOPass.OUTPUT.Normal */
  else if (event.code === "Digit4") saoPass.params.saoBlurRadius = Math.min(200, saoPass.params.saoBlurRadius + 2);
  else if (event.code === "Digit5") saoPass.params.saoBlurRadius = Math.max(0, saoPass.params.saoBlurRadius - 2);
  else if (event.code === "Digit6") saoPass.params.saoBlur = !saoPass.params.saoBlur;
});

function onWindowResize(): void {
  const widthRes = window.innerWidth || 1;
  const heightRes = window.innerHeight || 1;

  camera.aspect = widthRes / heightRes;
  camera.updateProjectionMatrix();
  renderer.setSize(widthRes, heightRes);

  composer.setSize(widthRes, heightRes);
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
