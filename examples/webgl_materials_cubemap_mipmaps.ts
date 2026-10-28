import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { TextureFilter, ColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { CubeTexture } from "ek3d/textures/CubeTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cubemap canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 10000);
camera.position.z = 500;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 1.5;
const manager = new LoadingManager();
const loader = new CubeTextureLoader(manager);
const textures: CubeTexture[] = [];
let disposed = false;
let failed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";
let levelsLoaded = 0;
for (let level = 0; level < 9; level++) {
  const urls = Array.from({ length: 6 }, (_, face) => `/examples/textures/cube/angus/cube_m0${level}_c0${face}.jpg`);
  textures[level] = loader.load(
    urls,
    () => {
      if (!disposed && ++levelsLoaded === 9) createScene();
    },
    undefined,
    (error) => {
      if (disposed) return;
      failed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    },
  );
}
function createScene(): void {
  const [texture, ...mipmaps] = textures;
  texture.mipmaps = mipmaps;
  texture.colorSpace = ColorSpace.SRGB;
  texture.minFilter = TextureFilter.LinearMipmapLinear;
  texture.magFilter = TextureFilter.Linear;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const sphere = new SphereGeometry(100, 128, 128);
  const manual = new MeshBasicMaterial({ color: 0xffffff, envMap: texture });
  manual.name = "manual mipmaps";
  const right = new Mesh(sphere, manual);
  right.position.x = 100;
  scene.add(right);
  const autoTexture = texture.clone();
  textures.push(autoTexture);
  autoTexture.mipmaps = [];
  autoTexture.generateMipmaps = true;
  autoTexture.needsUpdate = true;
  const auto = manual.clone();
  auto.name = "auto mipmaps";
  auto.envMap = autoTexture;
  const left = new Mesh(sphere, auto);
  left.position.x = -100;
  scene.add(left);
  loaded = true;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && !failed) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  disposeObject(scene);
  for (const texture of textures) texture.dispose();
  renderer.dispose();
});
