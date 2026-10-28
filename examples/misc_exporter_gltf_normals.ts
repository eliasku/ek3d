import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFExporter } from "ek3d/addons/exporters/GLTFExporter";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const button = document.querySelector<HTMLButtonElement>("#export_objects");
if (canvas === null || button === null) throw new Error("Missing glTF normals example elements");
const scene = new Scene();
scene.name = "Scene";
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 0, 150);
camera.name = "PerspectiveCamera";
scene.add(camera);
const lut = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => lut,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.minDistance = 100;
controls.maxDistance = 200;
controls.addEventListener("change", render);
for (const [name, z] of [
  ["DirectionalLight", 1],
  ["DirectionalLight2", -1],
] as const) {
  const light = new DirectionalLight(0xffffff, 4);
  light.position.set(0, 1, z);
  light.name = name;
  scene.add(light);
}
let disposed = false;
const geometry = new PlaneGeometry(50, 50);
const loader = new TextureLoader();
const openGL = loader.load("/examples/textures/NormalMapOpenGL.png", render);
const directX = loader.load("/examples/textures/NormalMapDirectX.png", render);
const material = new MeshStandardMaterial({
  color: 0x636389,
  roughness: 0.3,
  normalScale: new Vector2(0.5, 0.5),
  side: DoubleSide,
});
const mesh1 = new Mesh<MeshStandardMaterial>(geometry, material.clone());
mesh1.material.normalMap = openGL;
mesh1.position.x = -30;
mesh1.name = "Mesh1";
scene.add(mesh1);
const mesh2 = new Mesh<MeshStandardMaterial>(geometry, material.clone());
mesh2.material.normalMap = directX;
mesh2.material.normalScale.y *= -1;
mesh2.position.x = 30;
mesh2.name = "Mesh2";
scene.add(mesh2);
material.dispose();
const link = document.createElement("a");
link.style.display = "none";
document.body.appendChild(link);
let url: string | null = null;
function exportObjects(): void {
  new GLTFExporter().parse(
    [mesh1, mesh2],
    (result) => {
      if (disposed) return;
      const binary = result instanceof ArrayBuffer;
      const data = binary ? result : JSON.stringify(result, null, 2);
      if (!binary) console.log(data);
      if (url !== null) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([data], { type: binary ? "application/octet-stream" : "text/plain" }));
      link.href = url;
      link.download = binary ? "scene.glb" : "scene.gltf";
      link.click();
    },
    (error) => console.error("An error happened during parsing", error),
    { binary: true },
  );
}
function render(): void {
  if (!disposed) renderer.render(scene, camera);
}
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
button.addEventListener("click", exportObjects);
window.addEventListener("resize", resize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    button.removeEventListener("click", exportObjects);
    window.removeEventListener("resize", resize);
    controls.dispose();
    disposeObject(scene);
    lut.dispose();
    renderer.dispose();
    if (url !== null) URL.revokeObjectURL(url);
    link.remove();
  },
  { once: true },
);
render();
