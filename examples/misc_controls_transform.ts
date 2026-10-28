import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TransformControls } from "ek3d/addons/controls/TransformControls";
import { ColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { degToRad } from "ek3d/math/MathUtils";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { Scene } from "ek3d/scenes/Scene";

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing transform controls example canvas");
const canvas: HTMLCanvasElement = element;

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshLambertMaterial: lambertShader, MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const aspect = window.innerWidth / window.innerHeight;

const frustumSize = 5;

const cameraPersp = new PerspectiveCamera(50, aspect, 0.1, 100);
const cameraOrtho = new OrthographicCamera(
  -frustumSize * aspect,
  frustumSize * aspect,
  frustumSize,
  -frustumSize,
  0.1,
  100,
);
let currentCamera: PerspectiveCamera | OrthographicCamera = cameraPersp;

currentCamera.position.set(5, 2.5, 5);

const scene = new Scene();
scene.add(new GridHelper(5, 10, 0x888888, 0x444444));

const ambientLight = new AmbientLight(0xffffff);
scene.add(ambientLight);

const light = new DirectionalLight(0xffffff, 4);
light.position.set(1, 1, 1);
scene.add(light);

const texture = await new TextureLoader().loadAsync("/examples/textures/crate.gif");
texture.colorSpace = ColorSpace.SRGB;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const geometry = new BoxGeometry();
const material = new MeshLambertMaterial({ map: texture });

const orbit = new OrbitControls<PerspectiveCamera | OrthographicCamera>(currentCamera, canvas);
const control = new TransformControls(currentCamera, canvas);
const gizmo = control.getHelper();

orbit.update();
orbit.addEventListener("change", render);
control.addEventListener("change", render);
control.addEventListener("dragging-changed", (event) => {
  orbit.enabled = !(event as unknown as { value: boolean }).value;
});

const mesh = new Mesh(geometry, material);
scene.add(mesh);

control.attach(mesh);
scene.add(gizmo);

window.addEventListener("resize", onWindowResize);

window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "q":
      control.setSpace(control.space === "local" ? "world" : "local");
      break;

    case "Shift":
      control.setTranslationSnap(1);
      control.setRotationSnap(degToRad(15));
      control.setScaleSnap(0.25);
      break;

    case "w":
      control.setMode("translate");
      break;

    case "e":
      control.setMode("rotate");
      break;

    case "r":
      control.setMode("scale");
      break;

    case "c": {
      const position = currentCamera.position.clone();

      currentCamera = currentCamera === cameraPersp ? cameraOrtho : cameraPersp;
      currentCamera.position.copy(position);

      orbit.object = currentCamera;
      control.camera = currentCamera;

      currentCamera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);
      onWindowResize();
      break;
    }

    case "v": {
      const randomFoV = Math.random() + 0.1;
      const randomZoom = Math.random() + 0.1;

      cameraPersp.fov = randomFoV * 160;
      cameraOrtho.bottom = -randomFoV * 500;
      cameraOrtho.top = randomFoV * 500;

      cameraPersp.zoom = randomZoom * 5;
      cameraOrtho.zoom = randomZoom * 5;
      onWindowResize();
      break;
    }

    case "+":
    case "=":
      control.setSize(control.size + 0.1);
      break;

    case "-":
    case "_":
      control.setSize(Math.max(control.size - 0.1, 0.1));
      break;

    case "x":
      control.showX = !control.showX;
      break;

    case "y":
      control.showY = !control.showY;
      break;

    case "z":
      control.showZ = !control.showZ;
      break;

    case " ":
      control.enabled = !control.enabled;
      break;

    case "Escape":
      control.reset();
      break;
  }
});

window.addEventListener("keyup", function (event) {
  switch (event.key) {
    case "Shift":
      control.setTranslationSnap(null);
      control.setRotationSnap(null);
      control.setScaleSnap(null);
      break;
  }
});

function onWindowResize(): void {
  const aspect = window.innerWidth / window.innerHeight;

  cameraPersp.aspect = aspect;
  cameraPersp.updateProjectionMatrix();

  cameraOrtho.left = cameraOrtho.bottom * aspect;
  cameraOrtho.right = cameraOrtho.top * aspect;
  cameraOrtho.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

function render(): void {
  renderer.render(scene, currentCamera);
  canvas.dataset.state = "rendered";
  canvas.dataset.mode = control.mode;
  canvas.dataset.space = control.space;
  canvas.dataset.camera = currentCamera === cameraPersp ? "perspective" : "orthographic";
  canvas.dataset.attached = String(control.object !== undefined);
  canvas.dataset.gizmoVisible = String(gizmo.visible);
  canvas.dataset.axis = control.axis ?? "";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

render();
