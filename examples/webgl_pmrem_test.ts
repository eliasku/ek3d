import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing PMREM test canvas");
const canvas: HTMLCanvasElement = selected;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshPhysicalMaterial: physicalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 1;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 30);
camera.position.set(0, 0, 16);
function updateCamera(): void {
  camera.fov = (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / camera.aspect) * 180) / Math.PI;
  camera.updateProjectionMatrix();
}
updateCamera();
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 4;
controls.maxDistance = 20;
const light = new DirectionalLight(0xffffff, 0);
light.position.setFromSphericalCoords(100, -((213.5 * Math.PI) / 512), Math.PI / 2 - (597.5 * Math.PI) / 512);
scene.add(light);
const materials: MeshPhysicalMaterial[] = [];
const params = { enabled: true };
const gui = new GUI();
gui
  .add(params, "enabled")
  .name("PMREM")
  .onChange(() => {
    light.intensity = params.enabled ? 0 : 1;
    for (const material of materials) material.envMapIntensity = params.enabled ? 1 : 0;
  });
let target: WebGLCubeRenderTarget | null = null;
let disposed = false,
  loaded = false,
  frames = 0,
  generatorDisposed = false;
canvas.dataset.state = "loading";
const generator = new PMREMGenerator(renderer);
generator.compileEquirectangularShader();
function disposeGenerator(): void {
  if (!generatorDisposed) {
    generatorDisposed = true;
    generator.dispose();
  }
}
new HDRLoader().setPath("/examples/textures/equirectangular/").load(
  "spot1Lux.hdr",
  (texture) => {
    if (!disposed) {
      target = generator.fromEquirectangular(texture);
      scene.background = target.texture;
      const geometry = new SphereGeometry(0.4, 32, 32);
      for (let x = 0; x <= 10; x++)
        for (let y = 0; y <= 2; y++) {
          const material = new MeshPhysicalMaterial({
            roughness: x / 10,
            metalness: y < 1 ? 1 : 0,
            color: y < 2 ? 0xffffff : 0,
            envMap: target.texture,
            envMapIntensity: params.enabled ? 1 : 0,
          });
          materials.push(material);
          const mesh = new Mesh(geometry, material);
          mesh.position.set(x - 5, 1 - y, 0);
          scene.add(mesh);
        }
      loaded = true;
    }
    texture.dispose();
    disposeGenerator();
  },
  undefined,
  (cause) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(cause);
    }
    disposeGenerator();
  },
);
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  updateCamera();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  target?.dispose();
  disposeGenerator();
  dfg.dispose();
  renderer.dispose();
});
