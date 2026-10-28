import { Cache } from "ek3d/loaders/Cache";
import { Loader } from "ek3d/loaders/Loader";
import { LoadingManager } from "ek3d/loaders/LoadingManager";
import { FileLoader } from "ek3d/loaders/FileLoader";
import { ImageLoader } from "ek3d/loaders/ImageLoader";
import { ImageBitmapLoader } from "ek3d/loaders/ImageBitmapLoader";
import { TextureLoader } from "ek3d/loaders/TextureLoader";
import { CubeTextureLoader } from "ek3d/loaders/CubeTextureLoader";
import { DataTextureLoader, type DataTextureData } from "ek3d/loaders/DataTextureLoader";
import { CompressedTextureLoader, type CompressedTextureData } from "ek3d/loaders/CompressedTextureLoader";
import type { Texture } from "ek3d/textures/Texture";
import type { CubeTexture } from "ek3d/textures/CubeTexture";
import type { DataTexture } from "ek3d/textures/DataTexture";
import type { CompressedTexture } from "ek3d/textures/CompressedTexture";

const manager = new LoadingManager(
  () => {},
  (url, loaded, total) => {
    const progress: [string, number, number] = [url, loaded, total];
    void progress;
  },
  (url) => {
    url.toUpperCase();
  },
);
manager.cache.enabled = true;
const cache: Cache = manager.cache;
const unknownResource: unknown = cache.get("file:local.json");
const loader: Loader = new FileLoader(manager);
manager.addHandler(/\.png$/, new TextureLoader(manager));
manager.setURLModifier((url) => url);
const response: Promise<unknown> = new FileLoader(manager)
  .setResponseType("json")
  .setRequestHeader({ Accept: "application/json" })
  .loadAsync("local.json");
const image: Promise<HTMLImageElement> = new ImageLoader(manager).setPath("/assets/").loadAsync("tile.png");
const bitmap: Promise<ImageBitmap> = new ImageBitmapLoader(manager)
  .setOptions({ imageOrientation: "flipY" })
  .loadAsync("tile.png");
const texture: Promise<Texture> = new TextureLoader(manager).loadAsync("tile.png");
const cube: Promise<CubeTexture> = new CubeTextureLoader(manager).loadAsync(["a", "b", "c", "d", "e", "f"]);
declare const dataLoader: DataTextureLoader;
declare const compressedLoader: CompressedTextureLoader;
const data: Promise<DataTexture> = dataLoader.loadAsync("data.bin");
const compressed: Promise<CompressedTexture> = compressedLoader.loadAsync("blocks.bin");
const parsedData: DataTextureData = { width: 1, height: 1, data: new Uint8Array(4), flipY: false };
const parsedCompressed: CompressedTextureData = {
  width: 4,
  height: 4,
  format: 33777,
  mipmapCount: 1,
  mipmaps: [{ width: 4, height: 4, data: new Uint8Array(8) }],
};
// @ts-expect-error A format-specific loader must implement parsing before it can be constructed.
new DataTextureLoader(manager);
// @ts-expect-error Compressed formats require a concrete parser.
new CompressedTextureLoader(manager);
// @ts-expect-error Cache is an owner instance, not a mutable singleton.
Cache.enabled = true;
// @ts-expect-error Handler patterns are regular expressions.
manager.addHandler(".png", loader);
// @ts-expect-error ImageBitmap options use browser API literal values.
new ImageBitmapLoader().setOptions({ imageOrientation: "sideways" });
// @ts-expect-error Cube loading requires six URL entries rather than one string.
new CubeTextureLoader().loadAsync("one.png");
// @ts-expect-error File data remains unknown until the consumer validates its representation.
const unsafeJSON: Promise<{ value: number }> = response;
void [
  unknownResource,
  loader,
  response,
  image,
  bitmap,
  texture,
  cube,
  data,
  compressed,
  parsedData,
  parsedCompressed,
  unsafeJSON,
];
