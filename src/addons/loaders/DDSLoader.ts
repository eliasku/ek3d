import { CompressedTextureLoader } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureData } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureMipmap } from "../../textures/CompressedTexture";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { PixelFormat } from "../../constants";

// All values and structures referenced from:
// http://msdn.microsoft.com/en-us/library/bb943991.aspx
const DDS_MAGIC = 0x20534444;
const DDSD_MIPMAPCOUNT = 0x20000;

const DDSCAPS2_CUBEMAP = 0x200;
const DDSCAPS2_CUBEMAP_POSITIVEX = 0x400;
const DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800;
const DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000;
const DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000;
const DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000;
const DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000;

const DXGI_FORMAT_BC6H_UF16 = 95;
const DXGI_FORMAT_BC6H_SF16 = 96;

const FOURCC_DXT1 = fourCCToInt32("DXT1");
const FOURCC_DXT3 = fourCCToInt32("DXT3");
const FOURCC_DXT5 = fourCCToInt32("DXT5");
const FOURCC_ETC1 = fourCCToInt32("ETC1");
const FOURCC_DX10 = fourCCToInt32("DX10");

// The header length in 32 bit ints, and the DX10 extended header length.
const HEADER_LENGTH_INT = 31;
const EXTENDED_HEADER_LENGTH_INT = 5;

// Offsets into the header array.
const OFF_MAGIC = 0;
const OFF_SIZE = 1;
const OFF_FLAGS = 2;
const OFF_HEIGHT = 3;
const OFF_WIDTH = 4;
const OFF_MIPMAP_COUNT = 7;
const OFF_PF_FOUR_CC = 21;
const OFF_RGB_BIT_COUNT = 22;
const OFF_R_BIT_MASK = 23;
const OFF_G_BIT_MASK = 24;
const OFF_B_BIT_MASK = 25;
const OFF_A_BIT_MASK = 26;
const OFF_CAPS2 = 28;
const OFF_DXGI_FORMAT = 0;

function fourCCToInt32(value: string): number {
  return value.charCodeAt(0) + (value.charCodeAt(1) << 8) + (value.charCodeAt(2) << 16) + (value.charCodeAt(3) << 24);
}

function int32ToFourCC(value: number): string {
  return String.fromCharCode(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

/** Expands BGRA rows into the RGBA upload layout. */
function loadARGBMip(buffer: ArrayBuffer, dataOffset: number, width: number, height: number): Uint8Array {
  const dataLength = width * height * 4;
  const srcBuffer = new Uint8Array(buffer, dataOffset, dataLength);
  const byteArray = new Uint8Array(dataLength);
  let dst = 0;
  let src = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = srcBuffer[src];
      src++;
      const g = srcBuffer[src];
      src++;
      const r = srcBuffer[src];
      src++;
      const a = srcBuffer[src];
      src++;
      byteArray[dst] = r;
      dst++;
      byteArray[dst] = g;
      dst++;
      byteArray[dst] = b;
      dst++;
      byteArray[dst] = a;
      dst++;
    }
  }
  return byteArray;
}

/** Expands 24 bit BGR rows into RGBA with opaque alpha. */
function loadRGBMip(buffer: ArrayBuffer, dataOffset: number, width: number, height: number): Uint8Array {
  const dataLength = width * height * 3;
  const srcBuffer = new Uint8Array(buffer, dataOffset, dataLength);
  const byteArray = new Uint8Array(width * height * 4);
  let dst = 0;
  let src = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = srcBuffer[src];
      src++;
      const g = srcBuffer[src];
      src++;
      const r = srcBuffer[src];
      src++;
      byteArray[dst] = r;
      dst++;
      byteArray[dst] = g;
      dst++;
      byteArray[dst] = b;
      dst++;
      byteArray[dst] = 255;
      dst++;
    }
  }
  return byteArray;
}

/**
 * A loader for the S3TC, ETC1 and BPTC texture compression formats stored in DDS containers.
 *
 * Unsupported headers are reported by throwing instead of returning an empty texture, so a
 * caller cannot mistake a format the GPU cannot decode for a valid black texture.
 *
 * ```typescript
 * import { DDSLoader } from "ek3d/addons/loaders/DDSLoader";
 * import { ColorSpace } from "ek3d/constants";
 *
 * const map = await new DDSLoader().loadAsync("textures/compressed/disturb_dxt1_nomip.dds");
 * map.colorSpace = ColorSpace.SRGB; // only for color textures
 * ```
 */
