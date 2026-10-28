import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const status = document.querySelector<HTMLElement>("#status")!;
const priority = new URLSearchParams(location.search).get("background") === "auto" ? "auto" : "low";
const models = [
  "BoomBox.glb",
  "coffeeMug.glb",
  "Stork.glb",
  "Flamingo.glb",
  "Parrot.glb",
  "RobotExpressive/RobotExpressive.glb",
  "DiffuseRoughnessParameterSweep.glb",
  "godrays_demo.glb",
  "collision-world.glb",
  "ShadowmappableMesh.glb",
  "ShaderBall.glb",
  "DispersionTest.glb",
];
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(3, 2, 3);
camera.zoom = 3.4;
camera.updateProjectionMatrix();
const scene = new Scene();
scene.background = new Color(0x333333);
scene.add(new HemisphereLight(0xffffff, 0x444444, 3));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(2, 4, 3);
scene.add(light);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader, MeshPhysicalMaterial: physicalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
let disposed = false,
  failed = false,
  count = 0,
  frames = 0;
let heroTime = "loading";
canvas.dataset.state = "loading";
const start = performance.now();
const background = new GLTFLoader().setPath("/examples/models/gltf/").setPriority(priority).setCache("reload");
const hero = new GLTFLoader().setPath("/examples/models/gltf/").setCache("reload");
function updateStatus(): void {
  status.textContent = `Main asset (auto): ${heroTime}; background assets (${priority}): ${count} / ${models.length}`;
}
function error(cause: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
for (const name of models)
  background.load(
    name,
    (gltf) => {
      disposeObject(gltf.scene);
      if (disposed) return;
      count++;
      updateStatus();
    },
    undefined,
    error,
  );
hero.load(
  "Horse.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    heroTime = `${(performance.now() - start).toFixed(0)} ms`;
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    gltf.scene.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
    box.setFromObject(gltf.scene);
    gltf.scene.position.sub(box.getCenter(new Vector3()));
    scene.add(gltf.scene);
    updateStatus();
    render();
    if (!failed) canvas.dataset.state = "rendered";
  },
  undefined,
  error,
);
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
updateStatus();
render();
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  disposeObject(scene);
  dfg.dispose();
  renderer.dispose();
});
