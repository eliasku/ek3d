import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { TeapotGeometry } from "ek3d/addons/geometries/TeapotGeometry";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, Wrapping, ColorSpace } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing teapot canvas");
const canvas: HTMLCanvasElement = selected;
const scene = new Scene();
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 1, 80000);
camera.position.set(-600, 550, 1300);
scene.add(new AmbientLight(0x7c7c7c, 2));
const light = new DirectionalLight(0xffffff, 2);
light.position.set(0.32, 0.39, 0.7);
scene.add(light);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createEnvironments: WebGLEnvironments,
  shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader, MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
const manager = new LoadingManager();
let disposed = false;
let loaded = 0;
let failed = false;
let frames = 0;
canvas.dataset.state = "loading";
function assetLoaded(): void {
  if (!disposed) {
    loaded++;
    render();
  }
}
function assetError(error: unknown): void {
  if (!disposed) {
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
}
const texture = new TextureLoader(manager).load(
  "/examples/textures/uv_grid_opengl.jpg",
  (value) => {
    if (disposed) value.dispose();
    else assetLoaded();
  },
  undefined,
  assetError,
);
texture.wrapS = texture.wrapT = Wrapping.Repeat;
texture.anisotropy = 16;
texture.colorSpace = ColorSpace.SRGB;
const cube = new CubeTextureLoader(manager).setPath("/examples/textures/cube/pisa/").load(
  ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
  (value) => {
    if (disposed) value.dispose();
    else assetLoaded();
  },
  undefined,
  assetError,
);
const materials = {
  wireframe: new MeshBasicMaterial({ wireframe: true }),
  flat: new MeshPhongMaterial({ specular: 0x000000, flatShading: true, side: Side.Double }),
  smooth: new MeshLambertMaterial({ side: Side.Double }),
  glossy: new MeshPhongMaterial({ color: 0xc0c0c0, specular: 0x404040, shininess: 300, side: Side.Double }),
  textured: new MeshPhongMaterial({ map: texture, side: Side.Double }),
  reflective: new MeshPhongMaterial({ envMap: cube, side: Side.Double }),
};
type Shading = keyof typeof materials;
const params: {
  newTess: number;
  bottom: boolean;
  lid: boolean;
  body: boolean;
  fitLid: boolean;
  nonblinn: boolean;
  newShading: Shading;
} = {
  newTess: 15,
  bottom: true,
  lid: true,
  body: true,
  fitLid: false,
  nonblinn: false,
  newShading: "glossy",
};
let teapot: Mesh;
function rebuild(): void {
  if (teapot) {
    scene.remove(teapot);
    teapot.geometry.dispose();
  }
  teapot = new Mesh(
    new TeapotGeometry(300, params.newTess, params.bottom, params.lid, params.body, params.fitLid, !params.nonblinn),
    materials[params.newShading],
  );
  scene.add(teapot);
  scene.background = params.newShading === "reflective" ? cube : null;
  render();
}
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded === 2 && !failed) canvas.dataset.state = "rendered";
}
const gui = new GUI();
gui.add(params, "newTess", [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50]).name("Tessellation Level").onChange(rebuild);
gui.add(params, "lid").name("display lid").onChange(rebuild);
gui.add(params, "body").name("display body").onChange(rebuild);
gui.add(params, "bottom").name("display bottom").onChange(rebuild);
gui.add(params, "fitLid").name("snug lid").onChange(rebuild);
gui.add(params, "nonblinn").name("original scale").onChange(rebuild);
gui
  .add(params, "newShading", ["wireframe", "flat", "smooth", "glossy", "textured", "reflective"])
  .name("Shading")
  .onChange(rebuild);
controls.addEventListener("change", render);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
rebuild();
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  manager.abort();
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  scene.remove(teapot);
  scene.background = null;
  teapot.geometry.dispose();
  for (const material of Object.values(materials)) material.dispose();
  texture.dispose();
  cube.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
