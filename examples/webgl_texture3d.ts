import { OrbitControls } from "ek3d/addons/controls/OrbitControls";
import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import { NRRDLoader } from "ek3d/addons/loaders/NRRDLoader";
import { VolumeRenderShader1 } from "ek3d/addons/shaders/VolumeShader";
import { OrthographicCamera } from "ek3d/cameras/OrthographicCamera";
import { BackSide, FloatType, LinearFilter, RedFormat } from "ek3d/constants";
import { BoxGeometry } from "ek3d/geometries/BoxGeometry";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ShaderMaterial } from "ek3d/materials/ShaderMaterial";
import { Vector2 } from "ek3d/math/Vector2";
import { Vector3 } from "ek3d/math/Vector3";
import { Mesh } from "ek3d/objects/Mesh";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { Scene } from "ek3d/scenes/Scene";
import { Data3DTexture } from "ek3d/textures/Data3DTexture";
import type { Texture } from "ek3d/textures/Texture";
import { loadZipRuntime } from "./zip-runtime";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
if (!selected) throw new Error("Missing volume canvas");
const canvas: HTMLCanvasElement = selected;
const renderer = new WebGLRenderer({ canvas, shaders: {} });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
const scene = new Scene(),
  aspect = innerWidth / innerHeight;
const camera = new OrthographicCamera(-256 * aspect, 256 * aspect, 256, -256, 1, 1000);
camera.position.set(-64, -64, 128);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.target.set(64, 64, 128);
controls.minZoom = 0.5;
controls.maxZoom = 4;
controls.enablePan = false;
controls.update();
const gui = new GUI(),
  config = { clim1: 0, clim2: 1, renderstyle: "iso", isothreshold: 0.15, colormap: "viridis" };
const uniforms = {
  u_size: { value: new Vector3(1, 1, 1) },
  u_renderstyle: { value: 1 },
  u_renderthreshold: { value: 0.15 },
  u_clim: { value: new Vector2(0, 1) },
  u_data: { value: null as Texture | null },
  u_cmdata: { value: null as Texture | null },
};
const maps: { gray: Texture | null; viridis: Texture | null } = { gray: null, viridis: null };
let disposed = false,
  texture: Data3DTexture | null = null,
  geometry: BoxGeometry | null = null,
  material: ShaderMaterial | null = null;
function render(): void {
  if (!disposed) renderer.render(scene, camera);
}
function update(): void {
  uniforms.u_clim.value.set(config.clim1, config.clim2);
  uniforms.u_renderstyle.value = config.renderstyle === "mip" ? 0 : 1;
  uniforms.u_renderthreshold.value = config.isothreshold;
  uniforms.u_cmdata.value = config.colormap === "gray" ? maps.gray : maps.viridis;
  render();
}
gui.add(config, "clim1", 0, 1, 0.01).onChange(update);
gui.add(config, "clim2", 0, 1, 0.01).onChange(update);
gui.add(config, "colormap", { gray: "gray", viridis: "viridis" }).onChange(update);
gui.add(config, "renderstyle", { mip: "mip", iso: "iso" }).onChange(update);
gui.add(config, "isothreshold", 0, 1, 0.01).onChange(update);
controls.addEventListener("change", render);
async function init(): Promise<void> {
  try {
    const runtime: unknown = await loadZipRuntime();
    if (
      typeof runtime !== "object" ||
      runtime === null ||
      !("gunzipSync" in runtime) ||
      typeof runtime.gunzipSync !== "function"
    )
      throw new Error("fflate runtime lacks gunzipSync");
    if (disposed) return;
    const loader = new NRRDLoader(undefined, runtime as { gunzipSync(data: Uint8Array): Uint8Array });
    const volume = await loader.loadAsync("/examples/models/nrrd/stent.nrrd");
    if (disposed) return;
    texture = new Data3DTexture(volume.data, volume.xLength, volume.yLength, volume.zLength);
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const imageLoader = new TextureLoader();
    const viridis = await imageLoader.loadAsync("/examples/textures/cm_viridis.png");
    if (disposed) {
      viridis.dispose();
      return;
    }
    maps.viridis = viridis;
    const gray = await imageLoader.loadAsync("/examples/textures/cm_gray.png");
    if (disposed) {
      gray.dispose();
      return;
    }
    maps.gray = gray;
    uniforms.u_data.value = texture;
    uniforms.u_size.value.set(volume.xLength, volume.yLength, volume.zLength);
    material = new ShaderMaterial({
      uniforms,
      vertexShader: VolumeRenderShader1.vertexShader,
      fragmentShader: VolumeRenderShader1.fragmentShader,
      side: BackSide,
    });
    geometry = new BoxGeometry(volume.xLength, volume.yLength, volume.zLength);
    geometry.translate(volume.xLength / 2 - 0.5, volume.yLength / 2 - 0.5, volume.zLength / 2 - 0.5);
    scene.add(new Mesh(geometry, material));
    update();
  } catch (error) {
    if (!disposed) {
      canvas.dataset.state = "error";
      console.error(error);
    }
  }
}
void init();
function resize(): void {
  const aspect = innerWidth / innerHeight;
  camera.left = -256 * aspect;
  camera.right = 256 * aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
}
window.addEventListener("resize", resize);
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  window.removeEventListener("resize", resize);
  controls.removeEventListener("change", render);
  controls.dispose();
  gui.destroy();
  texture?.dispose();
  maps.gray?.dispose();
  maps.viridis?.dispose();
  geometry?.dispose();
  material?.dispose();
  renderer.dispose();
});
