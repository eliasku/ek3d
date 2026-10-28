import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { mergeGeometries } from "ek3d/addons/utils/BufferGeometryUtils";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { DoubleSide } from "ek3d/constants";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { DirectionalLight } from "ek3d/lights/DirectionalLight";
import { MeshPhongMaterial } from "ek3d/materials/MeshPhongMaterial";
import { Color } from "ek3d/math/Color";
import { Matrix4 } from "ek3d/math/Matrix4";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { phongShader } from "ek3d/renderers/shaders/PhongShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";
import { ifcGeometryToBuffer, type IFCColor } from "./ifc-geometry";

interface PlacedGeometry {
  color: IFCColor;
  geometryExpressID: number;
  flatTransformation: number[];
}
interface IFCGeometry {
  GetVertexData(): number;
  GetVertexDataSize(): number;
  GetIndexData(): number;
  GetIndexDataSize(): number;
  delete(): void;
}
interface IFCAPI {
  SetWasmPath(path: string, absolute?: boolean): void;
  Init(locateFile?: (path: string, prefix: string) => string, forceSingleThread?: boolean): Promise<void>;
  OpenModel(data: Uint8Array, settings: { COORDINATE_TO_ORIGIN: boolean }): number;
  StreamAllMeshes(
    model: number,
    callback: (mesh: { geometries: { size(): number; get(index: number): PlacedGeometry } }) => void,
  ): void;
  GetGeometry(model: number, geometry: number): IFCGeometry;
  GetVertexArray(pointer: number, size: number): Float32Array;
  GetIndexArray(pointer: number, size: number): Uint32Array;
  CloseModel(model: number): void;
  Dispose(): void;
}

const element = document.querySelector<HTMLCanvasElement>("#scene");
if (element === null) throw new Error("Missing IFC example canvas");
const canvas: HTMLCanvasElement = element;
const scene = new Scene();
scene.background = new Color(0x8cc7de);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(82.48, 22.09, -45.24);
for (const [x, y, z, color] of [
  [1, 1, 1, 0xffeeff],
  [-1, 0.5, -1, 0xffffff],
]) {
  const light = new DirectionalLight(color, 2.5);
  light.position.set(x, y, z);
  scene.add(light);
}
scene.add(new AmbientLight(0xffffee, 0.75));
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  createBackground: WebGLBackground,
  shaders: { MeshPhongMaterial: phongShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.target.set(30.86, 7.73, 0.15);
controls.update();
let disposed = false;
let frames = 0;
const controller = new AbortController();
canvas.dataset.state = "loading";
function render(): void {
  if (disposed) return;
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
}
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
  controller.abort();
  window.removeEventListener("resize", resize);
  controls.dispose();
  disposeObject(scene);
  renderer.dispose();
});

async function load(): Promise<void> {
  const runtime = await fetch("/examples/libs/web-ifc/web-ifc-api.js", { signal: controller.signal });
  if (!runtime.ok) throw new Error(`Unable to load web-ifc: HTTP ${runtime.status}`);
  const runtimeURL = URL.createObjectURL(new Blob([await runtime.text()], { type: "text/javascript" }));
  let module: unknown;
  try {
    // Vite cannot import publicDir vendor modules directly.
    module = await import(/* @vite-ignore */ runtimeURL);
  } finally {
    URL.revokeObjectURL(runtimeURL);
  }
  if (typeof module !== "object" || module === null || !("IfcAPI" in module) || typeof module.IfcAPI !== "function") {
    throw new Error("web-ifc runtime must export IfcAPI");
  }
  if (disposed) return;
  const api = new (module.IfcAPI as new () => IFCAPI)();
  const opaque: BufferGeometry[] = [];
  const transparent: BufferGeometry[] = [];
  let model: number | undefined;
  let initialized = false;
  try {
    api.SetWasmPath(new URL("/examples/libs/web-ifc/", location.href).href, true);
    await api.Init(undefined, true);
    initialized = true;
    if (disposed) return;
    const response = await fetch("/examples/models/ifc/rac_advanced_sample_project.ifc", { signal: controller.signal });
    if (!response.ok) throw new Error(`Unable to load IFC: HTTP ${response.status}`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (disposed) return;
    model = api.OpenModel(data, { COORDINATE_TO_ORIGIN: true });
    if (model < 0) throw new Error("Unable to open IFC model");
    const modelID = model;
    const matrix = new Matrix4();
    api.StreamAllMeshes(modelID, (mesh) => {
      for (let i = 0; i < mesh.geometries.size(); i++) {
        const placed = mesh.geometries.get(i);
        const source = api.GetGeometry(modelID, placed.geometryExpressID);
        let geometry: BufferGeometry;
        try {
          geometry = ifcGeometryToBuffer(
            placed.color,
            api.GetVertexArray(source.GetVertexData(), source.GetVertexDataSize()),
            api.GetIndexArray(source.GetIndexData(), source.GetIndexDataSize()),
          );
        } finally {
          source.delete();
        }
        geometry.applyMatrix4(matrix.fromArray(placed.flatTransformation));
        (placed.color.w === 1 ? opaque : transparent).push(geometry);
      }
    });
    for (const [geometries, isTransparent] of [
      [opaque, false],
      [transparent, true],
    ] as const) {
      if (geometries.length === 0) continue;
      const merged = mergeGeometries(geometries);
      if (merged === null) throw new Error("Unable to merge IFC geometry");
      scene.add(
        new Mesh(merged, new MeshPhongMaterial({ side: DoubleSide, vertexColors: true, transparent: isTransparent })),
      );
    }
    canvas.dataset.meshes = String(scene.children.filter((object) => object instanceof Mesh).length);
    render();
    canvas.dataset.state = "rendered";
  } finally {
    if (model !== undefined && model >= 0) api.CloseModel(model);
    if (initialized) api.Dispose();
    for (const geometry of opaque) geometry.dispose();
    for (const geometry of transparent) geometry.dispose();
  }
}
void load().catch((error: unknown) => {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});
render();
