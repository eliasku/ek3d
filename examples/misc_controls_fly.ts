import { FilmPass } from "ek3d/addons/postprocessing/FilmPass";
import { EffectComposer } from "ek3d/addons/postprocessing/EffectComposer";
import { RenderPass } from "ek3d/addons/postprocessing/RenderPass";
import { FlyControls } from "ek3d/addons/controls/FlyControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { SRGBColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Timer } from "ek3d/core/Timer";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Float32BufferAttribute } from "ek3d/core/BufferAttribute";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { FogExp2 } from "ek3d/scenes/FogExp2";
import { Scene } from "ek3d/scenes/Scene";
import { Color } from "ek3d/math/Color";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing fly controls example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const radius = 6371;
const tilt = 0.41;
const rotationSpeed = 0.02;

const cloudsScale = 1.005;
const moonScale = 0.23;

const MARGIN = 0;
let SCREEN_HEIGHT = window.innerHeight - MARGIN * 2;
let SCREEN_WIDTH = window.innerWidth;

let camera!: PerspectiveCamera;
let controls!: FlyControls;
let scene!: Scene;
let renderer!: WebGLRenderer;
let composer!: EffectComposer;
let stats!: Stats;
let meshPlanet!: Mesh;
let meshClouds!: Mesh;
let meshMoon!: Mesh;
const geometry = new SphereGeometry(radius, 100, 50);

let d: number;
let dPlanet: number;
const dMoonVec = new Vector3();

const textureLoader = new TextureLoader().setPath("/examples/textures/planets/");

const timer = new Timer();
timer.connect(document);

init();

function init() {
  camera = new PerspectiveCamera(25, SCREEN_WIDTH / SCREEN_HEIGHT, 50, 1e7);
  camera.position.z = radius * 5;

  scene = new Scene();
  scene.background = new Color(0x000000);
  scene.fog = new FogExp2(0x000000, 0.00000025);

  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshPhongMaterial: phongShader, MeshLambertMaterial: lambertShader, PointsMaterial: pointsShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

  const dirLight = new DirectionalLight(0xffffff, 3);
  dirLight.position.set(-1, 0, 1).normalize();
  scene.add(dirLight);

  const materialNormalMap = new MeshPhongMaterial({
    specular: 0x7c7c7c,
    shininess: 15,
    map: textureLoader.load("earth_atmos_2048.jpg"),
    specularMap: textureLoader.load("earth_specular_2048.jpg"),
    normalMap: textureLoader.load("earth_normal_2048.jpg"),

    // y scale is negated to compensate for normal map handedness.
    normalScale: new Vector2(0.85, -0.85),
  });
  materialNormalMap.map!.colorSpace = SRGBColorSpace;

  // planet

  meshPlanet = new Mesh(geometry, materialNormalMap);
  meshPlanet.rotation.y = 0;
  meshPlanet.rotation.z = tilt;
  scene.add(meshPlanet);

  // clouds

  const materialClouds = new MeshLambertMaterial({
    map: textureLoader.load("earth_clouds_1024.png"),
    transparent: true,
  });
  materialClouds.map!.colorSpace = SRGBColorSpace;

  meshClouds = new Mesh(geometry, materialClouds);
  meshClouds.scale.set(cloudsScale, cloudsScale, cloudsScale);
  meshClouds.rotation.z = tilt;
  scene.add(meshClouds);

  // moon

  const materialMoon = new MeshPhongMaterial({
    map: textureLoader.load("moon_1024.jpg"),
  });
  materialMoon.map!.colorSpace = SRGBColorSpace;

  meshMoon = new Mesh(geometry, materialMoon);
  meshMoon.position.set(radius * 5, 0, 0);
  meshMoon.scale.set(moonScale, moonScale, moonScale);
  scene.add(meshMoon);

  // stars

  const r = radius;
  const starsGeometry = [new BufferGeometry(), new BufferGeometry()];

  const vertices1: number[] = [];
  const vertices2: number[] = [];

  const vertex = new Vector3();

  for (let i = 0; i < 250; i++) {
    vertex.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    vertex.multiplyScalar(r);

    vertices1.push(vertex.x, vertex.y, vertex.z);
  }

  for (let i = 0; i < 1500; i++) {
    vertex.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    vertex.multiplyScalar(r);

    vertices2.push(vertex.x, vertex.y, vertex.z);
  }

  starsGeometry[0].setAttribute("position", new Float32BufferAttribute(vertices1, 3));
  starsGeometry[1].setAttribute("position", new Float32BufferAttribute(vertices2, 3));

  const starsMaterials = [
    new PointsMaterial({ color: 0x9c9c9c, size: 2, sizeAttenuation: true }),
    new PointsMaterial({ color: 0x838383, size: 2, sizeAttenuation: true }),
    new PointsMaterial({ color: 0x5a5a5a, size: 2, sizeAttenuation: true }),
  ];
  const starResources = [...starMaterialsDispose(starsMaterials)];
  void starResources;

  for (let i = 10; i < 30; i++) {
    const stars = new Points(starsGeometry[i % 2], starsMaterials[i % 3]);

    stars.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    stars.scale.setScalar(i * 10);

    stars.matrixAutoUpdate = false;
    stars.updateMatrix();

    scene.add(stars);
  }

  //

  controls = new FlyControls(camera, renderer.domElement as HTMLCanvasElement);

  controls.movementSpeed = 1000;
  controls.rollSpeed = Math.PI / 24;
  controls.autoForward = false;
  controls.dragToLook = false;

  //

  stats = new Stats();
  document.body.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);

  // postprocessing (WebGL port of the upstream WebGPU RenderPipeline + film node)

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new FilmPass());
}

function starMaterialsDispose(materials: PointsMaterial[]): Iterable<{ dispose(): void }> {
  return materials.map((m) => m);
}

function onWindowResize() {
  SCREEN_HEIGHT = window.innerHeight;
  SCREEN_WIDTH = window.innerWidth;

  camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
  camera.updateProjectionMatrix();

  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  composer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
}

function animate() {
  timer.update();

  render();
  publishState();
  stats.update();
}

function render() {
  // rotate the planet and clouds

  const delta = timer.getDelta();

  meshPlanet.rotation.y += rotationSpeed * delta;
  meshClouds.rotation.y += 1.25 * rotationSpeed * delta;

  // slow down as we approach the surface

  dPlanet = camera.position.length();

  dMoonVec.subVectors(camera.position, meshMoon.position);
  const dMoon = dMoonVec.length();

  if (dMoon < dPlanet) {
    d = dMoon - radius * moonScale * 1.01;
  } else {
    d = dPlanet - radius * 1.01;
  }

  controls.movementSpeed = 0.33 * d;
  controls.update(delta);

  composer.render(delta);
}

function publishState(): void {
  canvas.dataset.state = "rendered";
  canvas.dataset.cameraDistance = camera.position.length().toFixed(0);
  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
}
renderer.setAnimationLoop(animate);

window.addEventListener(
  "pagehide",
  () => {
    window.removeEventListener("resize", onWindowResize);
    timer.disconnect();
    controls.dispose();
    renderer.setAnimationLoop(null);
    geometry.dispose();
    (meshPlanet.material as MeshPhongMaterial).dispose();
    (meshClouds.material as MeshLambertMaterial).dispose();
    (meshMoon.material as MeshPhongMaterial).dispose();
    composer.dispose();
    renderer.dispose();
  },
  { once: true },
);
