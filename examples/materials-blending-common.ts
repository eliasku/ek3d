import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping, ColorSpace } from "ek3d/constants";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import { disposeObject } from "./dispose-object";

export function blendingScene(fov: number, z: number) {
  const selected = document.querySelector<HTMLCanvasElement>("#scene");
  if (!selected) throw new Error("Missing blending canvas");
  const canvas: HTMLCanvasElement = selected;
  const camera = new PerspectiveCamera(fov, innerWidth / innerHeight, 1, 1000);
  camera.position.z = z;
  const scene = new Scene();
  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = backgroundCanvas.height = 128;
  const ctx = backgroundCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#ddd";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#999";
  ctx.fillRect(32, 32, 32, 32);
  ctx.fillStyle = "#555";
  ctx.fillRect(64, 64, 64, 64);
  ctx.fillStyle = "#777";
  ctx.fillRect(96, 96, 32, 32);
  const background = new CanvasTexture(backgroundCanvas);
  background.colorSpace = ColorSpace.SRGB;
  background.wrapS = background.wrapT = Wrapping.Repeat;
  background.repeat.set(64, 32);
  scene.background = background;
  const renderer = new WebGLRenderer({
    canvas,
    preserveDrawingBuffer: true,
    createBackground: WebGLBackground,
    shaders: { MeshBasicMaterial: basicShader },
  });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  const loader = new TextureLoader();
  let pending = 0;
  let failed = false;
  let disposed = false;
  let frames = 0;
  canvas.dataset.state = "loading";
  function load(path: string) {
    pending++;
    const texture = loader.load(
      `/examples/textures/${path}`,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        pending--;
      },
      undefined,
      (error) => {
        if (disposed) return;
        failed = true;
        canvas.dataset.state = "error";
        canvas.dataset.error = String(error);
        console.error(error);
      },
    );
    texture.colorSpace = ColorSpace.SRGB;
    return texture;
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", resize);
  renderer.setAnimationLoop(() => {
    const time = Date.now() * 0.00025;
    background.offset.set((time * -0.01 * background.repeat.x) % 1, (time * -0.01 * background.repeat.y) % 1);
    renderer.render(scene, camera);
    canvas.dataset.frames = String(++frames);
    if (!failed && pending === 0) canvas.dataset.state = "rendered";
  });
  function cleanup(extra?: () => void) {
    window.addEventListener("pagehide", (event) => {
      if (event.persisted || disposed) return;
      disposed = true;
      window.removeEventListener("resize", resize);
      renderer.setAnimationLoop(null);
      extra?.();
      disposeObject(scene);
      background.dispose();
      renderer.dispose();
    });
  }
  return { scene, load, cleanup };
}

export function labelMaterial(text: string, background: string, custom = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = "white";
  ctx.font = custom ? "bold 11pt arial" : "bold 12pt arial";
  ctx.fillText(text, custom ? 8 : 10, 22);
  const map = new CanvasTexture(canvas);
  map.colorSpace = ColorSpace.SRGB;
  return new MeshBasicMaterial({ map, transparent: true });
}
