import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, Side, Mapping, TextureFilter, Wrapping } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshPhysicalMaterial } from "ek3d/materials/MeshPhysicalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";
const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing transmission canvas");
const canvas = selected;
const params = {
  color: 0xffffff,
  transmission: 1,
  opacity: 1,
  metalness: 0,
  roughness: 0,
  ior: 1.5,
  thickness: 0.01,
  specularIntensity: 1,
  specularColor: 0xffffff,
  envMapIntensity: 1,
  exposure: 1,
  transmissionResolutionScale: 1,
};
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 2000);
camera.position.z = 120;
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
const image = document.createElement("canvas");
image.width = image.height = 2;
const context = image.getContext("2d");
if (!context) throw new Error("Unable to create alpha texture");
context.fillStyle = "white";
context.fillRect(0, 1, 2, 1);
const alphaMap = new CanvasTexture(image);
alphaMap.magFilter = TextureFilter.Nearest;
alphaMap.wrapS = alphaMap.wrapT = Wrapping.Repeat;
alphaMap.repeat.set(1, 3.5);
const material = new MeshPhysicalMaterial({
  color: params.color,
  metalness: params.metalness,
  roughness: params.roughness,
  ior: params.ior,
  alphaMap,
  envMapIntensity: params.envMapIntensity,
  transmission: params.transmission,
  specularIntensity: params.specularIntensity,
  specularColor: params.specularColor,
  opacity: params.opacity,
  side: Side.Double,
  transparent: true,
});
scene.add(new Mesh(new SphereGeometry(20, 64, 32), material));
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 150;
const gui = new GUI();
gui.addColor(params, "color");
gui.add(params, "transmission", 0, 1, 0.01);
gui.add(params, "opacity", 0, 1, 0.01);
gui.add(params, "metalness", 0, 1, 0.01);
gui.add(params, "roughness", 0, 1, 0.01);
gui.add(params, "ior", 1, 2, 0.01);
gui.add(params, "thickness", 0, 5, 0.01);
gui.add(params, "specularIntensity", 0, 1, 0.01);
gui.addColor(params, "specularColor");
gui.add(params, "envMapIntensity", 0, 1, 0.01).name("envMap intensity");
gui.add(params, "exposure", 0, 1, 0.01);
gui.add(params, "transmissionResolutionScale", 0.01, 1, 0.01).name("transmission resolution");
gui.open();
const manager = new LoadingManager();
let disposed = false,
  frames = 0;
let environment: DataTexture | undefined;
canvas.dataset.state = "loading";
new UltraHDRLoader(manager).load(
  "/examples/textures/equirectangular/royal_esplanade_2k.hdr.jpg",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = Mapping.EquirectangularReflection;
    scene.background = texture;
    material.envMap = texture;
    canvas.dataset.state = "rendered";
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
renderer.setAnimationLoop(() => {
  material.color.set(params.color);
  material.transmission = params.transmission;
  material.opacity = params.opacity;
  material.metalness = params.metalness;
  material.roughness = params.roughness;
  material.ior = params.ior;
  material.thickness = params.thickness;
  material.specularIntensity = params.specularIntensity;
  material.specularColor.set(params.specularColor);
  material.envMapIntensity = params.envMapIntensity;
  renderer.toneMappingExposure = params.exposure;
  renderer.transmissionResolutionScale = params.transmissionResolutionScale;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  scene.background = null;
  material.envMap = null;
  disposeObject(scene);
  environment?.dispose();
  dfg.dispose();
  renderer.dispose();
});
