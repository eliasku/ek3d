import { LinearFilter, LinearMipmapLinearFilter } from "../../constants";
import { DataTextureLoader } from "../../loaders/DataTextureLoader";
import type { DataTextureData } from "../../loaders/DataTextureLoader";
import type { LoadingManager } from "../../loaders/LoadingManager";

/** A TIFF image file directory decoded by UTIF. */
export interface TIFFImageDirectory {
  width: number;
  height: number;
}

/** The UTIF functions required by TIFFLoader. */
export interface TIFFRuntime {
  decode(buffer: ArrayBuffer): TIFFImageDirectory[];
  decodeImage(buffer: ArrayBuffer, directory: TIFFImageDirectory): void;
  toRGBA8(directory: TIFFImageDirectory): Uint8Array;
}

/** Loads TIFF textures using a consumer-supplied UTIF runtime. */
export class TIFFLoader extends DataTextureLoader {
  runtime: TIFFRuntime;

  constructor(runtime: TIFFRuntime, manager?: LoadingManager) {
    super(manager);
    this.runtime = runtime;
  }

  override parse(buffer: ArrayBuffer): DataTextureData {
    const ifds = this.runtime.decode(buffer);
    const image = ifds[0];
    if (image === undefined) throw new Error("TIFFLoader: No image directory found.");
    this.runtime.decodeImage(buffer, image);
    const data = this.runtime.toRGBA8(image);
    return {
      width: image.width,
      height: image.height,
      data,
      flipY: true,
      magFilter: LinearFilter,
      minFilter: LinearMipmapLinearFilter,
    };
  }
}
