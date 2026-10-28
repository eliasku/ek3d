import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import type { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing geometry colors canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(20, innerWidth / innerHeight, 1, 10000);
camera.position.z = 1800;
const scene = new Scene();
scene.background = new Color(0xffffff);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 0, 1);
scene.add(light);
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 128;
const context = shadowCanvas.getContext("2d");
if (!context) throw new Error("Cannot create shadow canvas");
const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
gradient.addColorStop(0.1, "rgba(210,210,210,1)");
gradient.addColorStop(1, "rgba(255,255,255,1)");
context.fillStyle = gradient;
context.fillRect(0, 0, 128, 128);
const shadowGeometry = new PlaneGeometry(300, 300, 1, 1);
const shadowMaterial = new MeshBasicMaterial({ map: new CanvasTexture(shadowCanvas) });
for (const x of [0, -400, 400]) {
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.position.set(x, -250, 0);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
}
const radius = 200;
const first = new IcosahedronGeometry(radius, 1);
const count = first.attributes.position.count;
first.setAttribute("color", new Float32BufferAttribute(count * 3, 3));
const geometries = [first, first.clone(), first.clone()];
const color = new Color();
for (let i = 0; i < count; i++) {
  const y = ((first.attributes.position as BufferAttribute).getY(i) / radius + 1) / 2;
  color.setHSL(y, 1, 0.5, ColorSpace.SRGB);
  (geometries[0].attributes.color as BufferAttribute).setXYZ(i, color.r, color.g, color.b);
  color.setHSL(0, y, 0.5, ColorSpace.SRGB);
  (geometries[1].attributes.color as BufferAttribute).setXYZ(i, color.r, color.g, color.b);
  color.setRGB(1, 0.8 - y, 0, ColorSpace.SRGB);
  (geometries[2].attributes.color as BufferAttribute).setXYZ(i, color.r, color.g, color.b);
}
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true, vertexColors: true, shininess: 0 });
const wireMaterial = new MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true });
for (let i = 0; i < geometries.length; i++) {
  const mesh = new Mesh(geometries[i], material);
  mesh.add(new Mesh(geometries[i], wireMaterial));
  mesh.position.x = [-400, 400, 0][i];
  if (i === 0) mesh.rotation.x = -1.87;
  scene.add(mesh);
}
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let mouseX = 0,
  mouseY = 0,
  frames = 0,
  disposed = false;
canvas.dataset.state = "loading";
function mousemove(event: MouseEvent): void {
  mouseX = event.clientX - innerWidth / 2;
  mouseY = event.clientY - innerHeight / 2;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("mousemove", mousemove);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("mousemove", mousemove);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  stats.dom.remove();
  canvas.dataset.state = "disposed";
});
