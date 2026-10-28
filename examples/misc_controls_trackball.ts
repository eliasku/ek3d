import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
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

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing trackball controls example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const frustumSize = 400;

const aspect = window.innerWidth / window.innerHeight;

const perspectiveCamera = new PerspectiveCamera(60, aspect, 1, 1000);
perspectiveCamera.position.z = 500;

const orthographicCamera = new OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  1,
  1000,
);
orthographicCamera.position.z = 500;

const scene = new Scene();
scene.background = new Color(0xcccccc);
scene.fog = new FogExp2(0xcccccc, 0.002);

const geometry = new ConeGeometry(10, 30, 4, 1);
const material = new MeshPhongMaterial({ color: 0xffffff, flatShading: true });

const mesh = new InstancedMesh(geometry, material, 500);
const dummy = new Object3D();

for (let i = 0; i < 500; i++) {
  dummy.position.x = (Math.random() - 0.5) * 1000;
  dummy.position.y = (Math.random() - 0.5) * 1000;
  dummy.position.z = (Math.random() - 0.5) * 1000;

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

// renderer

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);

const stats = new Stats();
document.body.appendChild(stats.dom);

//

let controls: TrackballControls<PerspectiveCamera | OrthographicCamera>;

const params = { orthographicCamera: false, multiTouchRoll: false };

const gui = new GUI();
gui
  .add(params, "orthographicCamera")
  .name("use orthographic")
  .onChange((value) => {
    controls.dispose();
    createControls(value ? orthographicCamera : perspectiveCamera);
  });

gui
  .add(params, "multiTouchRoll")
  .name("multi touch roll")
  .onChange((value) => {
    controls.multiTouchRoll = value as boolean;
  });

//

window.addEventListener("resize", onWindowResize);

createControls(perspectiveCamera);

function createControls(camera: PerspectiveCamera | OrthographicCamera): void {
  controls = new TrackballControls(camera, canvas);

  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;

  controls.multiTouchRoll = params.multiTouchRoll;

  controls.keys = ["KeyA", "KeyS", "KeyD"];
}

function onWindowResize(): void {
  const aspect = window.innerWidth / window.innerHeight;

  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  orthographicCamera.left = (-frustumSize * aspect) / 2;
  orthographicCamera.right = (frustumSize * aspect) / 2;
  orthographicCamera.top = frustumSize / 2;
  orthographicCamera.bottom = -frustumSize / 2;
  orthographicCamera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  controls.handleResize();
}

function animate(): void {
  controls.update();

  render();

  stats.update();
}

function render(): void {
  const camera = params.orthographicCamera ? orthographicCamera : perspectiveCamera;

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.camera = params.orthographicCamera ? "orthographic" : "perspective";
  canvas.dataset.multiTouchRoll = String(params.multiTouchRoll);
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    gui.destroy();
    renderer.setAnimationLoop(null);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
    stats.dom.remove();
    renderer.dispose();
  },
  { once: true },
);
