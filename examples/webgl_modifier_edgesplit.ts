import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { OBJLoader } from "ek3d/addons/loaders/OBJLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { EdgeSplitModifier } from "ek3d/addons/modifiers/EdgeSplitModifier";
import { mergeVertices } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing edge split canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  failed = false,
  frames = 0;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
const camera = new PerspectiveCamera(75, innerWidth / innerHeight);
camera.position.set(0, 0, 4);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.rotateSpeed = 0.35;
controls.minZoom = 1;
scene.add(new HemisphereLight(0xffffff, 0x444444, 3));
const params = { smoothShading: true, edgeSplit: true, cutOffAngle: 20, showMap: false, tryKeepNormals: true };
const modifier = new EdgeSplitModifier();
let base: BufferGeometry | undefined, mesh: Mesh | undefined, map: Texture | undefined;
const material = new MeshStandardMaterial();
function render(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (!failed && mesh && map) canvas.dataset.state = "rendered";
}
function update(): void {
  if (!mesh || !base) return;
  if (mesh.geometry !== base) mesh.geometry.dispose();
  mesh.geometry = params.edgeSplit
    ? modifier.modify(base, (params.cutOffAngle * Math.PI) / 180, params.tryKeepNormals)
    : base;
  material.flatShading = !params.smoothShading;
  material.map = params.showMap ? (map ?? null) : null;
  material.needsUpdate = true;
  render();
}
function fail(error: unknown): void {
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(error);
  console.error(error);
}
new OBJLoader().load(
  "/examples/models/obj/cerberus/Cerberus.obj",
  (group) => {
    if (disposed) {
      disposeObject(group);
      return;
    }
    const source = group.children[0];
    if (!(source instanceof Mesh)) {
      disposeObject(group);
      fail(new Error("Cerberus mesh missing"));
      return;
    }
    base = mergeVertices(source.geometry);
    disposeObject(group);
    mesh = new Mesh(base, material);
    mesh.rotateY(-Math.PI / 2);
    mesh.scale.set(3.5, 3.5, 3.5);
    mesh.translateZ(1.5);
    scene.add(mesh);
    update();
  },
  undefined,
  fail,
);
new TextureLoader().load(
  "/examples/models/obj/cerberus/Cerberus_A.jpg",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    map = texture;
    map.colorSpace = SRGBColorSpace;
    update();
  },
  undefined,
  fail,
);
const gui = new GUI({ title: "Edge split modifier parameters" });
gui.add(params, "showMap").onFinishChange(update);
gui.add(params, "smoothShading").onFinishChange(update);
gui.add(params, "edgeSplit").onFinishChange(update);
gui.add(params, "cutOffAngle").min(0).max(180).onFinishChange(update);
gui.add(params, "tryKeepNormals").onFinishChange(update);
controls.addEventListener("change", render);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.dispose();
  gui.destroy();
  if (mesh && mesh.geometry !== base) base?.dispose();
  if (!mesh) material.dispose();
  material.map = null;
  disposeObject(scene);
  map?.dispose();
  dfg.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
