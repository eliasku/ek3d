import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { LightProbeHelper } from "ek3d/addons/helpers/LightProbeHelper";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { LightProbeGenerator } from "ek3d/addons/lights/LightProbeGenerator";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LightProbe } from "ek3d/lights/LightProbe";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing light probe canvas");
const canvas = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 0, 30);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.No;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 50;
controls.enablePan = false;
const probe = new LightProbe();
const params = { lightProbeIntensity: 1, directionalLightIntensity: 0.6, envMapIntensity: 1 };
const light = new DirectionalLight(0xffffff, params.directionalLightIntensity);
light.position.set(10, 10, 10);
scene.add(probe, light);
let material: MeshStandardMaterial | undefined;
let disposed = false;
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
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    scene.background = texture;
    probe.copy(LightProbeGenerator.fromCubeTexture(texture));
    probe.intensity = params.lightProbeIntensity;
    probe.position.set(-10, 0, 0);
    material = new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0,
      envMap: texture,
      envMapIntensity: params.envMapIntensity,
    });
    scene.add(new Mesh(new SphereGeometry(5, 64, 32), material), new LightProbeHelper(probe, 1));
    canvas.dataset.state = "rendered";
    render();
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
const gui = new GUI({ title: "Intensity" });
gui
  .add(params, "lightProbeIntensity", 0, 1, 0.02)
  .name("light probe")
  .onChange(() => {
    probe.intensity = params.lightProbeIntensity;
    render();
  });
gui
  .add(params, "directionalLightIntensity", 0, 1, 0.02)
  .name("directional light")
  .onChange(() => {
    light.intensity = params.directionalLightIntensity;
    render();
  });
gui
  .add(params, "envMapIntensity", 0, 1, 0.02)
  .name("envMap")
  .onChange(() => {
    if (material) material.envMapIntensity = params.envMapIntensity;
    render();
  });
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
  gui.destroy();
  scene.background = null;
  if (material) material.envMap = null;
  disposeObject(scene);
  cube.dispose();
  dfg.dispose();
  renderer.dispose();
});
