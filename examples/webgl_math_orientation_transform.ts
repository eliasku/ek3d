import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Spherical } from "ek3d/math/Spherical";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing orientation example canvas");
const canvas = selected;
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
camera.position.z = 5;
const scene = new Scene();
const geometry = new ConeGeometry(0.1, 0.5, 8);
geometry.rotateX(Math.PI * 0.5);
const mesh = new Mesh(geometry, new MeshNormalMaterial());
scene.add(mesh);
const target = new Mesh(new SphereGeometry(0.05), new MeshBasicMaterial({ color: 0xff0000 }));
scene.add(target);
scene.add(
  new Mesh(
    new SphereGeometry(2, 32, 32),
    new MeshBasicMaterial({ color: 0xcccccc, wireframe: true, transparent: true, opacity: 0.3 }),
  ),
);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, MeshNormalMaterial: normalShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const timer = new Timer();
timer.connect(document);
const gui = new GUI();
const params = { useLookAt: false };
gui.add(params, "useLookAt");
gui.open();
const spherical = new Spherical();
const rotationMatrix = new Matrix4();
const targetQuaternion = new Quaternion();
let timeout = 0;
function generateTarget(): void {
  spherical.theta = Math.random() * Math.PI * 2;
  spherical.phi = Math.acos(2 * Math.random() - 1);
  spherical.radius = 2;
  target.position.setFromSpherical(spherical);
  rotationMatrix.lookAt(target.position, mesh.position, mesh.up);
  targetQuaternion.setFromRotationMatrix(rotationMatrix);
  timeout = window.setTimeout(generateTarget, 2000);
}
generateTarget();
let frames = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  if (!mesh.quaternion.equals(targetQuaternion)) {
    if (params.useLookAt) mesh.lookAt(target.position);
    else mesh.quaternion.rotateTowards(targetQuaternion, (Math.PI / 2) * timer.getDelta());
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  clearTimeout(timeout);
  timer.disconnect();
  gui.destroy();
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
