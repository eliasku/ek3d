import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { LoopSubdivision } from "ek3d/addons/modifiers/LoopSubdivision";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide, FrontSide, RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { CapsuleGeometry } from "ek3d/geometries/CapsuleGeometry";
import { CircleGeometry } from "ek3d/geometries/CircleGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { DodecahedronGeometry } from "ek3d/geometries/DodecahedronGeometry";
import { IcosahedronGeometry } from "ek3d/geometries/IcosahedronGeometry";
import { LatheGeometry } from "ek3d/geometries/LatheGeometry";
import { OctahedronGeometry } from "ek3d/geometries/OctahedronGeometry";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { RingGeometry } from "ek3d/geometries/RingGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TetrahedronGeometry } from "ek3d/geometries/TetrahedronGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing subdivision canvas");
const canvas: HTMLCanvasElement = selected;
canvas.dataset.state = "loading";
let disposed = false,
  failed = false,
  loaded = false,
  frames = 0;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene();
const camera = new PerspectiveCamera(75, innerWidth / innerHeight);
camera.position.set(0, 0.7, 2.1);
const controls = new OrbitControls(camera, canvas);
controls.rotateSpeed = 0.5;
controls.minZoom = 1;
controls.target.set(0, 0, 0);
controls.update();
scene.add(new HemisphereLight(0xffffff, 0x737373, 3));
const frontLight = new DirectionalLight(0xffffff, 1.5),
  backLight = new DirectionalLight(0xffffff, 1.5);
frontLight.position.set(0, 1, 1);
backLight.position.set(0, 1, -1);
scene.add(frontLight, backLight);
const params = {
  geometry: "Box",
  iterations: 3,
  split: true,
  uvSmooth: false,
  preserveEdges: false,
  flatOnly: false,
  maxTriangles: 25000,
  flatShading: false,
  textured: true,
  wireframe: false,
};
const meshNormal = new Mesh<MeshStandardMaterial>(new BufferGeometry(), new MeshStandardMaterial());
const meshSmooth = new Mesh<MeshStandardMaterial>(new BufferGeometry(), new MeshStandardMaterial());
meshNormal.position.set(-0.7, 0, 0);
meshSmooth.position.set(0.7, 0, 0);
const wireMaterial = new MeshBasicMaterial({ color: 0xffffff, depthTest: true, wireframe: true });
const wireNormal = new Mesh(meshNormal.geometry, wireMaterial),
  wireSmooth = new Mesh(meshSmooth.geometry, wireMaterial);
wireNormal.position.copy(meshNormal.position);
wireSmooth.position.copy(meshSmooth.position);
wireNormal.visible = wireSmooth.visible = false;
scene.add(meshNormal, meshSmooth, wireNormal, wireSmooth);
const texture = new TextureLoader().load(
  "/examples/textures/uv_grid_opengl.jpg",
  (map) => {
    if (disposed) {
      map.dispose();
      return;
    }
    map.wrapS = map.wrapT = RepeatWrapping;
    map.colorSpace = SRGBColorSpace;
    loaded = true;
    render();
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    failed = true;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  },
);
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (!failed && loaded) canvas.dataset.state = "rendered";
}
function getGeometry(): BufferGeometry {
  switch (params.geometry) {
    case "Box":
      return new BoxGeometry();
    case "Capsule":
      return new CapsuleGeometry(0.5, 0.5, 3, 5);
    case "Circle":
      return new CircleGeometry(0.6, 10);
    case "Cone":
      return new ConeGeometry(0.6, 1.5, 5, 3);
    case "Cylinder":
      return new CylinderGeometry(0.5, 0.5, 1, 5, 4);
    case "Dodecahedron":
      return new DodecahedronGeometry(0.6);
    case "Icosahedron":
      return new IcosahedronGeometry(0.6);
    case "Lathe": {
      const points: Vector2[] = [];
      for (let i = 0; i < 65; i += 5) {
        const x = (Math.sin(i * 0.2) * Math.sin(i * 0.1) * 15 + 50) * 1.2;
        points.push(new Vector2(x * 0.0075, (i - 5) * 3 * 0.005));
      }
      const geometry = new LatheGeometry(points, 4);
      geometry.center();
      return geometry;
    }
    case "Octahedron":
      return new OctahedronGeometry(0.7);
    case "Plane":
      return new PlaneGeometry();
    case "Ring":
      return new RingGeometry(0.3, 0.6, 10);
    case "Sphere":
      return new SphereGeometry(0.6, 8, 4);
    case "Tetrahedron":
      return new TetrahedronGeometry(0.8);
    case "Torus":
      return new TorusGeometry(0.48, 0.24, 4, 6);
    case "TorusKnot":
      return new TorusKnotGeometry(0.38, 0.18, 20, 4);
    default:
      throw new Error(`Unknown geometry: ${params.geometry}`);
  }
}
function updateMaterial(): void {
  meshNormal.material.dispose();
  if (meshSmooth.material !== meshNormal.material) meshSmooth.material.dispose();
  const material = new MeshStandardMaterial({
    color: params.textured ? 0xffffff : 0x808080,
    flatShading: params.flatShading,
    map: params.textured ? texture : null,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    side: ["Circle", "Lathe", "Plane", "Ring"].includes(params.geometry) ? DoubleSide : FrontSide,
  });
  meshNormal.material = meshSmooth.material = material;
  render();
}
function updateMeshes(): void {
  const normal = getGeometry();
  const smooth = LoopSubdivision.modify(normal, params.iterations, params);
  meshNormal.geometry.dispose();
  meshSmooth.geometry.dispose();
  meshNormal.geometry = wireNormal.geometry = normal;
  meshSmooth.geometry = wireSmooth.geometry = smooth;
  updateMaterial();
}
function updateWireframe(): void {
  wireNormal.visible = wireSmooth.visible = params.wireframe;
  render();
}
updateMeshes();
const gui = new GUI();
const folder = gui.addFolder("Subdivide Params");
const geomController = folder
  .add(params, "geometry", [
    "Box",
    "Capsule",
    "Circle",
    "Cone",
    "Cylinder",
    "Dodecahedron",
    "Icosahedron",
    "Lathe",
    "Octahedron",
    "Plane",
    "Ring",
    "Sphere",
    "Tetrahedron",
    "Torus",
    "TorusKnot",
  ])
  .onFinishChange(() => {
    params.split = ["Box", "Ring", "Plane"].includes(params.geometry);
    params.uvSmooth = ["Circle", "Plane", "Ring"].includes(params.geometry);
    geomController.updateDisplay();
    splitController.updateDisplay();
    uvController.updateDisplay();
    preserveController.updateDisplay();
    updateMeshes();
  });
folder.add(params, "iterations").min(0).max(5).step(1).onFinishChange(updateMeshes);
const splitController = folder.add(params, "split").onFinishChange(updateMeshes);
const uvController = folder.add(params, "uvSmooth").onFinishChange(updateMeshes);
const preserveController = folder.add(params, "preserveEdges").onFinishChange(updateMeshes);
folder.add(params, "flatOnly").onFinishChange(updateMeshes);
folder.add(params, "maxTriangles").onFinishChange(updateMeshes);
const materialFolder = gui.addFolder("Material");
materialFolder.add(params, "flatShading").onFinishChange(updateMaterial);
materialFolder.add(params, "textured").onFinishChange(updateMaterial);
materialFolder.add(params, "wireframe").onFinishChange(updateWireframe);
controls.addEventListener("change", render);
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
  controls.dispose();
  gui.destroy();
  meshNormal.material.map = null;
  disposeObject(scene);
  texture.dispose();
  dfg.dispose();
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
