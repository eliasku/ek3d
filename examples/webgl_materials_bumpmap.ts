import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeMaterial, disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing bump map canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.background = new Color(0x060708);
const camera = new PerspectiveCamera(27, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 12;
scene.add(new HemisphereLight(0x8d7c7c, 0x494966, 3));
const light = new SpotLight(0xffffde, 200);
light.position.set(3.5, 0, 7);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.camera.near = 2;
light.shadow.camera.far = 15;
light.shadow.camera.fov = 40;
light.shadow.bias = -0.005;
scene.add(light);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 8;
controls.maxDistance = 50;
controls.enablePan = false;
controls.enableDamping = true;
let disposed = false;
const manager = new LoadingManager();
const onError = (error: unknown): void => {
  if (!disposed) {
    canvas.dataset.state = "error";
    console.error(error);
  }
};
canvas.dataset.state = "loading";
const map = new TextureLoader(manager).load(
  "/examples/models/gltf/LeePerrySmith/Infinite-Level_02_Disp_NoSmoothUV-4096.jpg",
  undefined,
  undefined,
  onError,
);
const material = new MeshPhongMaterial({
  color: 0x9c6e49,
  specular: 0x666666,
  shininess: 25,
  bumpMap: map,
  bumpScale: 10,
});
new GLTFLoader(manager).load(
  "/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const child = gltf.scene.children[0];
    if (!(child instanceof Mesh)) {
      disposeObject(gltf.scene);
      onError(new Error("Missing head mesh"));
      return;
    }
    const mesh = new Mesh(child.geometry, material);
    mesh.position.y = -0.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    for (const old of Array.isArray(child.material) ? child.material : [child.material]) disposeMaterial(old);
    canvas.dataset.model = "loaded";
    canvas.dataset.state = "ready";
  },
  undefined,
  onError,
);
const params = { enableBumpMap: true };
const gui = new GUI();
gui
  .add(params, "enableBumpMap")
  .name("enable bump map")
  .onChange(() => {
    material.bumpMap = params.enableBumpMap ? map : null;
    material.needsUpdate = true;
  });
gui.add(material, "bumpScale", 0, 40).name("bump scale");
gui.open();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
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
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  manager.abort();
  controls.dispose();
  gui.destroy();
  disposeObject(scene, [material]);
  map.dispose();
  renderer.dispose();
});
