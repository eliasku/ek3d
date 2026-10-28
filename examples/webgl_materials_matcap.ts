import { EXRLoader } from "ek3d/addons/loaders/EXRLoader";
import { GLTFLoader } from "ek3d/addons/loaders/GLTFLoader";
import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { ACESFilmicToneMapping, SRGBColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Color } from "ek3d/math/Color";
import { Mesh } from "ek3d/objects/Mesh";
import { MeshMatcapMaterial } from "ek3d/materials/MeshMatcapMaterial";
import { Texture } from "ek3d/textures/Texture";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { matcapShader } from "ek3d/renderers/shaders/MatcapShader";
import { Scene } from "ek3d/scenes/Scene";
import type { Group } from "ek3d/objects/Group";
import type { DataTexture } from "ek3d/textures/DataTexture";
import { loadZlibDecoder } from "./fflate";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing matcap example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const API = {
  color: 0xffffff, // sRGB
  exposure: 1.0,
};

let renderer: WebGLRenderer;
let scene: Scene;
let camera: PerspectiveCamera;
let controls: OrbitControls<PerspectiveCamera>;
let gui: GUI;
let mesh: Mesh<MeshMatcapMaterial> | null = null;
let loadedNormalMap: Texture | null = null;
let loadedMatcap: DataTexture | null = null;
let zlib: { unzlibSync(data: Uint8Array): Uint8Array } | null = null;
let disposed = false;

init().catch(onError);

function onError(error: unknown): void {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
}

async function init(): Promise<void> {
  // renderer
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    shaders: { MeshMatcapMaterial: matcapShader },
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // tone mapping
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = API.exposure;

  // scene
  scene = new Scene();

  // camera
  camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100);
  camera.position.set(0, 0, 13);

  // controls
  controls = new OrbitControls<PerspectiveCamera>(camera, canvas);
  controls.addEventListener("change", render);
  controls.enableZoom = false;
  controls.enablePan = false;

  // manager
  const manager = new LoadingManager(() => {
    if (disposed) return;
    canvas.dataset.loaded = "true";
    render();
  });

  // gui
  gui = new GUI();

  gui
    .addColor(API, "color")
    .listen()
    .onChange(function () {
      if (mesh === null) return;
      mesh.material.color.set(API.color);
      render();
    });

  gui.add(API, "exposure", 0, 2).onChange(function () {
    renderer.toneMappingExposure = API.exposure;
    render();
  });

  gui.domElement.style.webkitUserSelect = "none";
  canvas.dataset.gui = String(gui.controllers.length);

  // drag 'n drop
  initDragAndDrop();

  window.addEventListener("resize", onWindowResize);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      controls.dispose();
      gui.destroy();
      if (mesh !== null) {
        mesh.material.matcap?.dispose();
        mesh.material.normalMap?.dispose();
        mesh.material.dispose();
        mesh.geometry.dispose();
      }
      loadedNormalMap?.dispose();
      loadedMatcap?.dispose();
      renderer.dispose();
    },
    { once: true },
  );
  // matcap: 040full.exr is ZIP-compressed, so the shared zlib runtime is required.
  const runtime = await loadZlibDecoder();
  if (disposed) return;

  zlib = runtime;

  const loaderEXR = new EXRLoader(manager).setZlibDecoder(runtime);
  const matcap = loaderEXR.load("/examples/textures/matcaps/040full.exr", undefined, undefined, onError);
  loadedMatcap = matcap;

  // normalmap
  const loader = new TextureLoader(manager);
  loadedNormalMap = loader.load(
    "/examples/models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg",
    undefined,
    undefined,
    onError,
  );

  // model
  new GLTFLoader(manager).load(
    "/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb",
    function (gltf: { scene: Group }) {
      if (disposed) {
        gltf.scene.traverse((child) => {
          if (!(child instanceof Mesh)) return;
          child.geometry.dispose();
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
        });
        return;
      }

      const child = gltf.scene.children[0];
      if (!(child instanceof Mesh)) throw new Error("LeePerrySmith scene has no mesh");
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();

      // Upstream keeps the loaded child (and its skinning data) and swaps in a matcap material.
      mesh = child as Mesh<MeshMatcapMaterial>;
      mesh.material = new MeshMatcapMaterial({
        color: new Color().setHex(API.color),
        matcap: matcap,
        normalMap: loadedNormalMap,
      });
      mesh.position.y = -0.25;

      scene.add(mesh);

      canvas.dataset.model = "loaded";

      render();
    },
    undefined,
    onError,
  );

  render();
}

function onWindowResize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  render();
}

function render(): void {
  if (disposed) return;

  renderer.render(scene, camera);

  canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
  canvas.dataset.exposure = String(API.exposure);
  if (mesh !== null && canvas.dataset.state !== "error") canvas.dataset.state = "rendered";
}

//
// drag and drop anywhere in document
//

function updateMatcap(texture: Texture): void {
  if (disposed || mesh === null) {
    texture.dispose();
    return;
  }

  mesh.material.matcap?.dispose();

  mesh.material.matcap = texture;

  texture.needsUpdate = true;

  mesh.material.needsUpdate = true; // because the color space can change

  canvas.dataset.matcap = "updated";

  render();
}

function handleJPG(dataUrl: string): void {
  // PNG, WebP, AVIF, too
  const img = new Image();

  img.onload = function () {
    if (disposed) return;

    const texture = new Texture(img);

    texture.colorSpace = SRGBColorSpace;

    updateMatcap(texture);
  };

  img.src = dataUrl;
}

function handleEXR(buffer: ArrayBuffer): void {
  const loader = new EXRLoader();

  if (zlib !== null) loader.setZlibDecoder(zlib);

  updateMatcap(loader.createDataTexture(buffer));
}

function loadFile(file: File): void {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "exr") {
    const reader = new FileReader();

    reader.addEventListener("load", function (event) {
      if (disposed) return;
      const result = event.target?.result;
      if (!(result instanceof ArrayBuffer)) return;
      try {
        handleEXR(result);
      } catch (error) {
        canvas.dataset.error = error instanceof Error ? error.message : String(error);
        console.error(error);
      }
    });

    reader.readAsArrayBuffer(file);
  } else {
    // 'jpg', 'png'
    const reader = new FileReader();

    reader.addEventListener("load", function (event) {
      if (disposed) return;
      const result = event.target?.result;
      if (typeof result !== "string") return;
      handleJPG(result);
    });

    reader.readAsDataURL(file);
  }
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent): void {
  event.preventDefault();

  const file = event.dataTransfer?.files.item(0);
  if (file === null || file === undefined) return;

  canvas.dataset.dropped = file.name;
  loadFile(file);
}

function initDragAndDrop(): void {
  document.addEventListener("dragover", onDragOver);
  document.addEventListener("drop", onDrop);
}
