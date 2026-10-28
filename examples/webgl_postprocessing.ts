import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { ShaderPass } from "ek3d/addons/postprocessing/ShaderPass";
import { DotScreenShader } from "ek3d/addons/shaders/DotScreenShader";
import { RGBShiftShader } from "ek3d/addons/shaders/RGBShiftShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Object3D } from "ek3d/core/Object3D";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing postprocessing example canvas");

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 400;

const scene = new Scene();
scene.fog = new Fog(0x000000, 1, 1000);

const object = new Object3D();
scene.add(object);

const geometry = new SphereGeometry(1, 4, 4);
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true });

for (let i = 0; i < 100; i++) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  mesh.position.multiplyScalar(Math.random() * 400);
  mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
  mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 50;
  object.add(mesh);
}

scene.add(new AmbientLight(0xcccccc));

const light = new DirectionalLight(0xffffff, 3);
light.position.set(1, 1, 1);
scene.add(light);

// postprocessing

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const effect1 = new ShaderPass(DotScreenShader);
effect1.uniforms!["scale"].value = 4;
composer.addPass(effect1);

const effect2 = new ShaderPass(RGBShiftShader);
effect2.uniforms!["amount"].value = 0.0015;
composer.addPass(effect2);

composer.addPass(new OutputPass());

// Toggles keep the page externally checkable: 1 pauses the rotation, 2/3 toggle the two shader passes.
let rotate = true;

function publishState(): void {
  canvas!.dataset.state = "rendered";
  canvas!.dataset.rotate = String(rotate);
  canvas!.dataset.dotScreen = String(effect1.enabled);
  canvas!.dataset.rgbShift = String(effect2.enabled);
  canvas!.dataset.passes = String(composer.passes.length);
}

function animate(): void {
  if (rotate) {
    object.rotation.x += 0.005;
    object.rotation.y += 0.01;
  }

  composer.render();
  publishState();
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") rotate = !rotate;
  else if (event.code === "Digit2") {
    effect1.enabled = !effect1.enabled;
  } else if (event.code === "Digit3") {
    effect2.enabled = !effect2.enabled;
  }
});

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    composer.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  },
  { once: true },
);
