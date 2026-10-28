import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";
import { loadZstdDecoder } from "./zstd";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing FastHDR canvas");
const canvas: HTMLCanvasElement = selected;
const params = { image: "ballroom", fov: 40, exposure: 1, backgroundBlurriness: 0 };
const scene = new Scene();
const camera = new PerspectiveCamera(params.fov, innerWidth / innerHeight, 0.1, 50);
camera.position.set(7, 0, 0);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshPhysicalMaterial: physicalShader, MeshStandardMaterial: standardShader },
});
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const geometry = new SphereGeometry(0.45, 64, 32);
const materials = [
  new MeshPhysicalMaterial({ transmission: 1, thickness: 2, metalness: 0, roughness: 0 }),
  new MeshStandardMaterial({ metalness: 0, roughness: 1 }),
  new MeshStandardMaterial({ metalness: 1, roughness: 0 }),
  new MeshStandardMaterial({ metalness: 1, roughness: 0.5, color: 0x888888 }),
  new MeshStandardMaterial({ metalness: 0, roughness: 0, color: 0x6ab440 }),
];
for (let i = 0; i < materials.length; i++) {
  const sphere = new Mesh(geometry, materials[i]);
  sphere.position.z = 2 - i;
  scene.add(sphere);
}
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0.1;
controls.maxDistance = 20;
controls.enableDamping = true;
const stats = new Stats();
document.body.appendChild(stats.dom);
const manager = new LoadingManager();
const loader = new KTX2Loader(manager).setPath("/examples/textures/pmrem/").detectSupport(renderer);
const gui = new GUI();
gui
  .add(params, "image", {
    ballroom: "ballroom",
    "brown photostudio": "brown_photostudio_02",
    "cape hill": "cape_hill",
    cannon: "cannon",
    "metro noord": "metro_noord",
    "the sky is on fire": "the_sky_is_on_fire",
    "studio small 09": "studio_small_09",
    "wide street 01": "wide_street_01",
  })
  .onChange(loadTexture);
gui.add(params, "exposure", 0, 2, 0.01);
gui.add(params, "fov", 10, 100).onChange(() => {
  camera.fov = params.fov;
  camera.updateProjectionMatrix();
});
gui.add(params, "backgroundBlurriness", 0, 1, 0.01).name("background blurriness");
gui.open();
let disposed = false,
  request = 0,
  frames = 0;
let environment: Texture | undefined;
const decoder = loadZstdDecoder();
function fail(error: unknown, current: number): void {
  if (disposed || current !== request) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
async function loadTexture(): Promise<void> {
  const current = ++request;
  const name = params.image;
  canvas.dataset.state = "loading";
  delete canvas.dataset.error;
  try {
    const runtime = await decoder;
    if (disposed || current !== request) return;
    loader.setZSTDDecoder(runtime);
    const texture = await loader.loadAsync(`${name}_2k.pmrem.ktx2`);
    if (disposed || current !== request) {
      texture.dispose();
      return;
    }
    texture.isPMREMTexture = true;
    environment?.dispose();
    environment = texture;
    scene.environment = texture;
    scene.background = texture;
    canvas.dataset.asset = name;
    canvas.dataset.state = "rendered";
  } catch (error) {
    fail(error, current);
  }
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  request++;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  scene.environment = scene.background = null;
  environment?.dispose();
  disposeObject(scene);
  loader.dispose();
  dfg.dispose();
  renderer.dispose();
});
void loadTexture();
renderer.setAnimationLoop(() => {
  stats.begin();
  renderer.toneMappingExposure = params.exposure;
  scene.backgroundBlurriness = params.backgroundBlurriness;
  controls.update();
  renderer.render(scene, camera);
  stats.end();
  canvas.dataset.frames = String(++frames);
});
