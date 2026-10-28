import { KTX2Loader } from "ek3d/addons/loaders/KTX2Loader";
import type { Texture } from "ek3d/textures/Texture";
import {
  RED_GREEN_RGTC2_Format,
  RED_RGTC1_Format,
  RGBA_ASTC_4x4_Format,
  RGBA_BPTC_Format,
  RGBA_ETC2_EAC_Format,
  RGBA_PVRTC_4BPPV1_Format,
  RGBA_S3TC_DXT1_Format,
  RGBA_S3TC_DXT5_Format,
  RGB_BPTC_UNSIGNED_Format,
  RGB_ETC1_Format,
  RGB_ETC2_Format,
  RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format,
  SRGBTransfer,
} from "ek3d/constants";
import { ColorManagement } from "ek3d/math/ColorManagement";
import { BufferAttribute } from "ek3d/core/BufferAttribute";
import type { BufferGeometry } from "ek3d/core/BufferGeometry";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { PlaneGeometry } from "ek3d/geometries/PlaneGeometry";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { CompressedTexture } from "ek3d/textures/CompressedTexture";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import { loadZstdDecoder } from "./zstd";

interface SceneUserData {
  element: HTMLDivElement;
  camera: PerspectiveCamera;
}

interface Section {
  title: string;
  description: string;
  textures: string[];
}

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing KTX2 texture loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;

const contentSel = document.querySelector<HTMLDivElement>("#content");
if (contentSel === null) throw new Error("Missing KTX2 texture loader example content");
const content: HTMLDivElement = contentSel;

const scenes: Scene[] = [];

const sections: Section[] = [
  {
    title: "Uncompressed",
    description:
      "Uncompressed formats (rgba8, rgba16, rgba32) load as DataTexture objects." +
      " Lossless, easy to read/write, uncompressed on GPU, optionally compressed over the network.",
    textures: [
      "2d_rgba8.ktx2",
      "2d_rgba8_linear.ktx2",
      "2d_rgba16_linear.ktx2",
      "2d_rgba16unorm_linear.ktx2",
      "2d_rgba32_linear.ktx2",
      "2d_rgb9e5_linear.ktx2",
      "2d_r11g11b10_linear.ktx2",
    ],
  },
  {
    title: "Compressed",
    description:
      "Compressed formats (ASTC, BCn, ...) load as CompressedTexture objects," +
      " reducing memory cost. Requires native support on the device GPU: no single compressed" +
      " format is supported on every device.",
    textures: [
      "2d_astc4x4.ktx2",
      "2d_etc1.ktx2",
      "2d_etc2.ktx2",
      "2d_bc1.ktx2",
      "2d_bc3.ktx2",
      "2d_bc4.ktx2",
      "2d_bc5.ktx2",
      "2d_bc7.ktx2",
    ],
  },
  {
    title: "Universal",
    description:
      "Basis Universal textures are specialized intermediate formats supporting fast" +
      " runtime transcoding into other GPU texture compression formats. After transcoding," +
      " universal textures can be used on any device at reduced memory cost.",
    textures: ["2d_etc1s.ktx2", "2d_uastc.ktx2", "2d_uastc_hdr4x4.ktx2"],
  },
];

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setClearColor(0xffffff, 1);
renderer.setPixelRatio(window.devicePixelRatio);
updateSize();

let disposed = false;
let frames = 0;
let loader: KTX2Loader | null = null;
let plane: BufferGeometry | null = null;
const unsupported: string[] = [];

init().catch(function (error: unknown) {
  if (disposed) return;
  canvas.dataset.state = "error";
  canvas.dataset.error = error instanceof Error ? error.message : String(error);
  console.error(error);
});

