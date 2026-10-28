import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";
import { Fog } from "ek3d/scenes/Fog";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { SRGBColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BufferGeometry example canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;

let stats!: Stats;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;

let points!: Points;

init();

function init(): void {
  camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 5, 3500);
  camera.position.z = 2750;

  scene = new Scene();
  scene.background = new Color(0x050505);
  scene.fog = new Fog(0x050505, 2000, 3500);

  const particles = 500000;

  const geometry = new BufferGeometry();

  const positions = [];
  const colors = [];

  const color = new Color();

  const n = 1000,
    n2 = n / 2; // particles spread in the cube

  for (let i = 0; i < particles; i++) {
    // positions

    const x = Math.random() * n - n2;
    const y = Math.random() * n - n2;
    const z = Math.random() * n - n2;

    positions.push(x, y, z);

    // colors

    const vx = x / n + 0.5;
    const vy = y / n + 0.5;
    const vz = z / n + 0.5;

    color.setRGB(vx, vy, vz, SRGBColorSpace);

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  geometry.computeBoundingSphere();

  const material = new PointsMaterial({ size: 15, vertexColors: true });

  points = new Points(geometry, material);
  scene.add(points);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { PointsMaterial: pointsShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  stats = new Stats();
  document.body.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  const time = Date.now() * 0.001;

  points.rotation.x = time * 0.25;
  points.rotation.y = time * 0.5;

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";

  stats.update();
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);

  stats.dom.remove();
  disposeObject(scene);

  renderer.dispose();
  canvas.dataset.state = "disposed";
});
