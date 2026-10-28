import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing morph sphere canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 100);
camera.position.set(0, 5, 5);
const scene = new Scene();
const light1 = new PointLight(0xff2200, 50000);
light1.position.set(100, 100, 100);
const light2 = new PointLight(0x22ff00, 10000);
light2.position.set(-100, -100, -100);
scene.add(light1, light2, new AmbientLight(0x111111));
const timer = new Timer();
timer.connect(document);
const dfg = createDFGLUT();
const ltc = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  ltcTextures: ltc,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
    PointsMaterial: pointsShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 20;
let disposed = false;
let mesh: Mesh | undefined;
let sign = 1;
let frames = 0;
let textureLoaded = false;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
const texture = new TextureLoader().load(
  "/examples/textures/sprites/disc.png",
  (map) => {
    if (disposed) map.dispose();
    else textureLoaded = true;
  },
  undefined,
  fail,
);
new GLTFLoader().load(
  "/examples/models/gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const object = gltf.scene.getObjectByName("AnimatedMorphSphere");
    if (!(object instanceof Mesh)) {
      disposeObject(gltf.scene);
      fail(new Error("AnimatedMorphSphere mesh not found"));
      return;
    }
    mesh = object;
    mesh.rotation.z = Math.PI / 2;
    scene.add(mesh);
    const material = new PointsMaterial({ size: 10, sizeAttenuation: false, map: texture, alphaTest: 0.5 });
    const points = new Points(mesh.geometry, material);
    points.morphTargetInfluences = mesh.morphTargetInfluences;
    points.morphTargetDictionary = mesh.morphTargetDictionary;
    mesh.add(points);
  },
  undefined,
  fail,
);
renderer.setAnimationLoop(() => {
  timer.update();
  if (mesh) {
    const step = timer.getDelta() * 0.5;
    mesh.rotation.y += step;
    const influences = mesh.morphTargetInfluences!;
    influences[1] += step * sign;
    if (influences[1] <= 0 || influences[1] >= 1) sign *= -1;
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (mesh && textureLoaded) canvas.dataset.state = "rendered";
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
  timer.disconnect();
  controls.dispose();
  if (mesh) disposeObject(mesh);
  else texture.dispose();
  light1.dispose();
  light2.dispose();
  dfg.dispose();
  for (const texture of Object.values(ltc)) texture.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
