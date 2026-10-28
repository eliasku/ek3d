import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { FBXLoader } from "ek3d/addons/loaders/FBXLoader";
import { Stats } from "ek3d/addons/libs/Stats";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { GridHelper } from "ek3d/helpers/GridHelper";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import type { Object3D } from "ek3d/core/Object3D";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing FBX Nurbs example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.set(2, 18, 28);

const scene = new Scene();

const gridHelper = new GridHelper(28, 28, 0x303030, 0x303030);
scene.add(gridHelper);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { LineBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 12, 0);
controls.update();

const stats = new Stats();
document.body.appendChild(stats.dom);

const loader = new FBXLoader();
let object: Object3D | undefined;
let disposed = false;
let frames = 0;

function loadModel(): void {
  loader.load(
    "/examples/models/fbx/nurbs.fbx",
    (group) => {
      // A response arriving after pagehide must not resurrect disposed renderer state.
      if (disposed) {
        group.traverse((child) => {
          (child as Object3D & { geometry?: { dispose(): void } }).geometry?.dispose();
        });
        return;
      }

      object = group;
      scene.add(object);

      canvas.dataset.loaded = "true";
    },
    undefined,
    (error) => {
      if (disposed) return;

      canvas.dataset.state = "error";
      canvas.dataset.error = error instanceof Error ? error.message : String(error);
      console.error(error);
    },
  );
}

function animate(): void {
  controls.update();

  renderer.render(scene, camera);

  stats.update();

  frames++;
  canvas.dataset.frames = String(frames);

  if (canvas.dataset.state !== "error" && canvas.dataset.loaded === "true") canvas.dataset.state = "rendered";
}

renderer.setAnimationLoop(animate);

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);

    if (object !== undefined) {
      object.traverse((child) => {
        const renderable = child as Object3D & {
          geometry?: { dispose(): void };
          material?: { dispose(): void };
        };
        renderable.geometry?.dispose();
        renderable.material?.dispose();
      });
      scene.remove(object);
      object = undefined;
    }

    controls.dispose();
    stats.dom.remove();
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
    renderer.dispose();
  },
  { once: true },
);

// nurbs.fbx is an ASCII asset, so no zlib runtime is needed here.
loadModel();
