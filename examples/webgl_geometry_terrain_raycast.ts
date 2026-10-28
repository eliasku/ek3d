import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { ImprovedNoise } from "ek3d/addons/math/ImprovedNoise";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping, ColorSpace } from "ek3d/constants";
import type { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Raycaster } from "ek3d/core/Raycaster";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing terrain raycast example canvas");
const canvas = selected;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshNormalMaterial: normalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
scene.background = new Color(0xbfd1e5);
const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 10, 20000);
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.minDistance = 1000;
controls.maxDistance = 10000;
controls.maxPolarAngle = Math.PI / 2;
const width = 256,
  depth = 256;
const data = new Uint8Array(width * depth);
const noise = new ImprovedNoise();
const z = Math.random() * 100;
let quality = 1;
for (let j = 0; j < 4; j++) {
  for (let i = 0; i < data.length; i++)
    data[i] += Math.abs(noise.noise((i % width) / quality, Math.floor(i / width) / quality, z) * quality * 1.75);
  quality *= 5;
}
controls.target.y = data[width / 2 + (depth / 2) * width] + 500;
camera.position.set(2000, controls.target.y + 2000, 0);
controls.update();
const geometry = new PlaneGeometry(7500, 7500, width - 1, depth - 1);
geometry.rotateX(-Math.PI / 2);
const vertices = (geometry.attributes.position as BufferAttribute).array as Float32Array;
for (let i = 0; i < data.length; i++) vertices[i * 3 + 1] = data[i] * 10;
const imageCanvas = document.createElement("canvas");
imageCanvas.width = width;
imageCanvas.height = depth;
const context = imageCanvas.getContext("2d")!;
context.fillStyle = "#000";
context.fillRect(0, 0, width, depth);
const image = context.getImageData(0, 0, width, depth);
const normal = new Vector3();
const sun = new Vector3(1, 1, 1).normalize();
for (let i = 0; i < data.length; i++) {
  normal.set(data[i - 2] - data[i + 2], 2, data[i - width * 2] - data[i + width * 2]).normalize();
  const shade = normal.dot(sun),
    factor = 0.5 + data[i] * 0.007;
  image.data[i * 4] = (96 + shade * 128) * factor;
  image.data[i * 4 + 1] = (32 + shade * 96) * factor;
  image.data[i * 4 + 2] = shade * 96 * factor;
}
context.putImageData(image, 0, 0);
const scaled = document.createElement("canvas");
scaled.width = width * 4;
scaled.height = depth * 4;
const scaledContext = scaled.getContext("2d")!;
scaledContext.scale(4, 4);
scaledContext.drawImage(imageCanvas, 0, 0);
const scaledImage = scaledContext.getImageData(0, 0, scaled.width, scaled.height);
for (let i = 0; i < scaledImage.data.length; i += 4) {
  const v = Math.floor(Math.random() * 5);
  scaledImage.data[i] += v;
  scaledImage.data[i + 1] += v;
  scaledImage.data[i + 2] += v;
}
scaledContext.putImageData(scaledImage, 0, 0);
const texture = new CanvasTexture(scaled);
texture.wrapS = texture.wrapT = Wrapping.ClampToEdge;
texture.colorSpace = ColorSpace.SRGB;
const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture }));
scene.add(mesh);
const helperGeometry = new ConeGeometry(20, 100, 3);
helperGeometry.translate(0, 50, 0);
helperGeometry.rotateX(Math.PI / 2);
const helper = new Mesh(helperGeometry, new MeshNormalMaterial());
scene.add(helper);
const raycaster = new Raycaster();
const pointer = new Vector2();
function pointerMove(event: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, (-(event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(mesh)[0];
  if (hit?.face) {
    helper.position.set(0, 0, 0);
    helper.lookAt(hit.face.normal);
    helper.position.copy(hit.point);
  }
}
canvas.addEventListener("pointermove", pointerMove);
const stats = new Stats();
document.body.appendChild(stats.dom);
let frames = 0;
renderer.setAnimationLoop(() => {
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
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  canvas.removeEventListener("pointermove", pointerMove);
  controls.dispose();
  stats.dom.remove();
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
