import { TIFFLoader } from "ek3d/addons/loaders/TIFFLoader";
import type { TIFFRuntime } from "ek3d/addons/loaders/TIFFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing TIFF canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 4;
const scene = new Scene();
const geometry = new PlaneGeometry();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const manager = new LoadingManager();
let disposed = false;
let failure = false;
let loaded = 0;
let frames = 0;
canvas.dataset.state = "loading";
function reportFailure(cause: unknown): void {
  if (disposed) return;
  failure = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
async function loadTextures(): Promise<void> {
  const response = await fetch("/examples/vendor/utif.module.js");
  if (!response.ok) throw new Error(`Unable to load UTIF: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  let runtime: TIFFRuntime;
  try {
    // Vite cannot statically import publicDir vendor assets.
    const module: { default: TIFFRuntime } = await import(/* @vite-ignore */ url);
    runtime = module.default;
  } finally {
    URL.revokeObjectURL(url);
  }
  if (disposed) return;
  const loader = new TIFFLoader(runtime, manager);
  ["uncompressed", "lzw", "jpeg"].forEach((format, index) => {
    loader.load(
      `/examples/textures/tiff/crate_${format}.tif`,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = ColorSpace.SRGB;
        const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture }));
        mesh.position.x = (index - 1) * 1.5;
        scene.add(mesh);
        loaded++;
      },
      undefined,
      reportFailure,
    );
  });
}
void loadTextures().catch(reportFailure);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (!failure && loaded === 3) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  disposeObject(scene);
  geometry.dispose();
  renderer.dispose();
});
