import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { ThreeMFLoader } from "ek3d/addons/loaders/3MFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import type { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { loadZipRuntime } from "./zip-runtime";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing 3MF materials canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 10, 500);
const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 500);
camera.position.set(-50, 40, 50);
scene.add(camera);
const hemi = new HemisphereLight(0xffffff, 0x8d8d8d, 3);
hemi.position.set(0, 100, 0);
scene.add(hemi);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 40, 50);
light.castShadow = true;
light.shadow.camera.top = 50;
light.shadow.camera.bottom = -25;
light.shadow.camera.left = -25;
light.shadow.camera.right = 25;
light.shadow.camera.near = 0.1;
light.shadow.camera.far = 200;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const ground = new Mesh<MeshPhongMaterial>(
  new PlaneGeometry(1000, 1000),
  new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 11;
ground.receiveShadow = true;
scene.add(ground);
const dfg = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfg,
  ltcTextures,
  shaders: { MeshPhongMaterial: phongShader, MeshStandardMaterial: standardShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
if (renderer.shadowMap === null) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 50;
controls.maxDistance = 200;
controls.enablePan = false;
controls.target.set(0, 20, 0);
controls.update();
const manager = new LoadingManager(undefined, undefined, (url) => reportFailure(`Failed to load ${url}`));
let model: Group | undefined,
  failure: string | null = null;
let disposed = false,
  frames = 0;
canvas.dataset.state = "loading";
function release(object: Group): void {
  disposeObject(object);
  scene.remove(object);
}
function reportFailure(error: unknown): void {
  if (disposed || failure !== null) return;
  failure = error instanceof Error ? error.message : String(error);
  canvas.dataset.state = "error";
  canvas.dataset.error = failure;
  console.error(error);
}
void loadZipRuntime()
  .then((runtime) => {
    if (disposed) return;
    new ThreeMFLoader(manager).setZipRuntime(runtime).load(
      "/examples/models/3mf/truck.3mf",
      (object) => {
        if (disposed) {
          release(object);
          return;
        }
        object.rotation.set(-Math.PI / 2, 0, 0);
        object.traverse((child) => {
          child.castShadow = true;
        });
        model = object;
        scene.add(object);
      },
      undefined,
      reportFailure,
    );
  })
  .catch(reportFailure);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (failure !== null) canvas.dataset.state = "error";
  else if (model !== undefined) canvas.dataset.state = "rendered";
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
  if (model !== undefined) release(model);
  ground.geometry.dispose();
  ground.material.dispose();
  light.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltcTextures)) texture.dispose();
  renderer.dispose();
});
