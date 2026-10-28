import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { Timer } from "ek3d/core/Timer";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { Line } from "ek3d/objects/Line";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BufferGeometry example canvas");
const canvas: HTMLCanvasElement = canvasSel;
let disposed = false;
let frames = 0;

let stats!: Stats;
let timer!: Timer;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;

let line!: Line;

const segments = 10000;
const r = 800;
let t = 0;

init();

function init(): void {
  camera = new PerspectiveCamera(27, window.innerWidth / window.innerHeight, 1, 4000);
  camera.position.z = 2750;

  scene = new Scene();

  timer = new Timer();
  timer.connect(document);

  const geometry = new BufferGeometry();
  const material = new LineBasicMaterial({ vertexColors: true });

  const positions = [];
  const colors = [];

  for (let i = 0; i < segments; i++) {
    const x = Math.random() * r - r / 2;
    const y = Math.random() * r - r / 2;
    const z = Math.random() * r - r / 2;

    // positions

    positions.push(x, y, z);

    // colors

    colors.push(x / r + 0.5);
    colors.push(y / r + 0.5);
    colors.push(z / r + 0.5);
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  generateMorphTargets(geometry);

  geometry.computeBoundingSphere();

  line = new Line(geometry, material);
  scene.add(line);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { LineBasicMaterial: basicShader },
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
  timer.update();

  const delta = timer.getDelta();
  const time = timer.getElapsed();

  line.rotation.x = time * 0.25;
  line.rotation.y = time * 0.5;

  t += delta * 0.5;
  line.morphTargetInfluences![0] = Math.abs(Math.sin(t));

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";

  stats.update();
}

function generateMorphTargets(geometry: BufferGeometry): void {
  const data = [];

  for (let i = 0; i < segments; i++) {
    const x = Math.random() * r - r / 2;
    const y = Math.random() * r - r / 2;
    const z = Math.random() * r - r / 2;

    data.push(x, y, z);
  }

  const morphTarget = new Float32BufferAttribute(data, 3);
  morphTarget.name = "target1";

  geometry.morphAttributes.position = [morphTarget];
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);
  timer.dispose();

  stats.dom.remove();
  disposeObject(scene);

  renderer.dispose();
  canvas.dataset.state = "disposed";
});
