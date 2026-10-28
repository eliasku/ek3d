import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { SpriteMaterial } from "ek3d/materials/SpriteMaterial";
import { Group } from "ek3d/objects/Group";
import { Sprite } from "ek3d/objects/Sprite";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { spriteShader } from "ek3d/renderers/shaders/SpriteShader";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing sprites canvas");
const canvas = selected;
let disposed = false,
  pending = 3,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 1, 2100);
camera.position.z = 1500;
const cameraOrtho = new OrthographicCamera(-innerWidth / 2, innerWidth / 2, innerHeight / 2, -innerHeight / 2, 1, 10);
cameraOrtho.position.z = 10;
const scene = new Scene();
scene.fog = new Fog(0, 1500, 2100);
const sceneOrtho = new Scene();
const group = new Group();
scene.add(group);
const hud: Sprite[] = [];
const loader = new TextureLoader();
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
const hudTexture = loader.load(
  "/examples/textures/sprite0.png",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    pending--;
    texture.colorSpace = SRGBColorSpace;
    const material = new SpriteMaterial({ map: texture });
    const image = texture.image as HTMLImageElement;
    for (const [x, y] of [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ]) {
      const sprite = new Sprite(material);
      sprite.center.set(x, y);
      sprite.scale.set(image.width, image.height, 1);
      sceneOrtho.add(sprite);
      hud.push(sprite);
    }
    updateHUD();
  },
  undefined,
  fail,
);
const mapB = loader.load(
  "/examples/textures/sprite1.png",
  (texture) => {
    if (disposed) texture.dispose();
    else pending--;
  },
  undefined,
  fail,
);
const mapC = loader.load(
  "/examples/textures/sprite2.png",
  (texture) => {
    if (disposed) texture.dispose();
    else pending--;
  },
  undefined,
  fail,
);
mapB.colorSpace = mapC.colorSpace = SRGBColorSpace;
const materialB = new SpriteMaterial({ map: mapB, color: 0xffffff, fog: true });
const materialC = new SpriteMaterial({ map: mapC, color: 0xffffff, fog: true });
const sprites: Sprite[] = [];
for (let i = 0; i < 200; i++) {
  const x = Math.random() - 0.5,
    y = Math.random() - 0.5,
    z = Math.random() - 0.5;
  const material = (z < 0 ? materialB : materialC).clone();
  if (z >= 0) {
    material.color.setHSL(0.5 * Math.random(), 0.75, 0.5);
    mapC.offset.set(-0.5, -0.5);
    mapC.repeat.set(2, 2);
  }
  const sprite = new Sprite(material);
  sprite.position.set(x, y, z).normalize().multiplyScalar(500);
  group.add(sprite);
  sprites.push(sprite);
}
materialB.dispose();
materialC.dispose();
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true, shaders: { SpriteMaterial: spriteShader } });
renderer.autoClear = false;
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
function updateHUD(): void {
  if (hud.length !== 5) return;
  const width = innerWidth / 2,
    height = innerHeight / 2;
  hud[0].position.set(-width, height, 1);
  hud[1].position.set(width, height, 1);
  hud[2].position.set(-width, -height, 1);
  hud[3].position.set(width, -height, 1);
  hud[4].position.set(0, 0, 1);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  cameraOrtho.left = -innerWidth / 2;
  cameraOrtho.right = innerWidth / 2;
  cameraOrtho.top = innerHeight / 2;
  cameraOrtho.bottom = -innerHeight / 2;
  cameraOrtho.updateProjectionMatrix();
  updateHUD();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() / 1000;
  sprites.forEach((sprite, i) => {
    const material = sprite.material;
    const scale = Math.sin(time + sprite.position.x * 0.01) * 0.3 + 1;
    const image = material.map?.image as HTMLImageElement | undefined;
    material.rotation += 0.1 * (i / sprites.length);
    sprite.scale.set(scale * (image?.width || 1), scale * (image?.height || 1), 1);
    if (material.map !== mapC) material.opacity = Math.sin(time + sprite.position.x * 0.01) * 0.4 + 0.6;
  });
  group.rotation.set(time * 0.5, time * 0.75, time);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(sceneOrtho, cameraOrtho);
  if (!pending && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  disposeObject(sceneOrtho);
  hudTexture.dispose();
  mapB.dispose();
  mapC.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
