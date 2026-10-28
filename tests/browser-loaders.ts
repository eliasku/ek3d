import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { ImageLoader } from "ek3d/loaders/ImageLoader";
import { ImageBitmapLoader } from "ek3d/loaders/ImageBitmapLoader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { Texture } from "ek3d/textures/Texture";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function completed(manager: LoadingManager) {
  return new Promise<void>((resolve) => {
    manager.onLoad = resolve;
  });
}

export async function checkLoaders() {
  if (typeof createImageBitmap !== "function")
    throw new Error("Loader browser fixture requires createImageBitmap support");
  const checks: string[] = [];
  const url = new URL("../demo/assets/tile.png", import.meta.url).href;
  const manager = new LoadingManager();
  manager.cache.enabled = true;
  const other = new LoadingManager();
  other.cache.enabled = true;
  const bitmaps = new Set<ImageBitmap>();
  const textures: Texture[] = [];
  try {
    const progress: number[] = [];
    const fileDone = completed(manager);
    const file = await new FileLoader(manager).loadAsync("data:text/plain,loader-progress", (event) =>
      progress.push(event.loaded),
    );
    await fileDone;
    check(file === "loader-progress" && progress.at(-1) === 15, "file response and streaming progress");
    checks.push("file streaming progress and manager completion");
    const documentDone = completed(manager);
    const document = await new FileLoader(manager)
      .setResponseType("document")
      .setMimeType("application/xml")
      .loadAsync("data:application/xml,%3Casset%20name=%22local%22/%3E");
    await documentDone;
    check(
      document instanceof XMLDocument && document.documentElement.getAttribute("name") === "local",
      "document response must preserve XML parsing",
    );
    checks.push("browser document response parsing");

    const imageLoader = new ImageLoader(manager).setCrossOrigin("anonymous").setPriority("low");
    const imageDone = completed(manager);
    const images = await Promise.all([imageLoader.loadAsync(url), new ImageLoader(manager).loadAsync(url)]);
    await imageDone;
    check(images[0] === images[1], "same-manager image requests must deduplicate");
    check(images[0].complete && images[0].naturalWidth > 0, "local PNG must decode");
    check(images[0].crossOrigin === "anonymous" && images[0].fetchPriority === "low", "image CORS and priority");
    const isolatedImage = await new ImageLoader(other).loadAsync(url);
    check(isolatedImage !== images[0], "separate managers must not share image cache");
    checks.push("local PNG decode, image deduplication, CORS, priority and owner isolation");

    const textureDone = completed(manager);
    const texture = await new TextureLoader(manager).loadAsync(url);
    textures.push(texture);
    await textureDone;
    check(texture.image === images[0] && texture.version === 1, "TextureLoader image and upload invalidation");
    const cubeDone = completed(manager);
    const cube = await new CubeTextureLoader(manager).loadAsync(Array(6).fill(url));
    textures.push(cube);
    await cubeDone;
    check(
      cube.images.length === 6 && cube.images.every((image: HTMLImageElement) => image === images[0]),
      "CubeTextureLoader six face ownership",
    );
    check(cube.version === 1 && cube.flipY === false, "cube texture update contract");
    checks.push("texture and cube loaders preserve image ownership and update versions");

    const bitmapDone = completed(manager);
    const bitmapLoader = new ImageBitmapLoader(manager).setOptions({
      imageOrientation: "flipY",
      premultiplyAlpha: "none",
    });
    const loadedBitmaps = await Promise.all([bitmapLoader.loadAsync(url), bitmapLoader.loadAsync(url)]);
    for (const bitmap of loadedBitmaps) bitmaps.add(bitmap);
    await bitmapDone;
    check(loadedBitmaps[0] === loadedBitmaps[1], "same-manager bitmap requests must deduplicate");
    const separateBitmap = await new ImageBitmapLoader(other).loadAsync(url);
    bitmaps.add(separateBitmap);
    check(separateBitmap !== loadedBitmaps[0], "separate managers must not share bitmap cache");
    const bitmapTexture = new Texture(loadedBitmaps[0]);
    bitmapTexture.dispose();
    manager.cache.clear();
    check(loadedBitmaps[0].width > 0, "texture disposal and cache clear must not close caller-owned bitmap");
    loadedBitmaps[0].close();
    bitmaps.delete(loadedBitmaps[0]);
    check(loadedBitmaps[0].width === 0, "caller closes bitmap CPU storage explicitly");
    checks.push("bitmap deduplication, isolation and explicit CPU close ownership");

    let errors = 0;
    manager.onError = () => {
      errors++;
    };
    const corruptDone = completed(manager);
    const corrupt = await Promise.allSettled([
      new FileLoader(manager).setResponseType("json").loadAsync("data:application/json,%7Bbroken"),
    ]);
    await corruptDone;
    check(corrupt[0].status === "rejected" && errors === 1, "corrupt JSON must reject and finish manager");
    const invalidBitmapURL = "data:image/png;base64,AA==";
    const bitmapErrorDone = completed(manager);
    const invalid = await Promise.allSettled([
      bitmapLoader.loadAsync(invalidBitmapURL),
      bitmapLoader.loadAsync(invalidBitmapURL),
    ]);
    await bitmapErrorDone;
    check(
      invalid.every((result) => result.status === "rejected") && errors === 3,
      "bitmap decode errors must reach both subscribers and complete",
    );
    check(
      manager.cache.get(`image-bitmap:${invalidBitmapURL}`) === undefined,
      "decode error must evict cached promise",
    );
    checks.push("corrupt JSON and duplicate bitmap decode errors complete and clear cache");
    const rejectedBitmapURL = "rejected-cached-bitmap.png";
    const cachedError = new Error("cached bitmap request failed");
    manager.cache.add(`image-bitmap:${rejectedBitmapURL}`, Promise.reject<ImageBitmap>(cachedError));
    const rejectedBitmapDone = completed(manager);
    const rejectedBitmap = await Promise.allSettled([bitmapLoader.loadAsync(rejectedBitmapURL)]);
    await rejectedBitmapDone;
    check(
      rejectedBitmap[0].status === "rejected" && rejectedBitmap[0].reason === cachedError && errors === 4,
      "rejected cached bitmap promises must reach the error callback and complete the manager",
    );
    check(
      manager.cache.get(`image-bitmap:${rejectedBitmapURL}`) === undefined,
      "rejected cached bitmap promises must be evicted",
    );
    checks.push("rejected cached bitmap promises report failure and complete without retaining failed cache entries");
    return { checks };
  } finally {
    manager.abort();
    other.abort();
    manager.cache.clear();
    other.cache.clear();
    for (const texture of textures) texture.dispose();
    for (const bitmap of bitmaps) bitmap.close();
  }
}
