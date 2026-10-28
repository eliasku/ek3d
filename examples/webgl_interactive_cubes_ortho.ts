import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { Raycaster } from "ek3d/core/Raycaster";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { degToRad } from "ek3d/math/MathUtils";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { Stats } from "ek3d/addons/libs/Stats";
import { disposeObject } from "./dispose-object";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing interactive cubes example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 50;
const camera = new OrthographicCamera(
  (-frustumSize * aspect) / 2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  100,
);
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(1, 1, 1).normalize();
scene.add(light);

const geometry = new BoxGeometry();
for (let i = 0; i < 2000; i++) {
  const object = new Mesh<MeshLambertMaterial>(geometry, new MeshLambertMaterial({ color: Math.random() * 0xffffff }));
  object.position.set(Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * 40 - 20);
  object.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  object.scale.set(Math.random() + 0.5, Math.random() + 0.5, Math.random() + 0.5);
  scene.add(object);
}

const pointer = new Vector2();
const raycaster = new Raycaster();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const stats = new Stats();
document.body.appendChild(stats.dom);

let intersected: Mesh<MeshLambertMaterial> | null = null;
let currentHex = 0;
let theta = 0;
let frames = 0;
let disposed = false;

function onPointerMove(event: MouseEvent): void {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onWindowResize(): void {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  theta += 0.1;
  const angle = degToRad(theta);
  camera.position.set(25 * Math.sin(angle), 25 * Math.sin(angle), 25 * Math.cos(angle));
  camera.lookAt(scene.position);
  camera.updateMatrixWorld();

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, false);
  const hit = hits.length > 0 ? (hits[0].object as Mesh<MeshLambertMaterial>) : null;
  if (hit !== intersected) {
    if (intersected !== null) intersected.material.emissive.setHex(currentHex);
    intersected = hit;
    if (intersected !== null) {
      currentHex = intersected.material.emissive.getHex();
      intersected.material.emissive.setHex(0xff0000);
    }
  }

  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  stats.update();
}

document.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", onWindowResize);
renderer.setAnimationLoop(animate);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  document.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("resize", onWindowResize);
  renderer.setAnimationLoop(null);
  stats.dom.remove();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
