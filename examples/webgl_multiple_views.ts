import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
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
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing multiple views canvas");
const scene = new Scene();
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 0, 1);
scene.add(light);

const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 128;
const context = shadowCanvas.getContext("2d");
if (!context) throw new Error("Unable to create shadow canvas");
const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
gradient.addColorStop(0.1, "rgba(0,0,0,0.15)");
gradient.addColorStop(1, "rgba(0,0,0,0)");
context.fillStyle = gradient;
context.fillRect(0, 0, 128, 128);
const shadowGeometry = new PlaneGeometry(300, 300, 1, 1);
const shadowMaterial = new MeshBasicMaterial({ map: new CanvasTexture(shadowCanvas), transparent: true });
for (const x of [0, -400, 400]) {
  const shadow = new Mesh(shadowGeometry, shadowMaterial);
  shadow.position.set(x, -250, 0);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
}

const radius = 200;
const geometry1 = new IcosahedronGeometry(radius, 1);
const positions = geometry1.getAttribute("position");
if (!(positions instanceof BufferAttribute)) throw new Error("Missing icosahedron positions");
const count = positions.count;
geometry1.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
const geometries = [geometry1, geometry1.clone(), geometry1.clone()];
const colors = geometries.map((geometry) => {
  const attribute = geometry.getAttribute("color");
  if (!(attribute instanceof BufferAttribute)) throw new Error("Missing vertex colors");
  return attribute;
});
const color = new Color();
for (let i = 0; i < count; i++) {
  const y = (positions.getY(i) / radius + 1) / 2;
  color.setHSL(y, 1, 0.5, ColorSpace.SRGB);
  colors[0].setXYZ(i, color.r, color.g, color.b);
  color.setHSL(0, y, 0.5, ColorSpace.SRGB);
  colors[1].setXYZ(i, color.r, color.g, color.b);
  color.setRGB(1, 0.8 - y, 0, ColorSpace.SRGB);
  colors[2].setXYZ(i, color.r, color.g, color.b);
}
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true, vertexColors: true, shininess: 0 });
const wireMaterial = new MeshBasicMaterial({ color: 0, wireframe: true, transparent: true });
for (let i = 0; i < geometries.length; i++) {
  const mesh = new Mesh(geometries[i], material);
  mesh.add(new Mesh(geometries[i], wireMaterial));
  mesh.position.x = [-400, 400, 0][i];
  if (i === 0) mesh.rotation.x = -1.87;
  scene.add(mesh);
}

const views = [
  {
    left: 0,
    bottom: 0,
    width: 0.5,
    height: 1,
    background: new Color().setRGB(0.5, 0.5, 0.7, ColorSpace.SRGB),
    eye: [0, 300, 1800],
    up: [0, 1, 0],
    fov: 30,
  },
  {
    left: 0.5,
    bottom: 0,
    width: 0.5,
    height: 0.5,
    background: new Color().setRGB(0.7, 0.5, 0.5, ColorSpace.SRGB),
    eye: [0, 1800, 0],
    up: [0, 0, 1],
    fov: 45,
  },
  {
    left: 0.5,
    bottom: 0.5,
    width: 0.5,
    height: 0.5,
    background: new Color().setRGB(0.5, 0.7, 0.7, ColorSpace.SRGB),
    eye: [1400, 800, 1400],
    up: [0, 1, 0],
    fov: 60,
  },
].map((view) => {
  const camera = new PerspectiveCamera(view.fov, innerWidth / innerHeight, 1, 10000);
  camera.position.fromArray(view.eye);
  camera.up.fromArray(view.up);
  return { ...view, camera };
});
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
const stats = new Stats();
document.body.appendChild(stats.dom);
let mouseX = 0;
function move(event: MouseEvent): void {
  mouseX = event.clientX - innerWidth / 2;
}
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  views.forEach((view, i) => {
    const camera = view.camera;
    if (i === 0) camera.position.x = Math.max(-2000, Math.min(2000, camera.position.x + mouseX * 0.05));
    if (i === 1) camera.position.x = Math.max(-2000, Math.min(2000, camera.position.x - mouseX * 0.05));
    if (i === 2) camera.position.y = Math.max(-1600, Math.min(1600, camera.position.y - mouseX * 0.05));
    if (i === 1) camera.lookAt(camera.position.x, 0, camera.position.z);
    else camera.lookAt(scene.position);
    const left = Math.floor(innerWidth * view.left),
      bottom = Math.floor(innerHeight * view.bottom);
    const width = Math.floor(innerWidth * view.width),
      height = Math.floor(innerHeight * view.height);
    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setClearColor(view.background);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });
  stats.update();
}
document.addEventListener("mousemove", move);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  document.removeEventListener("mousemove", move);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  stats.dom.remove();
});
