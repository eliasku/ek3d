import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { MD2Character } from "ek3d/addons/misc/MD2Character";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (!element) throw new Error("Missing MD2 viewer canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0x050505);
scene.fog = new Fog(0x050505, 2.5, 10);
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 2, 4);
scene.add(new AmbientLight(0x666666));
const lights = [new SpotLight(0xffffff, 150), new SpotLight(0xffffff, 150)];
lights[0].position.set(2, 5, 10);
lights[1].position.set(-1, 3.5, 3.5);
for (const light of lights) {
  light.angle = 0.5;
  light.penumbra = 0.5;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  scene.add(light);
}
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshLambertMaterial: lambertShader, MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map system");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.update();
const timer = new Timer();
timer.connect(document);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const playback = { speed: 1, wireframe: false };
const character = new MD2Character();
character.scale = 0.03;
scene.add(character.root);
let disposed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
const groundTexture = new TextureLoader().load(
  "/examples/textures/terrain/grasslight-big.jpg",
  (texture) => {
    if (disposed) texture.dispose();
  },
  undefined,
  fail,
);
groundTexture.wrapS = groundTexture.wrapT = RepeatWrapping;
groundTexture.repeat.set(8, 8);
groundTexture.colorSpace = SRGBColorSpace;
const groundGeometry = new PlaneGeometry(20, 20);
const groundMaterial = new MeshPhongMaterial({ color: 0xffffff, map: groundTexture });
const ground = new Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
gui.add(playback, "speed", 0, 2).onChange(() => character.setPlaybackRate(playback.speed));
gui.add(playback, "wireframe").onChange(() => character.setWireframe(playback.wireframe));
character.onError = fail;
character.onLoadComplete = () => {
  if (disposed || !character.meshBody) return;
  const skins = gui.addFolder("Skins");
  const weapons = gui.addFolder("Weapons");
  const animations = gui.addFolder("Animations");
  character.skinsBody.forEach((skin, index) => {
    const action = { select: () => character.setSkin(index) };
    skins.add(action, "select").name(skin.name.replace(/\.[^.]+$/, ""));
  });
  character.weapons.forEach((weapon, index) => {
    const action = {
      select: () => {
        character.setWeapon(index);
        character.setWireframe(playback.wireframe);
      },
    };
    weapons.add(action, "select").name(weapon.name.replace(/\.[^.]+$/, ""));
  });
  for (const clip of character.meshBody.geometry.animations) {
    const action = { select: () => character.setAnimation(clip.name) };
    animations.add(action, "select").name(clip.name);
  }
  character.setAnimation(character.meshBody.geometry.animations[0].name);
  loaded = true;
};
character.loadParts({
  baseUrl: "/examples/models/md2/ratamahatta/",
  body: "ratamahatta.md2",
  skins: ["ratamahatta.png", "ctf_b.png", "ctf_r.png", "dead.png", "gearwhore.png"],
  weapons: [
    ["weapon.md2", "weapon.png"],
    ["w_bfg.md2", "w_bfg.png"],
    ["w_blaster.md2", "w_blaster.png"],
    ["w_chaingun.md2", "w_chaingun.png"],
    ["w_glauncher.md2", "w_glauncher.png"],
    ["w_hyperblaster.md2", "w_hyperblaster.png"],
    ["w_machinegun.md2", "w_machinegun.png"],
    ["w_railgun.md2", "w_railgun.png"],
    ["w_rlauncher.md2", "w_rlauncher.png"],
    ["w_shotgun.md2", "w_shotgun.png"],
    ["w_sshotgun.md2", "w_sshotgun.png"],
  ],
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  timer.update();
  character.update(timer.getDelta());
  renderer.render(scene, camera);
  stats.update();
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  character.dispose();
  controls.dispose();
  gui.destroy();
  stats.dom.removeEventListener("click", stats._onClick);
  stats.dom.remove();
  groundTexture.dispose();
  groundGeometry.dispose();
  groundMaterial.dispose();
  for (const light of lights) light.dispose();
  timer.disconnect();
  renderer.dispose();
});
