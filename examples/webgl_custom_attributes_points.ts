import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AdditiveBlending } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing custom points canvas");
const canvas = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 10000);
camera.position.z = 300;
const scene = new Scene();
const amount = 100000;
const positions = new Float32Array(amount * 3),
  colors = new Float32Array(amount * 3),
  sizes = new Float32Array(amount);
const vertex = new Vector3(),
  color = new Color();
for (let i = 0; i < amount; i++) {
  vertex.set((Math.random() * 2 - 1) * 200, (Math.random() * 2 - 1) * 200, (Math.random() * 2 - 1) * 200);
  vertex.toArray(positions, i * 3);
  color.setHSL((vertex.x < 0 ? 0.5 : 0) + (0.1 * i) / amount, vertex.x < 0 ? 0.7 : 0.9, 0.5);
  color.toArray(colors, i * 3);
  sizes[i] = 10;
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setAttribute("customColor", new BufferAttribute(colors, 3));
const sizeAttribute = new BufferAttribute(sizes, 1);
geometry.setAttribute("size", sizeAttribute);
const texture = new TextureLoader().load(
  "/examples/textures/sprites/spark1.png",
  (value) => {
    if (disposed) value.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
const material = new ShaderMaterial({
  uniforms: { color: { value: new Color(0xffffff) }, pointTexture: { value: texture } },
  vertexShader: `attribute float size; attribute vec3 customColor; varying vec3 vColor;
    void main() { vColor = customColor; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D pointTexture; varying vec3 vColor;
    void main() { gl_FragColor = vec4(color * vColor, 1.0) * texture2D(pointTexture, gl_PointCoord); }`,
  blending: AdditiveBlending,
  depthTest: false,
  transparent: true,
});
const sphere = new Points(geometry, material);
scene.add(sphere);
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.005;
  sphere.rotation.z = 0.01 * time;
  for (let i = 0; i < sizes.length; i++) sizes[i] = 14 + 13 * Math.sin(0.1 * i + time);
  sizeAttribute.needsUpdate = true;
  renderer.render(scene, camera);
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
  stats.update();
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  texture.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
