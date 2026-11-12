import { PerspectiveCamera } from "ek3d/cameras/PerspectiveCamera";
import { Wrapping, ColorSpace } from "ek3d/constants";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import { WebGLRenderer } from "ek3d/renderers/WebGLRenderer";
import { basicShader } from "ek3d/renderers/shaders/BasicShader";
import { WebGLBackground } from "ek3d/renderers/webgl/WebGLBackground";
import { Scene } from "ek3d/scenes/Scene";
import { CanvasTexture } from "ek3d/textures/CanvasTexture";
import type { Texture } from "ek3d/textures/Texture";
import { disposeObject } from "./dispose-object";

export class BlendingScene {
  scene: Scene;
  private renderScene: Scene;
  private canvas: HTMLCanvasElement;
  private camera: PerspectiveCamera;
  private background: CanvasTexture;
  private renderer: WebGLRenderer;
  private loader: TextureLoader;
  private pending: number;
  private failed: boolean;
  private disposed: boolean;
  private frames: number;

  constructor(fov: number, z: number) {
    const selected = document.querySelector<HTMLCanvasElement>("#scene");
    if (!selected) throw new Error("Missing blending canvas");
    this.canvas = selected;
    this.camera = new PerspectiveCamera(fov, innerWidth / innerHeight, 1, 1000);
    this.camera.position.z = z;
    this.renderScene = new Scene();
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
    this.background = new CanvasTexture(backgroundCanvas);
    this.background.colorSpace = ColorSpace.SRGB;
    this.background.wrapS = this.background.wrapT = Wrapping.Repeat;
    this.background.repeat.set(64, 32);
    this.renderScene.background = this.background;
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      preserveDrawingBuffer: true,
      createBackground: WebGLBackground,
      shaders: { MeshBasicMaterial: basicShader },
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.loader = new TextureLoader();
    this.pending = 0;
    this.failed = false;
    this.disposed = false;
    this.frames = 0;
    this.canvas.dataset.state = "loading";
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.renderer.setAnimationLoop(this.animate.bind(this));
    this.scene = this.renderScene;
    this.load = this.load.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  private loaded(texture: Texture) {
    if (this.disposed) {
      texture.dispose();
      return;
    }
    this.pending--;
  }

  private loadFailed(error: unknown) {
    if (this.disposed) return;
    this.failed = true;
    this.canvas.dataset.state = "error";
    this.canvas.dataset.error = String(error);
    console.error(error);
  }

  load(path: string) {
    this.pending++;
    const texture = this.loader.load(
      `/examples/textures/${path}`,
      this.loaded.bind(this),
      undefined,
      this.loadFailed.bind(this),
    );
    texture.colorSpace = ColorSpace.SRGB;
    return texture;
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private animate() {
    const time = Date.now() * 0.00025;
    this.background.offset.set(
      (time * -0.01 * this.background.repeat.x) % 1,
      (time * -0.01 * this.background.repeat.y) % 1,
    );
    this.renderer.render(this.renderScene, this.camera);
    this.canvas.dataset.frames = String(++this.frames);
    if (!this.failed && this.pending === 0) this.canvas.dataset.state = "rendered";
  }

  private pagehide(extra: (() => void) | undefined, event: PageTransitionEvent) {
    if (event.persisted || this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.resize);
    this.renderer.setAnimationLoop(null);
    extra?.();
    disposeObject(this.renderScene);
    this.background.dispose();
    this.renderer.dispose();
  }

  cleanup(extra?: () => void) {
    window.addEventListener("pagehide", this.pagehide.bind(this, extra));
  }
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
