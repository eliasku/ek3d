import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { MDDLoader, type MDDLoaderResult } from "ek3d/addons/loaders/MDDLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { MeshNormalMaterial } from "ek3d/materials/MeshNormalMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { normalShader } from "ek3d/renderers/shaders/NormalShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing MDD loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const scene = new Scene();

const camera = new PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8, 8, 8);
camera.lookAt(scene.position);

const timer = new Timer();
timer.connect(document);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshNormalMaterial: normalShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

let mixer: AnimationMixer | undefined;
let geometry: BoxGeometry | undefined;
let material: MeshNormalMaterial | undefined;
let mesh: Mesh<MeshNormalMaterial> | undefined;
let disposed = false;
let frames = 0;

canvas.dataset.state = "loading";
new MDDLoader().load(
  "/examples/models/mdd/cube.mdd",
  (result: MDDLoaderResult) => {
    // A response arriving after pagehide must not resurrect disposed renderer state.
    if (disposed) return;
    geometry = new BoxGeometry();
    geometry.morphAttributes.position = result.morphTargets;
    material = new MeshNormalMaterial();
    mesh = new Mesh(geometry, material);
    scene.add(mesh);
    mixer = new AnimationMixer(mesh);
    mixer.clipAction(result.clip).play();
    canvas.dataset.morphs = String(result.morphTargets.length);
  },
  undefined,
  (error: unknown) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

function animate(): void {
  timer.update();
  mixer?.update(timer.getDelta());
  renderer.render(scene, camera);
  if (mesh !== undefined && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
  canvas.dataset.frames = String(++frames);
}

function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

renderer.setAnimationLoop(animate);

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  mixer?.stopAllAction();
  if (mixer !== undefined && mesh !== undefined) mixer.uncacheRoot(mesh);
  if (mesh !== undefined) scene.remove(mesh);
  geometry?.dispose();
  material?.dispose();
  timer.disconnect();
  renderer.setAnimationLoop(null);
  renderer.dispose();
});
