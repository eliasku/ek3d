import type { LoadingManager } from "./LoadingManager";
import { TextureFilter, PixelFormat } from "../constants";
import { FileLoader } from "./FileLoader";
import { CompressedTexture } from "../textures/CompressedTexture";
import type { CompressedTextureFace } from "../textures/CompressedTexture";
import { Loader } from "./Loader";
import { error } from "../utils";
/**
 * Abstract base class for loading compressed texture formats S3TC, ASTC or ETC.
 * Textures are internally loaded via {@link FileLoader}.
 *
 * Derived classes have to implement the `parse()` method which holds the parsing
 * for the respective format.
 *
 * @abstract
 */
export abstract class CompressedTextureLoader extends Loader<CompressedTexture, string | string[]> {
  /** Parses the raw texture data, optionally including mipmaps. */
  abstract parse(buffer: ArrayBuffer, loadMipmaps?: boolean): CompressedTextureData;
  /**
   * Constructs a new compressed texture loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and passes the loaded compressed texture
   * to the `onLoad()` callback. The method also returns a new texture object which can
   * directly be used for material creation. If you do it this way, the texture
   * may pop up in your scene once the respective loading process is finished.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   * @return The compressed texture.
   */
  load(
    url: string | string[],
    onLoad?: (value: CompressedTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): CompressedTexture {
    const images: CompressedTextureFace[] = [];
    const texture = new CompressedTexture();
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    let loaded = 0;
    // Like DataTextureLoader, a parse failure is a load error: without this the throw escapes
    // the FileLoader callback and loadAsync() never settles.
    const reportParseError = (e: unknown) => {
      if (onError !== undefined) onError(e);
      else error(e);
    };
    const parseData = (buffer: unknown): CompressedTextureData => {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new TypeError("CompressedTextureLoader: Expected an ArrayBuffer response.");
      }
      return this.parse(buffer, true);
    };
    const urls = Array.isArray(url) ? url : [];
    const loadTexture = (i: number) => {
      loader.load(
        urls[i],
        (buffer: unknown) => {
          let texDatas: CompressedTextureData;
          try {
            texDatas = parseData(buffer);
          } catch (e) {
            reportParseError(e);
            return;
          }
          images[i] = {
            width: texDatas.width,
            height: texDatas.height,
            mipmaps: texDatas.mipmaps,
          };
          loaded += 1;
          if (loaded === 6) {
            if (texDatas.mipmapCount === 1) texture.minFilter = TextureFilter.Linear;
            texture.image = images;
            texture.format = texDatas.format;
            texture.needsUpdate = true;
            if (onLoad) onLoad(texture);
          }
        },
        onProgress,
        onError,
      );
    };
    if (Array.isArray(url)) {
      for (let i = 0, il = urls.length; i < il; ++i) {
        loadTexture(i);
      }
    } else {
      // compressed cubemap texture stored in a single DDS file
      loader.load(
        url,
        (buffer: unknown) => {
          let texDatas: CompressedTextureData;
          try {
            texDatas = parseData(buffer);
          } catch (e) {
            reportParseError(e);
            return;
          }
          if (texDatas.isCubemap) {
            const faces = texDatas.mipmaps.length / texDatas.mipmapCount;
            for (let f = 0; f < faces; f++) {
              images[f] = { mipmaps: [], width: texDatas.width, height: texDatas.height };
              for (let i = 0; i < texDatas.mipmapCount; i++) {
                images[f].mipmaps.push(texDatas.mipmaps[f * texDatas.mipmapCount + i]);
              }
            }
            texture.image = images;
          } else {
            texture.image = { width: texDatas.width, height: texDatas.height };
            texture.mipmaps = texDatas.mipmaps;
          }
          if (texDatas.mipmapCount === 1) {
            texture.minFilter = TextureFilter.Linear;
          }
          texture.format = texDatas.format;
          texture.needsUpdate = true;
          if (onLoad) onLoad(texture);
        },
        onProgress,
        onError,
      );
    }
    return texture;
  }
}

/** Parsed compressed texture data for the loader's format. */
export interface CompressedTextureData {
  /** Width of the base mip level. */
  width: number;
  /** Height of the base mip level. */
  height: number;
  /** Texture format. */
  format: PixelFormat;
  /** Texture data and dimensions for each mip level. */
  mipmaps: CompressedTexture["mipmaps"];
  /** Number of mip levels per face. */
  mipmapCount: number;
  /** Whether the data represents a cube map. */
  isCubemap?: boolean;
}
