import { Stats } from "ek3d/addons/libs/Stats";
import { mergeVertices } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping } from "ek3d/constants";
import { BufferAttribute, Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
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
if (!selected) throw new Error("Missing alpha points canvas");
const canvas = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.z = 500;
const scene = new Scene();
const vertices: number[] = [];
const vertex = new Vector3();
for (let i = 0; i < 100000; i++) {
  vertex.set((Math.random() * 2 - 1) * 100, (Math.random() * 2 - 1) * 100, (Math.random() * 2 - 1) * 100);
  if (Math.abs(vertex.x) > 60 || Math.abs(vertex.y) > 60 || Math.abs(vertex.z) > 60)
    vertices.push(vertex.x, vertex.y, vertex.z);
}
const innerCount = vertices.length / 3;
function addEdges(source: BoxGeometry, positions: [number, number, number, number][]): void {
  source.deleteAttribute("normal");
  source.deleteAttribute("uv");
  const merged = mergeVertices(source);
  source.dispose();
  const attr = merged.getAttribute("position");
  if (!(attr instanceof BufferAttribute)) throw new Error("Missing box edge positions");
  for (const [x, y, z, angle] of positions) {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    for (let i = 0; i < attr.count; i++) {
      vertex.fromBufferAttribute(attr, i);
      vertices.push(vertex.x * cos + vertex.z * sin + x, vertex.y + y, -vertex.x * sin + vertex.z * cos + z);
    }
  }
  merged.dispose();
}
addEdges(new BoxGeometry(200, 20, 20, 50, 5, 5), [
  [0, 110, 110, 0],
  [0, 110, -110, 0],
  [0, -110, 110, 0],
  [0, -110, -110, 0],
  [110, 110, 0, Math.PI / 2],
  [110, -110, 0, Math.PI / 2],
  [-110, 110, 0, Math.PI / 2],
  [-110, -110, 0, Math.PI / 2],
]);
addEdges(new BoxGeometry(20, 240, 20, 5, 60, 5), [
  [110, 0, 110, 0],
  [110, 0, -110, 0],
  [-110, 0, 110, 0],
  [-110, 0, -110, 0],
]);
const position = new Float32BufferAttribute(vertices, 3);
const colors: number[] = [],
  sizes: number[] = [];
const color = new Color();
for (let i = 0; i < position.count; i++) {
  color.setHSL(i < innerCount ? 0.5 + (0.2 * i) / innerCount : 0.1, 1, 0.5);
  color.toArray(colors, i * 3);
  sizes.push(i < innerCount ? 10 : 40);
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", position);
geometry.setAttribute("ca", new Float32BufferAttribute(colors, 3));
const size = new Float32BufferAttribute(sizes, 1);
geometry.setAttribute("size", size);
const texture = new TextureLoader().load(
  "/examples/textures/sprites/ball.png",
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
texture.wrapS = texture.wrapT = Wrapping.Repeat;
const material = new ShaderMaterial({
  uniforms: { amplitude: { value: 1 }, color: { value: new Color(0xffffff) }, pointTexture: { value: texture } },
  vertexShader: `attribute float size; attribute vec4 ca; varying vec4 vColor; void main() { vColor = ca; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (150.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D pointTexture; varying vec4 vColor; void main() { vec4 outColor = texture2D(pointTexture, gl_PointCoord); if (outColor.a < 0.5) discard; gl_FragColor = outColor * vec4(color * vColor.xyz, 1.0); float depth = gl_FragCoord.z / gl_FragCoord.w; float fogFactor = smoothstep(200.0, 600.0, depth); gl_FragColor = mix(gl_FragColor, vec4(0.0, 0.0, 0.0, gl_FragColor.w), fogFactor); }`,
});
const object = new Points(geometry, material);
scene.add(object);
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
  const time = Date.now() * 0.01;
  object.rotation.y = object.rotation.z = 0.02 * time;
  for (let i = 0; i < innerCount; i++) size.setX(i, Math.max(0, 26 + 32 * Math.sin(0.1 * i + 0.6 * time)));
  size.needsUpdate = true;
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
