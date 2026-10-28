import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Raycaster } from "ek3d/core/Raycaster";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Points } from "ek3d/objects/Points";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { mergeVertices } from "ek3d/addons/utils/BufferGeometryUtils";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing interactive points canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;
const particleSize = 20;
const pointer = new Vector2();
const raycaster = new Raycaster();
let intersected: number | null = null;

const scene = new Scene();
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.z = 250;

const box = new BoxGeometry(200, 200, 200, 16, 16, 16);
box.deleteAttribute("normal");
box.deleteAttribute("uv");
const merged = mergeVertices(box);
box.dispose();
const positions = merged.getAttribute("position");
if (positions === undefined) throw new Error("Missing merged point positions");
const colors: number[] = [];
const sizes: number[] = [];
const color = new Color();
for (let i = 0; i < positions.count; i++) {
  color.setHSL(0.01 + 0.1 * (i / positions.count), 1, 0.5);
  color.toArray(colors, i * 3);
  sizes.push(particleSize * 0.5);
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", positions);
geometry.setAttribute("customColor", new Float32BufferAttribute(colors, 3));
const sizeAttribute = new Float32BufferAttribute(sizes, 1);
geometry.setAttribute("size", sizeAttribute);
merged.dispose();

const texture = new TextureLoader().load(
  "/examples/textures/sprites/disc.png",
  (loaded) => {
    if (disposed) loaded.dispose();
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
  uniforms: {
    color: { value: new Color(0xffffff) },
    pointTexture: { value: texture },
    alphaTest: { value: 0.9 },
  },
  vertexShader: `
    attribute float size;
    attribute vec3 customColor;
    varying vec3 vColor;
    void main() {
      vColor = customColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D pointTexture;
    uniform float alphaTest;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(color * vColor, 1.0);
      gl_FragColor *= texture2D(pointTexture, gl_PointCoord);
      if (gl_FragColor.a < alphaTest) discard;
    }
  `,
});
const particles = new Points(geometry, material);
scene.add(particles);
const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
const stats = new Stats();
document.body.appendChild(stats.dom);
window.addEventListener("resize", onWindowResize);
document.addEventListener("pointermove", onPointerMove);

function onPointerMove(event: PointerEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function animate(): void {
  particles.rotation.x += 0.0005;
  particles.rotation.y += 0.001;
  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.intersectObject(particles)[0];
  const index = intersection?.index ?? null;
  if (intersected !== index) {
    if (intersected !== null) sizeAttribute.setX(intersected, particleSize);
    if (index !== null) sizeAttribute.setX(index, particleSize * 1.25);
    sizeAttribute.needsUpdate = true;
    intersected = index;
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
}
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("pointermove", onPointerMove);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  texture.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
