import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Raycaster } from "ek3d/core/Raycaster";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Vector2 } from "ek3d/math/Vector2";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing instancing raycast example canvas");
const canvas: HTMLCanvasElement = selected;
const amount = parseInt(window.location.search.slice(1)) || 10;
const count = Math.pow(amount, 3);
const raycaster = new Raycaster();
const mouse = new Vector2(1, 1);
const color = new Color();
const white = new Color().setHex(0xffffff);
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(amount, amount, amount);
camera.lookAt(0, 0, 0);
const scene = new Scene();
const light = new HemisphereLight(0xffffff, 0x888888, 3);
light.position.set(0, 1, 0);
scene.add(light);
const mesh = new InstancedMesh(new IcosahedronGeometry(0.5, 3), new MeshPhongMaterial({ color: 0xffffff }), count);
const offset = (amount - 1) / 2;
const matrix = new Matrix4();
let i = 0;
for (let x = 0; x < amount; x++) {
  for (let y = 0; y < amount; y++) {
    for (let z = 0; z < amount; z++) {
      matrix.setPosition(offset - x, offset - y, offset - z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color);
      i++;
    }
  }
}
scene.add(mesh);
const gui = new GUI();
gui.add(mesh, "count", 0, count);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;
const stats = new Stats();
document.body.appendChild(stats.dom);
let disposed = false;
let frames = 0;
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function mousemove(event: MouseEvent): void {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
function animate(): void {
  controls.update();
  raycaster.setFromCamera(mouse, camera);
  const instanceId = raycaster.intersectObject(mesh)[0]?.instanceId;
  if (instanceId !== undefined && mesh.instanceColor !== null) {
    mesh.getColorAt(instanceId, color);
    if (color.equals(white)) {
      mesh.setColorAt(instanceId, color.setHex(Math.random() * 0xffffff));
      mesh.instanceColor.needsUpdate = true;
    }
  }
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}
window.addEventListener("resize", resize);
document.addEventListener("mousemove", mousemove);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  document.removeEventListener("mousemove", mousemove);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  mesh.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
