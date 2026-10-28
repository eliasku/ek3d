import type { LoadingManager } from "./LoadingManager";
import { LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping } from "../constants";
import { FileLoader } from "./FileLoader";
import { DataTexture } from "../textures/DataTexture";
import type { DataTextureImage, DataTextureImageData } from "../textures/DataTexture";
import { Loader } from "./Loader";
import { error } from "../utils";
/**
 * Abstract base class for loading binary texture formats RGBE, EXR or TGA.
 * Textures are internally loaded via {@link FileLoader}.
 *
 * Derived classes have to implement the `parse()` method which holds the parsing
 * for the respective format.
 *
 * @abstract
 */
export abstract class DataTextureLoader extends Loader<DataTexture, string> {
  /** Parses the raw texture data for the loader's format. */
  abstract parse(buffer: ArrayBuffer): DataTextureData;
  /**
   * Constructs a new data texture loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }
  /**
   * Starts loading from the given URL and passes the loaded data texture
   * to the `onLoad()` callback. The method also returns a new texture object which can
   * directly be used for material creation. If you do it this way, the texture
   * may pop up in your scene once the respective loading process is finished.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   * @return The data texture.
   */
  load(
    url: string,
    onLoad?: (value: DataTexture, texData?: DataTextureData) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): DataTexture {
    const texture = new DataTexture();
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setPath(this.path);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (buffer?: any) => {
        let texData: any;
        try {
          texData = this.parse(buffer);
        } catch (e: any) {
          if (onError !== undefined) {
            onError(e);
          } else {
            error(e);
          }
          return;
        }
        this._applyTexData(texture, texData);
        if (onLoad) onLoad(texture, texData);
      },
      onProgress,
      onError,
    );
    return texture;
  }
  /**
   * Parses the given buffer and returns a configured data texture. Use this method
   * for parsing texture data that is already in memory (e.g. drag and drop or data
   * loaded from a server) without going through {@link DataTextureLoader#load}.
   *
   * @param buffer - The raw texture data.
   * @return The data texture.
   */
  createDataTexture(buffer: ArrayBuffer): DataTexture {
    const texture = new DataTexture();
    this._applyTexData(texture, this.parse(buffer));
    return texture;
  }
  /**
   * Applies the given parsed texture data to the given data texture.
   *
   * @private
   * @param texture - The data texture.
   * @param texData - The parsed texture data.
   */
  _applyTexData(texture: DataTexture, texData?: any) {
    if (texData.image !== undefined) {
      texture.image = texData.image;
    } else if (texData.data !== undefined) {
      texture.image.width = texData.width;
      texture.image.height = texData.height;
      texture.image.data = texData.data;
    }
    texture.wrapS = texData.wrapS !== undefined ? texData.wrapS : ClampToEdgeWrapping;
    texture.wrapT = texData.wrapT !== undefined ? texData.wrapT : ClampToEdgeWrapping;
    texture.magFilter = texData.magFilter !== undefined ? texData.magFilter : LinearFilter;
    texture.minFilter = texData.minFilter !== undefined ? texData.minFilter : LinearFilter;
    texture.anisotropy = texData.anisotropy !== undefined ? texData.anisotropy : 1;
    if (texData.colorSpace !== undefined) {
      texture.colorSpace = texData.colorSpace;
    }
    if (texData.flipY !== undefined) {
      texture.flipY = texData.flipY;
    }
    if (texData.format !== undefined) {
      texture.format = texData.format;
    }
    if (texData.type !== undefined) {
      texture.type = texData.type;
    }
    if (texData.mipmaps !== undefined) {
      texture.mipmaps = texData.mipmaps;
      texture.minFilter = LinearMipmapLinearFilter; // presumably...
    }
    if (texData.mipmapCount === 1) {
      texture.minFilter = LinearFilter;
    }
    if (texData.generateMipmaps !== undefined) {
      texture.generateMipmaps = texData.generateMipmaps;
    }
    texture.needsUpdate = true;
  }
}

/** Parsed texture pixels and optional upload settings. */
export interface DataTextureData {
  /** Image containing dimensions and texture data, instead of separate data fields. */
  image?: DataTextureImage;
  /** Raw texture pixels. */
  data?: NonNullable<DataTextureImageData>;
  /** Width of the base mip level. */
  width?: number;
  /** Height of the base mip level. */
  height?: number;
  /** Format-specific metadata: an RGBE header string or a structured EXR header. */
  header?: string | Record<string, unknown>;
  /** Gamma value parsed from the format header, if any. */
  gamma?: number;
  /** Exposure value parsed from the format header, if any. */
  exposure?: number;
  /** Horizontal wrapping mode. Defaults to ClampToEdgeWrapping. */
  wrapS?: number;
  /** Vertical wrapping mode. Defaults to ClampToEdgeWrapping. */
  wrapT?: number;
  /** Magnification filter. Defaults to LinearFilter. */
  magFilter?: number;
  /** Minification filter. Defaults to LinearFilter; supplied mipmaps select LinearMipmapLinearFilter. */
  minFilter?: number;
  /** Anisotropic filtering level. Defaults to 1. */
  anisotropy?: number;
  /** Color space of the texture pixels. */
  colorSpace?: string;
  /** Whether to flip the pixels vertically during GPU upload. */
  flipY?: boolean;
  /** Texture format. */
  format?: number;
  /** Texture data type. */
  type?: number;
  /** Texture data and dimensions for each mip level. */
  mipmaps?: DataTexture["mipmaps"];
  /** Number of mip levels; one selects LinearFilter. */
  mipmapCount?: number;
  /** Whether the GPU should generate mipmaps. */
  generateMipmaps?: boolean;
}
