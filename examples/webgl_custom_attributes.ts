import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { clamp } from "ek3d/math/MathUtils";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing custom attributes example canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
let loaded = false;
let failed = false;
let frames = 0;
canvas.dataset.state = "loading";

const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 300;
const scene = new Scene();
scene.background = new Color(0x050505);
const texture = new TextureLoader().load(
  "/examples/textures/water.jpg",
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
texture.wrapS = texture.wrapT = RepeatWrapping;
const uniforms = {
  amplitude: { value: 1 },
  color: { value: new Color(0xff2200) },
  colorTexture: { value: texture },
};
const material = new ShaderMaterial({
  uniforms,
  vertexShader: `
    uniform float amplitude;
    attribute float displacement;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vNormal = normal;
      vUv = (0.5 + amplitude) * uv + vec2(amplitude);
      vec3 newPosition = position + amplitude * normal * vec3(displacement);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform vec3 color;
    uniform sampler2D colorTexture;
    void main() {
      vec3 light = normalize(vec3(0.5, 0.2, 1.0));
      float dProd = dot(vNormal, light) * 0.5 + 0.5;
      vec4 tcolor = texture2D(colorTexture, vUv);
      vec4 gray = vec4(vec3(tcolor.r * 0.3 + tcolor.g * 0.59 + tcolor.b * 0.11), 1.0);
      gl_FragColor = gray * vec4(vec3(dProd) * color, 1.0);
    }
  `,
});
const geometry = new SphereGeometry(50, 128, 64);
const displacement = new Float32Array(geometry.attributes.position.count);
const noise = new Float32Array(displacement.length);
for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 5;
const displacementAttribute = new BufferAttribute(displacement, 1);
geometry.setAttribute("displacement", displacementAttribute);
const sphere = new Mesh(geometry, material);
scene.add(sphere);
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
  const time = Date.now() * 0.01;
  sphere.rotation.y = sphere.rotation.z = 0.01 * time;
  uniforms.amplitude.value = 2.5 * Math.sin(sphere.rotation.y * 0.125);
  uniforms.color.value.offsetHSL(0.0005, 0, 0);
  for (let i = 0; i < displacement.length; i++) {
    noise[i] = clamp(noise[i] + 0.5 * (0.5 - Math.random()), -5, 5);
    displacement[i] = Math.sin(0.1 * i + time) + noise[i];
  }
  displacementAttribute.needsUpdate = true;
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
