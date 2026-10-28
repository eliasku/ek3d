import { HalfFloatType, LinearFilter, LinearSRGBColorSpace, RGBAFormat } from "../../constants";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { DataTexture } from "../../textures/DataTexture";

interface HDRPixels {
  data: Float16Array;
  pixelFormat: string;
}

// The native HDR Canvas2D extension is not yet included in the TypeScript DOM library.
interface HDRContext {
  globalHDRHeadroom: number;
  getContextAttributes(): { colorType?: string };
  drawImage(image: HTMLImageElement, x: number, y: number): void;
  getImageData(
    x: number,
    y: number,
    width: number,
    height: number,
    options: { colorSpace: "srgb-linear"; pixelFormat: "rgba-float16" },
  ): HDRPixels;
}

interface DecodedImage {
  data: Uint16Array;
  width: number;
  height: number;
}

/** Loads native HDR JPEG XL images as linear-sRGB half-float textures. */
export class JXLLoader extends Loader<DataTexture> {
  override load(
    url: string,
    onLoad?: (texture: DataTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): DataTexture {
    const texture = new DataTexture(null, 0, 0, RGBAFormat, HalfFloatType);
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.setResponseType("arraybuffer");
    this.manager.itemStart(url);
    const failure = (error: unknown): void => {
      try {
        if (onError) onError(error);
        else console.error(error);
      } finally {
        this.manager.itemError(url);
        this.manager.itemEnd(url);
      }
    };
    loader.load(
      url,
      (buffer) => {
        if (!(buffer instanceof ArrayBuffer)) {
          failure(new TypeError("JXLLoader requires an ArrayBuffer"));
          return;
        }
        void this._decode(buffer).then((data) => {
          this._applyData(texture, data);
          try {
            onLoad?.(texture);
          } finally {
            this.manager.itemEnd(url);
          }
        }, failure);
      },
      onProgress,
      failure,
    );
    return texture;
  }

  parse(buffer: ArrayBuffer, onLoad: (texture: DataTexture) => void, onError?: (error: unknown) => void): void {
    void this.parseAsync(buffer).then(onLoad, onError);
  }

  async parseAsync(buffer: ArrayBuffer): Promise<DataTexture> {
    const data = await this._decode(buffer);
    const texture = new DataTexture();
    this._applyData(texture, data);
    return texture;
  }

  _applyData(texture: DataTexture, data: DecodedImage): void {
    texture.image = data;
    texture.format = RGBAFormat;
    texture.type = HalfFloatType;
    texture.colorSpace = LinearSRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.flipY = true;
    texture.needsUpdate = true;
  }

  async _decode(buffer: ArrayBuffer): Promise<DecodedImage> {
    const canvas = document.createElement("canvas");
    const options = { colorSpace: "srgb-linear", colorType: "float16" };
    const context = canvas.getContext(
      "2d",
      options as CanvasRenderingContext2DSettings,
    ) as unknown as HDRContext | null;
    if (
      context === null ||
      context.getContextAttributes().colorType !== "float16" ||
      !("globalHDRHeadroom" in context)
    ) {
      throw new Error("JXLLoader: Canvas2D float16 storage and globalHDRHeadroom are required.");
    }
    const url = URL.createObjectURL(new Blob([buffer]));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.globalHDRHeadroom = Infinity;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height, {
        colorSpace: "srgb-linear",
        pixelFormat: "rgba-float16",
      });
      if (pixels.pixelFormat !== "rgba-float16") {
        throw new Error("JXLLoader: Canvas2D rgba-float16 readback is required.");
      }
      return {
        data: new Uint16Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.length),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(url);
      canvas.width = canvas.height = 0;
    }
  }
}
