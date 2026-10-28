import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AdditiveBlending, DynamicDrawUsage } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing particles example canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
let loaded = false;
let failed = false;
let frames = 0;
canvas.dataset.state = "loading";

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 300;
const scene = new Scene();
const texture = new TextureLoader().load(
  "/examples/textures/sprites/spark1.png",
  (value) => {
    if (disposed) value.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
const material = new ShaderMaterial({
  uniforms: { pointTexture: { value: texture } },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D pointTexture;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
    }
  `,
  blending: AdditiveBlending,
  depthTest: false,
  transparent: true,
  vertexColors: true,
});
const count = 100000;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
const sizes = new Float32Array(count);
const color = new Color();
for (let i = 0; i < count; i++) {
  positions[i * 3] = (Math.random() * 2 - 1) * 200;
  positions[i * 3 + 1] = (Math.random() * 2 - 1) * 200;
  positions[i * 3 + 2] = (Math.random() * 2 - 1) * 200;
  color.setHSL(i / count, 1, 0.5);
  colors[i * 3] = color.r;
  colors[i * 3 + 1] = color.g;
  colors[i * 3 + 2] = color.b;
  sizes[i] = 20;
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setAttribute("color", new BufferAttribute(colors, 3));
const sizeAttribute = new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage);
geometry.setAttribute("size", sizeAttribute);
const particles = new Points(geometry, material);
scene.add(particles);
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.005;
  particles.rotation.z = 0.01 * time;
  for (let i = 0; i < count; i++) sizes[i] = 10 * (1 + Math.sin(0.1 * i + time));
  sizeAttribute.needsUpdate = true;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failed) canvas.dataset.state = loaded ? "rendered" : "loading";
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  geometry.dispose();
  material.dispose();
  texture.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
