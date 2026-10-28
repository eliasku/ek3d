import { SimplifyModifier, type MeshoptSimplifierLike } from "ek3d/addons/modifiers/SimplifyModifier";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GLTFLoader, type GLTF } from "ek3d/addons/loaders/GLTFLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import type { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing modifier simplifier example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const dfgLUT = createDFGLUT();

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();

const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 15;

const controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
controls.addEventListener("change", render); // use if there is no animation loop
controls.enablePan = false;
controls.enableZoom = false;

scene.add(new AmbientLight(0xffffff, 0.6));

const light = new PointLight(0xffffff, 400);
camera.add(light);
scene.add(camera);

let mesh: Mesh | undefined;
let simplified: Mesh | undefined;
let modifier: SimplifyModifier | undefined;
let gui: GUI | undefined;
let disposed = false;
let frames = 0;
let simplification = 0;

const params = { ratio: 0.125 };

/** meshopt simplifier is vendor runtime (user decision): fetched from the packaged
 * asset (public dir, untransformed) and imported through a Blob URL at runtime, so a
 * static import cannot work — publicDir assets are not module graph entries. */
async function loadSimplifier(): Promise<MeshoptSimplifierLike> {
  const source = (await new FileLoader()
    .setPath("/examples/libs/")
    .setResponseType("text")
    .loadAsync("meshopt_simplifier.module.js")) as unknown as string;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const mod = (await import(/* @vite-ignore */ url)) as { MeshoptSimplifier: MeshoptSimplifierLike };
    return mod.MeshoptSimplifier;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function simplify(): Promise<void> {
  const source = mesh;
  const target = simplified;
  const simplifier = modifier;
  if (disposed || source === undefined || target === undefined || simplifier === undefined) return;

  const positionAttribute = source.geometry.getAttribute("position");
  if (positionAttribute === undefined) throw new Error("LeePerrySmith.glb has no position attribute");

  const request = ++simplification;
  const count = Math.floor(positionAttribute.count * (1 - params.ratio)); // number of vertices to remove

  let geometry: BufferGeometry;
  try {
    geometry = await simplifier.modify(source.geometry, count);
  } catch (error) {
    // A stale request is already superseded; only report the failure that still matters.
    if (disposed || request !== simplification) return;

    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
    return;
  }

  // A response arriving after disposal or a newer slider value must not be applied.
  if (disposed || request !== simplification) {
    geometry.dispose();
    return;
  }

  if (target.geometry !== source.geometry) target.geometry.dispose();

  target.geometry = geometry;

  const simplifiedPosition = geometry.getAttribute("position");
  canvas.dataset.ratio = String(params.ratio);
  canvas.dataset.vertices = String(simplifiedPosition === undefined ? 0 : simplifiedPosition.count);
  render();
}

async function start(): Promise<void> {
  const simplifier = await loadSimplifier();
  if (disposed) return;

  new GLTFLoader().setPath("/examples/models/gltf/LeePerrySmith/").load(
    "LeePerrySmith.glb",
    (gltf: GLTF) => {
      if (disposed) {
        gltf.scene.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.geometry.dispose();
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
        });
        return;
      }

      const source = gltf.scene.children[0];
      if (!(source instanceof Mesh)) throw new Error("LeePerrySmith.glb did not provide a mesh");

      mesh = source;
      mesh.position.x = -3;
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);

      modifier = new SimplifyModifier().setSimplifier(simplifier);

      simplified = mesh.clone();
      const material = simplified.material as MeshStandardMaterial;
      simplified.material = material.clone();
      (simplified.material as MeshStandardMaterial).flatShading = true;

      simplified.position.x = 3;
      simplified.rotation.y = -Math.PI / 2;
      scene.add(simplified);

      canvas.dataset.loaded = "true";

      void simplify();

      gui = new GUI();
      gui.add(params, "ratio", 0.01, 1, 0.01).onChange(() => {
        void simplify();
      });
    },
    undefined,
    (error: unknown) => {
      if (disposed) return;

      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}

start().catch((error: unknown) => {
  if (disposed) return;

  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

function render(): void {
  renderer.render(scene, camera);

  frames++;
  canvas.dataset.frames = String(frames);
  if (canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}

function onWindowResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  render();
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    controls.dispose();
    gui?.destroy();
    if (simplified !== undefined && mesh !== undefined && simplified.geometry !== mesh.geometry) {
      simplified.geometry.dispose();
    }
    if (mesh !== undefined) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    if (simplified !== undefined) (simplified.material as MeshStandardMaterial).dispose();
    dfgLUT.dispose();
    renderer.dispose();
  },
  { once: true },
);