async function init(): Promise<void> {
  // 2d_uastc_hdr4x4.ktx2 uses KHR_SUPERCOMPRESSION_ZSTD; upstream supplies zstddec.
  const zstdDecoder = await loadZstdDecoder();
  if (disposed) return;
  if (zstdDecoder.init !== undefined) await zstdDecoder.init();
  if (disposed) return;

  const ktx2Loader = new KTX2Loader().setPath("/examples/textures/ktx2/").detectSupport(renderer);
  ktx2Loader.setZSTDDecoder(zstdDecoder);
  loader = ktx2Loader;

  const geometry = flipY(new PlaneGeometry(1, 1));
  plane = geometry;

  for (const section of sections) {
    const sectionElement = document.createElement("div");
    sectionElement.className = "section";

    const sectionHeader = document.createElement("div");
    sectionHeader.className = "section-title";
    sectionHeader.textContent = section.title;
    sectionElement.appendChild(sectionHeader);

    const sectionDescription = document.createElement("div");
    sectionDescription.className = "description";
    sectionDescription.textContent = section.description;
    sectionElement.appendChild(sectionDescription);

    for (const path of section.textures) {
      const scene = new Scene();

      // make a list item
      const element = document.createElement("div");
      element.className = "list-item";

      const sceneElement = document.createElement("div");
      element.appendChild(sceneElement);

      const labelElement = document.createElement("div");
      labelElement.innerText = "file: " + path;
      element.appendChild(labelElement);

      // the element that represents the area we want to render the scene
      const userData: SceneUserData = scene.userData;
      userData.element = sceneElement;
      sectionElement.appendChild(element);

      const camera = new PerspectiveCamera(50, 1, 1, 10);
      camera.position.z = 2;
      userData.camera = camera;

      if (disposed) return;

      try {
        const texture = await ktx2Loader.loadAsync(path);
        if (disposed) {
          texture.dispose();
          return;
        }

        const requirement = requiredExtension(texture);
        if (requirement !== null && !renderer.extensions.has(requirement)) {
          texture.dispose();
          labelElement.innerText += "\nunsupported: " + requirement;
          element.dataset.state = "unsupported";
          element.dataset.extension = requirement;
          unsupported.push(path);
          continue;
        }

        const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture }));

        labelElement.innerText += "\ncolorSpace: " + texture.colorSpace;

        scene.add(mesh);
        scenes.push(scene);
        element.dataset.state = "loaded";
      } catch (error) {
        // Unsupported GPU formats (ASTC/ETC/BC*) surface as load failures; keep them visible.
        element.dataset.state = "error";
        element.dataset.error = error instanceof Error ? error.message : String(error);
        unsupported.push(path);
        console.error(`Failed to load ${path}`, error);
      }
    }

    content.appendChild(sectionElement);
  }

  if (disposed) return;

  canvas.dataset.supported = String(scenes.length);
  canvas.dataset.unsupported = unsupported.join(",");

  if (scenes.length === 0) {
    canvas.dataset.state = "error";
    canvas.dataset.error = "No KTX2 texture could be displayed on this device";
  }

  renderer.setAnimationLoop(animate);
}

function updateSize(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;

  const ratio = renderer.getPixelRatio();

  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    renderer.setSize(width, height, false);
  }
}

/** Rewrite UVs for `flipY=false` textures. */
function flipY(geometry: BufferGeometry): BufferGeometry {
  const uv = geometry.getAttribute("uv");
  if (!(uv instanceof BufferAttribute)) throw new Error("PlaneGeometry is missing a float UV attribute");

  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1 - uv.getY(i));
  }

  return geometry;
}

/** WebGL extension a compressed KTX2 texture needs; null when the upload itself reports the problem. */
function requiredExtension(texture: Texture): string | null {
  if (!(texture instanceof CompressedTexture)) return null;

  // Mirrors WebGLUtils' extension choice: sRGB S3TC data needs the separate sRGB extension.
  const srgb = ColorManagement.getTransfer(texture.colorSpace) === SRGBTransfer;

  switch (texture.format) {
    case RGB_S3TC_DXT1_Format:
    case RGBA_S3TC_DXT1_Format:
    case RGBA_S3TC_DXT5_Format:
      return srgb ? "WEBGL_compressed_texture_s3tc_srgb" : "WEBGL_compressed_texture_s3tc";
    case RGB_ETC1_Format:
      return "WEBGL_compressed_texture_etc1";
    case RGB_ETC2_Format:
    case RGBA_ETC2_EAC_Format:
      return "WEBGL_compressed_texture_etc";
    case RGBA_ASTC_4x4_Format:
      return "WEBGL_compressed_texture_astc";
    case RGBA_BPTC_Format:
    case RGB_BPTC_UNSIGNED_Format: // UASTC HDR transcoded to BC6H
      return "EXT_texture_compression_bptc";
    case RED_RGTC1_Format:
    case RED_GREEN_RGTC2_Format:
      return "EXT_texture_compression_rgtc";
    case RGB_PVRTC_4BPPV1_Format:
    case RGBA_PVRTC_4BPPV1_Format:
      return "WEBGL_compressed_texture_pvrtc";
    default:
      return null;
  }
}

function animate(): void {
  if (disposed) return;

  updateSize();

  canvas.style.transform = `translateY(${window.scrollY}px)`;

  renderer.setClearColor(0xffffff);
  renderer.setScissorTest(false);
  renderer.clear();

  renderer.setClearColor(0xe0e0e0);
  renderer.setScissorTest(true);

  for (const scene of scenes) {
    const userData: SceneUserData = scene.userData;

    // get the element that is a place holder for where we want to
    // draw the scene
    const element = userData.element;

    // get its position relative to the page's viewport
    const rect = element.getBoundingClientRect();

    // check if it's offscreen. If so skip it
    if (rect.bottom < 0 || rect.top > canvas.clientHeight || rect.right < 0 || rect.left > canvas.clientWidth) {
      continue; // it's off screen
    }

    // set the viewport
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    const left = rect.left;
    const bottom = canvas.clientHeight - rect.bottom;

    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);

    renderer.render(scene, userData.camera);
  }

  canvas.dataset.frames = String(++frames);
  if (scenes.length > 0) canvas.dataset.state = "rendered";
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);

  for (const scene of scenes) {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;

      const { material } = child;
      if (!(material instanceof MeshBasicMaterial)) return;
      material.map?.dispose();
      material.dispose();
    });
  }

  plane?.dispose();
  loader?.dispose();
  renderer.dispose();
});
