import { PVRLoader } from "ek3d/addons/loaders/PVRLoader";
import { CubeReflectionMapping, DoubleSide, LinearFilter, SRGBColorSpace } from "ek3d/constants";
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
if (canvasSel === null) throw new Error("Missing PVR loader example canvas");
const canvas: HTMLCanvasElement = canvasSel;
const statusSel = document.querySelector<HTMLDivElement>("#status");
if (statusSel === null) throw new Error("Missing PVR loader example status element");
const status: HTMLDivElement = statusSel;

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
camera.position.z = 1000;

const scene = new Scene();
const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
  shaders: { MeshBasicMaterial: basicShader },
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const geometry = new BoxGeometry(200, 200, 200);
const torus = new TorusGeometry(100, 50, 32, 24);
const meshes: Mesh[] = [];
const materials: Material[] = [];
const textures: CompressedTexture[] = [];
let disposed = false;
let failed = false;
let pending = 0;

// PVRTC is an iOS GPU format; desktop drivers normally reject it.
const extensions: { has(name: string): boolean } = renderer.extensions;
const pvrtc = extensions.has("WEBGL_compressed_texture_pvrtc");

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

const loader = new PVRLoader();

function loadTexture(url: string, configure?: (texture: CompressedTexture) => void): CompressedTexture | null {
  if (!pvrtc) return null;
  pending += 1;
  const texture = loader.load(
    url,
    (loaded) => {
      pending = Math.max(0, pending - 1);
      if (configure) configure(loaded);
      if (!disposed) renderer.render(scene, camera);
    },
    undefined,
    reportError,
  );
  textures.push(texture);
  return texture;
}

function loadCube(url: string, assign: (texture: CompressedTexture) => void): void {
  if (!pvrtc) return;
  loadTexture(url, (texture) => {
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.mapping = CubeReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    assign(texture);
  });
}

if (pvrtc) {
  const disturb_4bpp_rgb = loadTexture("/examples/textures/compressed/disturb_4bpp_rgb.pvr");
  const disturb_4bpp_rgb_v3 = loadTexture("/examples/textures/compressed/disturb_4bpp_rgb_v3.pvr");
  const disturb_4bpp_rgb_mips = loadTexture("/examples/textures/compressed/disturb_4bpp_rgb_mips.pvr");
  const disturb_2bpp_rgb = loadTexture("/examples/textures/compressed/disturb_2bpp_rgb.pvr");
  const flare_4bpp_rgba = loadTexture("/examples/textures/compressed/flare_4bpp_rgba.pvr");
  const flare_2bpp_rgba = loadTexture("/examples/textures/compressed/flare_2bpp_rgba.pvr");

  // Levels without mipmaps cannot use a mipmap filter.
  for (const texture of [disturb_2bpp_rgb, disturb_4bpp_rgb, disturb_4bpp_rgb_v3, flare_4bpp_rgba, flare_2bpp_rgba]) {
    if (!texture) continue;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;
  }

  const material1 = new MeshBasicMaterial({ map: disturb_4bpp_rgb });
  const material2 = new MeshBasicMaterial({ map: disturb_4bpp_rgb_mips });
  const material3 = new MeshBasicMaterial({ map: disturb_2bpp_rgb });
  const material4 = new MeshBasicMaterial({
    map: flare_4bpp_rgba,
    side: DoubleSide,
    depthTest: false,
    transparent: true,
  });
  const material5 = new MeshBasicMaterial({
    map: flare_2bpp_rgba,
    side: DoubleSide,
    depthTest: false,
    transparent: true,
  });
  const material6 = new MeshBasicMaterial();
  const material7 = new MeshBasicMaterial({ map: disturb_4bpp_rgb_v3 });
  const material8 = new MeshBasicMaterial();
  materials.push(material1, material2, material3, material4, material5, material6, material7, material8);

  loadCube("/examples/textures/compressed/park3_cube_nomip_4bpp_rgb.pvr", (texture) => {
    material6.envMap = texture;
    material6.needsUpdate = true;
  });
  loadCube("/examples/textures/compressed/park3_cube_mip_2bpp_rgb_v3.pvr", (texture) => {
    material8.envMap = texture;
    material8.needsUpdate = true;
  });

  addMesh(material1, -500, 200, geometry);
  addMesh(material2, -166, 200, geometry);
  addMesh(material3, 166, 200, geometry);
  addMesh(material7, 500, 200, geometry);
  addMesh(material4, -500, -200, geometry);
  addMesh(material5, -166, -200, geometry);
  addMesh(material6, 166, -200, torus);
  addMesh(material8, 500, -200, torus);
}

function addMesh(material: MeshBasicMaterial, x: number, y: number, meshGeometry: BoxGeometry | TorusGeometry) {
  const mesh = new Mesh(meshGeometry, material);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  meshes.push(mesh);
}

canvas.dataset.formats = pvrtc ? "pvrtc" : "";
canvas.dataset.unsupported = pvrtc ? "none" : "pvrtc";
if (!pvrtc) {
  canvas.dataset.state = "unsupported";
  canvas.dataset.error = "WEBGL_compressed_texture_pvrtc is not available on this driver.";
  // PVRTC is an iOS-era format; desktop drivers have nothing to draw here.
  status.textContent =
    "WEBGL_compressed_texture_pvrtc is unavailable, so these PVRTC textures cannot be uploaded on this driver.";
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
  // Without the extension there is nothing to draw; report that instead of a fake scene.
  if (!disposed && !failed) {
    canvas.dataset.state = !pvrtc ? "unsupported" : pending === 0 ? "rendered" : "loading";
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
    torus.dispose();
    renderer.dispose();
  },
  { once: true },
);
