import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { Color } from "ek3d/math/Color";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { LineSegments } from "ek3d/objects/LineSegments";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const title = document.querySelector<HTMLElement>("#title");
const hideButton = document.querySelector<HTMLButtonElement>("#hideLines");
const showButton = document.querySelector<HTMLButtonElement>("#showAllLines");
if (!canvas || !title || !hideButton || !showButton) throw new Error("Missing selective draw elements");

const numLat = 100,
  numLng = 200;
const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 3.5;
const geometry = new BufferGeometry();
const positions = new Float32Array(numLat * numLng * 6);
const colors = new Float32Array(numLat * numLng * 6);
const visible = new Float32Array(numLat * numLng * 2);
const color = new Color();
for (let i = 0; i < numLat; i++) {
  for (let j = 0; j < numLng; j++) {
    const lat = (Math.random() * Math.PI) / 50 + (i / numLat) * Math.PI;
    const lng = (Math.random() * Math.PI) / 50 + (j / numLng) * 2 * Math.PI;
    const index = i * numLng + j;
    positions[index * 6 + 3] = Math.sin(lat) * Math.cos(lng);
    positions[index * 6 + 4] = Math.cos(lat);
    positions[index * 6 + 5] = Math.sin(lat) * Math.sin(lng);
    color.setHSL(lat / Math.PI, 1, 0.2);
    colors.set([color.r, color.g, color.b], index * 6);
    color.setHSL(lat / Math.PI, 1, 0.7);
    colors.set([color.r, color.g, color.b], index * 6 + 3);
    visible[index * 2] = visible[index * 2 + 1] = 1;
  }
}
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setAttribute("vertColor", new BufferAttribute(colors, 3));
const visibleAttribute = new BufferAttribute(visible, 1);
geometry.setAttribute("visible", visibleAttribute);
geometry.computeBoundingSphere();
const material = new ShaderMaterial({
  vertexShader: `attribute float visible;
attribute vec3 vertColor;
varying float vVisible;
varying vec3 vColor;
void main() {
  vColor = vertColor;
  vVisible = visible;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `varying float vVisible;
varying vec3 vColor;
void main() {
  if (vVisible > 0.0) gl_FragColor = vec4(vColor, 1.0);
  else discard;
}`,
});
const mesh = new LineSegments(geometry, material);
scene.add(mesh);
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let culled = 0,
  frames = 0,
  disposed = false;
function updateCount(): void {
  title!.textContent = `1 draw call, ${(numLat * numLng).toLocaleString()} lines, ${culled.toLocaleString()} culled`;
}
function hideLines(): void {
  for (let i = 0; i < visible.length; i += 2) {
    if (Math.random() > 0.75) {
      if (visible[i]) culled++;
      visible[i] = visible[i + 1] = 0;
    }
  }
  visibleAttribute.needsUpdate = true;
  updateCount();
}
function showAllLines(): void {
  culled = 0;
  visible.fill(1);
  visibleAttribute.needsUpdate = true;
  updateCount();
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
hideButton.addEventListener("click", hideLines);
showButton.addEventListener("click", showAllLines);
window.addEventListener("resize", resize);
updateCount();
renderer.setAnimationLoop(() => {
  const time = Date.now() * 0.001;
  mesh.rotation.x = time * 0.25;
  mesh.rotation.y = time * 0.5;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  hideButton.removeEventListener("click", hideLines);
  showButton.removeEventListener("click", showAllLines);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
