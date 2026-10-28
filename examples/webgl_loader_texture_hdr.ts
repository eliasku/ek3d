import { HDRLoader } from "ek3d/addons/loaders/HDRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ReinhardToneMapping } from "ek3d/constants";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import type { DataTextureData } from "ek3d/loaders/DataTextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTexture } from "ek3d/textures/DataTexture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing HDR texture loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  exposure: 2.0,
};

const scene = new Scene();

const aspect = window.innerWidth / window.innerHeight;

const camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);

const renderer = new WebGLRenderer({
  canvas,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.toneMapping = ReinhardToneMapping;
renderer.toneMappingExposure = params.exposure;

let texture: DataTexture | null = null;
let geometry: PlaneGeometry | null = null;
let material: MeshBasicMaterial | null = null;
let disposed = false;
let loaded = false;
let frames = 0;

const gui = new GUI();
gui.add(params, "exposure", 0, 4, 0.01).onChange(render);
gui.open();

new HDRLoader().load(
  "/examples/textures/memorial.hdr",
  function (loadedTexture: DataTexture, textureData?: DataTextureData) {
    // A response arriving after pagehide must not resurrect disposed renderer state.
    if (disposed) {
      loadedTexture.dispose();
      return;
    }

    texture = loadedTexture;
    material = new MeshBasicMaterial({ map: loadedTexture });

    const width = textureData?.width ?? loadedTexture.image.width;
    const height = textureData?.height ?? loadedTexture.image.height;

    geometry = new PlaneGeometry((1.5 * width) / height, 1.5);

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    loaded = true;
    canvas.dataset.width = String(width);
    canvas.dataset.height = String(height);

    render();
  },
  undefined,
  function (error: unknown) {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
    console.error(error);
  },
);

render();

function onWindowResize(): void {
  const aspect = window.innerWidth / window.innerHeight;

  const frustumHeight = camera.top - camera.bottom;

  camera.left = (-frustumHeight * aspect) / 2;
  camera.right = (frustumHeight * aspect) / 2;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();
}

function render(): void {
  if (disposed) return;

  renderer.toneMappingExposure = params.exposure;

  renderer.render(scene, camera);

  canvas.dataset.frames = String(++frames);
  if (loaded) canvas.dataset.state = "rendered";
}

window.addEventListener("resize", onWindowResize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", onWindowResize);
  gui.destroy();
  geometry?.dispose();
  material?.dispose();
  texture?.dispose();
  renderer.dispose();
});
