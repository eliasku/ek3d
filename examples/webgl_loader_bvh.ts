import { AnimationMixer } from "ek3d/animation/AnimationMixer";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { BVHLoader, type BVHLoaderResult } from "ek3d/addons/loaders/BVHLoader";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Timer } from "ek3d/core/Timer";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { SkeletonHelper } from "ek3d/helpers/SkeletonHelper";
import { Color } from "ek3d/math/Color";
import type { Bone } from "ek3d/objects/Bone";
import type { Skeleton } from "ek3d/objects/Skeleton";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing BVH loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 200, 300);

const scene = new Scene();
scene.background = new Color(0xeeeeee);

const grid = new GridHelper(400, 10);
scene.add(grid);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 300;
controls.maxDistance = 700;

const timer = new Timer();
timer.connect(document);

let mixer: AnimationMixer | undefined;
let skeleton: Skeleton | undefined;
let root: Bone | undefined;
let helper: SkeletonHelper | undefined;
let disposed = false;
let frames = 0;

canvas.dataset.state = "loading";
new BVHLoader().load(
  "/examples/models/bvh/pirouette.bvh",
  (result: BVHLoaderResult) => {
    // A response arriving after pagehide must not resurrect disposed renderer state.
    if (disposed) {
      result.skeleton.dispose();
      return;
    }
    skeleton = result.skeleton;
    root = skeleton.bones[0];
    helper = new SkeletonHelper(root);
    scene.add(root);
    scene.add(helper);
    mixer = new AnimationMixer(root);
    mixer.clipAction(result.clip).play();
    canvas.dataset.bones = String(skeleton.bones.length);
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
  if (root !== undefined && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
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
  controls.dispose();
  mixer?.stopAllAction();
  if (mixer !== undefined && root !== undefined) mixer.uncacheRoot(root);
  skeleton?.dispose();
  if (helper !== undefined) {
    helper.geometry.dispose();
    helper.material.dispose();
    scene.remove(helper);
  }
  if (root !== undefined) scene.remove(root);
  timer.disconnect();
  grid.geometry.dispose();
  grid.material.dispose();
  renderer.setAnimationLoop(null);
  renderer.dispose();
});
