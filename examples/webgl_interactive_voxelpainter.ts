import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ColorSpace } from "ek3d/constants";
import type { Object3D } from "ek3d/core/Object3D";
import { Raycaster } from "ek3d/core/Raycaster";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing voxel painter example canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(500, 800, 1300);
camera.lookAt(0, 0, 0);
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const rollOverMesh = new Mesh(
  new BoxGeometry(50, 50, 50),
  new MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true }),
);
scene.add(rollOverMesh);
let disposed = false;
let frames = 0;
let isShiftDown = false;
let loaded = false;
canvas.dataset.state = "loading";
const map = new TextureLoader().load(
  "/examples/textures/square-outline-textured.png",
  (texture) => {
    if (disposed) texture.dispose();
    else {
      loaded = true;
      render();
    }
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
map.colorSpace = ColorSpace.SRGB;
const cubeGeo = new BoxGeometry(50, 50, 50);
const cubeMaterial = new MeshLambertMaterial({ color: 0xfeb74c, map });
scene.add(new GridHelper(1000, 20));
const raycaster = new Raycaster();
const pointer = new Vector2();
const planeGeometry = new PlaneGeometry(1000, 1000);
planeGeometry.rotateX(-Math.PI / 2);
const plane = new Mesh(planeGeometry, new MeshBasicMaterial({ visible: false }));
scene.add(plane);
const objects: Object3D[] = [plane];
scene.add(new AmbientLight(0x606060, 3));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(1, 0.75, 0.5).normalize();
scene.add(light);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
function render(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = loaded ? "rendered" : "loading";
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
function intersection(event: PointerEvent) {
  pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects, false)[0];
}
function pointermove(event: PointerEvent): void {
  const hit = intersection(event);
  if (!hit?.face) return;
  rollOverMesh.position.copy(hit.point).add(hit.face.normal).divideScalar(50).floor().multiplyScalar(50).addScalar(25);
  render();
}
function pointerdown(event: PointerEvent): void {
  const hit = intersection(event);
  if (!hit?.face) return;
  if (isShiftDown) {
    if (hit.object !== plane) {
      scene.remove(hit.object);
      objects.splice(objects.indexOf(hit.object), 1);
    }
  } else {
    const voxel = new Mesh(cubeGeo, cubeMaterial);
    voxel.position.copy(hit.point).add(hit.face.normal).divideScalar(50).floor().multiplyScalar(50).addScalar(25);
    scene.add(voxel);
    objects.push(voxel);
  }
  render();
}
function keydown(event: KeyboardEvent): void {
  if (event.key === "Shift") isShiftDown = true;
}
function keyup(event: KeyboardEvent): void {
  if (event.key === "Shift") isShiftDown = false;
}
window.addEventListener("resize", resize);
document.addEventListener("pointermove", pointermove);
document.addEventListener("pointerdown", pointerdown);
document.addEventListener("keydown", keydown);
document.addEventListener("keyup", keyup);
render();
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  document.removeEventListener("pointermove", pointermove);
  document.removeEventListener("pointerdown", pointerdown);
  document.removeEventListener("keydown", keydown);
  document.removeEventListener("keyup", keyup);
  // The shared cube resources may not belong to a voxel at teardown.
  for (const object of objects.slice(1)) scene.remove(object);
  disposeObject(scene);
  cubeGeo.dispose();
  cubeMaterial.dispose();
  map.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
