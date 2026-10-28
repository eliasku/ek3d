import { FXAAPass } from "ek3d/addons/postprocessing/FXAAPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";

const container = document.querySelector<HTMLDivElement>("#container")!;

const camera = new PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 1, 2000);
camera.position.z = 500;

const scene = new Scene();

const hemiLight = new HemisphereLight(0xffffff, 0x8d8d8d);
hemiLight.position.set(0, 1000, 0);
scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 3);
dirLight.position.set(-3000, 1000, -1000);
scene.add(dirLight);

const geometry = new TetrahedronGeometry(10);
const material = new MeshStandardMaterial({ color: 0xf73232, flatShading: true });

const mesh = new InstancedMesh(geometry, material, 100);
const dummy = new Object3D();

for (let i = 0; i < 100; i++) {
  dummy.position.x = Math.random() * 500 - 250;
  dummy.position.y = Math.random() * 500 - 250;
  dummy.position.z = Math.random() * 500 - 250;

  dummy.scale.setScalar(Math.random() * 2 + 1);

  dummy.rotation.x = Math.random() * Math.PI;
  dummy.rotation.y = Math.random() * Math.PI;
  dummy.rotation.z = Math.random() * Math.PI;

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

scene.add(mesh);

const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();

const renderer = new WebGLRenderer({
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  canvas: document.createElement("canvas"),
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.autoClear = false;
container.appendChild(renderer.domElement as HTMLCanvasElement);

const controls = new OrbitControls(camera, renderer.domElement as HTMLCanvasElement);
controls.autoRotate = true;

// postprocessing: left composer without FXAA, right composer with FXAA sharing the passes

const renderPass = new RenderPass(scene, camera);
renderPass.clearAlpha = 0;

const outputPass = new OutputPass();

const composer1 = new EffectComposer(renderer);
composer1.addPass(renderPass);
composer1.addPass(outputPass);

const composer2 = new EffectComposer(renderer);
composer2.addPass(renderPass);
composer2.addPass(outputPass);

composer2.addPass(new FXAAPass());

const canvas = renderer.domElement as HTMLCanvasElement; // fxaa renders into wrapper; publish on it

let frames = 0;
let publishedFrames = -1;

function publishState(): void {
  if (frames === publishedFrames) return;
  publishedFrames = frames;
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(frames);
}

function animate(): void {
  const halfWidth = container.offsetWidth / 2;

  controls.update();

  renderer.setScissorTest(true);

  renderer.setScissor(0, 0, halfWidth - 1, container.offsetHeight);
  composer1.render();

  renderer.setScissor(halfWidth, 0, halfWidth, container.offsetHeight);
  composer2.render();

  renderer.setScissorTest(false);

  frames++;
  publishState();
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(container.offsetWidth, container.offsetHeight);
  composer1.setSize(container.offsetWidth, container.offsetHeight);
  composer2.setSize(container.offsetWidth, container.offsetHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer1.dispose();
    composer2.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  },
  { once: true },
);
