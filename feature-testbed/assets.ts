import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { FileLoader } from "ek3d/loaders/FileLoader";
import type { MeshBasicMaterial } from "ek3d/materials/MeshBasicMaterial";
import type { Texture } from "ek3d/textures/Texture";
import { RepeatWrapping, SRGBColorSpace } from "ek3d/constants";

export function createAssets(canvas: HTMLCanvasElement, material: MeshBasicMaterial, redraw: () => void) {
  const original = material.map;
  let texture: Texture | undefined;
  let disposed = false;
  let busy = false;
  let status = "1: local texture · 2: corrupt JSON · 3: missing resource";
  const manager = new LoadingManager(
    () => {
      busy = false;
      canvas.dataset.assetComplete = "true";
      if (!disposed) redraw();
    },
    (_url, loaded, total) => {
      canvas.dataset.assetProgress = `${loaded}/${total}`;
    },
    () => {
      canvas.dataset.assetManagerError = "true";
    },
  );
  function failed(error: unknown) {
    if (disposed) return;
    status = `Asset error: ${error instanceof Error ? error.message : String(error)}`;
    canvas.dataset.assetState = "error";
    redraw();
  }
  return {
    get status() {
      return status;
    },
    load(mode: "texture" | "corrupt" | "missing") {
      if (disposed || busy) return;
      if (mode === "texture" && texture) {
        material.map = material.map === texture ? original : texture;
        material.needsUpdate = true;
        canvas.dataset.assetState = material.map === texture ? "loaded" : "original";
        status =
          material.map === texture ? "Local PNG loaded · 1: restore original" : "Original texture · 1: local PNG";
        redraw();
        return;
      }
      busy = true;
      canvas.dataset.assetState = "loading";
      canvas.dataset.assetComplete = "false";
      canvas.dataset.assetManagerError = "false";
      canvas.dataset.assetBytes = "0";
      status = `Loading ${mode} asset…`;
      if (mode === "texture") {
        texture = new TextureLoader(manager).load(
          new URL("./assets/tile.png", import.meta.url).href,
          (loaded) => {
            if (disposed) return;
            loaded.colorSpace = SRGBColorSpace;
            loaded.wrapS = loaded.wrapT = RepeatWrapping;
            loaded.repeat.set(3, 3);
            material.map = loaded;
            material.needsUpdate = true;
            canvas.dataset.assetState = "loaded";
            status = "Local PNG loaded · 1: restore original";
            redraw();
          },
          undefined,
          (error) => {
            texture?.dispose();
            texture = undefined;
            failed(error);
          },
        );
      } else {
        const url =
          mode === "corrupt"
            ? new URL("./assets/broken.txt", import.meta.url).href
            : new URL("not-found.json", window.location.href).href;
        new FileLoader(manager)
          .setRequestHeader({ Accept: "application/json" })
          .setResponseType("json")
          .load(
            url,
            () => failed(new Error("Expected invalid asset to fail")),
            (event) => {
              canvas.dataset.assetBytes = String(event.loaded);
            },
            failed,
          );
      }
      redraw();
    },
    dispose() {
      disposed = true;
      manager.abort();
      manager.cache.clear();
      material.map = original;
      texture?.dispose();
      canvas.dataset.assetState = "disposed";
    },
  };
}
