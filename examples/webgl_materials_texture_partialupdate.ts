import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { LinearFilter, SRGBColorSpace } from "ek3d/constants";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Color } from "ek3d/math/Color";
import { randInt } from "ek3d/math/MathUtils";
import { Vector2 } from "ek3d/math/Vector2";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { DataTexture } from "ek3d/textures/DataTexture";
import { disposeObject } from "./dispose-object";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing partial texture update canvas");
const canvas: HTMLCanvasElement = selected;
const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
camera.position.z = 2;
const scene = new Scene();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const data = new Uint8Array(32 * 32 * 4);
const dataTexture = new DataTexture(data, 32, 32);
dataTexture.colorSpace = SRGBColorSpace;
const position = new Vector2();
const color = new Color();
let disposed = false;
let frames = 0;
let last = 0;
canvas.dataset.state = "loading";
new TextureLoader()
  .loadAsync("/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg")
  .then((texture) => {
    if (disposed) {
      texture.dispose();
      return;
    }
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    scene.add(new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: texture })));
    renderer.setAnimationLoop((time) => {
      if (time - last > 100) {
        last = time;
        position.set(32 * randInt(0, 15), 32 * randInt(0, 15));
        color.setHex(Math.random() * 0xffffff);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.floor(color.r * 255);
          data[i + 1] = Math.floor(color.g * 255);
          data[i + 2] = Math.floor(color.b * 255);
          data[i + 3] = 1;
        }
        renderer.copyTextureToTexture(dataTexture, texture, null, position);
      }
      renderer.render(scene, camera);
      canvas.dataset.frames = String(++frames);
      canvas.dataset.state = "rendered";
    });
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
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  renderer.setAnimationLoop(null);
  disposeObject(scene);
  dataTexture.dispose();
  renderer.dispose();
});
