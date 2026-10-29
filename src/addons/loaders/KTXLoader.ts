import { CompressedTextureLoader } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureData } from "../../loaders/CompressedTextureLoader";
import type { CompressedTextureMipmap } from "../../textures/CompressedTexture";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { PixelFormat } from "../../constants";

// identifier + header elements (not including key value meta-data pairs)
const HEADER_LEN = 12 + 13 * 4;

const KTX_IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

// Const enums cannot be enumerated; keep runtime file-format validation exhaustive.
const INTERNAL_FORMATS = {
  [PixelFormat.Alpha]: true,
  [PixelFormat.RGB]: true,
  [PixelFormat.RGBA]: true,
  [PixelFormat.Depth]: true,
  [PixelFormat.DepthStencil]: true,
  [PixelFormat.Red]: true,
  [PixelFormat.RedInteger]: true,
  [PixelFormat.RG]: true,
  [PixelFormat.RGInteger]: true,
  [PixelFormat.RGBInteger]: true,
  [PixelFormat.RGBAInteger]: true,
  [PixelFormat.RGB_S3TC_DXT1]: true,
  [PixelFormat.RGBA_S3TC_DXT1]: true,
  [PixelFormat.RGBA_S3TC_DXT3]: true,
  [PixelFormat.RGBA_S3TC_DXT5]: true,
  [PixelFormat.RGB_PVRTC_4BPPV1]: true,
  [PixelFormat.RGB_PVRTC_2BPPV1]: true,
  [PixelFormat.RGBA_PVRTC_4BPPV1]: true,
  [PixelFormat.RGBA_PVRTC_2BPPV1]: true,
  [PixelFormat.RGB_ETC1]: true,
  [PixelFormat.RGB_ETC2]: true,
  [PixelFormat.RGBA_ETC2_EAC]: true,
  [PixelFormat.R11_EAC]: true,
  [PixelFormat.SIGNED_R11_EAC]: true,
  [PixelFormat.RG11_EAC]: true,
  [PixelFormat.SIGNED_RG11_EAC]: true,
  [PixelFormat.RGBA_ASTC_4x4]: true,
  [PixelFormat.RGBA_ASTC_5x4]: true,
  [PixelFormat.RGBA_ASTC_5x5]: true,
  [PixelFormat.RGBA_ASTC_6x5]: true,
  [PixelFormat.RGBA_ASTC_6x6]: true,
  [PixelFormat.RGBA_ASTC_8x5]: true,
  [PixelFormat.RGBA_ASTC_8x6]: true,
  [PixelFormat.RGBA_ASTC_8x8]: true,
  [PixelFormat.RGBA_ASTC_10x5]: true,
  [PixelFormat.RGBA_ASTC_10x6]: true,
  [PixelFormat.RGBA_ASTC_10x8]: true,
  [PixelFormat.RGBA_ASTC_10x10]: true,
  [PixelFormat.RGBA_ASTC_12x10]: true,
  [PixelFormat.RGBA_ASTC_12x12]: true,
  [PixelFormat.RGBA_BPTC]: true,
  [PixelFormat.RGB_BPTC_SIGNED]: true,
  [PixelFormat.RGB_BPTC_UNSIGNED]: true,
  [PixelFormat.RED_RGTC1]: true,
  [PixelFormat.SIGNED_RED_RGTC1]: true,
  [PixelFormat.RED_GREEN_RGTC2]: true,
  [PixelFormat.SIGNED_RED_GREEN_RGTC2]: true,
} satisfies Record<PixelFormat, true>;

/**
 * Reader for the KTX 1.1 container that {@link KTXLoader} parses. Unsupported layouts
 * (uncompressed data, 3D textures, array textures, unexpected faces) throw instead of
 * returning empty maps.
 */
class KhronosTextureContainer {
  arrayBuffer: ArrayBuffer;
  littleEndian: boolean = true;
  glInternalFormat: number = 0;
  pixelWidth: number = 0;
  pixelHeight: number = 0;
  pixelDepth: number = 0;
  numberOfArrayElements: number = 0;
  numberOfFaces: number = 0;
  numberOfMipmapLevels: number = 0;
  bytesOfKeyValueData: number = 0;

