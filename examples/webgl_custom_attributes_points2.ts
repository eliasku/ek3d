import { Stats } from "ek3d/addons/libs/Stats";
import { mergeVertices, mergeGeometries } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping } from "ek3d/constants";
import { BufferAttribute, Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector3 } from "ek3d/math/Vector3";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing sorted points canvas");
const canvas = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 10000);
camera.position.z = 300;
const scene = new Scene();
const sphereSource = new SphereGeometry(100, 68, 38),
  boxSource = new BoxGeometry(80, 80, 80, 10, 10, 10);
for (const geometry of [sphereSource, boxSource]) {
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
}
const sphere = mergeVertices(sphereSource),
  box = mergeVertices(boxSource);
sphereSource.dispose();
boxSource.dispose();
const merged = mergeGeometries([sphere, box]);
if (!merged) throw new Error("Unable to merge point geometries");
const selectedPosition = merged.getAttribute("position");
const spherePosition = sphere.getAttribute("position");
if (!(selectedPosition instanceof BufferAttribute) || !(spherePosition instanceof BufferAttribute))
  throw new Error("Missing merged point positions");
const position: BufferAttribute = selectedPosition;
const length1 = spherePosition.count;
const colors: number[] = [],
  sizes = new Float32Array(position.count);
const color = new Color(),
  vertex = new Vector3();
for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  if (i < length1) color.setHSL(0.01 + (0.1 * i) / length1, 0.99, (vertex.y + 100) / 400);
  else color.setHSL(0.6, 0.75, 0.25 + vertex.y / 200);
  color.toArray(colors, i * 3);
  sizes[i] = i < length1 ? 10 : 40;
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", position);
geometry.setAttribute("ca", new Float32BufferAttribute(colors, 3));
const size = new BufferAttribute(sizes, 1);
geometry.setAttribute("size", size);
sphere.dispose();
box.dispose();
merged.dispose();
const texture = new TextureLoader().load(
  "/examples/textures/sprites/disc.png",
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
texture.wrapS = texture.wrapT = RepeatWrapping;
const material = new ShaderMaterial({
  uniforms: { color: { value: new Color(0xffffff) }, pointTexture: { value: texture } },
  vertexShader: `attribute float size; attribute vec3 ca; varying vec3 vColor; void main() { vColor = ca; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D pointTexture; varying vec3 vColor; void main() { gl_FragColor = vec4(color * vColor, 1.0) * texture2D(pointTexture, gl_PointCoord); }`,
  transparent: true,
});
const object = new Points(geometry, material);
scene.add(object);
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
const indices = new Uint16Array(position.count);
const index = new BufferAttribute(indices, 1);
geometry.setIndex(index);
const matrix = new Matrix4();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function animate(): void {
  const time = Date.now() * 0.005;
  object.rotation.y = object.rotation.z = 0.02 * time;
  for (let i = 0; i < length1; i++) sizes[i] = 16 + 12 * Math.sin(0.1 * i + time);
  size.needsUpdate = true;
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(object.matrixWorld);
  const sorted: [number, number][] = [];
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i).applyMatrix4(matrix);
    sorted.push([vertex.z, i]);
  }
  sorted.sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < sorted.length; i++) indices[i] = sorted[i][1];
  index.needsUpdate = true;
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
