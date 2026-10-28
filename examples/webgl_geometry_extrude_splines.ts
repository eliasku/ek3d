import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import {
  GrannyKnot,
  HeartCurve,
  VivianiCurve,
  KnotCurve,
  HelixCurve,
  TrefoilKnot,
  TorusKnot,
  CinquefoilKnot,
  TrefoilPolynomialKnot,
  FigureEightPolynomialKnot,
  DecoratedTorusKnot4a,
  DecoratedTorusKnot4b,
  DecoratedTorusKnot5a,
  DecoratedTorusKnot5c,
} from "ek3d/addons/curves/CurveExtras";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Object3D } from "ek3d/core/Object3D";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { TubeGeometry } from "ek3d/geometries/TubeGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing spline extrusion canvas");
const canvas: HTMLCanvasElement = canvasElement;
const pipeSpline = new CatmullRomCurve3(
  [
    [0, 10, -10],
    [10, 0, -10],
    [20, 0, 0],
    [30, 0, 10],
    [30, 0, 20],
    [20, 0, 30],
    [10, 0, 30],
    [0, 0, 30],
    [-10, 10, 30],
    [-10, 20, 30],
    [0, 30, 30],
    [10, 30, 30],
    [20, 30, 15],
    [10, 30, 10],
    [0, 30, 10],
    [-10, 20, 10],
    [-10, 10, 10],
    [0, 0, 10],
    [10, -10, 10],
    [20, -15, 10],
    [30, -15, 10],
    [40, -15, 10],
    [50, -15, 10],
    [60, 0, 10],
    [70, 0, 0],
    [80, 0, 0],
    [90, 0, 0],
    [100, 0, 0],
  ].map(([x, y, z]) => new Vector3(x, y, z)),
);
const sampleClosedSpline = new CatmullRomCurve3(
  [
    [0, -40, -40],
    [0, 40, -40],
    [0, 140, -40],
    [0, 40, 40],
    [0, -40, 40],
  ].map(([x, y, z]) => new Vector3(x, y, z)),
);
sampleClosedSpline.curveType = "catmullrom";
sampleClosedSpline.closed = true;
const splines = {
  GrannyKnot: new GrannyKnot(),
  HeartCurve: new HeartCurve(3.5),
  VivianiCurve: new VivianiCurve(70),
  KnotCurve: new KnotCurve(),
  HelixCurve: new HelixCurve(),
  TrefoilKnot: new TrefoilKnot(),
  TorusKnot: new TorusKnot(20),
  CinquefoilKnot: new CinquefoilKnot(20),
  TrefoilPolynomialKnot: new TrefoilPolynomialKnot(14),
  FigureEightPolynomialKnot: new FigureEightPolynomialKnot(),
  DecoratedTorusKnot4a: new DecoratedTorusKnot4a(),
  DecoratedTorusKnot4b: new DecoratedTorusKnot4b(),
  DecoratedTorusKnot5a: new DecoratedTorusKnot5a(),
  DecoratedTorusKnot5c: new DecoratedTorusKnot5c(),
  PipeSpline: pipeSpline,
  SampleClosedSpline: sampleClosedSpline,
};
const params = {
  spline: "GrannyKnot" as keyof typeof splines,
  scale: 4,
  extrusionSegments: 100,
  radiusSegments: 3,
  closed: true,
  animationView: false,
  lookAhead: false,
  cameraHelper: false,
};
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10000);
camera.position.set(0, 50, 500);
scene.add(new AmbientLight(0xffffff));
const light = new DirectionalLight(0xffffff, 1.5);
light.position.set(0, 0, 1);
scene.add(light);
const parent = new Object3D();
scene.add(parent);
const splineCamera = new PerspectiveCamera(84, innerWidth / innerHeight, 0.01, 1000);
parent.add(splineCamera);
const helper = new CameraHelper(splineCamera);
scene.add(helper);
const eye = new Mesh(new SphereGeometry(5), new MeshBasicMaterial({ color: 0xdddddd }));
parent.add(eye);
const material = new MeshLambertMaterial({ color: 0xff00ff });
const wire = new MeshBasicMaterial({ color: 0, opacity: 0.3, wireframe: true, transparent: true });
let geometry: TubeGeometry;
let mesh: Mesh<MeshLambertMaterial> | undefined;
function addTube(): void {
  if (mesh) {
    parent.remove(mesh);
    mesh.geometry.dispose();
  }
  geometry = new TubeGeometry(
    splines[params.spline],
    params.extrusionSegments,
    2,
    params.radiusSegments,
    params.closed,
  );
  mesh = new Mesh<MeshLambertMaterial>(geometry, material);
  mesh.add(new Mesh(geometry, wire));
  parent.add(mesh);
  setScale();
}
function setScale(): void {
  mesh?.scale.setScalar(params.scale);
}
addTube();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 100;
controls.maxDistance = 2000;
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI({ width: 285 });
const shape = gui.addFolder("Geometry");
shape.add(params, "spline", Object.keys(splines)).onChange(addTube);
shape.add(params, "scale", 2, 10).step(2).onChange(setScale);
shape.add(params, "extrusionSegments", 50, 500).step(50).onChange(addTube);
shape.add(params, "radiusSegments", 2, 12).step(1).onChange(addTube);
shape.add(params, "closed").onChange(addTube);
shape.open();
const view = gui.addFolder("Camera");
view.add(params, "animationView");
view.add(params, "lookAhead");
view.add(params, "cameraHelper");
view.open();
const direction = new Vector3(),
  binormal = new Vector3(),
  normal = new Vector3(),
  position = new Vector3(),
  lookAt = new Vector3();
renderer.setAnimationLoop(() => {
  const t = (Date.now() % 20000) / 20000;
  const path = geometry.parameters.path;
  path.getPointAt(t, position);
  position.multiplyScalar(params.scale);
  const segments = geometry.tangents.length,
    pickt = t * segments,
    pick = Math.floor(pickt),
    next = (pick + 1) % segments;
  binormal
    .subVectors(geometry.binormals[next], geometry.binormals[pick])
    .multiplyScalar(pickt - pick)
    .add(geometry.binormals[pick]);
  path.getTangentAt(t, direction);
  normal.copy(binormal).cross(direction);
  position.addScaledVector(normal, 15);
  splineCamera.position.copy(position);
  eye.position.copy(position);
  path.getPointAt((t + 30 / path.getLength()) % 1, lookAt);
  lookAt.multiplyScalar(params.scale);
  if (!params.lookAhead) lookAt.copy(position).add(direction);
  splineCamera.matrix.lookAt(splineCamera.position, lookAt, normal);
  splineCamera.quaternion.setFromRotationMatrix(splineCamera.matrix);
  helper.visible = eye.visible = params.cameraHelper;
  helper.update();
  renderer.render(scene, params.animationView ? splineCamera : camera);
  stats.update();
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
});
function resize(): void {
  camera.aspect = splineCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  splineCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
});
