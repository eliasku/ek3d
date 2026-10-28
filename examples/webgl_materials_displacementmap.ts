import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { DoubleSide } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing displacement map canvas");
const canvas: HTMLCanvasElement = selected;
const settings = {
  metalness: 1,
  roughness: 0.4,
  ambientIntensity: 0.2,
  aoMapIntensity: 1,
  envMapIntensity: 1,
  displacementScale: 2.436143,
  normalScale: 1,
};
const height = 500;
const scene = new Scene();
const camera = new OrthographicCamera(
  (-height * innerWidth) / innerHeight,
  (height * innerWidth) / innerHeight,
  height,
  -height,
  1,
  10000,
);
camera.position.z = 1500;
scene.add(camera);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enableDamping = true;
const ambient = new AmbientLight(0xffffff, settings.ambientIntensity);
scene.add(ambient);
const point = new PointLight(0xff0000, 1.5, 0, 0);
point.position.z = 2500;
scene.add(point);
camera.add(new PointLight(0xff6666, 3, 0, 0));
const blue = new PointLight(0x0000ff, 1.5, 0, 0);
blue.position.set(-1000, 0, 1000);
scene.add(blue);
let disposed = false;
const manager = new LoadingManager();
const onError = (error: unknown): void => {
  if (!disposed) {
    canvas.dataset.state = "error";
    console.error(error);
  }
};
canvas.dataset.state = "loading";
const cube = new CubeTextureLoader(manager).setPath("/examples/textures/cube/SwedishRoyalCastle/").load(
  ["px", "nx", "py", "ny", "pz", "nz"].map((name) => `${name}.jpg`),
  undefined,
  undefined,
  onError,
);
const loader = new TextureLoader(manager);
const base = "/examples/models/obj/ninja/";
const normal = loader.load(base + "normal.png", undefined, undefined, onError);
const ao = loader.load(base + "ao.jpg", undefined, undefined, onError);
const displacement = loader.load(base + "displacement.jpg", undefined, undefined, onError);
const material = new MeshStandardMaterial({
  color: 0xc1c1c1,
  roughness: settings.roughness,
  metalness: settings.metalness,
  normalMap: normal,
  normalScale: new Vector2(1, -1),
  aoMap: ao,
  aoMapIntensity: 1,
  displacementMap: displacement,
  displacementScale: settings.displacementScale,
  displacementBias: -0.428408,
  envMap: cube,
  envMapIntensity: settings.envMapIntensity,
  side: DoubleSide,
});
new OBJLoader(manager).load(
  base + "ninjaHead_Low.obj",
  (group) => {
    if (disposed) {
      disposeObject(group);
      return;
    }
    const child = group.children[0];
    if (!(child instanceof Mesh)) {
      disposeObject(group);
      onError(new Error("Missing ninja mesh"));
      return;
    }
    child.geometry.center();
    const mesh = new Mesh(child.geometry, material);
    mesh.scale.multiplyScalar(25);
    scene.add(mesh);
    for (const old of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(old);
    canvas.dataset.model = "loaded";
    canvas.dataset.state = "ready";
  },
  undefined,
  onError,
);
const gui = new GUI();
gui.add(settings, "metalness", 0, 1).onChange(() => {
  material.metalness = settings.metalness;
});
gui.add(settings, "roughness", 0, 1).onChange(() => {
  material.roughness = settings.roughness;
});
gui.add(settings, "aoMapIntensity", 0, 1).onChange(() => {
  material.aoMapIntensity = settings.aoMapIntensity;
});
gui.add(settings, "ambientIntensity", 0, 1).onChange(() => {
  ambient.intensity = settings.ambientIntensity;
});
gui.add(settings, "envMapIntensity", 0, 3).onChange(() => {
  material.envMapIntensity = settings.envMapIntensity;
});
gui.add(settings, "displacementScale", 0, 3).onChange(() => {
  material.displacementScale = settings.displacementScale;
});
gui.add(settings, "normalScale", -1, 1).onChange(() => {
  material.normalScale.set(1, -1).multiplyScalar(settings.normalScale);
});
const stats = new Stats();
document.body.appendChild(stats.dom);
let angle = 0;
renderer.setAnimationLoop(() => {
  controls.update();
  stats.begin();
  point.position.x = 2500 * Math.cos(angle);
  point.position.z = 2500 * Math.sin(angle);
  angle += 0.01;
  renderer.render(scene, camera);
  stats.end();
});
function resize(): void {
  const aspect = innerWidth / innerHeight;
  camera.left = -height * aspect;
  camera.right = height * aspect;
  camera.top = height;
  camera.bottom = -height;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
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
  stats.dom.remove();
  disposeObject(scene, [material]);
  dfg.dispose();
  renderer.dispose();
});
