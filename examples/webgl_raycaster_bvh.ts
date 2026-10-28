import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { FBXLoader } from "ek3d/addons/loaders/FBXLoader";
import { MeshBVH } from "ek3d/addons/math/bvh/core/MeshBVH";
import { BVHHelper } from "ek3d/addons/math/bvh/objects/BVHHelper";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DynamicDrawUsage } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Raycaster } from "ek3d/core/Raycaster";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { HemisphereLight } from "ek3d/lights/HemisphereLight";
import { LineBasicMaterial } from "ek3d/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector3 } from "ek3d/math/Vector3";
import { InstancedMesh } from "ek3d/objects/InstancedMesh";
import { LineSegments } from "ek3d/objects/LineSegments";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { loadZlibDecoder } from "./fflate";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing BVH raycaster canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 1, 100);
camera.position.z = 10;
const scene = new Scene();
scene.background = new Color(0xeeeeee);
scene.add(new HemisphereLight(0xffffff, 0x999999, 3));
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: {
    MeshBasicMaterial: basicShader,
    LineBasicMaterial: basicShader,
    MeshLambertMaterial: lambertShader,
    MeshPhongMaterial: phongShader,
  },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 75;
const stats = new Stats();
document.body.appendChild(stats.dom);
const params = { count: 150, firstHitOnly: true, useBVH: true, displayHelper: false, helperDepth: 10 };
const maxRays = 3000;
const lineGeometry = new BufferGeometry();
const linePositions = new BufferAttribute(new Float32Array(maxRays * 6), 3);
lineGeometry.setAttribute("position", linePositions);
const lineMaterial = new LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.25, depthWrite: false });
const lines = new LineSegments(lineGeometry, lineMaterial);
const sphereGeometry = new SphereGeometry();
const sphereMaterial = new MeshBasicMaterial({ color: 0x444444 });
const spheres = new InstancedMesh(sphereGeometry, sphereMaterial, maxRays * 2);
spheres.instanceMatrix.setUsage(DynamicDrawUsage);
spheres.count = 0;
scene.add(spheres, lines);
const raycaster = new Raycaster() as Raycaster & { firstHitOnly?: boolean };
const position = new Vector3(),
  axis = new Vector3(),
  quaternion = new Quaternion(),
  scale = new Vector3(1, 1, 1),
  matrix = new Matrix4();
for (let i = 0; i < maxRays * 2; i++) {
  position.randomDirection().multiplyScalar(3.75);
  spheres.setMatrixAt(i, matrix.compose(position, quaternion, scale));
}
let mesh: Mesh | undefined;
let helper: BVHHelper | undefined;
let disposed = false;
let frames = 0;
const gui = new GUI();
const raysFolder = gui.addFolder("Raycasting");
raysFolder.add(params, "count", 1, maxRays, 1);
raysFolder.add(params, "firstHitOnly");
raysFolder.add(params, "useBVH");
const helperFolder = gui.addFolder("BVH Helper");
helperFolder.add(params, "displayHelper");
helperFolder.add(params, "helperDepth", 1, 20, 1).onChange(() => {
  if (helper) {
    helper.depth = params.helperDepth;
    helper.update();
  }
});
canvas.dataset.state = "loading";
const loader = new FBXLoader();
loadZlibDecoder().then((runtime) => {
  if (disposed) return;
  loader.setZlibDecoder(runtime);
  loader.load(
    "/examples/models/fbx/stanford-bunny.fbx",
    (group) => {
      if (disposed) {
        disposeObject(group);
        return;
      }
      const candidate = group.children[0];
      if (!(candidate instanceof Mesh)) {
        disposeObject(group);
        reportError(new Error("Bunny model has no mesh"));
        return;
      }
      mesh = candidate;
      mesh.geometry.translate(0, 0.5 / 0.0075, 0);
      const bvh = new MeshBVH(mesh.geometry);
      const defaultRaycast = mesh.raycast.bind(mesh);
      mesh.raycast = function (ray, hits): void {
        if (params.useBVH) bvh.raycastObject3D(this, ray, hits);
        else defaultRaycast(ray, hits);
      };
      mesh.scale.setScalar(0.0075);
      scene.add(mesh);
      helper = new BVHHelper(mesh, bvh);
      helper.color.set(0xe91e63);
      scene.add(helper);
      canvas.dataset.loaded = "true";
    },
    undefined,
    reportError,
  );
}, reportError);
function reportError(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  if (mesh) {
    mesh.rotation.y += 0.002;
    mesh.updateMatrixWorld();
    raycaster.firstHitOnly = params.firstHitOnly;
    let lineIndex = 0;
    for (let i = 0; i < params.count; i++) {
      spheres.getMatrixAt(i * 2, matrix);
      matrix.decompose(position, quaternion, scale);
      const offset = 1e-4 * performance.now();
      axis.set(Math.sin(i * 100 + offset), Math.cos(-i * 10 + offset), Math.sin(i + offset)).normalize();
      position.applyAxisAngle(axis, 0.001);
      scale.setScalar(0.02);
      spheres.setMatrixAt(i * 2, matrix.compose(position, quaternion, scale));
      raycaster.ray.origin.copy(position);
      raycaster.ray.direction.copy(position).multiplyScalar(-1).normalize();
      const hit = raycaster.intersectObject(mesh)[0];
      if (hit) {
        scale.setScalar(0.01);
        spheres.setMatrixAt(i * 2 + 1, matrix.compose(hit.point, quaternion, scale));
      } else spheres.setMatrixAt(i * 2 + 1, matrix);
      linePositions.setXYZ(lineIndex++, position.x, position.y, position.z);
      linePositions.setXYZ(lineIndex++, hit?.point.x ?? 0, hit?.point.y ?? 0, hit?.point.z ?? 0);
    }
    spheres.count = params.count * 2;
    spheres.instanceMatrix.needsUpdate = true;
    lineGeometry.setDrawRange(0, lineIndex);
    linePositions.needsUpdate = true;
  }
  if (helper) helper.visible = params.displayHelper;
  renderer.render(scene, camera);
  stats.update();
  canvas.dataset.frames = String(++frames);
  if (mesh && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  controls.dispose();
  gui.destroy();
  stats.dom.remove();
  helper?.dispose();
  if (mesh) disposeObject(mesh);
  lineGeometry.dispose();
  lineMaterial.dispose();
  sphereGeometry.dispose();
  sphereMaterial.dispose();
  spheres.dispose();
  renderer.dispose();
});
