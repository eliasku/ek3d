import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ReinhardToneMapping, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { distanceShader } from "ek3d/renderers/shaders/DistanceShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (canvas === null) throw new Error("Missing physical lights example canvas");

const bulbLuminousPowers: Record<string, number> = {
  "110000 lm (1000W)": 110000,
  "3500 lm (300W)": 3500,
  "1700 lm (100W)": 1700,
  "800 lm (60W)": 800,
  "400 lm (40W)": 400,
  "180 lm (25W)": 180,
  "20 lm (4W)": 20,
  Off: 0,
};
const hemiLuminousIrradiances: Record<string, number> = {
  "0.0001 lx (Moonless Night)": 0.0001,
  "0.002 lx (Night Airglow)": 0.002,
  "0.5 lx (Full Moon)": 0.5,
  "3.4 lx (City Twilight)": 3.4,
  "50 lx (Living Room)": 50,
  "100 lx (Very Overcast)": 100,
  "350 lx (Office Room)": 350,
  "400 lx (Sunrise/Sunset)": 400,
  "1000 lx (Overcast)": 1000,
  "18000 lx (Daylight)": 18000,
  "50000 lx (Direct Sun)": 50000,
};
const params = {
  shadows: true,
  exposure: 0.68,
  bulbPower: "400 lm (40W)",
  hemiIrradiance: "0.0001 lx (Moonless Night)",
};

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(-4, 2, 4);
const scene = new Scene();
const bulbGeometry = new SphereGeometry(0.02, 16, 8);
const bulbLight = new PointLight(0xffee88, 1, 100, 2);
const bulbMat = new MeshStandardMaterial({ emissive: 0xffffee, emissiveIntensity: 1, color: 0x000000 });
bulbLight.add(new Mesh(bulbGeometry, bulbMat));
bulbLight.position.set(0, 2, 0);
bulbLight.castShadow = true;
scene.add(bulbLight);
const hemiLight = new HemisphereLight(0xddeeff, 0x0f0e0d, 0.02);
scene.add(hemiLight);

const floorMat = new MeshStandardMaterial({ roughness: 0.8, color: 0xffffff, metalness: 0.2, bumpScale: 1 });
const cubeMat = new MeshStandardMaterial({ roughness: 0.7, color: 0xffffff, bumpScale: 1, metalness: 0.2 });
const ballMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 1 });
const loader = new TextureLoader();
const textures: Texture[] = [];
let disposed = false;
function loadTexture(
  path: string,
  material: MeshStandardMaterial,
  slot: "map" | "bumpMap" | "roughnessMap" | "metalnessMap",
  color: boolean,
  repeat?: [number, number],
): void {
  const texture = loader.load(`/examples/textures/${path}`, (map) => {
    if (disposed) {
      map.dispose();
      return;
    }
    map.anisotropy = 4;
    if (repeat) {
      map.wrapS = RepeatWrapping;
      map.wrapT = RepeatWrapping;
      map.repeat.set(...repeat);
    }
    if (color) map.colorSpace = SRGBColorSpace;
    material[slot] = map;
    material.needsUpdate = true;
  });
  textures.push(texture);
}
loadTexture("hardwood2_diffuse.jpg", floorMat, "map", true, [10, 24]);
loadTexture("hardwood2_bump.jpg", floorMat, "bumpMap", false, [10, 24]);
loadTexture("hardwood2_roughness.jpg", floorMat, "roughnessMap", false, [10, 24]);
loadTexture("brick_diffuse.jpg", cubeMat, "map", true, [1, 1]);
loadTexture("brick_bump.jpg", cubeMat, "bumpMap", false, [1, 1]);
loadTexture("planets/earth_atmos_2048.jpg", ballMat, "map", true);
loadTexture("planets/earth_specular_2048.jpg", ballMat, "metalnessMap", true);

const floorGeometry = new PlaneGeometry(20, 20);
const floor = new Mesh(floorGeometry, floorMat);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const ballGeometry = new SphereGeometry(0.25, 32, 32);
const ball = new Mesh(ballGeometry, ballMat);
ball.position.set(1, 0.25, 1);
ball.rotation.y = Math.PI;
ball.castShadow = true;
scene.add(ball);
const boxGeometry = new BoxGeometry(0.5, 0.5, 0.5);
for (const [x, z] of [
  [-0.5, -1],
  [0, -5],
  [7, 0],
]) {
  const box = new Mesh(boxGeometry, cubeMat);
  box.position.set(x, 0.25, z);
  box.castShadow = true;
  scene.add(box);
}

const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  createShadowMap: WebGLShadowMap,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshStandardMaterial: standardShader,
    MeshDepthMaterial: depthShader,
    MeshDistanceMaterial: distanceShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const shadowMap = renderer.shadowMap;
if (shadowMap === null) throw new Error("The shadow map system failed to install");
shadowMap.enabled = true;
renderer.toneMapping = ReinhardToneMapping;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 1;
controls.maxDistance = 20;
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
gui.add(params, "hemiIrradiance", Object.keys(hemiLuminousIrradiances));
gui.add(params, "bulbPower", Object.keys(bulbLuminousPowers));
gui.add(params, "exposure", 0, 1);
gui.add(params, "shadows");
gui.open();
let previousShadowMap = false;
renderer.setAnimationLoop(() => {
  renderer.toneMappingExposure = Math.pow(params.exposure, 5);
  shadowMap.enabled = params.shadows;
  bulbLight.castShadow = params.shadows;
  if (params.shadows !== previousShadowMap) {
    ballMat.needsUpdate = true;
    cubeMat.needsUpdate = true;
    floorMat.needsUpdate = true;
    previousShadowMap = params.shadows;
  }
  bulbLight.power = bulbLuminousPowers[params.bulbPower];
  bulbMat.emissiveIntensity = bulbLight.intensity / Math.pow(0.02, 2);
  hemiLight.intensity = hemiLuminousIrradiances[params.hemiIrradiance];
  bulbLight.position.y = Math.cos(Date.now() * 0.0005) * 0.75 + 1.25;
  renderer.render(scene, camera);
  stats.update();
});
function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onResize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  bulbLight.shadow.dispose();
  for (const geometry of [bulbGeometry, floorGeometry, ballGeometry, boxGeometry]) geometry.dispose();
  for (const material of [bulbMat, floorMat, cubeMat, ballMat]) material.dispose();
  for (const texture of textures) texture.dispose();
  dfgLUT.dispose();
  renderer.dispose();
});
