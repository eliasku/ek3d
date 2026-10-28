import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Object3D } from "ek3d/core/Object3D";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Color } from "ek3d/math/Color";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing orbit controls example canvas");
const canvas: HTMLCanvasElement = element;

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();
scene.background = new Color(0xcccccc);
scene.fog = new FogExp2(0xcccccc, 0.002);

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(400, 200, 0);

const controls = new OrbitControls(camera, canvas);
controls.listenToKeyEvents(window);

controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.screenSpacePanning = false;

controls.minDistance = 100;
controls.maxDistance = 500;

controls.cursorStyle = "grab";

controls.maxPolarAngle = Math.PI / 2;

const geometry = new ConeGeometry(10, 30, 4, 1);
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true });

const mesh = new InstancedMesh(geometry, material, 500);
const dummy = new Object3D();

for (let i = 0; i < 500; i++) {
  dummy.position.x = Math.random() * 1600 - 800;
  dummy.position.y = 0;
  dummy.position.z = Math.random() * 1600 - 800;

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

function publishState(): void {
  canvas.dataset.cameraPosition = camera.position
    .toArray()
    .map((value) => value.toFixed(3))
    .join(",");
  canvas.dataset.target = controls.target
    .toArray()
    .map((value) => value.toFixed(3))
    .join(",");
}

function render(): void {
  controls.update();
  renderer.render(scene, camera);
  publishState();
  canvas.dataset.state = "rendered";
}

renderer.setAnimationLoop(render);

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
