import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { STLExporter } from "ek3d/addons/exporters/STLExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing STL exporter canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4, 2, 4);
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.fog = new Fog(0xa0a0a0, 4, 20);
const hemisphere = new HemisphereLight(0xffffff, 0x444444, 3);
hemisphere.position.set(0, 20, 0);
scene.add(hemisphere);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(0, 20, 10);
light.castShadow = true;
light.shadow.camera.top = 2;
light.shadow.camera.bottom = -2;
light.shadow.camera.left = -2;
light.shadow.camera.right = 2;
scene.add(light);
const ground = new Mesh(new PlaneGeometry(40, 40), new MeshPhongMaterial({ color: 0xbbbbbb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new GridHelper(40, 20, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);
const mesh = new Mesh(new BoxGeometry(), new MeshPhongMaterial({ color: 0x00ff00 }));
mesh.castShadow = true;
mesh.position.y = 0.5;
scene.add(mesh);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  createShadowMap: WebGLShadowMap,
  shaders: { MeshPhongMaterial: phongShader, MeshDepthMaterial: depthShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
if (renderer.shadowMap === null) throw new Error("The shadow map system failed to install");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.update();
const exporter = new STLExporter();
const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);
let url: string | null = null;
function save(blob: Blob): void {
  if (url !== null) URL.revokeObjectURL(url);
  url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "box.stl";
  link.click();
}
const params = {
  exportASCII: () => save(new Blob([exporter.parse(mesh)], { type: "text/plain" })),
  exportBinary: () =>
    save(
      new Blob([exporter.parse(mesh, { binary: true }).buffer as ArrayBuffer], { type: "application/octet-stream" }),
    ),
};
const gui = new GUI();
gui.add(params, "exportASCII").name("Export STL (ASCII)");
gui.add(params, "exportBinary").name("Export STL (Binary)");
gui.open();
let frames = 0;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  if (url !== null) URL.revokeObjectURL(url);
  link.remove();
  disposeObject(scene);
  light.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
