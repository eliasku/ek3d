import { EXRLoader } from "ek3d/addons/loaders/EXRLoader";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ToneMapping } from "ek3d/constants";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { DataTextureData } from "ek3d/loaders/DataTextureLoader";
import type { EXRPartHeader } from "ek3d/addons/loaders/EXRLoader";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { loadZlibDecoder } from "./fflate";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing EXR texture loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const params = {
  exposure: 2.0,
};

let renderer: WebGLRenderer;
let scene: Scene;
let camera: OrthographicCamera;
let gui: GUI;
let quad: PlaneGeometry | null = null;
let material: MeshBasicMaterial | null = null;
let texture: DataTexture | null = null;
let disposed = false;

init().catch(function (error: unknown) {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.toneMapping = ToneMapping.Reinhard;
  renderer.toneMappingExposure = params.exposure;

  scene = new Scene();

  const aspect = window.innerWidth / window.innerHeight;

  camera = new OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);

  gui = new GUI();
  gui.add(params, "exposure", 0, 4, 0.01).onChange(render);
  gui.open();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      gui.destroy();
      quad?.dispose();
      texture?.dispose();
      material?.dispose();
      renderer.dispose();
    },
    { once: true },
  );
  // Injected explicitly: the package never bundles a zlib runtime.
  const runtime = await loadZlibDecoder();
  if (disposed) return;
  const loader = new EXRLoader().setZlibDecoder(runtime);

  loader.load(
    "/examples/textures/memorial.exr",
    function (loadedTexture: DataTexture, textureData?: DataTextureData) {
      if (disposed) {
        loadedTexture.dispose();
        return;
      }

      if (textureData === undefined) throw new Error("EXR loader returned no texture data");

      texture = loadedTexture;

      // memorial.exr is NPOT; EXRLoader already sets no mipmaps and linear filtering.
      material = new MeshBasicMaterial({ map: loadedTexture });

      const width = textureData.width ?? loadedTexture.image.width;
      const height = textureData.height ?? loadedTexture.image.height;

      quad = new PlaneGeometry((1.5 * width) / height, 1.5);

      const mesh = new Mesh(quad, material);
      scene.add(mesh);

      canvas.dataset.width = String(width);
      canvas.dataset.height = String(height);
      canvas.dataset.loaded = "true";

      // The shared texture-data type also carries RGBE header strings; EXR returns its part header.
      const header: DataTextureData["header"] = textureData.header;
      if (isEXRPartHeader(header)) {
        canvas.dataset.compression = header.compression;
        canvas.dataset.channels = header.channels.map((channel) => channel.name).join(",");
      }

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
}

function isEXRPartHeader(header: DataTextureData["header"]): header is EXRPartHeader {
  return typeof header === "object" && header !== null && "compression" in header && "channels" in header;
}

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

  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
  canvas.dataset.exposure = String(params.exposure);
  if (texture !== null && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}
