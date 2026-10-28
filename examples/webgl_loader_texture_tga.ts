import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { TGALoader } from "ek3d/addons/loaders/TGALoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing TGA loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, 5);

const scene = new Scene();
scene.add(new AmbientLight(0xffffff, 1.5));
const light = new DirectionalLight(0xffffff, 2.5);
light.position.set(1, 1, 1);
scene.add(light);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;

const stats = new Stats();
document.body.appendChild(stats.dom);

const loader = new TGALoader();
const geometry = new BoxGeometry();
const materials: MeshPhongMaterial[] = [];
const textures: DataTexture[] = [];
const pending = new Set<string>(["crate_grey8", "crate_color8"]);
let disposed = false;
let failed = false;
let frames = 0;

function reportError(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

function addTexturedBox(url: string, label: string, x: number): void {
  const texture = loader.load(
    url,
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = SRGBColorSpace;
      pending.delete(label);
    },
    undefined,
    (error) => {
      pending.delete(label);
      reportError(error);
    },
  );
  textures.push(texture);
  const material = new MeshPhongMaterial({ color: 0xffffff, map: texture });
  materials.push(material);
  const mesh = new Mesh(geometry, material);
  mesh.position.x = x;
  scene.add(mesh);
}

// Box 1 uses the grey8 texture, box 2 the palettized color texture.
addTexturedBox("/examples/textures/crate_grey8.tga", "crate_grey8", -1);
addTexturedBox("/examples/textures/crate_color8.tga", "crate_color8", 1);

canvas.dataset.textures = "0";
canvas.dataset.state = "loading";
renderer.setAnimationLoop(animate);

function animate(): void {
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.textures = String(2 - pending.size);
  if (!disposed && !failed) canvas.dataset.state = pending.size === 0 ? "rendered" : "loading";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    renderer.setAnimationLoop(null);
    stats.dom.remove();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    geometry.dispose();
    renderer.dispose();
  },
  { once: true },
);
