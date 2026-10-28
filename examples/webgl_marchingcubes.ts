import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { MarchingCubes } from "ek3d/addons/objects/MarchingCubes";
import { ToonShader1, ToonShader2, ToonShaderHatching, ToonShaderDotted } from "ek3d/addons/shaders/ToonShader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { CubeRefractionMapping, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { Timer } from "ek3d/core/Timer";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { PointLight } from "ek3d/lights/PointLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Color } from "ek3d/math/Color";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing marching cubes canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  failed = false,
  loaded = 0,
  frames = 0;
function complete(): void {
  if (!disposed) loaded++;
}
function fail(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
const urls = ["px", "nx", "py", "ny", "pz", "nz"].map(
  (face) => `/examples/textures/cube/SwedishRoyalCastle/${face}.jpg`,
);
const cubeLoader = new CubeTextureLoader();
const reflection = cubeLoader.load(
  urls,
  (texture) => {
    if (disposed) texture.dispose();
    else complete();
  },
  undefined,
  fail,
);
const refraction = cubeLoader.load(
  urls,
  (texture) => {
    if (disposed) texture.dispose();
    else complete();
  },
  undefined,
  fail,
);
refraction.mapping = CubeRefractionMapping;
const texture = new TextureLoader().load(
  "/examples/textures/uv_grid_opengl.jpg",
  (map) => {
    if (disposed) map.dispose();
    else complete();
  },
  undefined,
  fail,
);
texture.wrapS = texture.wrapT = RepeatWrapping;
texture.colorSpace = SRGBColorSpace;
const scene = new Scene();
scene.background = new Color(0x050505);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 10000);
camera.position.set(-500, 500, 1500);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0.5, 0.5, 1);
scene.add(light);
const point = new PointLight(0xff7c00, 3, 0, 0);
point.position.set(0, 0, 100);
scene.add(point);
const ambient = new AmbientLight(0x323232, 3);
scene.add(ambient);
function toon(shader: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: typeof ToonShader1.uniforms;
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    uniforms: {
      ...shader.uniforms,
      uDirLightPos: { value: light.position },
      uDirLightColor: { value: light.color },
      uAmbientLightColor: { value: ambient.color },
    },
  });
}
const materials = {
  shiny: new MeshStandardMaterial({ color: 0x9c0000, envMap: reflection, roughness: 0.1, metalness: 1 }),
  chrome: new MeshLambertMaterial({ color: 0xffffff, envMap: reflection }),
  liquid: new MeshLambertMaterial({ color: 0xffffff, envMap: refraction, refractionRatio: 0.85 }),
  matte: new MeshPhongMaterial({ specular: 0x494949, shininess: 1 }),
  flat: new MeshLambertMaterial(),
  textured: new MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 1, map: texture }),
  colors: new MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 2, vertexColors: true }),
  multiColors: new MeshPhongMaterial({ shininess: 2, vertexColors: true }),
  plastic: new MeshPhongMaterial({ specular: 0xc1c1c1, shininess: 250 }),
  toon1: toon(ToonShader1),
  toon2: toon(ToonShader2),
  hatching: toon(ToonShaderHatching),
  dotted: toon(ToonShaderDotted),
};
const effect = new MarchingCubes(28, materials.shiny, true, true, 100000);
effect.scale.set(700, 700, 700);
effect.enableUvs = effect.enableColors = false;
scene.add(effect);
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader, MeshLambertMaterial: lambertShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 500;
controls.maxDistance = 5000;
const params = { speed: 1, numBlobs: 10, resolution: 28, isolation: 80, floor: true, wallx: false, wallz: false };
let current: keyof typeof materials = "shiny";
const gui = new GUI();
const stats = new Stats();
document.body.appendChild(stats.dom);
const materialFolder = gui.addFolder("Materials");
for (const name of Object.keys(materials) as (keyof typeof materials)[]) {
  const action = {
    select: () => {
      current = name;
      effect.material = materials[name];
      effect.enableUvs = name === "textured";
      effect.enableColors = name === "colors" || name === "multiColors";
    },
  };
  materialFolder.add(action, "select").name(name);
}
const simulation = gui.addFolder("Simulation");
simulation.add(params, "speed", 0.1, 8, 0.05);
simulation.add(params, "numBlobs", 1, 50, 1);
simulation.add(params, "resolution", 14, 100, 1);
simulation.add(params, "isolation", 10, 300, 1);
simulation.add(params, "floor");
simulation.add(params, "wallx");
simulation.add(params, "wallz");
const rainbow = [0xff0000, 0xffbb00, 0xffff00, 0x00ff00, 0x0000ff, 0x9400bd, 0xc800eb].map((value) => new Color(value));
const timer = new Timer();
timer.connect(document);
let time = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  time += timer.getDelta() * params.speed * 0.5;
  if (effect.resolution !== params.resolution) effect.init(Math.floor(params.resolution));
  effect.isolation = params.isolation;
  effect.reset();
  const strength = 1.2 / ((Math.sqrt(params.numBlobs) - 1) / 4 + 1);
  for (let i = 0; i < params.numBlobs; i++) {
    const x = Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.27 + 0.5;
    const y = Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.77;
    const z = Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.27 + 0.5;
    effect.addBall(x, y, z, strength, 12, current === "multiColors" ? rainbow[i % 7] : undefined);
  }
  if (params.floor) effect.addPlaneY(2, 12);
  if (params.wallx) effect.addPlaneX(2, 12);
  if (params.wallz) effect.addPlaneZ(2, 12);
  effect.update();
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (!failed && loaded === 3) canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  timer.dispose();
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  effect.geometry.dispose();
  for (const material of Object.values(materials)) material.dispose();
  reflection.dispose();
  refraction.dispose();
  texture.dispose();
  dfg.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
