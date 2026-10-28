import { MapControls } from "ek3d/addons/controls/MapControls";
import { RoomEnvironment } from "ek3d/addons/environments/RoomEnvironment";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { Stats } from "ek3d/addons/libs/Stats";
import { computeBatchedBoundsTree } from "ek3d/addons/math/bvh/utils/ExtensionUtilities";
import { EnhancedBatchedMesh, createRadixSort, getBatchedMeshLODCount } from "ek3d/addons/objects/EnhancedBatchedMesh";
import {
  performanceRangeLOD,
  simplifyGeometriesByErrorLOD,
  type MeshoptSimplifierRuntime,
} from "ek3d/addons/utils/SimplifyGeometryLOD";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { ToneMapping, CoordinateSystem } from "ek3d/constants";
import { Raycaster } from "ek3d/core/Raycaster";
import { PMREMGenerator } from "ek3d/extras/PMREMGenerator";
import { TorusKnotGeometry } from "ek3d/geometries/TorusKnotGeometry";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Quaternion } from "ek3d/math/Quaternion";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import { Scene } from "ek3d/scenes/Scene";
import { loadExporterRuntime } from "./exporter-runtime";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing batch LOD canvas");
const canvas: HTMLCanvasElement = selected;
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: { MeshBasicMaterial: basicShader, MeshLambertMaterial: lambertShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 0.8;
const scene = new Scene();
const room = new RoomEnvironment();
const pmrem = new PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.04);
room.dispose();
pmrem.dispose();
scene.environment = environment.texture;
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 20, 55);
const controls = new MapControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2;
const stats = new Stats();
document.body.appendChild(stats.dom);
const gui = new GUI();
const raycaster = new Raycaster() as Raycaster & { firstHitOnly?: boolean };
raycaster.firstHitOnly = true;
const mouse = new Vector2(1, 1);
const highlight = new Color("red");
const savedColor = new Color();
let hovered: number | null = null;
let mesh: EnhancedBatchedMesh | undefined;
let material: MeshStandardMaterial | undefined;
let disposed = false;
let frames = 0;
canvas.dataset.state = "loading";

async function loadRuntime(): Promise<MeshoptSimplifierRuntime> {
  const module = await loadExporterRuntime<{ MeshoptSimplifier: unknown }>(
    "/examples/libs/meshoptimizer/meshopt_simplifier.js",
    ["MeshoptSimplifier"],
  );
  const runtime = module.MeshoptSimplifier;
  if (
    typeof runtime !== "object" ||
    runtime === null ||
    !("ready" in runtime) ||
    !(runtime.ready instanceof Promise) ||
    !("simplify" in runtime) ||
    typeof runtime.simplify !== "function"
  )
    throw new Error("Invalid MeshoptSimplifier runtime");
  return runtime as MeshoptSimplifierRuntime;
}

async function init(): Promise<void> {
  const runtime = await loadRuntime();
  if (disposed) return;
  const knots = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [2, 1],
    [2, 3],
    [3, 1],
    [4, 1],
    [5, 3],
  ];
  const geometries = knots.map(([p, q]) => new TorusKnotGeometry(1, 0.4, 256, 32, p, q));
  const levels = await simplifyGeometriesByErrorLOD(geometries, 4, performanceRangeLOD, runtime);
  if (disposed) {
    for (const group of levels) for (const geometry of group) geometry.dispose();
    return;
  }
  const { vertexCount, indexCount, LODIndexCount } = getBatchedMeshLODCount(levels);
  material = new MeshStandardMaterial({ metalness: 1, roughness: 0.8 });
  const batch = new EnhancedBatchedMesh(500000, vertexCount, indexCount, material);
  mesh = batch;
  batch.customSort = createRadixSort(batch);
  for (let i = 0; i < levels.length; i++) {
    const group = levels[i];
    const id = batch.addGeometry(group[0], -1, LODIndexCount[i]);
    for (let j = 1; j < group.length; j++) batch.addGeometryLOD(id, group[j], [0.08, 0.04, 0.033, 0.02][j - 1]);
  }
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const matrix = new Matrix4();
  const color = new Color();
  const sqrt = Math.ceil(Math.sqrt(500000));
  const spacing = 5.5;
  const start = (sqrt / -2) * spacing + spacing / 2;
  for (let i = 0; i < 500000; i++) {
    const id = batch.addInstance(Math.floor(Math.random() * levels.length));
    position.set((i % sqrt) * spacing + start, 0, Math.floor(i / sqrt) * spacing + start);
    quaternion.random();
    batch.setMatrixAt(id, matrix.compose(position, quaternion, scale));
    batch.setColorAt(id, color.setHSL(Math.random(), 0.6, 0.5));
  }
  computeBatchedBoundsTree.call(batch);
  batch.computeBVH(CoordinateSystem.WebGL);
  scene.add(batch);
  for (const group of levels) for (const geometry of group) geometry.dispose();
  const config = { freeze: false, useBVH: true, useLOD: true };
  const bvh = batch.bvh;
  const lods = levels.map((_, i) => batch.getGeometryLOD(i));
  const onBeforeRender = batch.onBeforeRender.bind(batch);
  gui.add(batch, "instanceCount").disable();
  gui.add(config, "freeze").onChange(() => {
    batch.onBeforeRender = config.freeze ? () => {} : onBeforeRender;
  });
  gui
    .addFolder("Frustum culling & raycasting")
    .add(config, "useBVH")
    .onChange(() => {
      batch.bvh = config.useBVH ? bvh : null;
    });
  gui
    .addFolder("Geometries")
    .add(config, "useLOD")
    .onChange(() => {
      for (let i = 0; i < lods.length; i++) batch.setGeometryLOD(i, config.useLOD ? lods[i] : null);
    });
  canvas.dataset.state = "ready";
}
function onPointerMove(event: PointerEvent): void {
  if (!mesh) return;
  event.preventDefault();
  mouse.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(mesh);
  const id = hits[0]?.batchId ?? null;
  if (id === hovered) return;
  if (hovered !== null) mesh.setColorAt(hovered, savedColor);
  if (id !== null) {
    mesh.getColorAt(id, savedColor);
    mesh.setColorAt(id, highlight);
  }
  hovered = id;
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
document.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
  canvas.dataset.frames = String(++frames);
  if (mesh) canvas.dataset.state = "rendered";
});
init().catch((error: unknown) => {
  if (!disposed) {
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    renderer.setAnimationLoop(null);
    document.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", resize);
    controls.dispose();
    gui.destroy();
    stats.dom.remove();
    if (mesh) mesh.dispose();
    material?.dispose();
    environment.dispose();
    dfg.dispose();
    renderer.dispose();
  },
  { once: true },
);
