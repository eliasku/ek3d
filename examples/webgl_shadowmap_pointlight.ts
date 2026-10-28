import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BackSide, DoubleSide, NearestFilter, RepeatWrapping } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing shadow canvas");
const canvas = selected;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, 10, 40);
const scene = new Scene();
scene.add(new AmbientLight(0x111122, 3));
function createLight(color: number): PointLight {
  const intensity = 200;
  const light = new PointLight(color, intensity, 20);
  light.castShadow = true;
  light.shadow.bias = -0.005;
  light.shadow.mapSize.setScalar(128);
  light.shadow.radius = 10;
  const bulbMaterial = new MeshBasicMaterial({ color });
  bulbMaterial.color.multiplyScalar(intensity);
  light.add(new Mesh(new SphereGeometry(0.3, 12, 6), bulbMaterial));
  const pattern = document.createElement("canvas");
  pattern.width = pattern.height = 2;
  const context = pattern.getContext("2d");
  if (!context) throw new Error("Canvas 2D unavailable");
  context.fillStyle = "white";
  context.fillRect(0, 1, 2, 1);
  const texture = new CanvasTexture(pattern);
  texture.magFilter = NearestFilter;
  texture.wrapT = texture.wrapS = RepeatWrapping;
  texture.repeat.set(1, 4.5);
  const sphere = new Mesh(
    new SphereGeometry(2, 32, 8),
    new MeshPhongMaterial({ side: DoubleSide, alphaMap: texture, alphaTest: 0.5 }),
  );
  sphere.castShadow = sphere.receiveShadow = true;
  light.add(sphere);
  return light;
}
const pointLight = createLight(0x0088ff);
const pointLight2 = createLight(0xff8888);
const lights = [pointLight, pointLight2];
scene.add(pointLight, pointLight2);
const room = new Mesh(
  new BoxGeometry(30, 30, 30),
  new MeshPhongMaterial({ color: 0xa0adaf, shininess: 10, specular: 0x111111, side: BackSide }),
);
room.position.y = 10;
room.receiveShadow = true;
scene.add(room);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshPhongMaterial: phongShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 10, 0);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
let frames = 0;
renderer.setAnimationLoop(() => {
  let time = performance.now() * 0.001;
  for (const light of lights) {
    light.position.set(Math.sin(time * 0.6) * 9, Math.sin(time * 0.7) * 9 + 6, Math.sin(time * 0.8) * 9);
    light.rotation.x = light.rotation.z = time;
    time += 10000;
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
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
  renderer.setAnimationLoop(null);
  controls.dispose();
  stats.dom.remove();
  disposeObject(scene);
  pointLight.shadow.dispose();
  pointLight2.shadow.dispose();
  renderer.dispose();
});
