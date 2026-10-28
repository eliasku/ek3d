import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing texture rotation canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(10, 15, 25);
const scene = new Scene();
scene.add(camera);
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 20;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2;
controls.addEventListener("change", render);
const api = { offsetX: 0, offsetY: 0, repeatX: 0.25, repeatY: 0.25, rotation: Math.PI / 4, centerX: 0.5, centerY: 0.5 };
let disposed = false;
let frames = 0;
let loaded = false;
let gui: GUI | undefined;
canvas.dataset.state = "loading";
function render(): void {
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
}
new TextureLoader()
  .loadAsync("/examples/textures/uv_grid_opengl.jpg")
  .then((texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.colorSpace = SRGBColorSpace;
    scene.add(new Mesh(new BoxGeometry(10, 10, 10), new MeshBasicMaterial({ map: texture })));
    function updateUvTransform(): void {
      if (texture.matrixAutoUpdate) {
        texture.offset.set(api.offsetX, api.offsetY);
        texture.repeat.set(api.repeatX, api.repeatY);
        texture.center.set(api.centerX, api.centerY);
        texture.rotation = api.rotation;
      } else {
        texture.matrix.setUvTransform(
          api.offsetX,
          api.offsetY,
          api.repeatX,
          api.repeatY,
          api.rotation,
          api.centerX,
          api.centerY,
        );
      }
      render();
    }
    gui = new GUI();
    gui.add(api, "offsetX", 0, 1).name("offset.x").onChange(updateUvTransform);
    gui.add(api, "offsetY", 0, 1).name("offset.y").onChange(updateUvTransform);
    gui.add(api, "repeatX", 0.25, 2).name("repeat.x").onChange(updateUvTransform);
    gui.add(api, "repeatY", 0.25, 2).name("repeat.y").onChange(updateUvTransform);
    gui.add(api, "rotation", -2, 2).name("rotation").onChange(updateUvTransform);
    gui.add(api, "centerX", 0, 1).name("center.x").onChange(updateUvTransform);
    gui.add(api, "centerY", 0, 1).name("center.y").onChange(updateUvTransform);
    loaded = true;
    updateUvTransform();
  })
  .catch((error: unknown) => {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  });
function resize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui?.destroy();
  disposeObject(scene);
  renderer.dispose();
});
