import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";
import { NURBSCurve } from "ek3d/addons/curves/NURBSCurve";
import { NURBSSurface } from "ek3d/addons/curves/NURBSSurface";
import { NURBSVolume } from "ek3d/addons/curves/NURBSVolume";
import { ParametricGeometry } from "ek3d/addons/geometries/ParametricGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Vector4 } from "ek3d/math/Vector4";
import { Group } from "ek3d/objects/Group";
import { Line } from "ek3d/objects/Line";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing NURBS canvas");
const canvas: HTMLCanvasElement = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 2000);
camera.position.set(0, 150, 750);
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
scene.add(new AmbientLight(0xffffff));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(1, 1, 1);
scene.add(light);
const group = new Group();
group.position.y = 50;
scene.add(group);
const points: Vector4[] = [],
  knots: number[] = [0, 0, 0, 0];
for (let i = 0; i < 20; i++) {
  points.push(new Vector4(Math.random() * 400 - 200, Math.random() * 400, Math.random() * 400 - 200, 1));
  knots.push(Math.min(1, (i + 1) / 17));
}
const curve = new NURBSCurve(3, knots, points);
const curveGeometry = new BufferGeometry().setFromPoints(curve.getPoints(200));
const curveLine = new Line(curveGeometry, new LineBasicMaterial({ color: 0x333333 }));
curveLine.position.y = -100;
group.add(curveLine);
const controlGeometry = new BufferGeometry().setFromPoints(curve.controlPoints.map((p) => new Vector3(p.x, p.y, p.z)));
const controlLine = new Line(
  controlGeometry,
  new LineBasicMaterial({ color: 0x333333, opacity: 0.25, transparent: true }),
);
controlLine.position.copy(curveLine.position);
group.add(controlLine);
const surface = [
  [
    new Vector4(-200, -200, 100, 1),
    new Vector4(-200, -100, -200, 1),
    new Vector4(-200, 100, 250, 1),
    new Vector4(-200, 200, -100, 1),
  ],
  [new Vector4(0, -200, 0, 1), new Vector4(0, -100, -100, 5), new Vector4(0, 100, 150, 5), new Vector4(0, 200, 0, 1)],
  [
    new Vector4(200, -200, -100, 1),
    new Vector4(200, -100, 200, 1),
    new Vector4(200, 100, -250, 1),
    new Vector4(200, 200, 100, 1),
  ],
];
const volume = [-200, 0, 200].map((x, i) =>
  [-200, -100, 100, 200].map((y, j) => {
    const z = i === 2 && j > 0 ? [0, 100] : [-200, 200];
    return z.map((value) => new Vector4(x, y, value, 1));
  }),
);
const knotsU = [0, 0, 0, 1, 1, 1],
  knotsV = [0, 0, 0, 0, 1, 1, 1, 1],
  knotsW = [0, 0, 1, 1];
const map = new TextureLoader().load(
  "/examples/textures/uv_grid_opengl.jpg",
  (texture) => {
    if (disposed) texture.dispose();
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
map.wrapS = map.wrapT = RepeatWrapping;
map.anisotropy = 16;
map.colorSpace = SRGBColorSpace;
const material = new MeshLambertMaterial({ map, side: DoubleSide });
const nurbsSurface = new NURBSSurface(2, 3, knotsU, knotsV, surface);
const surfaceMesh = new Mesh(
  new ParametricGeometry((u, v, target) => nurbsSurface.getPoint(u, v, target), 20, 20),
  material,
);
surfaceMesh.position.set(-400, 100, 0);
group.add(surfaceMesh);
const nurbsVolume = new NURBSVolume(2, 3, 1, knotsU, knotsV, knotsW, volume);
const volumePoint = (u: number, v: number, w: number, target: Vector3): void => nurbsVolume.getPoint(u, v, w, target);
const surfaces: ((u: number, v: number, target: Vector3) => void)[] = [
  (u, v, target) => volumePoint(u, v, 0, target),
  (u, v, target) => volumePoint(u, v, 0.5, target),
  (u, v, target) => volumePoint(u, v, 1, target),
  (u, w, target) => volumePoint(u, 1, w, target),
  (v, w, target) => volumePoint(0, v, w, target),
];
for (const fn of surfaces) {
  const mesh = new Mesh(new ParametricGeometry(fn, 20, 20), material);
  mesh.position.set(400, 100, 0);
  mesh.scale.multiplyScalar(0.5);
  group.add(mesh);
}
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshLambertMaterial: lambertShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);
let targetRotation = 0,
  downRotation = 0,
  downX = 0;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
function pointerDown(event: PointerEvent): void {
  if (!event.isPrimary) return;
  downX = event.clientX - innerWidth / 2;
  downRotation = targetRotation;
  document.addEventListener("pointermove", pointerMove);
  document.addEventListener("pointerup", pointerUp);
  document.addEventListener("pointercancel", pointerUp);
}
function pointerMove(event: PointerEvent): void {
  if (!event.isPrimary) return;
  targetRotation = downRotation + (event.clientX - innerWidth / 2 - downX) * 0.02;
}
function removePointerListeners(): void {
  document.removeEventListener("pointermove", pointerMove);
  document.removeEventListener("pointerup", pointerUp);
  document.removeEventListener("pointercancel", pointerUp);
}
function pointerUp(event: PointerEvent): void {
  if (event.isPrimary) removePointerListeners();
}
canvas.addEventListener("pointerdown", pointerDown);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  group.rotation.y += (targetRotation - group.rotation.y) * 0.05;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  canvas.removeEventListener("pointerdown", pointerDown);
  removePointerListeners();
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  stats.dom.remove();
  canvas.dataset.state = "disposed";
});
