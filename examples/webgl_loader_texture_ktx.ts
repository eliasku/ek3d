import { KTXLoader } from "ek3d/addons/loaders/KTXLoader";
import { Side, ColorSpace } from "ek3d/constants";
import { AmbientLight } from "ek3d/lights/AmbientLight";
import { PointLight } from "ek3d/lights/PointLight";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { createDFGLUT } from "ek3d/renderers/shaders/DFGLUTData";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Material } from "ek3d/materials/Material";
import { MeshStandardMaterial } from "ek3d/materials/MeshStandardMaterial";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { standardShader } from "ek3d/renderers/shaders/StandardShader";
import { Scene } from "ek3d/scenes/Scene";
import type { CompressedTexture } from "ek3d/textures/CompressedTexture";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";

const canvasSel = document.querySelector<HTMLCanvasElement>("#scene");
if (canvasSel === null) throw new Error("Missing KTX loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const statusSel = document.querySelector<HTMLDivElement>("#status");
if (statusSel === null) throw new Error("Missing KTX loader example status element");
const status: HTMLDivElement = statusSel;

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.z = 1000;

const scene = new Scene();
scene.add(new AmbientLight(0xffffff, 0.02));
const pointLight = new PointLight(0xffffff, 2, 0, 0);
pointLight.position.z = 300;
scene.add(pointLight);

// MeshStandardMaterial declares a dfgLUT uniform, so the renderer needs its lookup texture.
const dfgLUT = createDFGLUT();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  getDFGLUT: () => dfgLUT,
  shaders: { MeshBasicMaterial: basicShader, MeshStandardMaterial: standardShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const loader = new KTXLoader();
const geometry = new BoxGeometry(200, 200, 200);
const meshes: Mesh[] = [];
const materials: Material[] = [];
const textures: CompressedTexture[] = [];
let disposed = false;
let failed = false;
let pending = 0;

// Each container carries one GPU format. These are the extensions the renderer actually consults:
// WebGL 2 maps PixelFormat.RGB_ETC1 through WEBGL_compressed_texture_etc, not the WebGL 1 etc1 extension.
const extensions: { has(name: string): boolean } = renderer.extensions;
const formats = {
  astc: extensions.has("WEBGL_compressed_texture_astc"),
  etc: extensions.has("WEBGL_compressed_texture_etc"),
  pvrtc: extensions.has("WEBGL_compressed_texture_pvrtc"),
  rgtc: extensions.has("EXT_texture_compression_rgtc"),
  // sRGB S3TC uses a separate extension, so the color maps need both.
  s3tcSrgb: extensions.has("WEBGL_compressed_texture_s3tc") && extensions.has("WEBGL_compressed_texture_s3tc_srgb"),
};

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

function loadTexture(url: string, colorTexture: boolean): CompressedTexture {
  pending += 1;
  const texture = loader.load(
    url,
    (loaded) => {
      pending = Math.max(0, pending - 1);
      if (colorTexture) loaded.colorSpace = ColorSpace.SRGB;
      if (!disposed) renderer.render(scene, camera);
    },
    undefined,
    reportError,
  );
  textures.push(texture);
  return texture;
}

/*
This is how compressed textures are supposed to be used:

best for desktop:
BC1(DXT1) - opaque textures
BC3(DXT5) - transparent textures with full alpha range

best for iOS:
PVR2, PVR4 - opaque textures or alpha

best for Android:
ETC1 - opaque textures
ASTC_4x4, ASTC8x8 - transparent textures with full alpha range
*/
if (formats.pvrtc) {
  const material1 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/disturb_PVR2bpp.ktx", true),
  });
  const material2 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/lensflare_PVR4bpp.ktx", true),
    depthTest: false,
    transparent: true,
    side: Side.Double,
  });
  materials.push(material1, material2);
  meshes.push(new Mesh(geometry, material1), new Mesh(geometry, material2));
}

if (formats.s3tcSrgb) {
  const material1 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/disturb_BC1.ktx", true),
  });
  const material2 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/lensflare_BC3.ktx", true),
    depthTest: false,
    transparent: true,
    side: Side.Double,
  });
  materials.push(material1, material2);
  meshes.push(new Mesh(geometry, material1), new Mesh(geometry, material2));
}

if (formats.rgtc) {
  // BC5 is an RGTC2 linear normal map; sRGB does not apply.
  const material3 = new MeshStandardMaterial({
    normalMap: loadTexture("/examples/textures/compressed/normal.bc5.ktx", false),
  });
  materials.push(material3);
  meshes.push(new Mesh(geometry, material3));
}

if (formats.etc) {
  const material1 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/disturb_ETC1.ktx", true),
  });
  materials.push(material1);
  meshes.push(new Mesh(geometry, material1));

  // EAC RG11 is stored in the same ETC2 container extension as ETC1.
  const material2 = new MeshStandardMaterial({
    normalMap: loadTexture("/examples/textures/compressed/normal.eac_rg.ktx", false),
  });
  materials.push(material2);
  meshes.push(new Mesh(geometry, material2));
}

if (formats.astc) {
  const material1 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/disturb_ASTC4x4.ktx", true),
  });
  const material2 = new MeshBasicMaterial({
    map: loadTexture("/examples/textures/compressed/lensflare_ASTC8x8.ktx", true),
    depthTest: false,
    transparent: true,
    side: Side.Double,
  });
  materials.push(material1, material2);
  meshes.push(new Mesh(geometry, material1), new Mesh(geometry, material2));
}

let x0 = (-Math.min(4, meshes.length) * 300) / 2 + 150;
for (let i = 0; i < Math.min(4, meshes.length); ++i, x0 += 300) {
  const mesh = meshes[i];
  mesh.position.x = x0;
  mesh.position.y = 150;
  scene.add(mesh);
}

let x1 = (-(meshes.length - 4) * 300) / 2 + 150;
for (let i = 4; i < meshes.length; ++i, x1 += 300) {
  const mesh = meshes[i];
  mesh.position.x = x1;
  mesh.position.y = -150;
  scene.add(mesh);
}

canvas.dataset.formats = [
  formats.pvrtc && "pvrtc",
  formats.s3tcSrgb && "s3tc-srgb",
  formats.etc && "etc",
  formats.rgtc && "rgtc",
  formats.astc && "astc",
]
  .filter(Boolean)
  .join(",");
const missingFormats = Object.entries(formats)
  .filter(([, supported]) => !supported)
  .map(([name]) => name);
canvas.dataset.unsupported = missingFormats.join(",") || "none";
if (meshes.length === 0) {
  canvas.dataset.state = "unsupported";
  canvas.dataset.error = "No compressed texture format supported by this driver: " + missingFormats.join(",");
  status.textContent =
    "This driver supports none of the KTX formats in the sample set (" + missingFormats.join(", ") + ").";
  status.hidden = false;
} else if (missingFormats.length > 0) {
  // Partial capability: name the missing formats instead of silently dropping those maps.
  status.textContent = "Unsupported by this driver, maps skipped: " + missingFormats.join(", ") + ".";
  status.hidden = false;
}

canvas.dataset.state ??= "loading";
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
  // A driver without any of the listed extensions has nothing to draw, and that is not a success.
  if (!disposed && !failed) {
    canvas.dataset.state = meshes.length === 0 ? "unsupported" : pending === 0 ? "rendered" : "loading";
  }
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
    dfgLUT.dispose();
    renderer.dispose();
  },
  { once: true },
);
