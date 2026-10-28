import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { InstancedBufferGeometry } from "ek3d/core/InstancedBufferGeometry";
import { InstancedBufferAttribute } from "ek3d/core/InstancedBufferAttribute";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing billboard canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let loaded = false;
let frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 5000);
camera.position.z = 1400;
const scene = new Scene();
const circle = new CircleGeometry(1, 6);
const geometry = new InstancedBufferGeometry();
geometry.index = circle.index;
geometry.attributes = circle.attributes;
const translations = new Float32Array(75000 * 3);
for (let i = 0; i < translations.length; i++) translations[i] = Math.random() * 2 - 1;
geometry.setAttribute("translate", new InstancedBufferAttribute(translations, 3));
const texture = new TextureLoader().load(
  "/examples/textures/sprites/circle.png",
  (map) => {
    if (disposed) map.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
const material = new RawShaderMaterial({
  uniforms: { map: { value: texture }, time: { value: 0 } },
  vertexShader: /* glsl */ `
    precision highp float;
    uniform mat4 modelViewMatrix, projectionMatrix;
    uniform float time;
    attribute vec3 position, translate;
    attribute vec2 uv;
    varying vec2 vUv;
    varying float vScale;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(translate, 1.0);
      vec3 trTime = translate + vec3(time);
      float scale = sin(trTime.x * 2.1) + sin(trTime.y * 3.2) + sin(trTime.z * 4.3);
      vScale = scale;
      scale = scale * 10.0 + 10.0;
      mvPosition.xyz += position * scale;
      vUv = uv;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D map;
    varying vec2 vUv;
    varying float vScale;
    vec3 HUEtoRGB(float H) {
      H = mod(H, 1.0);
      return clamp(vec3(abs(H * 6.0 - 3.0) - 1.0, 2.0 - abs(H * 6.0 - 2.0), 2.0 - abs(H * 6.0 - 4.0)), 0.0, 1.0);
    }
    vec3 HSLtoRGB(vec3 HSL) {
      vec3 RGB = HUEtoRGB(HSL.x);
      float C = (1.0 - abs(2.0 * HSL.z - 1.0)) * HSL.y;
      return (RGB - 0.5) * C + HSL.z;
    }
    void main() {
      vec4 diffuseColor = texture2D(map, vUv);
      gl_FragColor = vec4(diffuseColor.xyz * HSLtoRGB(vec3(vScale / 5.0, 1.0, 0.5)), diffuseColor.w);
      if (diffuseColor.w < 0.5) discard;
    }
  `,
  depthTest: true,
  depthWrite: true,
});
const mesh = new Mesh(geometry, material);
mesh.scale.set(500, 500, 500);
scene.add(mesh);
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
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const time = performance.now() * 0.0005;
  material.uniforms.time.value = time;
  mesh.rotation.x = time * 0.2;
  mesh.rotation.y = time * 0.4;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
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
