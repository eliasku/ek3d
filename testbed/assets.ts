import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { FileLoader } from "ek3d/loaders/FileLoader";
import type { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Texture } from "ek3d/textures/Texture";
import { Wrapping, ColorSpace } from "ek3d/constants";

export class Assets {
  private canvas: HTMLCanvasElement;
  private material: MeshBasicMaterial;
  private redraw: () => void;
  private original: Texture | null;
  private texture: Texture | undefined;
  private disposed: boolean;
  private busy: boolean;
  private statusText: string;
  private manager: LoadingManager;

  constructor(canvas: HTMLCanvasElement, material: MeshBasicMaterial, redraw: () => void) {
    this.canvas = canvas;
    this.material = material;
    this.redraw = redraw;
    this.original = material.map;
    this.texture = undefined;
    this.disposed = false;
    this.busy = false;
    this.statusText = "1: local texture · 2: corrupt JSON · 3: missing resource";
    this.manager = new LoadingManager(
      this.completed.bind(this),
      this.progress.bind(this),
      this.managerError.bind(this),
    );
    this.failed = this.failed.bind(this);
    this.load = this.load.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  private completed() {
    this.busy = false;
    this.canvas.dataset.assetComplete = "true";
    if (!this.disposed) this.redraw.call(undefined);
  }

  private progress(_url: string, loaded: number, total: number) {
    this.canvas.dataset.assetProgress = `${loaded}/${total}`;
  }

  private managerError() {
    this.canvas.dataset.assetManagerError = "true";
  }

  private failed(error: unknown) {
    if (this.disposed) return;
    this.statusText = `Asset error: ${error instanceof Error ? error.message : String(error)}`;
    this.canvas.dataset.assetState = "error";
    this.redraw.call(undefined);
  }

  private loaded(texture: Texture) {
    if (this.disposed) return;
    texture.colorSpace = ColorSpace.SRGB;
    texture.wrapS = texture.wrapT = Wrapping.Repeat;
    texture.repeat.set(3, 3);
    this.material.map = texture;
    this.material.needsUpdate = true;
    this.canvas.dataset.assetState = "loaded";
    this.statusText = "Local PNG loaded · 1: restore original";
    this.redraw.call(undefined);
  }

  private textureFailed(error: unknown) {
    this.texture?.dispose();
    this.texture = undefined;
    this.failed(error);
  }

  private unexpectedSuccess() {
    this.failed(new Error("Expected invalid asset to fail"));
  }

  private bytes(event: ProgressEvent) {
    this.canvas.dataset.assetBytes = String(event.loaded);
  }

  get status() {
    return this.statusText;
  }

  load(mode: "texture" | "corrupt" | "missing") {
    if (this.disposed || this.busy) return;
    if (mode === "texture" && this.texture) {
      this.material.map = this.material.map === this.texture ? this.original : this.texture;
      this.material.needsUpdate = true;
      this.canvas.dataset.assetState = this.material.map === this.texture ? "loaded" : "original";
      this.statusText =
        this.material.map === this.texture
          ? "Local PNG loaded · 1: restore original"
          : "Original texture · 1: local PNG";
      this.redraw.call(undefined);
      return;
    }
    this.busy = true;
    this.canvas.dataset.assetState = "loading";
    this.canvas.dataset.assetComplete = "false";
    this.canvas.dataset.assetManagerError = "false";
    this.canvas.dataset.assetBytes = "0";
    this.statusText = `Loading ${mode} asset…`;
    if (mode === "texture") {
      this.texture = new TextureLoader(this.manager).load(
        new URL("./assets/tile.png", import.meta.url).href,
        this.loaded.bind(this),
        undefined,
        this.textureFailed.bind(this),
      );
    } else {
      const url =
        mode === "corrupt"
          ? new URL("./assets/broken.txt", import.meta.url).href
          : new URL("not-found.json", window.location.href).href;
      new FileLoader(this.manager)
        .setRequestHeader({ Accept: "application/json" })
        .setResponseType("json")
        .load(url, this.unexpectedSuccess.bind(this), this.bytes.bind(this), this.failed);
    }
    this.redraw.call(undefined);
  }

  dispose() {
    this.disposed = true;
    this.manager.abort();
    this.manager.cache.clear();
    this.material.map = this.original;
    this.texture?.dispose();
    this.canvas.dataset.assetState = "disposed";
  }
}
