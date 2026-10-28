import { FlyControls } from "ek3d/addons/controls/FlyControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { PointLight } from "ek3d/lights/PointLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { Fog } from "ek3d/scenes/Fog";
import { LOD } from "ek3d/objects/LOD";
import { Mesh } from "ek3d/objects/Mesh";
import { Timer } from "ek3d/core/Timer";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing lod example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const timer = new Timer();
timer.connect(document);

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: FlyControls<PerspectiveCamera>;

init();

function init(): void {
  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 15000);
  camera.position.z = 1000;

  scene = new Scene();
  scene.fog = new Fog(0x000000, 1, 15000);

  const pointLight = new PointLight(0xff2200, 3, 0, 0);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  const dirLight = new DirectionalLight(0xffffff, 3);
  dirLight.position.set(0, 0, 1).normalize();
  scene.add(dirLight);

  const geometry: [IcosahedronGeometry, number][] = [
    [new IcosahedronGeometry(100, 16), 50],
    [new IcosahedronGeometry(100, 8), 300],
    [new IcosahedronGeometry(100, 4), 1000],
    [new IcosahedronGeometry(100, 2), 2000],
    [new IcosahedronGeometry(100, 1), 8000],
  ];

  const material = new MeshLambertMaterial({ color: 0xffffff, wireframe: true });

  for (let j = 0; j < 1000; j++) {
    const lod = new LOD();

    for (let i = 0; i < geometry.length; i++) {
      const mesh = new Mesh(geometry[i][0], material);
      mesh.scale.set(1.5, 1.5, 1.5);
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      lod.addLevel(mesh, geometry[i][1]);
    }

    lod.position.x = 10000 * (0.5 - Math.random());
    lod.position.y = 7500 * (0.5 - Math.random());
    lod.position.z = 10000 * (0.5 - Math.random());
    lod.updateMatrix();
    lod.matrixAutoUpdate = false;
    scene.add(lod);
  }

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshLambertMaterial: lambertShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  controls = new FlyControls(camera, canvas);
  controls.movementSpeed = 1000;
  controls.rollSpeed = Math.PI / 10;

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  timer.update();

  controls.update(timer.getDelta());

  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    controls.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
