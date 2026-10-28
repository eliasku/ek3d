import { createElementNS, warn } from "../utils";
import { SRGBToLinear } from "../math/ColorManagement";
let _canvas: any;
/**
 * A class containing utility functions for images.
 *
 * @hideconstructor
 */
export class ImageUtils {
  /**
   * Returns a data URI containing a representation of the given image.
   *
   * @param image - The image object.
   * @param [type='image/png'] - Indicates the image format.
   * @return The data URI.
   */
  static getDataURL(image: HTMLCanvasElement | HTMLImageElement | ImageBitmap, type?: string): string;
  static getDataURL(image?: any, type: string = "image/png"): string {
    if (/^data:/i.test((image as any).src)) {
      return (image as any).src;
    }
    if (typeof HTMLCanvasElement === "undefined") {
      return (image as any).src;
    }
    let canvas: any;
    if (image instanceof HTMLCanvasElement) {
      canvas = image;
    } else {
      if (_canvas === undefined) _canvas = createElementNS("canvas") as HTMLCanvasElement;
      _canvas.width = image.width;
      _canvas.height = image.height;
      const context = _canvas.getContext("2d");
      if (image instanceof ImageData) {
        context.putImageData(image, 0, 0);
      } else {
        context.drawImage(image, 0, 0, image.width, image.height);
      }
      canvas = _canvas;
    }
    return canvas.toDataURL(type);
  }
  /**
   * Converts the given sRGB image data to linear color space.
   *
   * @param image - The image object.
   * @return The converted image.
   */
  static sRGBToLinear(image?: any) {
    if (
      (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) ||
      (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
    ) {
      const canvas = createElementNS("canvas") as HTMLCanvasElement;
      (canvas as any).width = image.width;
      (canvas as any).height = image.height;
      const context = (canvas as any).getContext("2d");
      context.drawImage(image, 0, 0, image.width, image.height);
      const imageData = context.getImageData(0, 0, image.width, image.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i++) {
        data[i] = SRGBToLinear(data[i] / 255) * 255;
      }
      context.putImageData(imageData, 0, 0);
      return canvas;
    } else if (image.data) {
      const data = image.data.slice(0);
      for (let i = 0; i < data.length; i++) {
        if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
          (data as any)[i] = Math.floor(SRGBToLinear((data as any)[i] / 255) * 255);
        } else {
          // assuming float
          data[i] = SRGBToLinear(data[i]);
        }
      }
      return {
        data: data,
        width: image.width,
        height: image.height,
      };
    } else {
      warn("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.");
      return image;
    }
  }
}
