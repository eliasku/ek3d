import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ExtrudeGeometry } from "ek3d/geometries/ExtrudeGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { CatmullRomCurve3 } from "ek3d/extras/curves/CatmullRomCurve3";
import { Shape } from "ek3d/extras/core/Shape";
import { randFloat } from "ek3d/math/MathUtils";
import { Color } from "ek3d/math/Color";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { TrackballControls } from "ek3d/addons/controls/TrackballControls";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing extrude shapes example canvas");
const canvas: HTMLCanvasElement = canvasSel;

let camera!: PerspectiveCamera;
let scene!: Scene;
let renderer!: WebGLRenderer;
let controls!: TrackballControls<PerspectiveCamera | import("ek3d/cameras/OrthographicCamera").OrthographicCamera>;

init();

function init(): void {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshLambertMaterial: lambertShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);

  scene = new Scene();
  scene.background = new Color(0x222222);

  camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 0, 500);

  controls = new TrackballControls(camera, canvas);
  controls.minDistance = 200;
  controls.maxDistance = 500;

  scene.add(new AmbientLight(0x666666));

  const light = new PointLight(0xffffff, 3, 0, 0);
  light.position.copy(camera.position);
  scene.add(light);

  //

  const closedSpline = new CatmullRomCurve3([
    new Vector3(-60, -100, 60),
    new Vector3(-60, 20, 60),
    new Vector3(-60, 120, 60),
    new Vector3(60, 20, -60),
    new Vector3(60, -100, -60),
  ]);

  closedSpline.curveType = "catmullrom";
  closedSpline.closed = true;

  const extrudeSettings1 = {
    steps: 100,
    bevelEnabled: false,
    extrudePath: closedSpline,
  };

  const pts1: Vector2[] = [];
  const count = 3;

  for (let i = 0; i < count; i++) {
    const l = 20;

    const a = ((2 * i) / count) * Math.PI;

    pts1.push(new Vector2(Math.cos(a) * l, Math.sin(a) * l));
  }

  const shape1 = new Shape(pts1);

  const geometry1 = new ExtrudeGeometry(shape1, extrudeSettings1);

  const material1 = new MeshLambertMaterial({ color: 0xb00000, wireframe: false });

  const mesh1 = new Mesh(geometry1, material1);

  scene.add(mesh1);

  //

  const randomPoints: Vector3[] = [];

  for (let i = 0; i < 10; i++) {
    randomPoints.push(new Vector3((i - 4.5) * 50, randFloat(-50, 50), randFloat(-50, 50)));
  }

  const randomSpline = new CatmullRomCurve3(randomPoints);

  //

  const extrudeSettings2 = {
    steps: 200,
    bevelEnabled: false,
    extrudePath: randomSpline,
  };

  const pts2: Vector2[] = [];
  const numPts = 5;

  for (let i = 0; i < numPts * 2; i++) {
    const l = i % 2 == 1 ? 10 : 20;

    const a = (i / numPts) * Math.PI;

    pts2.push(new Vector2(Math.cos(a) * l, Math.sin(a) * l));
  }

  const shape2 = new Shape(pts2);

  const geometry2 = new ExtrudeGeometry(shape2, extrudeSettings2);

  const material2 = new MeshLambertMaterial({ color: 0xff8000, wireframe: false });

  const mesh2 = new Mesh(geometry2, material2);

  scene.add(mesh2);

  //

  const materials = [material1, material2];

  const extrudeSettings3 = {
    depth: 20,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 2,
    bevelSize: 4,
    bevelSegments: 1,
  };

  const geometry3 = new ExtrudeGeometry(shape2, extrudeSettings3);

  const mesh3 = new Mesh(geometry3, materials);

  mesh3.position.set(50, 100, 50);

  scene.add(mesh3);

  //

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(): void {
  controls.update();
  renderer.render(scene, camera);

  canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    renderer.setAnimationLoop(null);
    renderer.dispose();
  },
  { once: true },
);
