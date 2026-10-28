import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Line2 } from "ek3d/addons/lines/Line2";
import { LineGeometry } from "ek3d/addons/lines/LineGeometry";
import { LineMaterial } from "ek3d/addons/lines/LineMaterial";
import { LineSegments2 } from "ek3d/addons/lines/LineSegments2";
import { LineSegmentsGeometry } from "ek3d/addons/lines/LineSegmentsGeometry";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import type { InterleavedBufferAttribute } from "ek3d/core/InterleavedBufferAttribute";
import type { Intersection } from "ek3d/core/Raycaster";
import { Raycaster } from "ek3d/core/Raycaster";
import { Timer } from "ek3d/core/Timer";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing fat line raycasting canvas");
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(-40, 0, 60);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 10;
controls.maxDistance = 500;
const timer = new Timer();
timer.connect(document);
const pointer = new Vector2(Infinity, Infinity);
const raycaster = new Raycaster();
const lineParams = { threshold: 0 };
raycaster.params.Line2 = lineParams;
const matLine = new LineMaterial({
  color: 0xffffff,
  linewidth: 1,
  worldUnits: true,
  vertexColors: true,
  alphaToCoverage: true,
});
const matThresholdLine = new LineMaterial({
  color: 0xffffff,
  linewidth: 1,
  worldUnits: true,
  transparent: true,
  opacity: 0.2,
  depthTest: false,
  visible: false,
});
const sphereGeometry = new SphereGeometry(0.25, 8, 4);
const sphereInter = new Mesh<MeshBasicMaterial>(
  sphereGeometry,
  new MeshBasicMaterial({ color: 0xff0000, depthTest: false }),
);
const sphereOnLine = new Mesh<MeshBasicMaterial>(
  sphereGeometry,
  new MeshBasicMaterial({ color: 0x00ff00, depthTest: false }),
);
sphereInter.visible = sphereOnLine.visible = false;
sphereInter.renderOrder = sphereOnLine.renderOrder = 10;
scene.add(sphereInter, sphereOnLine);

const points: Vector3[] = [];
for (let i = -50; i < 50; i++) {
  const t = i / 3;
  points.push(new Vector3(t * Math.sin(2 * t), t, t * Math.cos(2 * t)));
}
const spline = new CatmullRomCurve3(points);
const divisions = Math.round(3 * points.length);
const positions: number[] = [];
const colors: number[] = [];
const point = new Vector3();
const color = new Color();
for (let i = 0; i < divisions; i++) {
  const t = i / divisions;
  spline.getPoint(t, point);
  positions.push(point.x, point.y, point.z);
  color.setHSL(t, 1, 0.5, ColorSpace.SRGB);
  colors.push(color.r, color.g, color.b);
}
const lineGeometry = new LineGeometry().setPositions(positions).setColors(colors);
const segmentsGeometry = new LineSegmentsGeometry().setPositions(positions).setColors(colors);
const line = new Line2(lineGeometry, matLine);
const thresholdLine = new Line2(lineGeometry, matThresholdLine);
const segments = new LineSegments2(segmentsGeometry, matLine);
const thresholdSegments = new LineSegments2(segmentsGeometry, matThresholdLine);
for (const object of [line, thresholdLine, segments, thresholdSegments]) {
  object.computeLineDistances();
  scene.add(object);
}
line.visible = thresholdLine.visible = false;

const params = {
  "line type": 1,
  "world units": matLine.worldUnits,
  "visualize threshold": matThresholdLine.visible,
  width: matLine.linewidth,
  alphaToCoverage: matLine.alphaToCoverage,
  threshold: lineParams.threshold,
  translation: 0,
  animate: true,
};
const gui = new GUI();
gui.add(params, "line type", { LineGeometry: 0, LineSegmentsGeometry: 1 }).onChange(() => {
  line.visible = thresholdLine.visible = params["line type"] === 0;
  segments.visible = thresholdSegments.visible = params["line type"] === 1;
});
gui.add(params, "world units").onChange(() => {
  matLine.worldUnits = matThresholdLine.worldUnits = params["world units"];
});
gui.add(params, "visualize threshold").onChange(() => {
  matThresholdLine.visible = params["visualize threshold"];
});
gui.add(params, "width", 1, 10).onChange(() => {
  matLine.linewidth = params.width;
  matThresholdLine.linewidth = params.width + lineParams.threshold;
});
gui.add(params, "alphaToCoverage").onChange(() => {
  matLine.alphaToCoverage = params.alphaToCoverage;
});
gui.add(params, "threshold", 0, 10).onChange(() => {
  lineParams.threshold = params.threshold;
  matThresholdLine.linewidth = matLine.linewidth + lineParams.threshold;
});
gui.add(params, "translation", 0, 10).onChange(() => {
  line.position.x = segments.position.x = params.translation;
});
gui.add(params, "animate");

function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function move(event: PointerEvent): void {
  pointer.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
}
document.addEventListener("pointermove", move);
window.addEventListener("resize", resize);
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  if (params.animate) {
    line.rotation.y += timer.getDelta() * 0.1;
    segments.rotation.y = line.rotation.y;
  }
  thresholdLine.position.copy(line.position);
  thresholdLine.quaternion.copy(line.quaternion);
  thresholdSegments.position.copy(segments.position);
  thresholdSegments.quaternion.copy(segments.quaternion);
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const object = line.visible ? line : segments;
  const hit = raycaster.intersectObject(object)[0] as
    | (Intersection & { pointOnLine: Vector3; faceIndex: number })
    | undefined;
  sphereInter.visible = sphereOnLine.visible = hit !== undefined;
  if (hit) {
    sphereInter.position.copy(hit.point);
    sphereOnLine.position.copy(hit.pointOnLine);
    color.fromBufferAttribute(
      object.geometry.getAttribute("instanceColorStart") as InterleavedBufferAttribute,
      hit.faceIndex,
    );
    sphereInter.material.color.copy(color).offsetHSL(0.3, 0, 0);
    sphereOnLine.material.color.copy(color).offsetHSL(0.7, 0, 0);
  }
  canvas.style.cursor = hit ? "crosshair" : "";
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("pointermove", move);
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
