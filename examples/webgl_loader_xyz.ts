import { XYZLoader } from "ek3d/addons/loaders/XYZLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing XYZ loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(10, 7, 10);
const scene = new Scene();
scene.add(camera);
camera.lookAt(scene.position);
const timer = new Timer();
timer.connect(document);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { PointsMaterial: pointsShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
let points: Points | undefined;
let disposed = false;
let frames = 0;
new XYZLoader().load(
  "/examples/models/xyz/helix_201.xyz",
  (geometry) => {
    if (disposed) {
      geometry.dispose();
      return;
    }
    geometry.center();
    points = new Points(geometry, new PointsMaterial({ size: 0.1, vertexColors: geometry.hasAttribute("color") }));
    scene.add(points);
    canvas.dataset.loaded = "true";
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
renderer.setAnimationLoop(() => {
  timer.update();
  const delta = timer.getDelta();
  if (points) {
    points.rotation.x += delta * 0.2;
    points.rotation.y += delta * 0.5;
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (points) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  if (points) {
    points.geometry.dispose();
    (points.material as PointsMaterial).dispose();
    scene.remove(points);
  }
  renderer.dispose();
});
