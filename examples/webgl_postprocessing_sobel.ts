import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { LuminosityShader } from "ek3d/addons/shaders/LuminosityShader";
import { SobelOperatorShader } from "ek3d/addons/shaders/SobelOperatorShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing sobel example canvas");

const scene = new Scene();

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, 3);
camera.lookAt(scene.position);

const geometry = new TorusKnotGeometry(1, 0.3, 256, 32);
const material = new MeshPhongMaterial({ color: 0xffff00 });

const mesh = new Mesh(geometry, material);
scene.add(mesh);

const ambientLight = new AmbientLight(0xe7e7e7);
scene.add(ambientLight);

const pointLight = new PointLight(0xffffff, 20);
camera.add(pointLight);
scene.add(camera);

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// postprocessing

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// color to grayscale conversion

const effectGrayScale = new ShaderPass(LuminosityShader);
composer.addPass(effectGrayScale);

// you might want to use a gaussian blur filter before
// the next pass to improve the result of the Sobel operator

// Sobel operator

const effectSobel = new ShaderPass(SobelOperatorShader);
effectSobel.uniforms!["resolution"].value.x = window.innerWidth * window.devicePixelRatio;
effectSobel.uniforms!["resolution"].value.y = window.innerHeight * window.devicePixelRatio;
composer.addPass(effectSobel);

const controls = new OrbitControls(camera, renderer.domElement as HTMLCanvasElement);
controls.enableZoom = false;

// Page check hooks: 1 toggles the Sobel effect like the upstream GUI 'enable' switch.
let effectSobelEnabled = true;

function publishState(): void {
  canvas!.dataset.state = "rendered";
  canvas!.dataset.sobel = String(effectSobelEnabled);
  canvas!.dataset.frames = String(frames);
}

let frames = 0;

function animate(): void {
  composer.render();
  frames++;
  publishState();
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") {
    effectSobelEnabled = !effectSobelEnabled;
    effectSobel.enabled = effectSobelEnabled;
    effectGrayScale.enabled = effectSobelEnabled;
  }
});

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  effectSobel.uniforms!["resolution"].value.x = window.innerWidth * window.devicePixelRatio;
  effectSobel.uniforms!["resolution"].value.y = window.innerHeight * window.devicePixelRatio;
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
