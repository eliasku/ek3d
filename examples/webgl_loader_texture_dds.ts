import { DDSLoader } from "ek3d/addons/loaders/DDSLoader";
import { Blending, Mapping, Side, TextureFilter, ColorSpace } from "ek3d/constants";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TorusGeometry } from "ek3d/geometries/TorusGeometry";
import type { Material } from "ek3d/materials/Material";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { Scene } from "ek3d/scenes/Scene";
import type { CompressedTexture } from "ek3d/textures/CompressedTexture";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing DDS loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const statusSel = document.querySelector<HTMLDivElement>("#status");
if (statusSel === null) throw new Error("Missing DDS loader example status element");
const status: HTMLDivElement = statusSel;

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 100);
camera.position.y = -2;
camera.position.z = 16;

const scene = new Scene();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const loader = new DDSLoader();
const geometry = new BoxGeometry(2, 2, 2);
const torus = new TorusGeometry();
const meshes: Mesh[] = [];
const textures: CompressedTexture[] = [];
const materials: Material[] = [];
const unsupported: string[] = [];
let disposed = false;
let failed = false;
let pending = 0;

// Compressed payloads need their driver extension; uncompressed RGBA DDS blocks do not.
const extensions: { has(name: string): boolean } = renderer.extensions;
const s3tcSrgb = extensions.has("WEBGL_compressed_texture_s3tc_srgb");
const bptc = extensions.has("EXT_texture_compression_bptc");

function reportError(error: unknown): void {
  pending = Math.max(0, pending - 1);
  if (disposed) return;
  failed = true;
  canvas.dataset.state = "error";
  const message = error instanceof Error ? error.message : String(error);
  canvas.dataset.error = message;
  status.textContent = message;
  status.hidden = false;
  console.error(error);
}

/**
 * Loads a DDS map when the driver supports its format. A missing extension or a failed load is
 * recorded instead of leaving a silently blank texture in the scene.
 */
function loadMap(url: string, supported: boolean, label: string, colorTexture: boolean): CompressedTexture | null {
  if (!supported) {
    unsupported.push(label);
    return null;
  }
  pending += 1;
  const texture = loader.load(
    url,
    (loaded) => {
      pending = Math.max(0, pending - 1);
      loaded.anisotropy = 4;
      if (colorTexture) loaded.colorSpace = ColorSpace.SRGB;
      if (!disposed) renderer.render(scene, camera);
    },
    undefined,
    reportError,
  );
  textures.push(texture);
  return texture;
}

/* Compressed cubemaps use the same sRGB S3TC extension as the 2D color maps. */
function loadCube(url: string, label: string, assign: (texture: CompressedTexture) => void): void {
  if (!s3tcSrgb) {
    unsupported.push(label);
    return;
  }
  pending += 1;
  const texture = loader.load(
    url,
    (loaded) => {
      pending = Math.max(0, pending - 1);
      loaded.magFilter = TextureFilter.Linear;
      loaded.minFilter = TextureFilter.Linear;
      loaded.mapping = Mapping.CubeReflection;
      loaded.colorSpace = ColorSpace.SRGB;
      assign(loaded);
      if (!disposed) renderer.render(scene, camera);
    },
    undefined,
    reportError,
  );
  textures.push(texture);
}

/*
This is how compressed textures are supposed to be used:

DXT1 - RGB - opaque textures
DXT3 - RGBA - transparent textures with sharp alpha transitions
DXT5 - RGBA - transparent textures with full alpha range
*/
const map1 = loadMap("/examples/textures/compressed/disturb_dxt1_nomip.dds", s3tcSrgb, "disturb_dxt1_nomip", true);
const map2 = loadMap("/examples/textures/compressed/disturb_dxt1_mip.dds", s3tcSrgb, "disturb_dxt1_mip", true);
const map3 = loadMap("/examples/textures/compressed/hepatica_dxt3_mip.dds", s3tcSrgb, "hepatica_dxt3_mip", true);
const map4 = loadMap("/examples/textures/compressed/explosion_dxt5_mip.dds", s3tcSrgb, "explosion_dxt5_mip", true);
const map5 = loadMap("/examples/textures/compressed/disturb_argb_nomip.dds", true, "disturb_argb_nomip", true);
const map6 = loadMap("/examples/textures/compressed/disturb_argb_mip.dds", true, "disturb_argb_mip", true);
const map7 = loadMap(
  "/examples/textures/compressed/disturb_dx10_bc6h_signed_nomip.dds",
  bptc,
  "disturb_dx10_bc6h_signed_nomip",
  false,
);
const map8 = loadMap(
  "/examples/textures/compressed/disturb_dx10_bc6h_signed_mip.dds",
  bptc,
  "disturb_dx10_bc6h_signed_mip",
  false,
);
const map9 = loadMap(
  "/examples/textures/compressed/disturb_dx10_bc6h_unsigned_nomip.dds",
  bptc,
  "disturb_dx10_bc6h_unsigned_nomip",
  false,
);
const map10 = loadMap(
  "/examples/textures/compressed/disturb_dx10_bc6h_unsigned_mip.dds",
  bptc,
  "disturb_dx10_bc6h_unsigned_mip",
  false,
);
const map11 = loadMap("/examples/textures/wave_normals_24bit_uncompressed.dds", true, "wave_normals_24bit", false);

