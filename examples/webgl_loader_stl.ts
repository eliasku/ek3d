import { STLLoader, type STLGeometry } from "ek3d/addons/loaders/STLLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing STL loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 15);
camera.position.set(3, 0.15, 3);

const cameraTarget = new Vector3(0, -0.25, 0);

const scene = new Scene();
scene.background = new Color(0x72645b);
scene.fog = new Fog(0x72645b, 2, 15);

// Ground

const groundGeometry = new PlaneGeometry(40, 40);
const groundMaterial = new MeshPhongMaterial({ color: 0xcbcbcb, specular: 0x474747 });
const plane = new Mesh(groundGeometry, groundMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -0.5;
plane.receiveShadow = true;
scene.add(plane);

// Lights
const shadowedLights: DirectionalLight[] = [];

scene.add(new HemisphereLight(0x8d7c7c, 0x494966, 3));
addShadowedLight(1, 1, 1, 0xffffff, 3.5);
addShadowedLight(0.5, 1, -1, 0xffd500, 3);

// Renderer

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);

const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("the shadow map system failed to install");
shadowMap.enabled = true;

// Stats

const stats = new Stats();
document.body.appendChild(stats.dom);

// Models

const diskMaterial = new MeshPhongMaterial({ color: 0xff9c7c, specular: 0x494949, shininess: 200 });
const pr2Material = new MeshPhongMaterial({ color: 0xd5d5d5, specular: 0x494949, shininess: 200 });

const meshes: Mesh[] = [];
const materials: MeshPhongMaterial[] = [diskMaterial, pr2Material];

let frames = 0;
let loadedCount = 0;
let loadFailed = false;
let disposed = false;

canvas.dataset.state = "loading";

// Upstream loads the four models independently: one failure must not hide the others.
const stlLoader = new STLLoader();
load("/examples/models/stl/ascii/slotted_disk.stl", (geometry) => {
  addModel(geometry, diskMaterial, [0, -0.25, 0.6], [0, -Math.PI / 2, 0], 0.5);
});
load("/examples/models/stl/binary/pr2_head_pan.stl", (geometry) => {
  addModel(geometry, pr2Material, [0, -0.37, -0.6], [-Math.PI / 2, 0, 0], 2);
});
load("/examples/models/stl/binary/pr2_head_tilt.stl", (geometry) => {
  addModel(geometry, pr2Material, [0.136, -0.37, -0.6], [-Math.PI / 2, 0.3, 0], 2);
});
load("/examples/models/stl/binary/colored.stl", (geometry) => {
  canvas.dataset.colored = String(geometry.hasColors);
  canvas.dataset.alpha = String(geometry.alpha);
  let material = pr2Material;
  if (geometry.hasColors) {
    material = new MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });
    materials.push(material);
  }
  addModel(geometry, material, [0.5, 0.2, 0], [-Math.PI / 2, Math.PI / 2, 0], 0.3);
});

function load(url: string, onLoad: (geometry: STLGeometry) => void): void {
  stlLoader.load(
    url,
    (geometry) => {
      if (disposed) {
        geometry.dispose();
        return;
      }
      onLoad(geometry);
      loadedCount++;
      canvas.dataset.loaded = `${loadedCount}/4`;
    },
    undefined,
    (cause: unknown) => {
      if (disposed) return;
      loadFailed = true;
      canvas.dataset.state = "error";
      canvas.dataset.error = cause instanceof Error ? cause.message : String(cause);
      console.error("Error loading STL model", cause);
    },
  );
}

function addModel(
  geometry: STLGeometry,
  material: MeshPhongMaterial,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: number,
): void {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  meshes.push(mesh);
}

function addShadowedLight(x: number, y: number, z: number, color: number, intensity: number): void {
  const directionalLight = new DirectionalLight(color, intensity);
  directionalLight.position.set(x, y, z);
  scene.add(directionalLight);

  directionalLight.castShadow = true;

  const d = 1;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;

  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 4;

  directionalLight.shadow.bias = -0.002;

  shadowedLights.push(directionalLight);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  const timer = Date.now() * 0.0005;

  camera.position.x = Math.cos(timer) * 3;
  camera.position.z = Math.sin(timer) * 3;

  camera.lookAt(cameraTarget);

  renderer.render(scene, camera);
  stats.update();

  frames++;
  canvas.dataset.frames = String(frames);

  // Only a fully loaded page counts as rendered; a failed load keeps the error state.
  if (loadedCount === 4 && !loadFailed) canvas.dataset.state = "rendered";
}

function dispose(): void {
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);
  for (const mesh of meshes) mesh.geometry.dispose();
  for (const material of materials) material.dispose();
  groundGeometry.dispose();
  groundMaterial.dispose();
  for (const light of shadowedLights) light.dispose();
  stats.dom.remove();
  renderer.dispose();
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", dispose, { once: true });
