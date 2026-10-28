import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute, Uint8BufferAttribute } from "ek3d/core/BufferAttribute";
import { Side } from "ek3d/constants";
import { RawShaderMaterial } from "ek3d/materials/RawShaderMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing raw shader canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10);
camera.position.z = 2;
const scene = new Scene();
scene.background = new Color(0x101010);
const geometry = new BufferGeometry();
const positions: number[] = [];
const colors: number[] = [];
for (let i = 0; i < 600; i++) {
  positions.push(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  colors.push(Math.random() * 255, Math.random() * 255, Math.random() * 255, Math.random() * 255);
}
geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
geometry.setAttribute("color", new Uint8BufferAttribute(colors, 4, true));
const material = new RawShaderMaterial({
  uniforms: { time: { value: 1 } },
  vertexShader: `precision mediump float;
precision mediump int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
attribute vec3 position;
attribute vec4 color;
varying vec3 vPosition;
varying vec4 vColor;
void main() {
  vPosition = position;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `precision mediump float;
precision mediump int;
uniform float time;
varying vec3 vPosition;
varying vec4 vColor;
void main() {
  vec4 color = vec4(vColor);
  color.r += sin(vPosition.x * 10.0 + time) * 0.5;
  gl_FragColor = color;
}`,
  side: Side.Double,
  transparent: true,
});
const mesh = new Mesh(geometry, material);
scene.add(mesh);
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
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  const time = performance.now();
  mesh.rotation.y = time * 0.0005;
  material.uniforms.time.value = time * 0.005;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
