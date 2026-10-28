import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { ShapeGeometry } from "ek3d/geometries/ShapeGeometry";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Line } from "ek3d/objects/Line";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing text shapes canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, -400, 600);
const scene = new Scene();
scene.background = new Color(0xf0f0f0);
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.target.set(0, 0, 0);
controls.update();
const lineMaterial = new LineBasicMaterial({ color: 0x006699, side: DoubleSide });
const meshMaterial = new MeshBasicMaterial({ color: 0x006699, transparent: true, opacity: 0.4, side: DoubleSide });
const geometries: BufferGeometry[] = [];
let disposed = false;
let loaded = false;
canvas.dataset.state = "loading";
function render(): void {
  renderer.clear();
  renderer.render(scene, camera);
  if (loaded) canvas.dataset.state = "rendered";
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
controls.addEventListener("change", render);
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  for (const geometry of geometries) geometry.dispose();
  lineMaterial.dispose();
  meshMaterial.dispose();
  renderer.dispose();
});
new FontLoader().load(
  new URL("./fonts/helvetiker_regular.typeface.json", import.meta.url).href,
  (font) => {
    if (disposed) return;
    const shapes = font.generateShapes("   Three.js\nSimple text.", 100);
    const geometry = new ShapeGeometry(shapes);
    geometries.push(geometry);
    geometry.computeBoundingBox();
    const xMid = -0.5 * (geometry.boundingBox!.max.x - geometry.boundingBox!.min.x);
    geometry.translate(xMid, 0, 0);
    const mesh = new Mesh(geometry, meshMaterial);
    mesh.position.z = -150;
    scene.add(mesh);
    for (const shape of shapes) {
      for (const path of [shape, ...shape.holes]) {
        const lineGeometry = new BufferGeometry().setFromPoints(path.getPoints());
        geometries.push(lineGeometry);
        lineGeometry.translate(xMid, 0, 0);
        scene.add(new Line(lineGeometry, lineMaterial));
      }
    }
    loaded = true;
    render();
  },
  undefined,
  (cause) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = cause instanceof Error ? cause.message : String(cause);
    console.error(cause);
  },
);
render();
