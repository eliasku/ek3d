import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { ImageLoader } from "ek3d/loaders/ImageLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing cube panorama canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(90, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 0.01;
const scene = new Scene();
let disposed = false,
  loaded = false,
  frames = 0;
canvas.dataset.state = "loading";
const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableZoom = false;
controls.enablePan = false;
controls.enableDamping = true;
controls.rotateSpeed = -0.25;
const textures = Array.from({ length: 6 }, () => new Texture());
const materials = textures.map((map) => new MeshBasicMaterial({ map }));
const geometry = new BoxGeometry(1, 1, 1);
geometry.scale(1, 1, -1);
scene.add(new Mesh(geometry, materials));
function fail(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}
new ImageLoader().load(
  "/examples/textures/cube/sun_temple_stripe.jpg",
  (image) => {
    if (disposed) return;
    try {
      const tileWidth = image.height;
      for (let i = 0; i < textures.length; i++) {
        const tile = document.createElement("canvas");
        tile.width = tile.height = tileWidth;
        const context = tile.getContext("2d");
        if (!context) throw new Error("Canvas2D is unavailable for panorama atlas extraction");
        context.drawImage(image, tileWidth * i, 0, tileWidth, tileWidth, 0, 0, tileWidth, tileWidth);
        textures[i].colorSpace = SRGBColorSpace;
        textures[i].image = tile;
        textures[i].needsUpdate = true;
      }
      loaded = true;
    } catch (error) {
      fail(error);
    }
  },
  undefined,
  fail,
);
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  window.removeEventListener("resize", resize);
  controls.dispose();
  disposeObject(scene);
  renderer.dispose();
  canvas.dataset.state = "disposed";
});
