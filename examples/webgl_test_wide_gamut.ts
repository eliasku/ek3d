import { WebGL } from "ek3d/addons/capabilities/WebGL";
import {
  DisplayP3ColorSpace,
  DisplayP3ColorSpaceImpl,
  LinearDisplayP3ColorSpace,
  LinearDisplayP3ColorSpaceImpl,
} from "ek3d/addons/math/ColorSpaces";
import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { SRGBColorSpace } from "ek3d/constants";
import { contain } from "ek3d/extras/TextureUtils";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { ColorManagement } from "ek3d/math/ColorManagement";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import type { Texture } from "ek3d/textures/Texture";

const selected = document.querySelector<HTMLCanvasElement>("#scene");
const sliderSelected = document.querySelector<HTMLDivElement>("#slider");
if (!selected || !sliderSelected) throw new Error("Missing wide gamut example elements");
const canvas = selected;
const slider = sliderSelected;
const isP3Context = WebGL.isColorSpaceAvailable(DisplayP3ColorSpace);
const previousWorkingColorSpace = ColorManagement.workingColorSpace;
ColorManagement.define({
  [DisplayP3ColorSpace]: DisplayP3ColorSpaceImpl,
  [LinearDisplayP3ColorSpace]: LinearDisplayP3ColorSpaceImpl,
});
if (isP3Context) ColorManagement.workingColorSpace = LinearDisplayP3ColorSpace;
const sceneL = new Scene();
const sceneR = new Scene();
const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 6;
const renderer = new WebGLRenderer({ canvas, antialias: true, createBackground: WebGLBackground });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
const gamut = matchMedia("(color-gamut: p3)");
const loader = new TextureLoader();
let textureL: Texture | undefined;
let textureR: Texture | undefined;
let disposed = false;
let sliderPos = innerWidth / 2;
let pointerId: number | null = null;
let frames = 0;
canvas.dataset.state = "loading";
canvas.dataset.p3Context = String(isP3Context);
function updateGamut(): void {
  renderer.outputColorSpace = isP3Context && gamut.matches ? DisplayP3ColorSpace : SRGBColorSpace;
  if (textureL) textureL.needsUpdate = true;
  if (textureR) textureR.needsUpdate = true;
}
updateGamut();
async function loadTextures(): Promise<void> {
  try {
    const left = await loader.loadAsync("/examples/textures/wide_gamut/logo_srgb.png");
    if (disposed) {
      left.dispose();
      return;
    }
    textureL = left;
    left.colorSpace = SRGBColorSpace;
    const right = await loader.loadAsync("/examples/textures/wide_gamut/logo_p3.png");
    if (disposed) {
      right.dispose();
      return;
    }
    textureR = right;
    right.colorSpace = DisplayP3ColorSpace;
    sceneL.background = contain(left, innerWidth / innerHeight);
    sceneR.background = contain(right, innerWidth / innerHeight);
    canvas.dataset.loaded = "true";
  } catch (error) {
    if (disposed) return;
    canvas.dataset.state = "error";
    canvas.dataset.error = String(error);
    console.error(error);
  }
}
void loadTextures();
function updateSlider(offset: number): void {
  sliderPos = Math.max(10, Math.min(innerWidth - 10, offset));
  slider.style.left = `${sliderPos - slider.offsetWidth / 2}px`;
}
function pointerDown(event: PointerEvent): void {
  if (!event.isPrimary) return;
  pointerId = event.pointerId;
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);
}
function pointerMove(event: PointerEvent): void {
  if (event.pointerId === pointerId) updateSlider(event.clientX);
}
function pointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  window.removeEventListener("pointercancel", pointerUp);
}
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (textureL) contain(textureL, camera.aspect);
  if (textureR) contain(textureR, camera.aspect);
  updateSlider(sliderPos);
}
updateSlider(sliderPos);
slider.addEventListener("pointerdown", pointerDown);
window.addEventListener("resize", resize);
gamut.addEventListener("change", updateGamut);
renderer.setAnimationLoop(() => {
  renderer.setScissor(0, 0, sliderPos, innerHeight);
  renderer.render(sceneL, camera);
  renderer.setScissor(sliderPos, 0, innerWidth, innerHeight);
  renderer.render(sceneR, camera);
  canvas.dataset.frames = String(++frames);
  if (canvas.dataset.loaded) canvas.dataset.state = "rendered";
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted || disposed) return;
  disposed = true;
  renderer.setAnimationLoop(null);
  slider.removeEventListener("pointerdown", pointerDown);
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  window.removeEventListener("pointercancel", pointerUp);
  window.removeEventListener("resize", resize);
  gamut.removeEventListener("change", updateGamut);
  textureL?.dispose();
  textureR?.dispose();
  renderer.dispose();
  ColorManagement.workingColorSpace = previousWorkingColorSpace;
});