export class DDSLoader extends CompressedTextureLoader {
  /**
   * Constructs a new DDS loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Parses the given DDS texture data.
   *
   * @param buffer - The raw texture data.
   * @param loadMipmaps - Whether to load mipmaps or not.
   * @return An object representing the parsed texture data.
   */
  parse(buffer: ArrayBuffer, loadMipmaps?: boolean): CompressedTextureData {
    if (buffer.byteLength < (HEADER_LENGTH_INT + 1) * 4) {
      throw new Error("THREE.DDSLoader: Not enough data to contain a DDS header.");
    }
    // Adapted from @toji's DDS utils
    // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js
    const header = new Int32Array(buffer, 0, HEADER_LENGTH_INT);

    if (header[OFF_MAGIC] !== DDS_MAGIC) {
      throw new Error("THREE.DDSLoader: Invalid magic number in DDS header.");
    }

    let blockBytes: number;
    const fourCC = header[OFF_PF_FOUR_CC];
    let isRGBAUncompressed = false;
    let isRGBUncompressed = false;
    let dataOffset = header[OFF_SIZE] + 4;
    let format: number;

    switch (fourCC) {
      case FOURCC_DXT1:
        blockBytes = 8;
        format = PixelFormat.RGB_S3TC_DXT1;
        break;
      case FOURCC_DXT3:
        blockBytes = 16;
        format = PixelFormat.RGBA_S3TC_DXT3;
        break;
      case FOURCC_DXT5:
        blockBytes = 16;
        format = PixelFormat.RGBA_S3TC_DXT5;
        break;
      case FOURCC_ETC1:
        blockBytes = 8;
        format = PixelFormat.RGB_ETC1;
        break;
      case FOURCC_DX10: {
        dataOffset += EXTENDED_HEADER_LENGTH_INT * 4;
        if (buffer.byteLength < dataOffset) {
          throw new Error("THREE.DDSLoader: Not enough data to contain the DDS DX10 header.");
        }
        const extendedHeader = new Int32Array(buffer, (HEADER_LENGTH_INT + 1) * 4, EXTENDED_HEADER_LENGTH_INT);
        const dxgiFormat = extendedHeader[OFF_DXGI_FORMAT];
        if (dxgiFormat === DXGI_FORMAT_BC6H_SF16) {
          blockBytes = 16;
          format = PixelFormat.RGB_BPTC_SIGNED;
        } else if (dxgiFormat === DXGI_FORMAT_BC6H_UF16) {
          blockBytes = 16;
          format = PixelFormat.RGB_BPTC_UNSIGNED;
        } else {
          throw new Error("THREE.DDSLoader: Unsupported DXGI_FORMAT code " + dxgiFormat);
        }
        break;
      }
      default:
        if (
          header[OFF_RGB_BIT_COUNT] === 32 &&
          header[OFF_R_BIT_MASK] & 0xff0000 &&
          header[OFF_G_BIT_MASK] & 0xff00 &&
          header[OFF_B_BIT_MASK] & 0xff &&
          header[OFF_A_BIT_MASK] & 0xff000000
        ) {
          isRGBAUncompressed = true;
          blockBytes = 64;
          format = PixelFormat.RGBA;
        } else if (
          header[OFF_RGB_BIT_COUNT] === 24 &&
          header[OFF_R_BIT_MASK] & 0xff0000 &&
          header[OFF_G_BIT_MASK] & 0xff00 &&
          header[OFF_B_BIT_MASK] & 0xff
        ) {
          isRGBUncompressed = true;
          blockBytes = 64;
          format = PixelFormat.RGBA;
        } else {
          throw new Error("THREE.DDSLoader: Unsupported FourCC code " + int32ToFourCC(fourCC));
        }
    }

    let mipmapCount = 1;
    if ((header[OFF_FLAGS] & DDSD_MIPMAPCOUNT) !== 0 && loadMipmaps !== false) {
      mipmapCount = Math.max(1, header[OFF_MIPMAP_COUNT]);
    }

    const caps2 = header[OFF_CAPS2];
    const isCubemap = (caps2 & DDSCAPS2_CUBEMAP) !== 0;
    if (
      isCubemap &&
      (!(caps2 & DDSCAPS2_CUBEMAP_POSITIVEX) ||
        !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEX) ||
        !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEY) ||
        !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEY) ||
        !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEZ) ||
        !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEZ))
    ) {
      throw new Error("THREE.DDSLoader: Incomplete cubemap faces.");
    }

    const width = header[OFF_WIDTH];
    const height = header[OFF_HEIGHT];
    const mipmaps: CompressedTextureMipmap[] = [];
    const faces = isCubemap ? 6 : 1;

    for (let face = 0; face < faces; face++) {
      let mipWidth = width;
      let mipHeight = height;
      for (let i = 0; i < mipmapCount; i++) {
        let byteArray: Uint8Array;
        let dataLength: number;
        if (isRGBAUncompressed) {
          byteArray = loadARGBMip(buffer, dataOffset, mipWidth, mipHeight);
          dataLength = byteArray.length;
        } else if (isRGBUncompressed) {
          byteArray = loadRGBMip(buffer, dataOffset, mipWidth, mipHeight);
          dataLength = mipWidth * mipHeight * 3;
        } else {
          dataLength = Math.ceil(mipWidth / 4) * Math.ceil(mipHeight / 4) * blockBytes;
          byteArray = new Uint8Array(buffer, dataOffset, dataLength);
        }
        mipmaps.push({ data: byteArray, width: mipWidth, height: mipHeight });
        dataOffset += dataLength;
        mipWidth = Math.max(mipWidth >> 1, 1);
        mipHeight = Math.max(mipHeight >> 1, 1);
      }
    }

    return { mipmaps, width, height, format, mipmapCount, isCubemap };
  }
}
