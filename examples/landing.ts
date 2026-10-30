import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { SSAOPass } from "ek3d/addons/postprocessing/SSAOPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { createLandingSculpture, updateLandingSculpture } from "./landing-sculpture";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing landing canvas");
const canvas = selected;
const params = new URLSearchParams(window.location.search);
const still = params.has("still") ? Math.max(0, Number(params.get("still")) || 0) : null;
const separation = params.has("separation") ? Math.min(1, Math.max(0, Number(params.get("separation")) || 0)) : null;
const view = params.get("view");
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: "high-performance",
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshLambertMaterial: lambertShader,
    MeshPhysicalMaterial: physicalShader,
    MeshNormalMaterial: normalShader,
  },
});
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 1;

const scene = new Scene();
const camera = new PerspectiveCamera(34, 1, 0.1, 40);
camera.position.z = 10;
const room = new RoomEnvironment();
const pmrem = new PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.12, 0.1, 100, { size: 256 });
scene.environment = environment.texture;
pmrem.dispose();
room.dispose();

const sculpture = new Group();
const form = new Group();
sculpture.add(form);
scene.add(sculpture);
const metal = new MeshPhysicalMaterial({
  color: 0xa6aaa1,
  metalness: 0.86,
  roughness: 0.34,
  clearcoat: 0.08,
  clearcoatRoughness: 0.4,
  envMapIntensity: 1.15,
});
const metaballs = createLandingSculpture(metal);
form.add(metaballs);

// Only environment lighting reaches the sculpture, so SSAO attenuates indirect light.
const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4;
composer.renderTarget2.samples = 4;
const renderPass = new RenderPass(scene, camera);
const ssao = new SSAOPass(scene, camera, 1, 1, 24);
const output = new OutputPass();
composer.addPass(renderPass);
composer.addPass(ssao);
composer.addPass(output);

// Fixed hemisphere samples and noise make still captures reproducible.
for (let i = 0; i < ssao.kernel.length; i++) {
  const fraction = (i + 0.5) / ssao.kernel.length;
  const height = (((i * 7) % ssao.kernel.length) + 0.5) / ssao.kernel.length;
  const angle = i * 2.399963229728653;
  const radius = Math.sqrt(1 - height * height);
  ssao.kernel[i].set(Math.cos(angle) * radius, Math.sin(angle) * radius, height);
  ssao.kernel[i].multiplyScalar(0.1 + 0.9 * fraction * fraction);
}
const noise = ssao.noiseTexture;
if (noise !== null && noise.image.data !== null) {
  const data = noise.image.data;
  for (let i = 0; i < data.length; i++) data[i] = Math.sin((i + 1) * 127.1);
  noise.needsUpdate = true;
}

const diagnostics = new MeshNormalMaterial();
if (view === "normals") {
  metaballs.material = diagnostics;
} else if (view === "clay") {
  metal.color.set(0xa6aaa1);
  metal.metalness = 0;
  metal.roughness = 0.85;
  metal.clearcoat = 0;
} else if (view === "wireframe") {
  metal.wireframe = true;
}
ssao.enabled = view !== "noao" && view !== "normals" && view !== "wireframe";
if (view === "ao") ssao.output = SSAOPass.OUTPUT.Blur;
if (view === "depth") ssao.output = SSAOPass.OUTPUT.Depth;
output.enabled = view !== "ao" && view !== "depth";

const pointer = new Vector2();
const targetPointer = new Vector2();
let energy = 0;
let held = false;
let elapsed = 0;
let previousTime = 0;
let released = false;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const portrait = width <= 760;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const viewHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * 10;
  const viewWidth = viewHeight * camera.aspect;
  const scale = Math.min(viewHeight * (portrait ? 0.38 : 0.76), viewWidth * (portrait ? 0.86 : 0.46)) / 4.5;
  sculpture.scale.setScalar(scale);
  sculpture.position.set(viewWidth * (portrait ? 0 : 0.235), viewHeight * (portrait ? 0.19 : 0), 0);
  const dpr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  ssao.kernelRadius = 0.55 * scale;
  ssao.minDistance = (0.006 * scale) / (camera.far - camera.near);
  ssao.maxDistance = (0.8 * scale) / (camera.far - camera.near);
}

function move(event: PointerEvent): void {
  targetPointer.set((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
}
function press(event: PointerEvent): void {
  if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("a"))) return;
  move(event);
  held = true;
}
function releasePointer(): void {
  held = false;
}
function leave(): void {
  targetPointer.set(0, 0);
  releasePointer();
}

function animate(time: number): void {
  const delta = previousTime === 0 ? 0 : Math.min((time - previousTime) * 0.001, 0.05);
  previousTime = time;
  elapsed += delta;
  const seconds = still ?? elapsed;
  pointer.lerp(targetPointer, 1 - Math.exp(-delta * 4));
  energy = separation ?? energy + ((held ? 1 : 0) - energy) * (1 - Math.exp(-delta * (held ? 9 : 3)));
  form.rotation.set(
    0.06 + Math.sin(seconds * 0.22) * 0.1,
    -0.12 + Math.sin(seconds * 0.16) * 0.2 + energy * 0.12,
    -0.18 + Math.sin(seconds * 0.18) * 0.08 - energy * 0.12,
  );
  form.position.y = Math.sin(seconds * 0.4) * 0.06;
  updateLandingSculpture(metaballs, seconds, energy);
  camera.position.x = pointer.x * 0.35 * sculpture.scale.x;
  camera.position.y = pointer.y * 0.22 * sculpture.scale.x;
  camera.position.z = 10;
  camera.lookAt(0, 0, 0);
  if (view === "noao" || view === "normals" || view === "wireframe") renderer.render(scene, camera);
  else composer.render(delta);
  canvas.dataset.state = "rendered";
  canvas.dataset.separation = energy.toFixed(3);
}
function visibility(): void {
  previousTime = 0;
  releasePointer();
  renderer.setAnimationLoop(document.hidden ? null : animate);
}
function restore(event: PageTransitionEvent): void {
  if (!event.persisted) return;
  previousTime = 0;
  releasePointer();
  renderer.setAnimationLoop(animate);
}
function release(event: PageTransitionEvent): void {
  renderer.setAnimationLoop(null);
  if (event.persisted || released) return;
  released = true;
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", move);
  window.removeEventListener("pointerdown", press);
  window.removeEventListener("pointerup", releasePointer);
  window.removeEventListener("pointercancel", releasePointer);
  window.removeEventListener("blur", leave);
  document.documentElement.removeEventListener("pointerleave", leave);
  document.removeEventListener("visibilitychange", visibility);
  window.removeEventListener("pageshow", restore);
  window.removeEventListener("pagehide", release);
  disposeObject(scene, [metal, diagnostics]);
  ssao.dispose();
  ssao.ssaoMaterial.dispose();
  ssao.noiseTexture?.dispose();
  output.dispose();
  composer.dispose();
  environment.dispose();
  dfgLUT.dispose();
  renderer.dispose();
}

resize();
renderer.setAnimationLoop(animate);
window.addEventListener("resize", resize);
window.addEventListener("pointermove", move, { passive: true });
window.addEventListener("pointerdown", press, { passive: true });
window.addEventListener("pointerup", releasePointer);
window.addEventListener("pointercancel", releasePointer);
window.addEventListener("blur", leave);
document.documentElement.addEventListener("pointerleave", leave);
document.addEventListener("visibilitychange", visibility);
window.addEventListener("pageshow", restore);
window.addEventListener("pagehide", release);
