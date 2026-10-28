import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ShadowMap } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SpotLightHelper } from "ek3d/helpers/SpotLightHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing spotlights canvas");
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = ShadowMap.PCF;
const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4.6, 2.2, -2.1);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.maxPolarAngle = Math.PI / 2;
controls.minDistance = 1;
controls.maxDistance = 10;
controls.update();
const scene = new Scene();
const floor = new Mesh(new PlaneGeometry(100, 100), new MeshPhongMaterial({ color: 0x808080 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.05;
floor.receiveShadow = true;
const box = new Mesh(new BoxGeometry(0.3, 0.1, 0.2), new MeshPhongMaterial({ color: 0xaaaaaa }));
box.castShadow = true;
box.receiveShadow = true;
box.position.y = 0.5;
scene.add(floor, box, new AmbientLight(0x444444));
const lights = [0xff7f00, 0x00ff7f, 0x7f00ff].map((color, i) => {
  const light = new SpotLight(color, 10);
  light.castShadow = true;
  light.angle = 0.3;
  light.penumbra = 0.2;
  light.decay = 2;
  light.distance = 50;
  light.position.set(1.5 - i * 1.5, 4, i === 1 ? 3.5 : 4.5);
  scene.add(light);
  return light;
});
const helpers = lights.map((light) => {
  const helper = new SpotLightHelper(light);
  scene.add(helper);
  return helper;
});
interface Motion {
  light: SpotLight;
  start: number;
  angleDuration: number;
  positionDuration: number;
  angle: number;
  penumbra: number;
  targetAngle: number;
  targetPenumbra: number;
  position: Vector3;
  targetPosition: Vector3;
}
let motions: Motion[] = [];
function tween(): void {
  const start = performance.now();
  motions = lights.map((light) => ({
    light,
    start,
    angleDuration: Math.random() * 3000 + 2000,
    positionDuration: Math.random() * 3000 + 2000,
    angle: light.angle,
    penumbra: light.penumbra,
    targetAngle: Math.random() * 0.7 + 0.1,
    targetPenumbra: Math.random() + 1,
    position: light.position.clone(),
    targetPosition: new Vector3(Math.random() * 3 - 1.5, Math.random() + 1.5, Math.random() * 3 - 1.5),
  }));
}
function ease(value: number): number {
  const t = Math.min(1, value);
  return t * (2 - t);
}
tween();
const interval = window.setInterval(tween, 5000);
renderer.setAnimationLoop(() => {
  const now = performance.now();
  for (const motion of motions) {
    const a = ease((now - motion.start) / motion.angleDuration);
    const p = ease((now - motion.start) / motion.positionDuration);
    motion.light.angle = motion.angle + (motion.targetAngle - motion.angle) * a;
    motion.light.penumbra = motion.penumbra + (motion.targetPenumbra - motion.penumbra) * a;
    motion.light.position.lerpVectors(motion.position, motion.targetPosition, p);
  }
  for (const helper of helpers) helper.update();
  renderer.render(scene, camera);
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  window.clearInterval(interval);
  renderer.setAnimationLoop(null);
  controls.dispose();
  for (const light of lights) light.dispose();
  disposeObject(scene);
  renderer.dispose();
});
