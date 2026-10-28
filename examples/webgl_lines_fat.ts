import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Line2 } from "ek3d/addons/lines/Line2";
import { LineGeometry } from "ek3d/addons/lines/LineGeometry";
import { LineMaterial } from "ek3d/addons/lines/LineMaterial";
import { hilbert3D } from "ek3d/addons/utils/GeometryUtils";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { LineDashedMaterial } from "ek3d/materials/LineDashedMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { dashedShader } from "ek3d/renderers/shaders/DashedShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing fat lines canvas");
const canvas: HTMLCanvasElement = canvasElement;
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { LineBasicMaterial: basicShader, LineDashedMaterial: dashedShader },
});
renderer.setPixelRatio(devicePixelRatio);
const scene = new Scene();
const frustumSize = 60;
const perspective = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
perspective.position.set(-40, 0, 60);
const orthographic = new OrthographicCamera(-30, 30, 30, -30, 1, 1000);
orthographic.position.copy(perspective.position);
let camera: PerspectiveCamera | OrthographicCamera = perspective;
const insetCamera = new PerspectiveCamera(40, 1, 1, 1000);
const controls = new OrbitControls<PerspectiveCamera | OrthographicCamera>(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 500;

const positions: number[] = [];
const colors: number[] = [];
const points = hilbert3D(new Vector3(), 20, 1);
const spline = new CatmullRomCurve3(points);
const divisions = Math.round(12 * points.length);
const point = new Vector3();
const color = new Color();
for (let i = 0; i < divisions; i++) {
  const t = i / divisions;
  spline.getPoint(t, point);
  positions.push(point.x, point.y, point.z);
  color.setHSL(t, 1, 0.5, ColorSpace.SRGB);
  colors.push(color.r, color.g, color.b);
}
const geometry = new LineGeometry();
geometry.setPositions(positions);
geometry.setColors(colors);
const material = new LineMaterial({
  color: 0xffffff,
  linewidth: 5,
  vertexColors: true,
  dashed: false,
  alphaToCoverage: true,
});
const line = new Line2(geometry, material);
line.computeLineDistances();
scene.add(line);
const basicGeometry = new BufferGeometry();
basicGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
basicGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
const basic = new LineBasicMaterial({ vertexColors: true });
const dashed = new LineDashedMaterial({ vertexColors: true, scale: 2, dashSize: 1, gapSize: 1 });
const thinLine = new Line<LineBasicMaterial>(basicGeometry, basic);
thinLine.computeLineDistances();
thinLine.visible = false;
scene.add(thinLine);

const gui = new GUI();
const params = {
  camera: 0,
  "line type": 0,
  "world units": false,
  width: 5,
  alphaToCoverage: true,
  dashed: false,
  "dash scale": 1,
  "dash / gap": 1,
};
gui.add(params, "camera", { perspective: 0, orthographic: 1 }).onChange(() => {
  const value = params.camera;
  const previous = camera;
  camera = value === 0 ? perspective : orthographic;
  camera.position.copy(previous.position);
  camera.quaternion.copy(previous.quaternion);
  controls.object = camera;
});
gui.add(params, "line type", { LineGeometry: 0, "gl.LINE": 1 }).onChange(() => {
  const value = params["line type"];
  line.visible = value === 0;
  thinLine.visible = value === 1;
});
gui.add(params, "world units").onChange(() => {
  const value = params["world units"];
  material.worldUnits = value;
  material.needsUpdate = true;
  if (value) widthController.name("width (world units)").min(0.1).max(0.5).setValue(0.5);
  else widthController.name("width (pixels)").min(1).max(10).setValue(5);
});
const widthController = gui
  .add(params, "width", 1, 10)
  .name("width (pixels)")
  .onChange(() => {
    material.linewidth = params.width;
  });
gui.add(params, "alphaToCoverage").onChange(() => {
  material.alphaToCoverage = params.alphaToCoverage;
});
gui.add(params, "dashed").onChange(() => {
  const value = params.dashed;
  material.dashed = value;
  thinLine.material = value ? dashed : basic;
});
gui.add(params, "dash scale", 0.5, 2, 0.1).onChange(() => {
  material.dashScale = dashed.scale = params["dash scale"];
});
gui.add(params, "dash / gap", { "2 : 1": 0, "1 : 1": 1, "1 : 2": 2 }).onChange(() => {
  const value = params["dash / gap"];
  material.dashSize = dashed.dashSize = value === 0 ? 2 : 1;
  material.gapSize = dashed.gapSize = value === 2 ? 2 : 1;
});

let insetSize = innerHeight / 4;
function resize(): void {
  const aspect = innerWidth / innerHeight;
  perspective.aspect = aspect;
  perspective.updateProjectionMatrix();
  orthographic.left = (-frustumSize * aspect) / 2;
  orthographic.right = (frustumSize * aspect) / 2;
  orthographic.top = frustumSize / 2;
  orthographic.bottom = -frustumSize / 2;
  orthographic.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  insetSize = innerHeight / 4;
  insetCamera.aspect = 1;
  insetCamera.updateProjectionMatrix();
}
function animate(): void {
  renderer.setClearColor(0x000000, 0);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  controls.update();
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
  disposeObject(scene, [basic, dashed]);
  renderer.dispose();
});
