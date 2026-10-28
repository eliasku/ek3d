import { FirstPersonControls } from "ek3d/addons/controls/FirstPersonControls";
import { ImprovedNoise } from "ek3d/addons/math/ImprovedNoise";
import { ColorSpace, Wrapping } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import type { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { Timer } from "ek3d/core/Timer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing terrain example canvas");
const canvas: HTMLCanvasElement = element;

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);

const scene = new Scene();
scene.background = new Color(0xefd1b5);
scene.fog = new FogExp2(0xefd1b5, 0.0025);

const worldWidth = 256;
const worldDepth = 256;

const data = generateHeight(worldWidth, worldDepth);

camera.position.set(100, 800, -800);
camera.lookAt(-100, 810, -800);

const geometry = new PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
geometry.rotateX(-Math.PI / 2);

const vertices = (geometry.attributes.position as BufferAttribute).array as Float32Array;

for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
  vertices[j + 1] = data[i] * 10;
}

const texture = new CanvasTexture(generateTexture(data, worldWidth, worldDepth));
texture.wrapS = Wrapping.ClampToEdge;
texture.wrapT = Wrapping.ClampToEdge;
texture.colorSpace = ColorSpace.SRGB;

const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture }));
scene.add(mesh);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new FirstPersonControls(camera, canvas);
controls.movementSpeed = 150;
controls.lookSpeed = 0.2;

const timer = new Timer();
timer.connect(document);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function generateHeight(width: number, height: number): Uint8Array {
  let seed = Math.PI / 4;

  window.Math.random = (function () {
    return function (): number {
      const value = Math.sin(seed++);
      return value * 10000 - Math.floor(value * 10000);
    };
  })();

  const size = width * height;
  const heightData = new Uint8Array(size);
  const perlin = new ImprovedNoise();
  const z = window.Math.random() * 100;

  let quality = 1;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      heightData[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
    }

    quality *= 5;
  }

  return heightData;
}

function generateTexture(data: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const vector3 = new Vector3(0, 0, 0);

  const sun = new Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  let context = canvas.getContext("2d")!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);

  let image = context.getImageData(0, 0, canvas.width, canvas.height);
  const imageData = image.data;

  for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];

    vector3.normalize();

    const shade = vector3.dot(sun);

    imageData[i] = (96 + shade * 128) * (0.5 + data[j] * 0.007);
    imageData[i + 1] = (32 + shade * 96) * (0.5 + data[j] * 0.007);
    imageData[i + 2] = shade * 96 * (0.5 + data[j] * 0.007);
  }

  context.putImageData(image, 0, 0);

  // Scaled 4x

  const canvasScaled = document.createElement("canvas");
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext("2d")!;
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  const imageDataScaled = image.data;

  for (let i = 0, l = imageDataScaled.length; i < l; i += 4) {
    const v = Math.floor(window.Math.random() * 5);

    imageDataScaled[i] += v;
    imageDataScaled[i + 1] += v;
    imageDataScaled[i + 2] += v;
  }

  context.putImageData(image, 0, 0);

  return canvasScaled;
}

function render(): void {
  controls.update(timer.getDelta());
  renderer.render(scene, camera);
}

function publishState(): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function animate(): void {
  timer.update();

  render();
  publishState();
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    controls.dispose();
    renderer.setAnimationLoop(null);
    geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
    texture.dispose();
    renderer.dispose();
  },
  { once: true },
);
