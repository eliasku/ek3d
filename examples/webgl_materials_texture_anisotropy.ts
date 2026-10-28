import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { clamp } from "ek3d/math/MathUtils";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
const leftLabel = document.querySelector<HTMLElement>("#val_left");
const rightLabel = document.querySelector<HTMLElement>("#val_right");
if (!selected || !leftLabel || !rightLabel) throw new Error("Missing anisotropy example elements");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = false;
const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 1, 25000);
camera.position.z = 1500;
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
leftLabel.textContent = maxAnisotropy > 0 ? String(maxAnisotropy) : "not supported";
rightLabel.textContent = maxAnisotropy > 0 ? "1" : "not supported";
let disposed = false;
let loaded = 0;
let failed = false;
canvas.dataset.state = "loading";
const loader = new TextureLoader();
function makeScene(anisotropy: number): Scene {
  const scene = new Scene();
  scene.background = new Color(0xf2f7ff);
  scene.fog = new Fog(0xf2f7ff, 1, 25000);
  scene.add(new AmbientLight(0xeef0ff, 3));
  const light = new DirectionalLight(0xffffff, 6);
  light.position.set(1, 1, 1);
  scene.add(light);
  const texture = loader.load(
    "/examples/textures/crate.gif",
    (map) => {
      if (disposed) map.dispose();
      else loaded++;
    },
    undefined,
    (error) => {
      if (disposed) return;
      failed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(512, 512);
  const mesh = new Mesh(new PlaneGeometry(100, 100), new MeshPhongMaterial({ color: 0xffffff, map: texture }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(1000, 1000, 1000);
  scene.add(mesh);
  return scene;
}
const scene1 = makeScene(maxAnisotropy);
const scene2 = makeScene(1);
const stats = new Stats();
document.body.appendChild(stats.dom);
let mouseX = 0;
let mouseY = 0;
function mousemove(event: MouseEvent): void {
  mouseX = event.clientX - innerWidth / 2;
  mouseY = event.clientY - innerHeight / 2;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("mousemove", mousemove);
window.addEventListener("resize", resize);
let frames = 0;
renderer.setAnimationLoop(() => {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y = clamp(camera.position.y + (-(mouseY - 200) - camera.position.y) * 0.05, 50, 1000);
  camera.lookAt(scene1.position);
  renderer.clear();
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, Math.max(0, innerWidth / 2 - 2), innerHeight);
  renderer.render(scene1, camera);
  renderer.setScissor(innerWidth / 2, 0, Math.max(0, innerWidth / 2 - 2), innerHeight);
  renderer.render(scene2, camera);
  renderer.setScissorTest(false);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (loaded === 2 && !failed) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("mousemove", mousemove);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene1);
  disposeObject(scene2);
  stats.dom.remove();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
