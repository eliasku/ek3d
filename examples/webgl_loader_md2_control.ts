import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { SunLight } from "ek3d/addons/lights/SunLight";
import { Gyroscope } from "ek3d/addons/misc/Gyroscope";
import { MD2CharacterComplex } from "ek3d/addons/misc/MD2CharacterComplex";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PCFShadowMap, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
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
if (!element) throw new Error("Missing MD2 controls canvas");
const canvas: HTMLCanvasElement = element;
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 4000);
camera.position.set(0, 150, 1300);
const scene = new Scene();
scene.background = new Color(0xffffff);
scene.fog = new Fog(0xffffff, 1000, 4000);
scene.add(camera);
scene.add(new AmbientLight(0x666666, 3));
const sun = new SunLight(0xffffff, 7);
sun.position.set(200, 450, 500);
sun.castShadow = true;
sun.shadow.camera.far = 2000;
scene.add(sun);
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
renderer.shadowMap.type = PCFShadowMap;
const cameraControls = new OrbitControls<PerspectiveCamera>(camera, canvas);
cameraControls.target.set(0, 50, 0);
cameraControls.update();
const timer = new Timer();
timer.connect(document);
const stats = new Stats();
document.body.appendChild(stats.dom);
const controls = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  crouch: false,
  jump: false,
  attack: false,
};
const skinNames = [
  "grok.jpg",
  "ogrobase.png",
  "arboshak.png",
  "ctf_r.png",
  "ctf_b.png",
  "darkam.png",
  "freedom.png",
  "gib.png",
  "gordogh.png",
  "igdosh.png",
  "khorne.png",
  "nabogro.png",
  "sharokh.png",
];
const characters = skinNames.map(() => {
  const character = new MD2CharacterComplex();
  character.scale = 3;
  character.controls = controls;
  return character;
});
const baseCharacter = new MD2CharacterComplex();
baseCharacter.scale = 3;
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
groundTexture.repeat.set(64, 64);
groundTexture.wrapS = groundTexture.wrapT = RepeatWrapping;
groundTexture.colorSpace = SRGBColorSpace;
const groundGeometry = new PlaneGeometry(16000, 16000);
const groundMaterial = new MeshPhongMaterial({ color: 0xffffff, map: groundTexture });
const ground = new Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
baseCharacter.onError = fail;
baseCharacter.onLoadComplete = () => {
  if (disposed) return;
  characters.forEach((character, index) => {
    character.shareParts(baseCharacter);
    character.enableShadows(true);
    character.setWeapon(0);
    character.setSkin(index);
    character.root.position.x = (index - skinNames.length / 2) * 150;
    scene.add(character.root);
  });
  const gyro = new Gyroscope();
  gyro.add(camera);
  characters[Math.floor(skinNames.length / 2)].root.add(gyro);
  loaded = true;
};
baseCharacter.loadParts({
  baseUrl: "/examples/models/md2/ogro/",
  body: "ogro.md2",
  skins: skinNames,
  weapons: [["weapon.md2", "weapon.jpg"]],
  animations: { move: "run", idle: "stand", jump: "jump", attack: "attack", crouchMove: "cwalk", crouchIdle: "cstand" },
  walkSpeed: 350,
  crouchSpeed: 175,
});
function key(event: KeyboardEvent): void {
  const value = event.type === "keydown";
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      controls.moveForward = value;
      break;
    case "ArrowDown":
    case "KeyS":
      controls.moveBackward = value;
      break;
    case "ArrowLeft":
    case "KeyA":
      controls.moveLeft = value;
      break;
    case "ArrowRight":
    case "KeyD":
      controls.moveRight = value;
      break;
    default:
      return;
  }
  if (event.code.startsWith("Arrow")) event.preventDefault();
}
function clearKeys(): void {
  controls.moveForward = controls.moveBackward = controls.moveLeft = controls.moveRight = false;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
document.addEventListener("keydown", key);
document.addEventListener("keyup", key);
window.addEventListener("blur", clearKeys);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  for (const character of characters) character.update(delta);
  renderer.render(scene, camera);
  stats.update();
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  document.removeEventListener("keydown", key);
  document.removeEventListener("keyup", key);
  window.removeEventListener("blur", clearKeys);
  renderer.setAnimationLoop(null);
  for (const character of characters) character.dispose();
  baseCharacter.dispose();
  cameraControls.dispose();
  stats.dom.removeEventListener("click", stats._onClick);
  stats.dom.remove();
  groundTexture.dispose();
  groundGeometry.dispose();
  groundMaterial.dispose();
  sun.dispose();
  timer.disconnect();
  renderer.dispose();
});