// DDS levels without mipmaps cannot be filtered with a mipmap filter.
if (map1) map1.minFilter = map1.magFilter = TextureFilter.Linear;
if (map5) map5.minFilter = map5.magFilter = TextureFilter.Linear;

const material1 = new MeshBasicMaterial({ map: map1 });
const material2 = new MeshBasicMaterial({ map: map2 });
const material3 = new MeshBasicMaterial({ map: map3, alphaTest: 0.5, side: Side.Double });
const material4 = new MeshBasicMaterial({
  map: map4,
  side: Side.Double,
  blending: Blending.Additive,
  depthTest: false,
  transparent: true,
});
const material5 = new MeshBasicMaterial();
const material6 = new MeshBasicMaterial();
const material7 = new MeshBasicMaterial({ map: map5 });
const material8 = new MeshBasicMaterial({ map: map6 });
const material9 = new MeshBasicMaterial({ map: map7 });
const material10 = new MeshBasicMaterial({ map: map8 });
const material11 = new MeshBasicMaterial({ map: map9 });
const material12 = new MeshBasicMaterial({ map: map10 });
const material13 = new MeshBasicMaterial({ map: map11, transparent: true });
materials.push(material1, material2, material3, material4, material5, material6, material7);
materials.push(material8, material9, material10, material11, material12, material13);

loadCube("/examples/textures/compressed/Mountains.dds", "Mountains", (texture) => {
  material1.envMap = texture;
  material1.needsUpdate = true;
});
loadCube("/examples/textures/compressed/Mountains_argb_mip.dds", "Mountains_argb_mip", (texture) => {
  material5.envMap = texture;
  material5.needsUpdate = true;
});
loadCube("/examples/textures/compressed/Mountains_argb_nomip.dds", "Mountains_argb_nomip", (texture) => {
  material6.envMap = texture;
  material6.needsUpdate = true;
});

// Each slot keeps the upstream layout; a slot whose format is unavailable is reported, not drawn.
const slots: Array<[MeshBasicMaterial, number, number, "box" | "torus", boolean]> = [
  [material1, -10, -2, "torus", s3tcSrgb],
  [material2, -6, -2, "box", s3tcSrgb],
  [material3, -6, 2, "box", s3tcSrgb],
  [material4, -10, 2, "box", s3tcSrgb],
  [material5, -2, 2, "box", s3tcSrgb],
  [material6, -2, -2, "box", s3tcSrgb],
  [material7, 2, -2, "box", true],
  [material8, 2, 2, "box", true],
  [material9, 6, -2, "box", bptc],
  [material10, 6, 2, "box", bptc],
  [material11, 10, -2, "box", bptc],
  [material12, 10, 2, "box", bptc],
  [material13, -10, -6, "box", true],
];
for (const [material, x, y, kind, supported] of slots) {
  if (!supported) continue;
  const mesh = new Mesh(kind === "torus" ? torus : geometry, material);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  meshes.push(mesh);
}

canvas.dataset.formats = [
  map1 && "dxt1",
  map2 && "dxt1-mip",
  map3 && "dxt3",
  map4 && "dxt5",
  map5 && "argb",
  map6 && "argb-mip",
  map7 && "bc6h-signed",
  map8 && "bc6h-signed-mip",
  map9 && "bc6h-unsigned",
  map10 && "bc6h-unsigned-mip",
  map11 && "rgb24",
]
  .filter(Boolean)
  .join(",");
canvas.dataset.unsupported = unsupported.length === 0 ? "none" : unsupported.join(",");
canvas.dataset.state = "loading";
// Explain skipped slots instead of leaving the viewer with a partly empty scene.
if (unsupported.length > 0) {
  status.textContent = "Skipped compressed DDS maps this driver cannot upload: " + unsupported.join(", ") + ".";
  status.hidden = false;
}

let frames = 0;
renderer.setAnimationLoop(animate);

function animate(): void {
  const time = Date.now() * 0.001;
  for (const mesh of meshes) {
    mesh.rotation.x = time;
    mesh.rotation.y = time;
  }
  renderer.render(scene, camera);
  canvas.dataset.frames = String(++frames);
  if (!disposed && !failed) canvas.dataset.state = pending === 0 ? "rendered" : "loading";
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);
window.addEventListener(
  "pagehide",
  (event) => {
    if (event.persisted || disposed) return;
    disposed = true;
    window.removeEventListener("resize", onWindowResize);
    renderer.setAnimationLoop(null);
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    geometry.dispose();
    torus.dispose();
    renderer.dispose();
  },
  { once: true },
);
