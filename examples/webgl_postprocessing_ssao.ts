import { SSAOPass } from "ek3d/addons/postprocessing/SSAOPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { Color } from "ek3d/math/Color";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Group } from "ek3d/objects/Group";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader, MeshLambertMaterial: lambertShader },
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const camera = new PerspectiveCamera(65, window.innerWidth / window.innerHeight, 100, 700);
camera.position.z = 500;

const scene = new Scene();
const background = new Color(0xaaaaaa);
scene.background = background;

scene.add(new DirectionalLight(0xffffff, 4));
scene.add(new AmbientLight(0xffffff));

const group = new Group();
scene.add(group);

const geometry = new BoxGeometry(10, 10, 10);
const material = new MeshLambertMaterial();

const mesh = new InstancedMesh(geometry, material, 100);
const dummy = new Object3D();
const color = new Color();

for (let i = 0; i < 100; i++) {
  dummy.position.x = Math.random() * 400 - 200;
  dummy.position.y = Math.random() * 400 - 200;
  dummy.position.z = Math.random() * 400 - 200;
  dummy.rotation.x = Math.random();
  dummy.rotation.y = Math.random();
  dummy.rotation.z = Math.random();

  dummy.scale.setScalar(Math.random() * 10 + 2);

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);

  color.setHex(Math.random() * 0xffffff);
  mesh.setColorAt(i, color);
}

group.add(mesh);

const width = window.innerWidth;
const height = window.innerHeight;

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera, width, height);
composer.addPass(ssaoPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.output = String(ssaoPass.output);
  canvas.dataset.kernelRadius = String(ssaoPass.kernelRadius);
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

// Page check hooks (instead of lil-gui): 1–5 set the output mode, 6/7 adjust the kernel radius.

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") ssaoPass.output = 0; /* SSAOPass.OUTPUT.Default */
  else if (event.code === "Digit2") ssaoPass.output = 1; /* SSAOPass.OUTPUT.SSAO */
  else if (event.code === "Digit3") ssaoPass.output = 2; /* SSAOPass.OUTPUT.Blur */
  else if (event.code === "Digit4") ssaoPass.output = 3; /* SSAOPass.OUTPUT.Depth */
  else if (event.code === "Digit5") ssaoPass.output = 4; /* SSAOPass.OUTPUT.Normal */
  else if (event.code === "Digit6") ssaoPass.kernelRadius = Math.max(0, ssaoPass.kernelRadius - 4);
  else if (event.code === "Digit7") ssaoPass.kernelRadius = Math.min(32, ssaoPass.kernelRadius + 4);
});

function onWindowResize(): void {
  const widthRes = window.innerWidth;
  const heightRes = window.innerHeight;

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
