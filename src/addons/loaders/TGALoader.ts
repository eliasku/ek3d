import { DataTextureLoader } from "../../loaders/DataTextureLoader";
import type { DataTextureData } from "../../loaders/DataTextureLoader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { TextureFilter } from "../../constants";

const TGA_TYPE_NO_DATA = 0;
const TGA_TYPE_INDEXED = 1;
const TGA_TYPE_RGB = 2;
const TGA_TYPE_GREY = 3;
const TGA_TYPE_RLE_INDEXED = 9;
const TGA_TYPE_RLE_RGB = 10;
const TGA_TYPE_RLE_GREY = 11;

const TGA_ORIGIN_MASK = 0x30;
const TGA_ORIGIN_SHIFT = 0x04;
const TGA_ORIGIN_BL = 0x00;
const TGA_ORIGIN_BR = 0x01;
const TGA_ORIGIN_UL = 0x02;
const TGA_ORIGIN_UR = 0x03;

interface TgaHeader {
  id_length: number;
  colormap_type: number;
  image_type: number;
  colormap_index: number;
  colormap_length: number;
  colormap_size: number;
  origin: number[];
  width: number;
  height: number;
  pixel_size: number;
  flags: number;
}

/** Copies one source image into the RGBA destination honouring the header's origin flags. */
type RowWriter = (
  imageData: Uint8Array,
  yStart: number,
  yStep: number,
  yEnd: number,
  xStart: number,
  xStep: number,
  xEnd: number,
  image: Uint8Array,
  palettes: Uint8Array | undefined,
) => void;

/**
 * A loader for the TGA texture format.
 *
 * ```ts
 * import { TGALoader } from "ek3d/addons/loaders/TGALoader";
 * import { ColorSpace } from "ek3d/constants";
 *
 * const texture = await new TGALoader().loadAsync("textures/crate_color8.tga");
 * texture.colorSpace = ColorSpace.SRGB; // only for color textures
 * ```
 */
