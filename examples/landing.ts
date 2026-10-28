import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping } from "ek3d/constants";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import type { WebGLCubeRenderTarget } from "ek3d/renderers/WebGLCubeRenderTarget";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing landing canvas");

const scene = new Scene();
const camera = new PerspectiveCamera(38, 1, 0.1, 30);
camera.position.z = 9;

const sculpture = new Group();
const knot = new Mesh<MeshStandardMaterial>(
  new TorusKnotGeometry(1.1, 0.34, 192, 32),
  new MeshStandardMaterial({ color: 0x8bc8b3, metalness: 0.95, roughness: 0.21, envMapIntensity: 1.2 }),
);
sculpture.add(knot);

const orbit = new Mesh<MeshBasicMaterial>(
  new TorusGeometry(2.15, 0.008, 8, 160),
  new MeshBasicMaterial({ color: 0xb5edcb, transparent: true, opacity: 0.28 }),
);
orbit.rotation.set(1.1, 0.35, -0.35);
sculpture.add(orbit);
scene.add(sculpture);

const key = new DirectionalLight(0xe5fff5, 1.5);
key.position.set(-3, 5, 5);
const fill = new DirectionalLight(0x6aa8ef, 0.8);
fill.position.set(4, 0, 2);
const rim = new DirectionalLight(0xffbe86, 1.3);
rim.position.set(1, -3, -2);
scene.add(key, fill, rim);

const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshStandardMaterial: standardShader,
  },
});
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = ToneMapping.Neutral;

const room = new RoomEnvironment();
const pmrem = new PMREMGenerator(renderer);
let environment: WebGLCubeRenderTarget;
try {
  environment = pmrem.fromScene(room, 0.04);
} finally {
  room.dispose();
  pmrem.dispose();
}
scene.environment = environment.texture;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const portraitLayout = width <= 760;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  const viewHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
  const viewWidth = viewHeight * camera.aspect;
  sculpture.scale.setScalar(
    Math.min(viewHeight * (portraitLayout ? 0.38 : 0.78), viewWidth * (portraitLayout ? 0.92 : 0.52)) / 4.3,
  );
  sculpture.position.set(viewWidth * (portraitLayout ? 0.03 : 0.24), viewHeight * (portraitLayout ? 0.23 : 0), 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
}

function animate(time: number): void {
  const seconds = time * 0.001;
  knot.rotation.set(0.35 + Math.sin(seconds * 0.18) * 0.15, seconds * 0.12, 0.2);
  orbit.rotation.z = -0.35 + Math.sin(seconds * 0.12) * 0.12;
  renderer.render(scene, camera);
}

function restore(event: PageTransitionEvent): void {
  if (event.persisted) renderer.setAnimationLoop(animate);
}

function release(event: PageTransitionEvent): void {
  renderer.setAnimationLoop(null);
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  window.removeEventListener("pageshow", restore);
  window.removeEventListener("pagehide", release);
  knot.geometry.dispose();
  knot.material.dispose();
  orbit.geometry.dispose();
  orbit.material.dispose();
  environment.dispose();
  dfgLUT.dispose();
  renderer.dispose();
}

resize();
renderer.setAnimationLoop(animate);
window.addEventListener("resize", resize);
window.addEventListener("pageshow", restore);
window.addEventListener("pagehide", release);
