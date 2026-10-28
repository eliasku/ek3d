import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Scene } from "ek3d/scenes/Scene";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { Stats } from "ek3d/addons/libs/Stats";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { UltraHDRLoader } from "ek3d/addons/loaders/UltraHDRLoader";
import { ToneMapping, Mapping } from "ek3d/constants";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { physicalShader } from "ek3d/renderers/shaders/PhysicalShader";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { WebGLEnvironments } from "ek3d/renderers/webgl/WebGLEnvironments";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (selected === null) throw new Error("Missing example canvas");
const canvas = selected;
let disposed = false;
let frames = 0;
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(60, 60, 60);
const scene = new Scene();
const dfg = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  createEnvironments: WebGLEnvironments,
  getDFGLUT: () => dfg,
  shaders: {
    MeshBasicMaterial: basicShader,
    MeshStandardMaterial: standardShader,
    MeshPhysicalMaterial: physicalShader,
  },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = ToneMapping.ACESFilmic;
renderer.toneMappingExposure = 1;
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 2;
controls.maxDistance = 60;
controls.target.set(0, 0, -0.2);
controls.update();
const stats = new Stats();
document.body.appendChild(stats.dom);
let environment: DataTexture | undefined;
let loaded = false;
canvas.dataset.state = "loading";
function error(cause: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = String(cause);
  console.error(cause);
}
new UltraHDRLoader().load(
  "/examples/textures/equirectangular/royal_esplanade_2k.hdr.jpg",
  (texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    environment = texture;
    texture.mapping = Mapping.EquirectangularReflection;
    scene.environment = texture;
    new GLTFLoader().load(
      "/examples/models/gltf/dungeon_warkarma.glb",
      (gltf) => {
        const model = gltf.scene;
        if (disposed) {
          disposeObject(model);
          return;
        }
        void renderer.compileAsync(model, camera, scene).then(
          () => {
            if (disposed) {
              disposeObject(model);
              return;
            }
            scene.add(model);
            loaded = true;
          },
          (cause: unknown) => {
            disposeObject(model);
            error(cause);
          },
        );
      },
      undefined,
      error,
    );
  },
  undefined,
  error,
);
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  stats.update();
  if (loaded) {
    canvas.dataset.state = "rendered";
    canvas.dataset.frames = String(++frames);
  }
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  stats.dom.remove();
  disposeObject(scene);
  environment?.dispose();
  renderer.dispose();
  dfg.dispose();
  canvas.dataset.state = "disposed";
});
