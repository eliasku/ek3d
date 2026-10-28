import { CameraHelper } from "ek3d/helpers/CameraHelper";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { randFloatSpread } from "ek3d/math/MathUtils";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { Stats } from "ek3d/addons/libs/Stats";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing camera example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_WIDTH;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let mesh!: Mesh;

let cameraRig!: Group;
let activeCamera!: PerspectiveCamera | OrthographicCamera;
let activeHelper!: CameraHelper;
let cameraPerspective!: PerspectiveCamera;
let cameraOrtho!: OrthographicCamera;
let cameraPerspectiveHelper!: CameraHelper;
let cameraOrthoHelper!: CameraHelper;

const frustumSize = 600;

const stats = new Stats();

init();

function init(): void {
  scene = new Scene();

  camera = new PerspectiveCamera(50, 0.5 * aspect, 1, 10000);
  camera.position.z = 2500;

  cameraPerspective = new PerspectiveCamera(50, 0.5 * aspect, 150, 1000);
  cameraPerspectiveHelper = new CameraHelper(cameraPerspective);
  scene.add(cameraPerspectiveHelper);

  cameraOrtho = new OrthographicCamera(
    (0.5 * frustumSize * aspect) / -2,
    (0.5 * frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    150,
    1000,
  );
  cameraOrthoHelper = new CameraHelper(cameraOrtho);
  scene.add(cameraOrthoHelper);

  activeCamera = cameraPerspective;
  activeHelper = cameraPerspectiveHelper;

  // counteract different front orientation of cameras vs rig

  cameraOrtho.rotation.y = Math.PI;
  cameraPerspective.rotation.y = Math.PI;

  cameraRig = new Group();

  cameraRig.add(cameraPerspective);
  cameraRig.add(cameraOrtho);

  scene.add(cameraRig);

  mesh = new Mesh(new SphereGeometry(100, 16, 8), new MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  scene.add(mesh);

  const mesh2 = new Mesh(new SphereGeometry(50, 16, 8), new MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
  mesh2.position.y = 150;
  mesh.add(mesh2);

  const mesh3 = new Mesh(new SphereGeometry(5, 16, 8), new MeshBasicMaterial({ color: 0x0000ff, wireframe: true }));
  mesh3.position.z = 150;
  cameraRig.add(mesh3);

  const geometry = new BufferGeometry();
  const vertices: number[] = [];

  for (let i = 0; i < 10000; i++) {
    vertices.push(randFloatSpread(2000)); // x
    vertices.push(randFloatSpread(2000)); // y
    vertices.push(randFloatSpread(2000)); // z
  }

  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));

  const particles = new Points(geometry, new PointsMaterial({ color: 0x888888 }));
  scene.add(particles);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader, PointsMaterial: pointsShader, LineBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  renderer.setAnimationLoop(animate);

  renderer.setScissorTest(true);

  document.body.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);
  document.addEventListener("keydown", onKeyDown);
}

function onKeyDown(event: KeyboardEvent): void {
  switch (event.code) {
    case "KeyO":
      activeCamera = cameraOrtho;
      activeHelper = cameraOrthoHelper;

      break;

    case "KeyP":
      activeCamera = cameraPerspective;
      activeHelper = cameraPerspectiveHelper;

      break;
  }
}

function onWindowResize(): void {
  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

  camera.aspect = 0.5 * aspect;
  camera.updateProjectionMatrix();

  cameraPerspective.aspect = 0.5 * aspect;
  cameraPerspective.updateProjectionMatrix();

  cameraOrtho.left = (-0.5 * frustumSize * aspect) / 2;
  cameraOrtho.right = (0.5 * frustumSize * aspect) / 2;
  cameraOrtho.top = frustumSize / 2;
  cameraOrtho.bottom = -frustumSize / 2;
  cameraOrtho.updateProjectionMatrix();
}

function animate(): void {
  render();
  stats.update();

  canvas.dataset.state = "rendered";
  canvas.dataset.activeCamera = activeCamera.type;
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

function render(): void {
  const r = Date.now() * 0.0005;

  mesh.position.x = 700 * Math.cos(r);
  mesh.position.z = 700 * Math.sin(r);
  mesh.position.y = 700 * Math.sin(r);

  mesh.children[0].position.x = 70 * Math.cos(2 * r);
  mesh.children[0].position.z = 70 * Math.sin(r);

  if (activeCamera === cameraPerspective) {
    cameraPerspective.fov = 35 + 30 * Math.sin(0.5 * r);
    cameraPerspective.far = mesh.position.length();
    cameraPerspective.updateProjectionMatrix();

    cameraPerspectiveHelper.update();
    cameraPerspectiveHelper.visible = true;

    cameraOrthoHelper.visible = false;
  } else {
    cameraOrtho.far = mesh.position.length();
    cameraOrtho.updateProjectionMatrix();

    cameraOrthoHelper.update();
    cameraOrthoHelper.visible = true;

    cameraPerspectiveHelper.visible = false;
  }

  cameraRig.lookAt(mesh.position);

  activeHelper.visible = false;

  renderer.setClearColor(0x000000, 1);
  renderer.setScissor(0, 0, SCREEN_WIDTH / 2, SCREEN_HEIGHT);
  renderer.setViewport(0, 0, SCREEN_WIDTH / 2, SCREEN_HEIGHT);
  renderer.render(scene, activeCamera);

  activeHelper.visible = true;

  renderer.setClearColor(0x111111, 1);
  renderer.setScissor(SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2, SCREEN_HEIGHT);
  renderer.setViewport(SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2, SCREEN_HEIGHT);
  renderer.render(scene, camera);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("keydown", onKeyDown);
    stats.dom.remove();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
