import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { LineMaterial } from "ek3d/addons/lines/LineMaterial";
import { Wireframe } from "ek3d/addons/lines/Wireframe";
import { WireframeGeometry2 } from "ek3d/addons/lines/WireframeGeometry2";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { WireframeGeometry } from "ek3d/geometries/WireframeGeometry";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import { LineSegments } from "ek3d/objects/LineSegments";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing fat wireframe canvas");
const canvas: HTMLCanvasElement = canvasElement;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { LineBasicMaterial: basicShader, LineDashedMaterial: dashedShader },
});
renderer.setPixelRatio(devicePixelRatio);
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(-50, 0, 50);
const insetCamera = new PerspectiveCamera(40, 1, 1, 1000);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 500;
const sourceGeometry = new IcosahedronGeometry(20, 1);
const geometry = new WireframeGeometry2(sourceGeometry);
const material = new LineMaterial({ color: 0x4080ff, linewidth: 5, dashed: false });
const wireframe = new Wireframe(geometry, material);
wireframe.computeLineDistances();
scene.add(wireframe);
const basicGeometry = new WireframeGeometry(sourceGeometry);
sourceGeometry.dispose();
const basic = new LineBasicMaterial({ color: 0x4080ff });
const dashed = new LineDashedMaterial({ scale: 2, dashSize: 1, gapSize: 1 });
const thinWireframe = new LineSegments<LineBasicMaterial>(basicGeometry, basic);
thinWireframe.computeLineDistances();
thinWireframe.visible = false;
scene.add(thinWireframe);
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const params = { "line type": 0, "width (px)": 5, dashed: false, "dash scale": 1, "dash / gap": 1 };
gui.add(params, "line type", { LineGeometry: 0, "gl.LINE": 1 }).onChange(() => {
  const value = params["line type"];
  wireframe.visible = value === 0;
  thinWireframe.visible = value === 1;
});
gui.add(params, "width (px)", 1, 10).onChange(() => {
  material.linewidth = params["width (px)"];
});
gui.add(params, "dashed").onChange(() => {
  const value = params.dashed;
  material.dashed = value;
  thinWireframe.material = value ? dashed : basic;
});
gui.add(params, "dash scale", 0.5, 1, 0.1).onChange(() => {
  material.dashScale = dashed.scale = params["dash scale"];
});
gui.add(params, "dash / gap", { "2 : 1": 0, "1 : 1": 1, "1 : 2": 2 }).onChange(() => {
  const value = params["dash / gap"];
  material.dashSize = dashed.dashSize = value === 0 ? 2 : 1;
  material.gapSize = dashed.gapSize = value === 2 ? 2 : 1;
});
let insetSize = innerHeight / 4;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  insetSize = innerHeight / 4;
  insetCamera.aspect = 1;
  insetCamera.updateProjectionMatrix();
}
function animate(): void {
  renderer.setClearColor(0x000000, 0);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(scene, camera);
  renderer.setClearColor(0x222222, 1);
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setScissor(20, 20, insetSize, insetSize);
  renderer.setViewport(20, 20, insetSize, insetSize);
  insetCamera.position.copy(camera.position);
  insetCamera.quaternion.copy(camera.quaternion);
  renderer.render(scene, insetCamera);
  renderer.setScissorTest(false);
  stats.update();
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
resize();
window.addEventListener("resize", resize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene, [basic, dashed]);
  renderer.dispose();
});
