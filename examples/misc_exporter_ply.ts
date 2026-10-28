import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PLYExporter } from "ek3d/addons/exporters/PLYExporter";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BufferAttribute, Uint8BufferAttribute } from "ek3d/core/BufferAttribute";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { depthShader } from "ek3d/renderers/shaders/DepthShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { WebGLShadowMap } from "ek3d/renderers/webgl/WebGLShadowMap";
import { Fog } from "ek3d/scenes/Fog";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing PLY canvas");
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
const directional = new DirectionalLight(0xffffff, 3);
directional.position.set(0, 20, 10);
directional.castShadow = true;
directional.shadow.camera.top = 2;
directional.shadow.camera.bottom = -2;
directional.shadow.camera.left = -2;
directional.shadow.camera.right = 2;
scene.add(directional);
const ground = new Mesh(new PlaneGeometry(40, 40), new MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new GridHelper(40, 20, 0x000000, 0x000000);
grid.material.opacity = 0.2;
grid.material.transparent = true;
scene.add(grid);
const geometry = new BoxGeometry();
const positions = geometry.getAttribute("position");
if (!(positions instanceof BufferAttribute)) throw new Error("Missing box positions");
const colors = new Uint8BufferAttribute(positions.count * 3, 3, true);
const vertex = new Vector3();
for (let i = 0; i < positions.count; i++) {
  vertex.fromBufferAttribute(positions, i);
  colors.setX(i, vertex.x > 0 ? 0.5 : 0);
  colors.setY(i, vertex.y > 0 ? 0.5 : 0);
  colors.setZ(i, vertex.z > 0 ? 0.5 : 0);
}
geometry.setAttribute("color", colors);
const mesh = new Mesh(geometry, new MeshPhongMaterial({ vertexColors: true }));
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
if (!renderer.shadowMap) throw new Error("Shadow map unavailable");
renderer.shadowMap.enabled = true;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.update();
const exporter = new PLYExporter();
const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);
let downloadUrl: string | undefined;
let disposed = false;
function save(result: string | ArrayBuffer): void {
  if (disposed) return;
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(
    new Blob([result], { type: typeof result === "string" ? "text/plain" : "application/octet-stream" }),
  );
  link.href = downloadUrl;
  link.download = "box.ply";
  link.click();
}
const params = {
  exportASCII: () => exporter.parse(mesh, save),
  exportBinaryBigEndian: () => exporter.parse(mesh, save, { binary: true }),
  exportBinaryLittleEndian: () => exporter.parse(mesh, save, { binary: true, littleEndian: true }),
};
const gui = new GUI();
gui.add(params, "exportASCII").name("Export PLY (ASCII)");
gui.add(params, "exportBinaryBigEndian").name("Export PLY (Binary BE)");
gui.add(params, "exportBinaryLittleEndian").name("Export PLY (Binary LE)");
gui.open();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
let frames = 0;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  link.remove();
  disposeObject(scene);
  directional.shadow.dispose();
  renderer.dispose();
});
