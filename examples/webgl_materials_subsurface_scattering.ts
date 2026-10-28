import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { FBXLoader } from "ek3d/addons/loaders/FBXLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { SubsurfaceScatteringShader } from "ek3d/addons/shaders/SubsurfaceScatteringShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import type { Material } from "ek3d/materials/Material";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import type { Group } from "ek3d/objects/Group";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { cloneUniforms } from "ek3d/renderers/shaders/UniformsUtils";
import { Scene } from "ek3d/scenes/Scene";
import { loadZlibDecoder } from "./fflate";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing subsurface canvas");
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 5000);
camera.position.set(0, 300, 1600);
const scene = new Scene();
scene.add(new AmbientLight(0xc1c1c1));
const directionalLight = new DirectionalLight(0xffffff, 0.03);
directionalLight.position.set(0, 0.5, 0.5).normalize();
scene.add(directionalLight);
const markers = [0xc1c1c1, 0xc1c100].map(
  (color) => new Mesh<MeshBasicMaterial>(new SphereGeometry(4, 8, 8), new MeshBasicMaterial({ color })),
);
markers[0].add(new PointLight(0xc1c1c1, 4, 300, 0));
markers[0].position.set(0, -50, 350);
markers[1].add(new PointLight(0xc1c100, 0.75, 500, 0));
markers[1].position.set(-100, 20, -260);
scene.add(...markers);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 500;
controls.maxDistance = 3000;
const stats = new Stats();
document.body.appendChild(stats.dom);
let disposed = false;
let model: Mesh | undefined;
let group: Group | undefined;
let frames = 0;
let pending = 3;
function loaded(): void {
  if (disposed) return;
  if (--pending === 0) canvas!.dataset.loaded = "true";
}
function failed(error: unknown): void {
  if (disposed) return;
  canvas!.dataset.state = "error";
  canvas!.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
const textureLoader = new TextureLoader();
const diffuse = textureLoader.load("/examples/models/fbx/white.jpg", loaded, undefined, failed);
diffuse.colorSpace = SRGBColorSpace;
diffuse.wrapS = diffuse.wrapT = RepeatWrapping;
const thickness = textureLoader.load("/examples/models/fbx/bunny_thickness.jpg", loaded, undefined, failed);
const shader = SubsurfaceScatteringShader;
const uniforms = cloneUniforms(shader.uniforms) as Record<string, { value: unknown }>;
uniforms.map.value = diffuse;
uniforms.diffuse.value = new Color(1, 0.2, 0.2);
uniforms.shininess.value = 500;
uniforms.thicknessMap.value = thickness;
uniforms.thicknessColor.value = new Color(0.5, 0.3, 0);
const params = { distortion: 0.1, ambient: 0.4, attenuation: 0.8, power: 2, scale: 16 };
for (const key of Object.keys(params) as Array<keyof typeof params>) {
  uniforms["thickness" + key[0].toUpperCase() + key.slice(1)].value = params[key];
}
const material = new ShaderMaterial({
  uniforms,
  vertexShader: shader.vertexShader,
  fragmentShader: shader.fragmentShader,
  lights: true,
});
const gui = new GUI({ title: "Thickness Control" });
for (const [key, max, step] of [
  ["distortion", 1, 0.01],
  ["ambient", 5, 0.05],
  ["attenuation", 5, 0.05],
  ["power", 16, 0.1],
  ["scale", 50, 0.1],
] as const) {
  gui.add(params, key, 0.01, max, step).onChange(() => {
    uniforms["thickness" + key[0].toUpperCase() + key.slice(1)].value = params[key];
    canvas!.dataset[key] = String(params[key]);
  });
}
function release(object: Group): void {
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      for (const value of Array.isArray(child.material) ? child.material : [child.material]) value.dispose();
    }
  });
}
void loadZlibDecoder()
  .then((runtime) => {
    if (disposed) return;
    new FBXLoader().setZlibDecoder(runtime).load(
      "/examples/models/fbx/stanford-bunny.fbx",
      (object) => {
        if (disposed) {
          release(object);
          return;
        }
        const mesh = object.children[0];
        if (!(mesh instanceof Mesh)) {
          release(object);
          failed(new Error("FBX bunny has no mesh"));
          return;
        }
        group = object;
        model = mesh;
        const original: Material | Material[] = model.material;
        for (const entry of Array.isArray(original) ? original : [original]) entry.dispose();
        model.material = material;
        model.position.set(0, 0, 10);
        model.scale.setScalar(1);
        scene.add(model);
        loaded();
      },
      undefined,
      failed,
    );
  })
  .catch(failed);
renderer.setAnimationLoop(() => {
  if (model) model.rotation.y = performance.now() / 5000;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.loaded === "true" && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", resize);
    renderer.setAnimationLoop(null);
    controls.dispose();
    gui.destroy();
    stats.dom.remove();
    model?.geometry.dispose();
    if (group) release(group);
    for (const marker of markers) {
      marker.geometry.dispose();
      marker.material.dispose();
    }
    diffuse.dispose();
    thickness.dispose();
    material.dispose();
    renderer.dispose();
  },
  { once: true },
);
