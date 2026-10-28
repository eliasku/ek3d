import { CompressedTextureLoader } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureData } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureMipmap } from "../../textures/CompressedTexture";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { PixelFormat } from "../../constants";

const HEADER_LENGTH_INT = 13;

interface PvrDatas {
  buffer: ArrayBuffer;
  header: Uint32Array;
  dataPtr?: number;
  bpp?: number;
  format?: number;
  width?: number;
  height?: number;
  numSurfaces?: number;
  numMipmaps?: number;
  isCubemap?: boolean;
}

/**
 * A loader for the PVRTC texture compression format in PVR v2 and v3 containers.
 *
 * Unsupported containers and format codes throw during parsing, so a driver without PVRTC
 * support reports a failure through the loading manager instead of rendering blank geometry.
 *
 * ```typescript
 * import { PVRLoader } from "ek3d/addons/loaders/PVRLoader";
 * import { ColorSpace } from "ek3d/constants";
 *
 * const map = await new PVRLoader().loadAsync("textures/compressed/disturb_4bpp_rgb.pvr");
 * map.colorSpace = ColorSpace.SRGB; // only for color textures
 * ```
 */
export class PVRLoader extends CompressedTextureLoader {
  /**
   * Constructs a new PVR loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Parses the given PVRTC texture data.
   *
   * @param buffer - The raw texture data.
   * @return An object representing the parsed texture data.
   */
  parse(buffer: ArrayBuffer): CompressedTextureData {
    if (buffer.byteLength < HEADER_LENGTH_INT * 4) {
      throw new Error("THREE.PVRLoader: Not enough data to contain a PVR header.");
    }
    const header = new Uint32Array(buffer, 0, HEADER_LENGTH_INT);
    const pvrDatas: PvrDatas = { buffer, header };

    if (header[0] === 0x03525650) {
      // PVR v3
      return parseV3(pvrDatas);
    } else if (header[11] === 0x21525650) {
      // PVR v2
      return parseV2(pvrDatas);
    }
    throw new Error("THREE.PVRLoader: Unknown PVR format.");
  }
}

function parseV3(pvrDatas: PvrDatas): CompressedTextureData {
  const header = pvrDatas.header;
  const metaLen = header[12];
  const pixelFormat = header[2];
  const height = header[6];
  const width = header[7];
  const numFaces = header[10];
  const numMipmaps = header[11];

  let bpp: number;
  let format: number;
  switch (pixelFormat) {
    case 0: // PVRTC 2bpp RGB
      bpp = 2;
      format = PixelFormat.RGB_PVRTC_2BPPV1;
      break;
    case 1: // PVRTC 2bpp RGBA
      bpp = 2;
      format = PixelFormat.RGBA_PVRTC_2BPPV1;
      break;
    case 2: // PVRTC 4bpp RGB
      bpp = 4;
      format = PixelFormat.RGB_PVRTC_4BPPV1;
      break;
    case 3: // PVRTC 4bpp RGBA
      bpp = 4;
      format = PixelFormat.RGBA_PVRTC_4BPPV1;
      break;
    default:
      throw new Error("THREE.PVRLoader: Unsupported PVR format: " + pixelFormat);
  }

  pvrDatas.dataPtr = 52 + metaLen;
  pvrDatas.bpp = bpp;
  pvrDatas.format = format;
  pvrDatas.width = width;
  pvrDatas.height = height;
  pvrDatas.numSurfaces = numFaces;
  pvrDatas.numMipmaps = numMipmaps;
  pvrDatas.isCubemap = numFaces === 6;
  return extract(pvrDatas);
}

function parseV2(pvrDatas: PvrDatas): CompressedTextureData {
  const header = pvrDatas.header;
  const headerLength = header[0];
  const height = header[1];
  const width = header[2];
  const numMipmaps = header[3];
  const flags = header[4];
  const bitmaskAlpha = header[10];
  const numSurfs = header[12];

  const TYPE_MASK = 0xff;
  const PVRTC_2 = 24;
  const PVRTC_4 = 25;

  const formatFlags = flags & TYPE_MASK;
  const hasAlpha = bitmaskAlpha > 0;
  let bpp: number;
  let format: number;

  if (formatFlags === PVRTC_4) {
    format = hasAlpha ? PixelFormat.RGBA_PVRTC_4BPPV1 : PixelFormat.RGB_PVRTC_4BPPV1;
    bpp = 4;
  } else if (formatFlags === PVRTC_2) {
    format = hasAlpha ? PixelFormat.RGBA_PVRTC_2BPPV1 : PixelFormat.RGB_PVRTC_2BPPV1;
    bpp = 2;
  } else {
    throw new Error("THREE.PVRLoader: Unknown PVR format: " + formatFlags);
  }

  pvrDatas.dataPtr = headerLength;
  pvrDatas.bpp = bpp;
  pvrDatas.format = format;
  pvrDatas.width = width;
  pvrDatas.height = height;
  pvrDatas.numSurfaces = numSurfs;
  pvrDatas.numMipmaps = numMipmaps + 1;
  // v2 has no explicit cubemap flag: six surfaces are treated as a cube.
  pvrDatas.isCubemap = numSurfs === 6;
  return extract(pvrDatas);
}

function extract(pvrDatas: PvrDatas): CompressedTextureData {
  const width = pvrDatas.width ?? 0;
  const height = pvrDatas.height ?? 0;
  const format = pvrDatas.format ?? 0;
  const numMipmaps = pvrDatas.numMipmaps ?? 1;
  const numSurfs = pvrDatas.numSurfaces ?? 1;
  const isCubemap = pvrDatas.isCubemap === true;
  const pvr: CompressedTextureData = { mipmaps: [], width, height, format, mipmapCount: numMipmaps, isCubemap };

  const buffer = pvrDatas.buffer;
  let dataOffset = pvrDatas.dataPtr ?? 0;
  const bpp = pvrDatas.bpp ?? 0;

  // PVRTC packs one 8x4 texel block at 2bpp, or one 4x4 block at 4bpp.
  const blockWidth = bpp === 2 ? 8 : 4;
  const blockSize = (blockWidth * 4 * bpp) / 8;
  const mipmaps: CompressedTextureMipmap[] = Array.from({ length: numMipmaps * numSurfs });

  for (let mipLevel = 0; mipLevel < numMipmaps; mipLevel++) {
    const sWidth = Math.max(width >> mipLevel, 1);
    const sHeight = Math.max(height >> mipLevel, 1);
    // PVRTC clamps each dimension to at least two blocks.
    const widthBlocks = Math.max(sWidth / blockWidth, 2);
    const heightBlocks = Math.max(sHeight / 4, 2);
    const dataSize = widthBlocks * heightBlocks * blockSize;

    for (let surfIndex = 0; surfIndex < numSurfs; surfIndex++) {
      if (dataOffset + dataSize > buffer.byteLength) {
        throw new Error("THREE.PVRLoader: Truncated PVR image data for level " + mipLevel + ".");
      }
      const byteArray = new Uint8Array(buffer, dataOffset, dataSize);
      mipmaps[surfIndex * numMipmaps + mipLevel] = { data: byteArray, width: sWidth, height: sHeight };
      dataOffset += dataSize;
    }
  }

  pvr.mipmaps = mipmaps;
  return pvr;
}
