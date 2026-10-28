import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { OutputPass } from "ek3d/addons/postprocessing/OutputPass";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { HalfFloatType } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "ek3d/renderers/WebGLRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selectedCanvas = document.querySelector<HTMLCanvasElement>("#scene");
const selectedContainer = document.querySelector<HTMLDivElement>("#wrapper");
if (!selectedCanvas || !selectedContainer) throw new Error("Missing multisampled renderbuffers canvas");
const canvas: HTMLCanvasElement = selectedCanvas;
const container: HTMLDivElement = selectedContainer;
const camera = new PerspectiveCamera(45, container.clientWidth / container.clientHeight, 10, 2000);
camera.position.z = 500;
const scene = new Scene();
scene.background = new Color(0xffffff);
scene.fog = new Fog(0xcccccc, 100, 1500);
const light = new HemisphereLight(0xffffff, 0x222222, 5);
light.position.set(1, 1, 1);
scene.add(light);
const group = new Group();
const geometry = new SphereGeometry(10, 64, 40);
const material = new MeshLambertMaterial({
  color: 0xee0808,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const wireframe = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });
for (let i = 0; i < 50; i++) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(Math.random() * 600 - 300, Math.random() * 600 - 300, Math.random() * 600 - 300);
  mesh.rotation.x = Math.random();
  mesh.rotation.z = Math.random();
  mesh.scale.setScalar(Math.random() * 5 + 5);
  group.add(mesh);
  const mesh2 = new Mesh(geometry, wireframe);
  mesh2.position.copy(mesh.position);
  mesh2.rotation.copy(mesh.rotation);
  mesh2.scale.copy(mesh.scale);
  group.add(mesh2);
}
scene.add(group);
const renderer = new WebGLRenderer({
  canvas,
  shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.autoClear = false;
const size = renderer.getDrawingBufferSize(new Vector2());
const target = new WebGLRenderTarget(size.width, size.height, { samples: 4, type: HalfFloatType });
const renderPass = new RenderPass(scene, camera);
const outputPass = new OutputPass();
const composer1 = new EffectComposer(renderer);
composer1.addPass(renderPass);
composer1.addPass(outputPass);
const composer2 = new EffectComposer(renderer, target);
composer2.addPass(renderPass);
composer2.addPass(outputPass);
const params = { animate: true };
const gui = new GUI();
gui.add(params, "animate");
function resize(): void {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  composer1.setSize(container.clientWidth, container.clientHeight);
  composer2.setSize(container.clientWidth, container.clientHeight);
}
function animate(): void {
  const halfWidth = container.clientWidth / 2;
  if (params.animate) group.rotation.y += 0.002;
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, halfWidth - 1, container.clientHeight);
  composer1.render();
  renderer.setScissor(halfWidth, 0, halfWidth, container.clientHeight);
  composer2.render();
  renderer.setScissorTest(false);
  canvas.dataset.state = "rendered";
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  gui.destroy();
  composer1.dispose();
  composer2.dispose();
  renderPass.dispose();
  outputPass.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