  /**
   * @param arrayBuffer - Contents of the KTX container file.
   * @param facesExpected - Either 1 or 6, depending on whether a cube texture is expected.
   */
  constructor(arrayBuffer: ArrayBuffer, facesExpected: number) {
    this.arrayBuffer = arrayBuffer;
    if (arrayBuffer.byteLength < HEADER_LEN) throw new Error("THREE.KTXLoader: File too short for a KTX header.");
    const identifier = new Uint8Array(arrayBuffer, 0, 12);
    for (let i = 0; i < 12; i++) {
      if (identifier[i] !== KTX_IDENTIFIER[i]) throw new Error("THREE.KTXLoader: File missing KTX identifier.");
    }

    // The remaining header uses native 32 bit unsigned integers with a self-describing endianness word.
    const dataSize = Uint32Array.BYTES_PER_ELEMENT;
    const headerDataView = new DataView(arrayBuffer, 12, 13 * dataSize);
    this.littleEndian = headerDataView.getUint32(0, true) === 0x04030201;
    const read = (index: number) => headerDataView.getUint32(index * dataSize, this.littleEndian);
    const glType = read(1);
    this.glInternalFormat = read(4);
    this.pixelWidth = read(6);
    this.pixelHeight = read(7);
    this.pixelDepth = read(8);
    this.numberOfArrayElements = read(9);
    this.numberOfFaces = read(10);
    this.numberOfMipmapLevels = read(11);
    this.bytesOfKeyValueData = read(12);

    if (glType !== 0) throw new Error("THREE.KTXLoader: Only compressed formats are supported.");
    // A zero level count asks the driver to generate mipmaps, which compressed formats disallow.
    this.numberOfMipmapLevels = Math.max(1, this.numberOfMipmapLevels);

    if (this.pixelHeight === 0 || this.pixelDepth !== 0) {
      throw new Error("THREE.KTXLoader: Only 2D textures are supported.");
    }
    if (this.numberOfArrayElements !== 0) throw new Error("THREE.KTXLoader: Texture arrays are not supported.");
    if (this.numberOfFaces !== facesExpected) {
      throw new Error(
        "THREE.KTXLoader: Number of faces expected " + facesExpected + ", but found " + this.numberOfFaces,
      );
    }
  }

  /** Reads the mip levels, optionally only the base level. */
  mipmaps(loadMipmaps: boolean): CompressedTextureMipmap[] {
    const mipmaps: CompressedTextureMipmap[] = [];
    const dataView = new DataView(this.arrayBuffer);
    let dataOffset = HEADER_LEN + this.bytesOfKeyValueData;
    let width = this.pixelWidth;
    let height = this.pixelHeight;
    const mipmapCount = loadMipmaps ? this.numberOfMipmapLevels : 1;

    for (let level = 0; level < mipmapCount; level++) {
      if (dataOffset + 4 > this.arrayBuffer.byteLength) {
        throw new Error("THREE.KTXLoader: Truncated KTX image size for level " + level + ".");
      }
      // Size per face; array cubemaps are not supported.
      const imageSize = dataView.getUint32(dataOffset, this.littleEndian);
      dataOffset += 4;

      for (let face = 0; face < this.numberOfFaces; face++) {
        if (dataOffset + imageSize > this.arrayBuffer.byteLength) {
          throw new Error("THREE.KTXLoader: Truncated KTX image data for level " + level + ".");
        }
        mipmaps.push({ data: new Uint8Array(this.arrayBuffer, dataOffset, imageSize), width, height });
        dataOffset += imageSize;
        // Levels and faces are padded to a four byte boundary.
        dataOffset += 3 - ((imageSize + 3) % 4);
      }

      width = Math.max(width >> 1, 1);
      height = Math.max(height >> 1, 1);
    }

    return mipmaps;
  }
}

/**
 * A loader for the KTX 1.1 texture compression container.
 *
 * The container stores a GPU compressed format directly; whether that format uploads depends on
 * the driver's compressed texture extensions. Unsupported containers throw during parsing.
 *
 * References:
 * - [The KTX File Format and Tools](https://www.khronos.org/opengles/sdk/tools/KTX/)
 * - [Babylon.JS khronosTextureContainer.ts](https://github.com/BabylonJS/Babylon.js/blob/master/src/Misc/khronosTextureContainer.ts)
 *
 * ```ts
 * import { KTXLoader } from "ek3d/addons/loaders/KTXLoader";
 * import { ColorSpace } from "ek3d/constants";
 *
 * const map = await new KTXLoader().loadAsync("textures/compressed/disturb_BC1.ktx");
 * map.colorSpace = ColorSpace.SRGB; // only for color textures
 * ```
 */
export class KTXLoader extends CompressedTextureLoader {
  /**
   * Constructs a new KTX loader.
   *
   * @param [manager] - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Parses the given KTX texture data.
   *
   * @param buffer - The raw texture data.
   * @param loadMipmaps - Whether to load mipmaps or not.
   * @return An object representing the parsed texture data.
   */
  parse(buffer: ArrayBuffer, loadMipmaps?: boolean): CompressedTextureData {
    const ktx = new KhronosTextureContainer(buffer, 1);
    const format = ktx.glInternalFormat;
    if (!Object.hasOwn(INTERNAL_FORMATS, format)) {
      throw new Error("THREE.KTXLoader: Unsupported internal format " + format);
    }
    return {
      mipmaps: ktx.mipmaps(loadMipmaps === true),
      width: ktx.pixelWidth,
      height: ktx.pixelHeight,
      format,
      isCubemap: ktx.numberOfFaces === 6,
      mipmapCount: ktx.numberOfMipmapLevels,
    };
  }
}
