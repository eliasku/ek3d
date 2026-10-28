import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { ConvexGeometry } from "ek3d/addons/geometries/ConvexGeometry";
import { mergeVertices } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, ColorSpace } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { DodecahedronGeometry } from "ek3d/geometries/DodecahedronGeometry";
import { AxesHelper } from "ek3d/helpers/AxesHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { PointsMaterial } from "ek3d/materials/PointsMaterial";
import { Vector3 } from "ek3d/math/Vector3";
import { Group } from "ek3d/objects/Group";
import { Mesh } from "ek3d/objects/Mesh";
import { Points } from "ek3d/objects/Points";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { pointsShader } from "ek3d/renderers/shaders/PointsShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing convex geometry canvas");
const canvas = selected;
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(15, 20, 30);
scene.add(camera);
scene.add(new AmbientLight(0x666666));
camera.add(new PointLight(0xffffff, 3, 0, 0));
scene.add(new AxesHelper(20));
const group = new Group();
scene.add(group);
const source = new DodecahedronGeometry(10);
source.deleteAttribute("normal");
source.deleteAttribute("uv");
const merged = mergeVertices(source);
source.dispose();
const position = merged.getAttribute("position");
if (!(position instanceof BufferAttribute)) throw new Error("Missing CPU position attribute");
const vertices: Vector3[] = [];
for (let i = 0; i < position.count; i++) vertices.push(new Vector3().fromBufferAttribute(position, i));
merged.dispose();
const texture = new TextureLoader().load(
  "/examples/textures/sprites/disc.png",
  (value) => {
    if (disposed) value.dispose();
    else loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
texture.colorSpace = ColorSpace.SRGB;
group.add(
  new Points(
    new BufferGeometry().setFromPoints(vertices),
    new PointsMaterial({ color: 0x0080ff, map: texture, size: 1, alphaTest: 0.5 }),
  ),
);
group.add(
  new Mesh(
    new ConvexGeometry(vertices),
    new MeshLambertMaterial({ color: 0xffffff, opacity: 0.5, side: Side.Double, transparent: true }),
  ),
);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader, MeshLambertMaterial: lambertShader, PointsMaterial: pointsShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 20;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2;
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  group.rotation.y += 0.005;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
