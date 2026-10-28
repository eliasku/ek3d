import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { DebugEnvironment } from "ek3d/addons/environments/DebugEnvironment";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { HDRCubeTextureLoader } from "ek3d/addons/loaders/HDRCubeTextureLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, TextureFilter } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing HDR environment canvas");
const canvas: HTMLCanvasElement = selected;
const params = { envMap: "HDR", roughness: 0, metalness: 0, exposure: 1, debug: false };
const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 120;
const scene = new Scene();
scene.background = new Color(0);
const torus = new Mesh<MeshStandardMaterial>(
  new TorusKnotGeometry(18, 8, 150, 20),
  new MeshStandardMaterial({ color: 0xffffff, metalness: params.metalness, roughness: params.roughness }),
);
const plane = new Mesh<MeshBasicMaterial>(new PlaneGeometry(200, 200), new MeshBasicMaterial());
plane.position.y = -50;
plane.rotation.x = -Math.PI * 0.5;
scene.add(torus, plane);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader, MeshStandardMaterial: standardShader },
});
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const pmrem = new PMREMGenerator(renderer);
pmrem.compileCubemapShader();
const environment = new DebugEnvironment();
const generated = pmrem.fromScene(environment);
environment.dispose();
const manager = new LoadingManager();
let hdrTarget: WebGLCubeRenderTarget | undefined;
let ldrTarget: WebGLCubeRenderTarget | undefined;
let disposed = false;
let failure = false;
let frames = 0;
canvas.dataset.state = "loading";
function reportFailure(cause: unknown): void {
  if (disposed) return;
  failure = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
const names = ["px", "nx", "py", "ny", "pz", "nz"];
const hdr = new HDRCubeTextureLoader(manager).setPath("/examples/textures/cube/pisaHDR/").load(
  names.map((name) => `${name}.hdr`),
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    hdrTarget = pmrem.fromCubemap(texture);
    texture.magFilter = TextureFilter.Linear;
    texture.needsUpdate = true;
  },
  undefined,
  reportFailure,
);
const ldr = new CubeTextureLoader(manager).setPath("/examples/textures/cube/pisa/").load(
  names.map((name) => `${name}.png`),
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    ldrTarget = pmrem.fromCubemap(texture);
  },
  undefined,
  reportFailure,
);
const stats = new Stats();
document.body.appendChild(stats.dom);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 50;
controls.maxDistance = 300;
const gui = new GUI();
gui.add(params, "envMap", ["Generated", "LDR", "HDR"]);
gui.add(params, "roughness", 0, 1, 0.01);
gui.add(params, "metalness", 0, 1, 0.01);
gui.add(params, "exposure", 0, 2, 0.01);
gui.add(params, "debug");
gui.open();
renderer.setAnimationLoop(() => {
  stats.begin();
  torus.material.roughness = params.roughness;
  torus.material.metalness = params.metalness;
  const target = params.envMap === "Generated" ? generated : params.envMap === "LDR" ? ldrTarget : hdrTarget;
  const cube = params.envMap === "Generated" ? generated.texture : params.envMap === "LDR" ? ldr : hdr;
  const map = target?.texture ?? null;
  if (map && map !== torus.material.envMap) {
    torus.material.envMap = map;
    torus.material.needsUpdate = true;
    plane.material.map = map;
    plane.material.needsUpdate = true;
  }
  torus.rotation.y += 0.005;
  plane.visible = params.debug;
  scene.background = cube;
  renderer.toneMappingExposure = params.exposure;
  renderer.render(scene, camera);
  stats.end();
  canvas.dataset.frames = String(++frames);
  if (!failure && hdrTarget && ldrTarget) canvas.dataset.state = "rendered";
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
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  generated.dispose();
  hdrTarget?.dispose();
  ldrTarget?.dispose();
  hdr.dispose();
  ldr.dispose();
  pmrem.dispose();
  dfg.dispose();
  stats.dom.remove();
  renderer.dispose();
});
