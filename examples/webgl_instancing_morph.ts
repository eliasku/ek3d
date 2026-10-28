import { SunLight } from "ek3d/addons/lights/SunLight";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import type { Object3D } from "ek3d/core/Object3D";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { createLTCTextures } from "ek3d/renderers/shaders/LTCTextures";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (!element) throw new Error("Missing instanced morph canvas");
const canvas: HTMLCanvasElement = element;
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 100, 10000);
const scene = new Scene();
scene.background = new Color(0x99ddff);
scene.fog = new Fog(0x99ddff, 5000, 10000);
const light = new SunLight(0xffffff, 2);
light.position.set(200, 1000, 50);
light.castShadow = true;
light.shadow.camera.far = 10000;
light.shadow.mapSize.setScalar(2048);
scene.add(light, new HemisphereLight(0x99ddff, 0x669933, 0.5));
const ground = new Mesh(
  new PlaneGeometry(1000000, 1000000),
  new MeshStandardMaterial({ color: 0x669933, depthWrite: true }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const dfgLUT = createDFGLUT();
const ltcTextures = createLTCTextures();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfgLUT,
  ltcTextures,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
const timer = new Timer();
timer.connect(document);
const stats = new Stats();
document.body.appendChild(stats.dom);
const offsets = new Float32Array(1024);
for (let i = 0; i < offsets.length; i++) offsets[i] = Math.random() * 3;
let dummy: (Mesh & { morphTargetInfluences: number[] }) | null = null;
let mesh: InstancedMesh | null = null;
let mixer: AnimationMixer | null = null;
let model: Object3D | null = null;
let disposed = false;
let frames = 0;
canvas.dataset.state = "loading";
new GLTFLoader().load(
  "/examples/models/gltf/Horse.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const horse = gltf.scene.children[0];
    if (!(horse instanceof Mesh) || !horse.morphTargetInfluences || !gltf.animations[0]) {
      disposeObject(gltf.scene);
      canvas.dataset.state = "error";
      canvas.dataset.error = "Horse model has no animated morph mesh";
      return;
    }
    dummy = horse as Mesh & { morphTargetInfluences: number[] };
    model = gltf.scene;
    mesh = new InstancedMesh(dummy.geometry, dummy.material, 1024);
    mesh.castShadow = true;
    for (let x = 0, i = 0; x < 32; x++) {
      for (let y = 0; y < 32; y++, i++) {
        dummy.position.set(5000 - 300 * x + 200 * Math.random(), 0, 5000 - 300 * y);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new Color(`hsl(${Math.random() * 360}, 50%, 66%)`));
      }
    }
    scene.add(mesh);
    mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  const time = timer.getElapsed();
  camera.position.set(Math.sin(time / 10) * 3000, 1500 + 1000 * Math.cos(time / 5), Math.cos(time / 10) * 3000);
  camera.lookAt(0, 0, 0);
  if (mesh && mixer && dummy) {
    for (let i = 0; i < offsets.length; i++) {
      mixer.setTime(time + offsets[i]);
      mesh.setMorphAt(i, dummy);
    }
    if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (mesh && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.disconnect();
  stats.dom.removeEventListener("click", stats._onClick);
  stats.dom.remove();
  mixer?.stopAllAction();
  mesh?.dispose();
  if (model) disposeObject(model);
  disposeObject(ground);
  light.dispose();
  dfgLUT.dispose();
  ltcTextures.LTC_FLOAT_1.dispose();
  ltcTextures.LTC_FLOAT_2.dispose();
  ltcTextures.LTC_HALF_1.dispose();
  ltcTextures.LTC_HALF_2.dispose();
  renderer.dispose();
});
