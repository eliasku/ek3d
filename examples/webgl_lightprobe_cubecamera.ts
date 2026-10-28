import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { LightProbeHelper } from "ek3d/addons/helpers/LightProbeHelper";
import { LightProbeGenerator } from "ek3d/addons/lights/LightProbeGenerator";
import { CubeCamera } from "ek3d/cameras/CubeCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { LightProbe } from "ek3d/lights/LightProbe";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cube camera probe canvas");
const canvas = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 30);
const renderer = new WebGLRenderer({ canvas, antialias: true, createBackground: WebGLBackground });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const target = new WebGLCubeRenderTarget(256);
const cubeCamera = new CubeCamera(1, 1000, target);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 50;
controls.enablePan = false;
const probe = new LightProbe();
scene.add(probe);
let disposed = false;
let pending = false;
let frames = 0;
canvas.dataset.state = "loading";
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
}
controls.addEventListener("change", render);
const manager = new LoadingManager();
const cube = new CubeTextureLoader(manager).setPath("/examples/textures/cube/pisa/").load(
  ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
  async (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    scene.background = texture;
    pending = true;
    try {
      cubeCamera.update(renderer, scene);
      const generated = await LightProbeGenerator.fromCubeRenderTarget(renderer, target);
      if (disposed) return;
      probe.copy(generated);
      scene.add(new LightProbeHelper(probe, 5));
      canvas.dataset.state = "rendered";
      render();
    } catch (error) {
      if (!disposed) {
        canvas.dataset.state = "error";
        canvas.dataset.error = String(error);
        console.error(error);
      }
    } finally {
      pending = false;
      if (disposed) {
        target.dispose();
        renderer.dispose();
      }
    }
  },
  undefined,
  (error) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      canvas.dataset.error = String(error);
      console.error(error);
    }
  },
);
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  controls.dispose();
  scene.background = null;
  disposeObject(scene);
  cube.dispose();
  if (!pending) {
    target.dispose();
    renderer.dispose();
  }
});
