import { FloatType, HalfFloatType, LinearFilter, LinearSRGBColorSpace } from "../../constants";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { CubeTexture } from "../../textures/CubeTexture";
import { DataTexture } from "../../textures/DataTexture";
import { error } from "../../utils";
import { HDRLoader } from "./HDRLoader";

/** Loads six RGBE images into an HDR cube texture. */
export class HDRCubeTextureLoader extends Loader<CubeTexture, string[]> {
  hdrLoader: HDRLoader;
  type: number;

  constructor(manager?: LoadingManager) {
    super(manager);
    this.hdrLoader = new HDRLoader(this.manager);
    this.type = HalfFloatType;
  }

  load(
    urls: string[],
    onLoad?: (texture: CubeTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (cause: unknown) => void,
  ): CubeTexture {
    const texture = new CubeTexture();
    texture.type = this.type;
    if (texture.type === FloatType || texture.type === HalfFloatType) {
      texture.colorSpace = LinearSRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
    }
    let loaded = 0;
    let failed = false;
    urls.forEach((url, i) => {
      const loader = new FileLoader(this.manager);
      loader
        .setPriority(this.priority)
        .setCache(this.cache)
        .setPath(this.path)
        .setResponseType("arraybuffer")
        .setRequestHeader(this.requestHeader)
        .setWithCredentials(this.withCredentials);
      loader.load(
        url,
        (buffer) => {
          if (failed) return;
          try {
            if (!(buffer instanceof ArrayBuffer))
              throw new Error("HDRCubeTextureLoader: Expected an ArrayBuffer response.");
            const texData = this.hdrLoader.parse(buffer);
            if (texData.data === undefined || texData.width === undefined || texData.height === undefined)
              throw new Error("HDRCubeTextureLoader: Missing face data.");
            const face = new DataTexture(texData.data, texData.width, texData.height);
            face.type = texture.type;
            face.colorSpace = texture.colorSpace;
            face.format = texture.format;
            face.minFilter = texture.minFilter;
            face.magFilter = texture.magFilter;
            face.generateMipmaps = texture.generateMipmaps;
            texture.images[i] = face;
          } catch (cause) {
            failed = true;
            if (onError) onError(cause);
            else error(cause);
            this.manager.itemError(this.manager.resolveURL(this.path + url));
            return;
          }
          if (++loaded === 6) {
            texture.needsUpdate = true;
            onLoad?.(texture);
          }
        },
        onProgress,
        (cause) => {
          failed = true;
          onError?.(cause);
        },
      );
    });
    return texture;
  }

  setDataType(value: number): this {
    this.type = value;
    this.hdrLoader.setDataType(value);
    return this;
  }
}
