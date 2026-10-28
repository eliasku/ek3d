import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing morph targets canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
scene.background = new Color(0x8fbcd4);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 20);
camera.position.z = 10;
scene.add(camera, new AmbientLight(0x8fbcd4, 1.5));
const pointLight = new PointLight(0xffffff, 200);
camera.add(pointLight);
const geometry = new BoxGeometry(2, 2, 2, 32, 32, 32);
const position = geometry.attributes.position as Float32BufferAttribute;
const sphere: number[] = [];
const twist: number[] = [];
const axis = new Vector3(1, 0, 0);
const vertex = new Vector3();
for (let i = 0; i < position.count; i++) {
  const x = position.getX(i),
    y = position.getY(i),
    z = position.getZ(i);
  sphere.push(
    x * Math.sqrt(1 - (y * y) / 2 - (z * z) / 2 + (y * y * z * z) / 3),
    y * Math.sqrt(1 - (z * z) / 2 - (x * x) / 2 + (z * z * x * x) / 3),
    z * Math.sqrt(1 - (x * x) / 2 - (y * y) / 2 + (x * x * y * y) / 3),
  );
  vertex
    .set(x * 2, y, z)
    .applyAxisAngle(axis, (Math.PI * x) / 2)
    .toArray(twist, twist.length);
}
geometry.morphAttributes.position = [new Float32BufferAttribute(sphere, 3), new Float32BufferAttribute(twist, 3)];
const material = new MeshPhongMaterial({ color: 0xff0000, flatShading: true });
const mesh = new Mesh(geometry, material);
scene.add(mesh);
const gui = new GUI({ title: "Morph Targets" });
const params = { Spherify: 0, Twist: 0 };
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
gui.add(params, "Spherify", 0, 1, 0.01).onChange((value: unknown) => {
  mesh.morphTargetInfluences![0] = value as number;
});
gui.add(params, "Twist", 0, 1, 0.01).onChange((value: unknown) => {
  mesh.morphTargetInfluences![1] = value as number;
});
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
let frames = 0;
canvas.dataset.state = "loading";
renderer.setAnimationLoop(() => {
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
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  pointLight.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
