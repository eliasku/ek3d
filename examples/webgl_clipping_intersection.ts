import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, SRGBColorSpace } from "ek3d/constants";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { PlaneHelper } from "ek3d/helpers/PlaneHelper";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Plane } from "ek3d/math/Plane";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing clipping intersection canvas");
const canvas: HTMLCanvasElement = selected;
const params = { clipIntersection: true, planeConstant: 0, showHelpers: false, alphaToCoverage: true };
const clipPlanes = [
  new Plane(new Vector3(1, 0, 0), 0),
  new Plane(new Vector3(0, -1, 0), 0),
  new Plane(new Vector3(0, 0, -1), 0),
];
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader, MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.localClippingEnabled = true;
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 200);
camera.position.set(-1.5, 2.5, 3);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
controls.minDistance = 1;
controls.maxDistance = 10;
controls.enablePan = false;
const light = new HemisphereLight(0xffffff, 0x080808, 4.5);
light.position.set(-1.25, 1, 1.25);
scene.add(light);
const group = new Group();
const materials: MeshPhongMaterial[] = [];
for (let i = 1; i <= 30; i += 2) {
  const material = new MeshPhongMaterial({
    color: new Color().setHSL(Math.random(), 0.5, 0.5, SRGBColorSpace),
    side: DoubleSide,
    clippingPlanes: clipPlanes,
    clipIntersection: params.clipIntersection,
    alphaToCoverage: true,
  });
  materials.push(material);
  group.add(new Mesh(new SphereGeometry(i / 30, 48, 24), material));
}
scene.add(group);
const helpers = new Group();
helpers.add(new PlaneHelper(clipPlanes[0], 2, 0xff0000));
helpers.add(new PlaneHelper(clipPlanes[1], 2, 0x00ff00));
helpers.add(new PlaneHelper(clipPlanes[2], 2, 0x0000ff));
helpers.visible = false;
scene.add(helpers);
const gui = new GUI();
gui.add(params, "alphaToCoverage").onChange(() => {
  for (const material of materials) {
    material.alphaToCoverage = params.alphaToCoverage;
    material.needsUpdate = true;
  }
  render();
});
gui
  .add(params, "clipIntersection")
  .name("clip intersection")
  .onChange(() => {
    for (const material of materials) material.clipIntersection = params.clipIntersection;
    render();
  });
gui
  .add(params, "planeConstant", -1, 1)
  .step(0.01)
  .name("plane constant")
  .onChange(() => {
    for (const plane of clipPlanes) plane.constant = params.planeConstant;
    render();
  });
gui
  .add(params, "showHelpers")
  .name("show helpers")
  .onChange(() => {
    helpers.visible = params.showHelpers;
    render();
  });
let frames = 0;
function render(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
render();
let disposed = false;
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
