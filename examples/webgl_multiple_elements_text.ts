import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Timer } from "ek3d/core/Timer";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#c");
if (!canvas) throw new Error("Missing sound-wave canvas");
const renderer = new WebGLRenderer({ canvas, antialias: true, shaders: { PointsMaterial: pointsShader } });
renderer.setPixelRatio(window.devicePixelRatio);
const root = new Scene();
const colors = [
  "rgb(0,127,255)",
  "rgb(255,0,0)",
  "rgb(0,255,0)",
  "rgb(0,255,255)",
  "rgb(255,0,255)",
  "rgb(255,0,127)",
  "rgb(255,255,0)",
  "rgb(0,255,127)",
];
const views = Array.from(document.querySelectorAll<HTMLDivElement>(".view"), (element, index) => {
  const scene = new Scene();
  scene.background = new Color(0xffffff);
  root.add(scene);
  const vertices: number[] = [];
  if (index % 2 === 0) {
    for (let x = -10; x <= 10; x++)
      for (let y = -10; y <= 10; y++) for (let z = -10; z <= 10; z++) vertices.push(x, y, z);
  } else {
    for (let i = 0; i < 20 ** 3; i++)
      vertices.push(20 * Math.random() - 10, 20 * Math.random() - 10, 20 * Math.random() - 10);
  }
  const original = new Float32BufferAttribute(vertices, 3);
  const position = new Float32BufferAttribute(vertices, 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", position);
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 128;
  const context = sprite.getContext("2d");
  if (!context) throw new Error("Missing sprite canvas context");
  context.arc(64, 64, 64, 0, 2 * Math.PI);
  context.fillStyle = colors[Math.floor(colors.length * Math.random())];
  context.fill();
  const texture = new CanvasTexture(sprite);
  texture.colorSpace = SRGBColorSpace;
  scene.add(new Points(geometry, new PointsMaterial({ size: 0.25, map: texture, transparent: true, alphaTest: 0.1 })));
  const camera = new PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.set(0, 0, 24);
  const controls = new OrbitControls(camera, element);
  return { scene, element, camera, controls, position, original, wave: Math.floor(index / 2) };
});
const timer = new Timer();
timer.connect(document);
const point = new Vector3();
const offset = new Vector3();
let time = 0;
let width = 0;
let height = 0;
let frames = 0;
let disposed = false;
canvas.dataset.state = "loading";
renderer.setAnimationLoop(() => {
  timer.update();
  const newWidth = canvas.clientWidth;
  const newHeight = canvas.clientHeight;
  if (newWidth !== width || newHeight !== height) {
    width = newWidth;
    height = newHeight;
    renderer.setSize(width, height, false);
  }
  renderer.setClearColor(0xffffff);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setClearColor(0x000000);
  renderer.setScissorTest(true);
  for (const view of views) {
    const rect = view.element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
    const bottom = height - rect.bottom;
    renderer.setViewport(rect.left, bottom, rect.width, rect.height);
    renderer.setScissor(rect.left, bottom, rect.width, rect.height);
    view.camera.aspect = rect.width / rect.height;
    view.camera.updateProjectionMatrix();
    renderer.render(view.scene, view.camera);
    for (let i = 0; i < view.position.count; i++) {
      point.fromBufferAttribute(view.original, i);
      const { x, y, z } = point;
      if (view.wave === 0) {
        offset.set(Math.sin(x - time / 5), 0, 0);
      } else if (view.wave === 1) {
        const rho = Math.sqrt(x * x + y * y);
        if (rho < 0.1) offset.set(0, 0, 0);
        else {
          const phi = Math.atan2(y, x);
          const amplitude = (1.5 * Math.sin(rho - time / 5)) / Math.sqrt(rho);
          offset.set(amplitude * Math.cos(phi), amplitude * Math.sin(phi), 0);
        }
      } else {
        const r = Math.sqrt(x * x + y * y + z * z);
        if (r < 0.1) offset.set(0, 0, 0);
        else {
          const theta = Math.acos(z / r);
          const phi = Math.atan2(y, x);
          const amplitude = (3 * Math.sin(r - time / 5)) / r;
          offset.set(
            amplitude * Math.cos(phi) * Math.sin(theta),
            amplitude * Math.sin(phi) * Math.sin(theta),
            amplitude * Math.cos(theta),
          );
        }
      }
      view.position.setXYZ(i, x + offset.x, y + offset.y, z + offset.z);
    }
    view.position.needsUpdate = true;
  }
  time += timer.getDelta() * 60;
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  timer.dispose();
  for (const view of views) view.controls.dispose();
  disposeObject(root);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
