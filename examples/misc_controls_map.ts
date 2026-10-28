import { MapControls } from "ek3d/addons/controls/MapControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Object3D } from "ek3d/core/Object3D";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing map controls example canvas");
const canvas: HTMLCanvasElement = element;

const scene = new Scene();
scene.background = new Color(0xcccccc);
scene.fog = new FogExp2(0xcccccc, 0.002);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 200, -200);

const controls = new MapControls(camera, canvas);

controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.05;

controls.screenSpacePanning = false;

controls.minDistance = 100;
controls.maxDistance = 500;

controls.maxPolarAngle = Math.PI / 2;

const geometry = new BoxGeometry();
geometry.translate(0, 0.5, 0);
const material = new MeshPhongMaterial({ color: 0xeeeeee, flatShading: true });

const mesh = new InstancedMesh(geometry, material, 500);
const dummy = new Object3D();

for (let i = 0; i < 500; i++) {
  dummy.position.x = Math.random() * 1600 - 800;
  dummy.position.y = 0;
  dummy.position.z = Math.random() * 1600 - 800;
  dummy.scale.x = 20;
  dummy.scale.y = Math.random() * 80 + 10;
  dummy.scale.z = 20;

  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

scene.add(mesh);

const dirLight1 = new DirectionalLight(0xffffff, 3);
dirLight1.position.set(1, 1, 1);
scene.add(dirLight1);

const dirLight2 = new DirectionalLight(0x002288, 3);
dirLight2.position.set(-1, -1, -1);
scene.add(dirLight2);

const ambientLight = new AmbientLight(0x555555);
scene.add(ambientLight);

// Page check hooks: Digit1 toggles zoomToCursor, Digit2 toggles screenSpacePanning (replacing the vendor GUI).
let zoomToCursor = false;

function publishState(increment: boolean): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.zoomToCursor = String(zoomToCursor);
  canvas.dataset.screenSpacePanning = String(controls.screenSpacePanning);
  if (increment) canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function render(): void {
  renderer.render(scene, camera);
}

function animate(): void {
  controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
  render();
  publishState(true);
}

renderer.setAnimationLoop(animate);

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") {
    zoomToCursor = !zoomToCursor;
    controls.zoomToCursor = zoomToCursor;
  } else if (event.code === "Digit2") {
    controls.screenSpacePanning = !controls.screenSpacePanning;
  }
});

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    renderer.setAnimationLoop(null);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  },
  { once: true },
);
