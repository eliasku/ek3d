import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TransformControls } from "ek3d/addons/controls/TransformControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Raycaster } from "ek3d/core/Raycaster";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { SpotLight } from "ek3d/lights/SpotLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { ShadowMaterial } from "ek3d/materials/ShadowMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Line } from "ek3d/objects/Line";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { shadowShader } from "ek3d/renderers/shaders/ShadowShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvasElement = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvasElement) throw new Error("Missing spline editor canvas");
const canvas: HTMLCanvasElement = canvasElement;
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 10000);
camera.position.set(0, 250, 1000);
scene.add(camera);
scene.add(new AmbientLight(0xf0f0f0, 3));
const light = new SpotLight(0xffffff, 4.5);
light.position.set(0, 1500, 200);
light.angle = Math.PI * 0.2;
light.decay = 0;
light.castShadow = true;
light.shadow.camera.near = 200;
light.shadow.camera.far = 2000;
light.shadow.bias = -0.000222;
light.shadow.mapSize.set(1024, 1024);
scene.add(light);
const planeGeometry = new PlaneGeometry(2000, 2000);
planeGeometry.rotateX(-Math.PI / 2);
const plane = new Mesh(planeGeometry, new ShadowMaterial({ color: 0, opacity: 0.2 }));
plane.position.y = -200;
plane.receiveShadow = true;
scene.add(plane);
const grid = new GridHelper(2000, 100);
grid.position.y = -199;
if (!Array.isArray(grid.material)) {
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
}
scene.add(grid);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createShadowMap: WebGLShadowMap,
  shaders: {
    MeshLambertMaterial: lambertShader,
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    ShadowMaterial: shadowShader,
    MeshDepthMaterial: depthShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (!renderer.shadowMap) throw new Error("Missing shadow map");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
const transform = new TransformControls(camera, canvas);
scene.add(transform.getHelper());
const raycaster = new Raycaster(),
  pointer = new Vector2(),
  down = new Vector2(),
  up = new Vector2(),
  point = new Vector3();
const box = new BoxGeometry(20, 20, 20);
const objects: Mesh<MeshLambertMaterial>[] = [];
const positions: Vector3[] = [];
const params = { uniform: true, tension: 0.5, centripetal: true, chordal: true, addPoint, removePoint, exportSpline };
const arcSegments = 200;
function createSpline(type: "catmullrom" | "centripetal" | "chordal", color: number) {
  const curve = new CatmullRomCurve3(positions);
  curve.curveType = type;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(arcSegments * 3), 3));
  const line = new Line(geometry, new LineBasicMaterial({ color, opacity: 0.35 }));
  line.castShadow = true;
  scene.add(line);
  return { curve, line };
}
const splines = {
  uniform: createSpline("catmullrom", 0xff0000),
  centripetal: createSpline("centripetal", 0x00ff00),
  chordal: createSpline("chordal", 0x0000ff),
};
function addSplineObject(position?: Vector3): void {
  const object = new Mesh<MeshLambertMaterial>(box, new MeshLambertMaterial({ color: Math.random() * 0xffffff }));
  if (position) object.position.copy(position);
  else object.position.set(Math.random() * 1000 - 500, Math.random() * 600, Math.random() * 800 - 400);
  object.castShadow = object.receiveShadow = true;
  scene.add(object);
  objects.push(object);
  positions.push(object.position);
}
function addPoint(): void {
  addSplineObject();
  updateSplineOutline();
  render();
}
function removePoint(): void {
  if (objects.length <= 4) return;
  const object = objects.pop()!;
  positions.pop();
  if (transform.object === object) transform.detach();
  scene.remove(object);
  object.material.dispose();
  updateSplineOutline();
  render();
}
function updateSplineOutline(): void {
  for (const { curve, line } of Object.values(splines)) {
    const attribute = line.geometry.getAttribute("position");
    if (!(attribute instanceof BufferAttribute)) throw new Error("Missing spline position attribute");
    for (let i = 0; i < arcSegments; i++) {
      curve.getPoint(i / (arcSegments - 1), point);
      attribute.setXYZ(i, point.x, point.y, point.z);
    }
    attribute.needsUpdate = true;
  }
}
function exportSpline(): void {
  const code = objects.map(({ position: p }) => `new THREE.Vector3(${p.x}, ${p.y}, ${p.z})`);
  console.log(code.join(",\n"));
  prompt("copy and paste code", `[${code.join(",\n\t")}]`);
}
for (const p of [
  [289.76843686945404, 452.51481137238443, 56.10018915737797],
  [-53.56300074753207, 171.49711742836848, -14.495472686253045],
  [-91.40118730204415, 176.4306956436485, -6.958271935582161],
  [-383.785318791128, 491.1365363371675, 47.869296953772746],
])
  addSplineObject(new Vector3(p[0], p[1], p[2]));
updateSplineOutline();
function render(): void {
  splines.uniform.line.visible = params.uniform;
  splines.centripetal.line.visible = params.centripetal;
  splines.chordal.line.visible = params.chordal;
  renderer.render(scene, camera);
  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
const gui = new GUI();
gui.add(params, "uniform").onChange(render);
gui
  .add(params, "tension", 0, 1)
  .step(0.01)
  .onChange(() => {
    splines.uniform.curve.tension = params.tension;
    updateSplineOutline();
    render();
  });
gui.add(params, "centripetal").onChange(render);
gui.add(params, "chordal").onChange(render);
gui.add(params, "addPoint");
gui.add(params, "removePoint");
gui.add(params, "exportSpline");
gui.open();
controls.addEventListener("change", render);
transform.addEventListener("change", render);
transform.addEventListener("dragging-changed", (event) => {
  if ("value" in event) controls.enabled = !event.value;
});
transform.addEventListener("objectChange", updateSplineOutline);
function onDown(event: PointerEvent): void {
  down.set(event.clientX, event.clientY);
}
function onUp(event: PointerEvent): void {
  up.set(event.clientX, event.clientY);
  if (down.distanceTo(up) === 0) {
    transform.detach();
    render();
  }
}
function onMove(event: PointerEvent): void {
  pointer.set((event.clientX / innerWidth) * 2 - 1, (-event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(objects, false)[0];
  if (hit && hit.object !== transform.object) transform.attach(hit.object);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
document.addEventListener("pointerdown", onDown);
document.addEventListener("pointerup", onUp);
document.addEventListener("pointermove", onMove);
window.addEventListener("resize", resize);
render();
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("pointerdown", onDown);
  document.removeEventListener("pointerup", onUp);
  document.removeEventListener("pointermove", onMove);
  window.removeEventListener("resize", resize);
  controls.dispose();
  transform.dispose();
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
});
