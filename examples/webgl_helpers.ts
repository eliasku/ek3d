import { VertexNormalsHelper } from "ek3d/addons/helpers/VertexNormalsHelper";
import { VertexTangentsHelper } from "ek3d/addons/helpers/VertexTangentsHelper";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { EdgesGeometry } from "ek3d/geometries/EdgesGeometry";
import { WireframeGeometry } from "ek3d/geometries/WireframeGeometry";
import { BoxHelper } from "ek3d/helpers/BoxHelper";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { PointLightHelper } from "ek3d/helpers/PointLightHelper";
import { PolarGridHelper } from "ek3d/helpers/PolarGridHelper";
import { PointLight } from "ek3d/lights/PointLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { Group } from "ek3d/objects/Group";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing helpers example canvas");
const canvas = selected;
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 1000);
camera.position.z = 400;
const scene = new Scene();
const light = new PointLight();
light.position.set(200, 100, 150);
scene.add(light, new PointLightHelper(light, 15));
const grid = new GridHelper(400, 40, 0x0000ff, 0x808080);
grid.position.set(-150, -150, 0);
scene.add(grid);
const polar = new PolarGridHelper(200, 16, 8, 64, 0x0000ff, 0x808080);
polar.position.set(200, -150, 0);
scene.add(polar);
let disposed = false;
let loaded = false;
let updateVectors: (() => void) | undefined;
canvas.dataset.state = "loading";
new GLTFLoader().load(
  "/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb",
  (gltf) => {
    if (disposed) {
      disposeObject(gltf.scene);
      return;
    }
    const mesh = gltf.scene.children[0] as Mesh;
    mesh.geometry.computeTangents();
    const group = new Group();
    group.scale.multiplyScalar(50);
    scene.add(group);
    group.updateMatrixWorld(true);
    group.add(mesh);
    const normals = new VertexNormalsHelper(mesh, 5);
    const tangents = new VertexTangentsHelper(mesh, 5);
    scene.add(normals, tangents);
    updateVectors = () => {
      normals.update();
      tangents.update();
    };
    scene.add(new BoxHelper(mesh));
    const wire = new LineSegments(
      new WireframeGeometry(mesh.geometry),
      new LineBasicMaterial({ depthTest: false, opacity: 0.25, transparent: true }),
    );
    wire.position.x = 4;
    group.add(wire);
    scene.add(new BoxHelper(wire));
    const edges = new LineSegments(
      new EdgesGeometry(mesh.geometry),
      new LineBasicMaterial({ depthTest: false, opacity: 0.25, transparent: true }),
    );
    edges.position.x = -4;
    group.add(edges);
    scene.add(new BoxHelper(edges), new BoxHelper(group), new BoxHelper(scene));
    loaded = true;
  },
  undefined,
  (error) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);
let frames = 0;
renderer.setAnimationLoop(() => {
  const time = -performance.now() * 0.0003;
  camera.position.x = 400 * Math.cos(time);
  camera.position.z = 400 * Math.sin(time);
  camera.lookAt(scene.position);
  light.position.set(Math.sin(time * 1.7) * 300, Math.cos(time * 1.5) * 400, Math.cos(time * 1.3) * 300);
  updateVectors?.();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
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
  disposeObject(scene);
  dfgLUT.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