export class TGALoader extends DataTextureLoader {
  /**
   * Constructs a new TGA loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Parses the given TGA texture data.
   *
   * @param buffer - The raw texture data.
   * @return An object representing the parsed texture data.
   */
  parse(buffer: ArrayBuffer): DataTextureData {
    // reference from vthibault, https://github.com/vthibault/roBrowser/blob/master/src/Loaders/Targa.js
    if (buffer.byteLength < 19) throw new Error("THREE.TGALoader: Not enough data to contain header.");

    let offset = 0;
    const content = new Uint8Array(buffer);
    const header: TgaHeader = {
      id_length: content[offset++],
      colormap_type: content[offset++],
      image_type: content[offset++],
      colormap_index: content[offset++] | (content[offset++] << 8),
      colormap_length: content[offset++] | (content[offset++] << 8),
      colormap_size: content[offset++],
      origin: [content[offset++] | (content[offset++] << 8), content[offset++] | (content[offset++] << 8)],
      width: content[offset++] | (content[offset++] << 8),
      height: content[offset++] | (content[offset++] << 8),
      pixel_size: content[offset++],
      flags: content[offset++],
    };
    const width = header.width;

    function checkHeader(): void {
      switch (header.image_type) {
        // check indexed type
        case TGA_TYPE_INDEXED:
        case TGA_TYPE_RLE_INDEXED:
          if (header.colormap_length > 256 || header.colormap_size !== 24 || header.colormap_type !== 1) {
            throw new Error("THREE.TGALoader: Invalid type colormap data for indexed type.");
          }
          break;
        // check colormap type
        case TGA_TYPE_RGB:
        case TGA_TYPE_GREY:
        case TGA_TYPE_RLE_RGB:
        case TGA_TYPE_RLE_GREY:
          if (header.colormap_type) {
            throw new Error("THREE.TGALoader: Invalid type colormap data for colormap type.");
          }
          break;
        // a file without data cannot produce a texture
        case TGA_TYPE_NO_DATA:
          throw new Error("THREE.TGALoader: No data.");
        default:
          throw new Error("THREE.TGALoader: Invalid type " + header.image_type);
      }

      if (header.width <= 0 || header.height <= 0) throw new Error("THREE.TGALoader: Invalid image size.");

      if (header.pixel_size !== 8 && header.pixel_size !== 16 && header.pixel_size !== 24 && header.pixel_size !== 32) {
        throw new Error("THREE.TGALoader: Invalid pixel size " + header.pixel_size);
      }
    }

    function parsePixels(
      useRle: boolean,
      usePal: boolean,
      dataOffset: number,
      data: Uint8Array,
    ): { pixelData: Uint8Array; palettes: Uint8Array | undefined } {
      let pixelData: Uint8Array;
      let palettes: Uint8Array | undefined;

      const pixelSize = header.pixel_size >> 3;
      const pixelTotal = header.width * header.height * pixelSize;

      if (usePal) {
        palettes = data.subarray(dataOffset, (dataOffset += header.colormap_length * (header.colormap_size >> 3)));
      }

      if (useRle) {
        pixelData = new Uint8Array(pixelTotal);
        let shift = 0;
        const pixels = new Uint8Array(pixelSize);
        while (shift < pixelTotal) {
          // Truncated packet data would otherwise decode as zeroed pixels.
          if (dataOffset >= data.length) throw new Error("THREE.TGALoader: Truncated RLE image data.");
          const c = data[dataOffset++];
          let count = (c & 0x7f) + 1;
          if (c & 0x80) {
            // RLE packet: repeat one pixel
            if (dataOffset + pixelSize > data.length) throw new Error("THREE.TGALoader: Truncated RLE image data.");
            for (let i = 0; i < pixelSize; ++i) pixels[i] = data[dataOffset++];
            // A packet may not write past the destination buffer.
            if (shift + pixelSize * count > pixelTotal) {
              throw new Error("THREE.TGALoader: RLE packet exceeds the image size.");
            }
            for (let i = 0; i < count; ++i) pixelData.set(pixels, shift + i * pixelSize);
            shift += pixelSize * count;
          } else {
            // raw packet
            count *= pixelSize;
            if (dataOffset + count > data.length) throw new Error("THREE.TGALoader: Truncated RLE image data.");
            if (shift + count > pixelTotal) throw new Error("THREE.TGALoader: RLE packet exceeds the image size.");
            pixelData.set(data.subarray(dataOffset, dataOffset + count), shift);
            dataOffset += count;
            shift += count;
          }
        }
      } else {
        pixelData = data.subarray(dataOffset, (dataOffset += usePal ? header.width * header.height : pixelTotal));
      }

      return { pixelData, palettes };
    }

    const rgb8: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image, palettes) => {
      if (palettes === undefined) throw new Error("THREE.TGALoader: Missing color map for an indexed image.");
      const colormap = palettes;
      const colormapIndex = header.colormap_index;
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i++) {
          // map from the full color map index to the stored palette index
          const index = image[i] - colormapIndex;
          imageData[(x + width * y) * 4 + 3] = 255;
          imageData[(x + width * y) * 4 + 2] = colormap[index * 3 + 0];
          imageData[(x + width * y) * 4 + 1] = colormap[index * 3 + 1];
          imageData[(x + width * y) * 4 + 0] = colormap[index * 3 + 2];
        }
      }
    };

    const rgb16: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image) => {
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i += 2) {
          const color = image[i + 0] + (image[i + 1] << 8);
          imageData[(x + width * y) * 4 + 0] = (color & 0x7c00) >> 7;
          imageData[(x + width * y) * 4 + 1] = (color & 0x03e0) >> 2;
          imageData[(x + width * y) * 4 + 2] = (color & 0x001f) << 3;
          imageData[(x + width * y) * 4 + 3] = color & 0x8000 ? 0 : 255;
        }
      }
    };

    const rgb24: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image) => {
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i += 3) {
          imageData[(x + width * y) * 4 + 3] = 255;
          imageData[(x + width * y) * 4 + 2] = image[i + 0];
          imageData[(x + width * y) * 4 + 1] = image[i + 1];
          imageData[(x + width * y) * 4 + 0] = image[i + 2];
        }
      }
    };

    const rgb32: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image) => {
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i += 4) {
          imageData[(x + width * y) * 4 + 2] = image[i + 0];
          imageData[(x + width * y) * 4 + 1] = image[i + 1];
          imageData[(x + width * y) * 4 + 0] = image[i + 2];
          imageData[(x + width * y) * 4 + 3] = image[i + 3];
        }
      }
    };

    const grey8: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image) => {
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i++) {
          const color = image[i];
          imageData[(x + width * y) * 4 + 0] = color;
          imageData[(x + width * y) * 4 + 1] = color;
          imageData[(x + width * y) * 4 + 2] = color;
          imageData[(x + width * y) * 4 + 3] = 255;
        }
      }
    };

    const grey16: RowWriter = (imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image) => {
      let i = 0;
      for (let y = yStart; y !== yEnd; y += yStep) {
        for (let x = xStart; x !== xEnd; x += xStep, i += 2) {
          imageData[(x + width * y) * 4 + 0] = image[i + 0];
          imageData[(x + width * y) * 4 + 1] = image[i + 0];
          imageData[(x + width * y) * 4 + 2] = image[i + 0];
          imageData[(x + width * y) * 4 + 3] = image[i + 1];
        }
      }
    };

    function getTgaRGBA(
      imageData: Uint8Array,
      imageWidth: number,
      imageHeight: number,
      image: Uint8Array,
      palette: Uint8Array | undefined,
      useGrey: boolean,
    ): Uint8Array {
      let xStart: number;
      let yStart: number;
      let xStep: number;
      let yStep: number;
      let xEnd: number;
      let yEnd: number;

      switch ((header.flags & TGA_ORIGIN_MASK) >> TGA_ORIGIN_SHIFT) {
        default:
        case TGA_ORIGIN_UL:
          xStart = 0;
          xStep = 1;
          xEnd = imageWidth;
          yStart = 0;
          yStep = 1;
          yEnd = imageHeight;
          break;
        case TGA_ORIGIN_BL:
          xStart = 0;
          xStep = 1;
          xEnd = imageWidth;
          yStart = imageHeight - 1;
          yStep = -1;
          yEnd = -1;
          break;
        case TGA_ORIGIN_UR:
          xStart = imageWidth - 1;
          xStep = -1;
          xEnd = -1;
          yStart = 0;
          yStep = 1;
          yEnd = imageHeight;
          break;
        case TGA_ORIGIN_BR:
          xStart = imageWidth - 1;
          xStep = -1;
          xEnd = -1;
          yStart = imageHeight - 1;
          yStep = -1;
          yEnd = -1;
          break;
      }

      let writer: RowWriter;
      if (useGrey) {
        if (header.pixel_size === 8) writer = grey8;
        else if (header.pixel_size === 16) writer = grey16;
        else throw new Error("THREE.TGALoader: Format not supported.");
      } else {
        if (header.pixel_size === 8) writer = rgb8;
        else if (header.pixel_size === 16) writer = rgb16;
        else if (header.pixel_size === 24) writer = rgb24;
        else if (header.pixel_size === 32) writer = rgb32;
        else throw new Error("THREE.TGALoader: Format not supported.");
      }
      writer(imageData, yStart, yStep, yEnd, xStart, xStep, xEnd, image, palette);
      return imageData;
    }

    checkHeader();

    if (header.id_length + offset > buffer.byteLength) throw new Error("THREE.TGALoader: No data.");

    // skip the image ID field
    offset += header.id_length;

    let useRle = false;
    let usePal = false;
    let useGrey = false;

    switch (header.image_type) {
      case TGA_TYPE_RLE_INDEXED:
        useRle = true;
        usePal = true;
        break;
      case TGA_TYPE_INDEXED:
        usePal = true;
        break;
      case TGA_TYPE_RLE_RGB:
        useRle = true;
        break;
      case TGA_TYPE_RLE_GREY:
        useRle = true;
        useGrey = true;
        break;
      case TGA_TYPE_GREY:
        useGrey = true;
        break;
    }

    const imageData = new Uint8Array(header.width * header.height * 4);
    const result = parsePixels(useRle, usePal, offset, content);
    getTgaRGBA(imageData, header.width, header.height, result.pixelData, result.palettes, useGrey);

    return {
      data: imageData,
      width: header.width,
      height: header.height,
      flipY: true,
      generateMipmaps: true,
      minFilter: TextureFilter.LinearMipmapLinear,
    };
  }
}
