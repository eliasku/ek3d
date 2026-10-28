import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import { BufferGeometry } from "ek3d/core/BufferGeometry";
import { Raycaster } from "ek3d/core/Raycaster";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ConeGeometry } from "ek3d/geometries/ConeGeometry";
import { CylinderGeometry } from "ek3d/geometries/CylinderGeometry";
import { SphereGeometry } from "ek3d/geometries/SphereGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshLambertMaterial } from "ek3d/materials/MeshLambertMaterial";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Box3 } from "ek3d/math/Box3";
import { Color } from "ek3d/math/Color";
import { Line3 } from "ek3d/math/Line3";
import { Matrix3 } from "ek3d/math/Matrix3";
import { Plane } from "ek3d/math/Plane";
import { Ray } from "ek3d/math/Ray";
import { Sphere } from "ek3d/math/Sphere";
import { Triangle } from "ek3d/math/Triangle";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { lambertShader } from "ek3d/renderers/shaders/LambertShader";
import { Scene } from "ek3d/scenes/Scene";
import { loadExporterRuntime } from "./exporter-runtime";

interface PolysliceRuntime {
  Printer: new (name: string) => object;
  Filament: new (name: string) => object;
  Polyslice: new (settings: {
    printer: object;
    filament: object;
    layerHeight: number;
    infillPattern: string;
    infillDensity: number;
    verbose: boolean;
  }) => { slice(mesh: Mesh): string };
}
const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Missing G-code canvas");
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  shaders: { MeshBasicMaterial: basicShader, LineBasicMaterial: basicShader, MeshLambertMaterial: lambertShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 1, 1000);
camera.up.set(0, 0, 1);
camera.position.set(42, 42, 42);
const scene = new Scene();
scene.background = new Color(0xa0a0a0);
scene.add(new AmbientLight(0xffffff, 0.5));
const light = new DirectionalLight(0xffffff, 2.5);
light.position.set(0, 200, 100);
scene.add(light);
const grid = new GridHelper(220, 10);
grid.rotation.x = -Math.PI / 2;
scene.add(grid);
const controls = new OrbitControls(camera, canvas);
controls.update();
const material = new MeshLambertMaterial({ color: 0x00cc00 });
let mesh = new Mesh(new BoxGeometry(10, 10, 10), material);
mesh.position.z = 5;
scene.add(mesh);
let runtime: PolysliceRuntime | undefined;
let disposed = false;
const status = document.querySelector<HTMLDivElement>("#status");
if (!status) throw new Error("Missing exporter status");
const statusElement: HTMLDivElement = status;
const params = {
  addCube: () => selectGeometry(new BoxGeometry(10, 10, 10), "cube"),
  addCylinder: () => selectGeometry(new CylinderGeometry(5, 5, 10, 42), "cylinder", Math.PI / 2),
  addCone: () => selectGeometry(new ConeGeometry(5, 10, 42), "cone", Math.PI / 2),
  addSphere: () => selectGeometry(new SphereGeometry(5, 42, 42), "sphere"),
  addTorus: () => selectGeometry(new TorusGeometry(5, 2, 24, 100), "torus"),
  exportToGCode,
  geometryName: "cube",
  printer: "Ender3",
  filament: "GenericPLA",
  layerHeight: 0.2,
  infillDensity: 20,
  infillPattern: "grid",
};
function selectGeometry(geometry: BufferGeometry, name: string, rotation = 0): void {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh = new Mesh(geometry, material);
  mesh.rotation.x = rotation;
  mesh.updateMatrixWorld(true);
  const box = new Box3().setFromObject(mesh);
  if (Number.isFinite(box.min.z)) mesh.position.z -= box.min.z;
  mesh.updateMatrixWorld(true);
  params.geometryName = name;
  scene.add(mesh);
}
const gui = new GUI();
const profiles = gui.addFolder("Printer & Filament");
profiles
  .add(params, "printer", ["Ender3", "UltimakerS5", "PrusaI3MK3S", "AnycubicI3Mega", "BambuLabP1P"])
  .name("Printer");
profiles.add(params, "filament", ["GenericPLA", "GenericPETG", "GenericABS"]).name("Filament");
const settings = gui.addFolder("Slicer Settings");
settings.add(params, "layerHeight", 0.1, 0.4, 0.05).name("Layer Height (mm)");
settings.add(params, "infillDensity", 0, 100, 5).name("Infill Density (%)");
settings.add(params, "infillPattern", ["grid", "triangles", "hexagons"]).name("Infill Pattern");
const geometries = gui.addFolder("Geometry Selection");
for (const key of ["addCube", "addCylinder", "addCone", "addSphere", "addTorus"] as const)
  geometries.add(params, key).name(key.slice(3));
const exportButton = gui.addFolder("Export").add(params, "exportToGCode").name("Export G-code").disable();
gui.open();
const downloadURLs = new Set<string>();
function exportToGCode(): void {
  if (!runtime) return;
  try {
    const slicer = new runtime.Polyslice({
      printer: new runtime.Printer(params.printer),
      filament: new runtime.Filament(params.filament),
      layerHeight: params.layerHeight,
      infillDensity: params.infillDensity,
      infillPattern: params.infillPattern,
      verbose: true,
    });
    const gcode = slicer.slice(mesh);
    if (typeof gcode !== "string" || !gcode.includes("G1")) throw new Error("Polyslice returned invalid G-code");
    const url = URL.createObjectURL(new Blob([gcode], { type: "text/plain" }));
    downloadURLs.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${params.geometryName}-geometry.gcode`;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadURLs.delete(url);
    }, 1000);
    statusElement.textContent = `Exported ${params.geometryName}: ${gcode.length} bytes. Review G-code before using a printer.`;
  } catch (error) {
    statusElement.textContent = `G-code export failed: ${String(error)}`;
    console.error(error);
  }
}
loadExporterRuntime<{ createPolyslice(engine: object): PolysliceRuntime }>("/examples/libs/polyslice/polyslice.js", [
  "createPolyslice",
])
  .then((module) => {
    if (disposed) return;
    runtime = module.createPolyslice({
      Vector2,
      Vector3,
      Box3,
      Line3,
      Sphere,
      Matrix3,
      Triangle,
      Ray,
      Raycaster,
      Mesh,
      DoubleSide,
      BufferGeometry,
      BufferAttribute,
      Plane,
      MeshPhongMaterial,
    });
    exportButton.enable();
    statusElement.textContent = "Ready. Review exported G-code before using a printer.";
    canvas.dataset.state = "ready";
  })
  .catch((error: unknown) => {
    if (!disposed) {
      statusElement.textContent = String(error);
      console.error(error);
    }
  });
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
});
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    controls.dispose();
    gui.destroy();
    for (const url of downloadURLs) URL.revokeObjectURL(url);
    downloadURLs.clear();
    mesh.geometry.dispose();
    material.dispose();
    grid.geometry.dispose();
    if (Array.isArray(grid.material)) for (const item of grid.material) item.dispose();
    else grid.material.dispose();
    renderer.dispose();
  },
  { once: true },
);
