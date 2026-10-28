import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TransformControls } from "ek3d/addons/controls/TransformControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { ProgressiveLightMap } from "ek3d/addons/misc/ProgressiveLightMap";
import type { LightMapPacker } from "ek3d/addons/misc/ProgressiveLightMap";
import type { Object3D } from "ek3d/core/Object3D";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing progressive lightmap canvas");
const canvas = selected;
canvas.dataset.state = "loading";
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshPhongMaterial: phongShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 100, 200);
const scene = new Scene();
scene.background = new Color(0x949494);
scene.fog = new Fog(0x949494, 1000, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = true;
controls.minDistance = 100;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 1.5;
controls.target.set(0, 100, 0);
const origin = new Group();
origin.position.set(60, 150, 100);
scene.add(origin);
const lightControl = new TransformControls(camera, canvas);
lightControl.addEventListener("dragging-changed", (event) => {
  if ("value" in event && typeof event.value === "boolean") controls.enabled = !event.value;
});
lightControl.attach(origin);
scene.add(lightControl.getHelper());
const lights = Array.from({ length: 8 }, (_, i) => {
  const light = new DirectionalLight(0xffffff, Math.PI / 8);
  light.name = `Dir. Light ${i}`;
  light.position.set(200, 200, 200);
  light.castShadow = true;
  light.shadow.camera.near = 100;
  light.shadow.camera.far = 5000;
  light.shadow.camera.right = 150;
  light.shadow.camera.left = -150;
  light.shadow.camera.top = 150;
  light.shadow.camera.bottom = -150;
  light.shadow.mapSize.set(512, 512);
  return light;
});
const ground = new Mesh(new PlaneGeometry(600, 600), new MeshPhongMaterial({ color: 0xffffff, depthWrite: true }));
ground.position.y = -0.1;
ground.rotation.x = -Math.PI / 2;
ground.name = "Ground Mesh";
scene.add(ground);
const params = {
  Enable: true,
  "Blur Edges": true,
  "Blend Window": 200,
  "Light Radius": 50,
  "Ambient Weight": 0.5,
  "Debug Lightmap": false,
};
const gui = new GUI({ title: "Accumulation Settings" });
gui.add(params, "Enable");
gui.add(params, "Blur Edges");
gui.add(params, "Blend Window", 1, 500).step(1);
gui.add(params, "Light Radius", 0, 200).step(10);
gui.add(params, "Ambient Weight", 0, 1).step(0.1);
gui.add(params, "Debug Lightmap");
let disposed = false;
let lightmap: ProgressiveLightMap | undefined;
let modelControl: TransformControls | undefined;
let frame = 0;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  lightControl.dispose();
  modelControl?.dispose();
  gui.destroy();
  lightmap?.dispose();
  for (const light of lights) light.dispose();
  disposeObject(scene);
  renderer.dispose();
});
async function start(): Promise<void> {
  const response = await fetch("/examples/libs/potpack.module.js");
  if (!response.ok) throw new Error(`Unable to load potpack: HTTP ${response.status}`);
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  let runtime: unknown;
  // Vite cannot statically import a publicDir vendor asset.
  try {
    runtime = await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (
    typeof runtime !== "object" ||
    runtime === null ||
    !("potpack" in runtime) ||
    typeof runtime.potpack !== "function"
  )
    throw new Error("potpack runtime must export potpack");
  if (disposed) return;
  const gltf = await new GLTFLoader().loadAsync("/examples/models/gltf/ShadowmappableMesh.glb");
  if (disposed) {
    disposeObject(gltf.scene);
    return;
  }
  lightmap = new ProgressiveLightMap(renderer, runtime.potpack as LightMapPacker, 1024);
  const object = gltf.scene.children[0];
  if (!object) throw new Error("Missing shadowmappable mesh");
  const objects: Object3D[] = [ground, ...lights];
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.name = "Loaded Mesh";
      const old = child.material;
      if (Array.isArray(old)) old.forEach((material) => material.dispose());
      else old.dispose();
      child.material = new MeshPhongMaterial();
      objects.push(child);
    } else child.layers.disableAll();
  });
  lightmap.addObjectsToLightMap(objects);
  scene.add(object);
  object.scale.set(2, 2, 2);
  object.position.set(0, -16, 0);
  modelControl = new TransformControls(camera, canvas);
  modelControl.addEventListener("dragging-changed", (event) => {
    if ("value" in event && typeof event.value === "boolean") controls.enabled = !event.value;
  });
  modelControl.attach(object);
  scene.add(modelControl.getHelper());
  const target = new Group();
  target.position.set(0, 20, 0);
  object.add(target);
  for (const light of lights) light.target = target;
  renderer.setAnimationLoop(() => {
    controls.update();
    if (params.Enable && lightmap) {
      lightmap.update(camera, params["Blend Window"], params["Blur Edges"]);
      if (!lightmap.firstUpdate) lightmap.showDebugLightmap(params["Debug Lightmap"]);
    }
    for (const light of lights) {
      if (Math.random() > params["Ambient Weight"]) {
        light.position.set(
          origin.position.x + Math.random() * params["Light Radius"],
          origin.position.y + Math.random() * params["Light Radius"],
          origin.position.z + Math.random() * params["Light Radius"],
        );
      } else {
        const lambda = Math.acos(2 * Math.random() - 1) - 3.14159 / 2;
        const phi = 2 * 3.14159 * Math.random();
        light.position.set(
          Math.cos(lambda) * Math.cos(phi) * 300 + object.position.x,
          Math.abs(Math.cos(lambda) * Math.sin(phi) * 300) + object.position.y + 20,
          Math.sin(lambda) * 300 + object.position.z,
        );
      }
    }
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frame);
    canvas.dataset.state = "rendered";
  });
}
start().catch((error: unknown) => {
  if (!disposed) {
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
});
