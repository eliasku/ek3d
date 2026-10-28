import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { clamp } from "ek3d/math/MathUtils";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selectedNormalCanvas = document.querySelector<HTMLCanvasElement>("#normal-canvas");
const selectedLogCanvas = document.querySelector<HTMLCanvasElement>("#log-canvas");
const selectedNormalContainer = document.querySelector<HTMLDivElement>("#normal");
const selectedLogContainer = document.querySelector<HTMLDivElement>("#log");
const selectedBorder = document.querySelector<HTMLDivElement>("#border");
if (!selectedNormalCanvas || !selectedLogCanvas || !selectedNormalContainer || !selectedLogContainer || !selectedBorder)
  throw new Error("Missing depth comparison elements");
const normalCanvas: HTMLCanvasElement = selectedNormalCanvas;
const logCanvas: HTMLCanvasElement = selectedLogCanvas;
const normalContainer: HTMLDivElement = selectedNormalContainer;
const logContainer: HTMLDivElement = selectedLogContainer;
const border: HTMLDivElement = selectedBorder;
const scene = new Scene();
scene.add(new AmbientLight(0x777777));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(100, 100, 100);
scene.add(light);
const normalCamera = new PerspectiveCamera(50, 1, 1e-6, 1e27);
const logCamera = new PerspectiveCamera(50, 1, 1e-6, 1e27);
scene.add(normalCamera, logCamera);
const normalRenderer = new WebGLRenderer({
  canvas: normalCanvas,
  antialias: true,
  shaders: { MeshPhongMaterial: phongShader },
});
const logRenderer = new WebGLRenderer({
  canvas: logCanvas,
  antialias: true,
  logarithmicDepthBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
const stats = new Stats();
document.body.appendChild(stats.dom);
const labels = [
  { size: 0.01, scale: 0.0001, label: "microscopic (1µm)" },
  { size: 0.01, scale: 0.1, label: "minuscule (1mm)" },
  { size: 0.01, scale: 1, label: "tiny (1cm)" },
  { size: 1, scale: 1, label: "child-sized (1m)" },
  { size: 10, scale: 1, label: "tree-sized (10m)" },
  { size: 100, scale: 1, label: "building-sized (100m)" },
  { size: 1000, scale: 1, label: "medium (1km)" },
  { size: 10000, scale: 1, label: "city-sized (10km)" },
  { size: 3400000, scale: 1, label: "moon-sized (3,400 Km)" },
  { size: 12000000, scale: 1, label: "planet-sized (12,000 km)" },
  { size: 1400000000, scale: 1, label: "sun-sized (1,400,000 km)" },
  { size: 7.47e12, scale: 1, label: "solar system-sized (50Au)" },
  { size: 9.4605284e15, scale: 1, label: "gargantuan (1 light year)" },
  { size: 3.08567758e16, scale: 1, label: "ludicrous (1 parsec)" },
  { size: 1e19, scale: 1, label: "mind boggling (1000 light years)" },
];
let split = 0.25;
let zoompos = -100;
let minimumSpeed = 0.015;
let speed = minimumSpeed;
let mouseX = 0.5;
let mouseY = 0.5;
let disposed = false;
function resize(): void {
  const width = innerWidth;
  const height = innerHeight;
  for (const [renderer, camera, fraction, offset, container] of [
    [normalRenderer, normalCamera, split, 0, normalContainer],
    [logRenderer, logCamera, 1 - split, split, logContainer],
  ] as const) {
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(width * fraction, height);
    camera.aspect = (width * fraction) / height;
    camera.updateProjectionMatrix();
    camera.setViewOffset(width, height, width * offset, 0, width * fraction, height);
    container.style.width = `${fraction * 100}%`;
  }
  border.style.left = `${split * 100}%`;
}
function moveBorder(event: PointerEvent): void {
  split = clamp(event.clientX / innerWidth, 0, 1);
  resize();
}
function stopBorder(): void {
  window.removeEventListener("pointermove", moveBorder);
  window.removeEventListener("pointerup", stopBorder);
}
function startBorder(): void {
  window.addEventListener("pointermove", moveBorder);
  window.addEventListener("pointerup", stopBorder);
}
function mouseMove(event: MouseEvent): void {
  mouseX = event.clientX / innerWidth;
  mouseY = event.clientY / innerHeight;
}
function wheel(event: WheelEvent): void {
  if (event.deltaY === 0) return;
  speed = Math.sign(event.deltaY) / 10;
  minimumSpeed = 0.001;
}
resize();
border.addEventListener("pointerdown", startBorder);
window.addEventListener("mousemove", mouseMove);
window.addEventListener("resize", resize);
window.addEventListener("wheel", wheel);
normalCanvas.dataset.state = "loading";
new FontLoader().load(
  new URL("./fonts/helvetiker_regular.typeface.json", import.meta.url).href,
  (font) => {
    if (disposed) return;
    const sphere = new SphereGeometry(0.5, 24, 12);
    for (const label of labels) {
      const geometry = new TextGeometry(label.label, { font, size: label.size, depth: label.size / 2 });
      geometry.computeBoundingSphere();
      geometry.translate(-geometry.boundingSphere!.radius, 0, 0);
      const material = new MeshPhongMaterial({
        color: new Color().setHSL(Math.random(), 0.5, 0.5),
        specular: 0x050505,
        shininess: 50,
        emissive: 0x000000,
      });
      const group = new Group();
      group.position.z = -label.size * label.scale;
      scene.add(group);
      const text = new Mesh(geometry, material);
      text.scale.setScalar(label.scale);
      text.position.z = -label.size * label.scale;
      text.position.y = (label.size / 4) * label.scale;
      group.add(text);
      const dot = new Mesh(sphere, material);
      dot.position.y = (-label.size / 4) * label.scale;
      dot.scale.multiplyScalar(label.size * label.scale);
      group.add(dot);
    }
    normalRenderer.setAnimationLoop(() => {
      const min = labels[0]!.size * labels[0]!.scale;
      const last = labels[labels.length - 1]!;
      const max = last.size * last.scale * 100;
      let damping = Math.abs(speed) > minimumSpeed ? 0.95 : 1;
      const zoom = clamp(Math.exp(zoompos), min, max);
      zoompos = Math.log(zoom);
      if ((zoom === min && speed < 0) || (zoom === max && speed > 0)) damping = 0.85;
      zoompos += speed;
      speed *= damping;
      normalCamera.position.set(
        Math.sin(0.5 * Math.PI * (mouseX - 0.5)) * zoom,
        Math.sin(0.25 * Math.PI * (mouseY - 0.5)) * zoom,
        Math.cos(0.5 * Math.PI * (mouseX - 0.5)) * zoom,
      );
      normalCamera.lookAt(scene.position);
      logCamera.position.copy(normalCamera.position);
      logCamera.quaternion.copy(normalCamera.quaternion);
      normalRenderer.render(scene, normalCamera);
      logRenderer.render(scene, logCamera);
      stats.update();
      normalCanvas.dataset.state = "rendered";
      logCanvas.dataset.state = "rendered";
    });
  },
  undefined,
  (cause) => {
    if (disposed) return;
    normalCanvas.dataset.state = "error";
    normalCanvas.dataset.error = cause instanceof Error ? cause.message : String(cause);
    console.error(cause);
  },
);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  border.removeEventListener("pointerdown", startBorder);
  stopBorder();
  window.removeEventListener("mousemove", mouseMove);
  window.removeEventListener("resize", resize);
  window.removeEventListener("wheel", wheel);
  normalRenderer.setAnimationLoop(null);
  disposeObject(scene);
  normalRenderer.dispose();
  logRenderer.dispose();
  stats.dom.remove();
});
