import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Side, NormalMap } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Box3 } from "ek3d/math/Box3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing object-space normal map canvas");
const canvas: HTMLCanvasElement = selected;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  getDFGLUT: () => dfg,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 1, 1000);
camera.position.set(-10, 0, 23);
scene.add(camera);
const controls = new OrbitControls(camera, canvas);
controls.addEventListener("change", render);
controls.minDistance = 10;
controls.maxDistance = 50;
controls.enablePan = false;
scene.add(new AmbientLight(0xffffff, 0.6));
camera.add(new PointLight(0xffffff, 4.5, 0, 0));
let disposed = false;
const manager = new LoadingManager();
canvas.dataset.state = "loading";
new GLTFLoader(manager).load(
  "/examples/models/gltf/Nefertiti/Nefertiti.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const meshes: Mesh[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) meshes.push(child);
    });
    for (const child of meshes) {
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (material instanceof MeshStandardMaterial) {
          material.normalMapType = NormalMap.ObjectSpace;
          material.side = Side.Double;
        }
      }
      child.geometry.deleteAttribute("normal");
      child.scale.multiplyScalar(0.5);
      new Box3().setFromObject(child).getCenter(child.position).multiplyScalar(-1);
      scene.add(child);
    }
    canvas.dataset.model = "loaded";
    canvas.dataset.state = "ready";
    render();
  },
  undefined,
  (error) => {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(error);
    }
  },
);
function render(): void {
  renderer.render(scene, camera);
}
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  manager.abort();
  controls.dispose();
  disposeObject(scene);
  dfg.dispose();
  renderer.dispose();
});
render();
