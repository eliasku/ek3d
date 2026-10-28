/**
 * Minimal KTX 2.0 container reader and the subset of Khronos constants the
 * ({@link https://registry.khronos.org/KTX/specs/2.0/ktx-2.0.html|KTX 2.0})
 * loader needs. Mirrors the container shape of the vendored `ktx-parse`
 * `read()` used upstream; only the fields `KTX2Loader` consumes are decoded.
 *
 * Vendor exclusion: `ktx-parse`/`zstddec` are third-party runtime supplied by
 * the consumer, same as the meshopt decoder; this port ships its own container
 * parser instead.
 */

export const KHR_DF_FLAG_ALPHA_PREMULTIPLIED = 1;
export const KHR_DF_PRIMARIES_UNSPECIFIED = 0;
export const KHR_DF_PRIMARIES_BT709 = 1;
export const KHR_DF_PRIMARIES_DISPLAYP3 = 10;

export const KHR_DF_TRANSFER_UNSPECIFIED = 0;
export const KHR_DF_TRANSFER_LINEAR = 1;
export const KHR_DF_TRANSFER_SRGB = 2;

export const KHR_SUPERCOMPRESSION_NONE = 0;
export const KHR_SUPERCOMPRESSION_BASIS = 1;
export const KHR_SUPERCOMPRESSION_ZSTD = 2;
export const KHR_SUPERCOMPRESSION_ZLIB = 4;

/** Set on a DFD sample channelType when the sample values are signed integers. */
export const KHR_DF_SAMPLE_DATATYPE_SIGNED = 64;

/** Vulkan format numbers for the formats KTX2Loader maps; 10000xxxx range are Khronos extensions. */
export const VK_FORMAT_UNDEFINED = 0;
export const VK_FORMAT_R8_UNORM = 9;
export const VK_FORMAT_R8_SRGB = 15;
export const VK_FORMAT_R8G8_UNORM = 16;
export const VK_FORMAT_R8G8_SRGB = 22;
export const VK_FORMAT_R16_SFLOAT = 76;
export const VK_FORMAT_R32_SFLOAT = 100;
export const VK_FORMAT_R16G16_SFLOAT = 83;
export const VK_FORMAT_R32G32_SFLOAT = 103;
export const VK_FORMAT_R8G8B8A8_UNORM = 37;
export const VK_FORMAT_R8G8B8A8_SRGB = 43;
export const VK_FORMAT_R16G16B16A16_UNORM = 91;
export const VK_FORMAT_R16G16B16A16_SFLOAT = 97;
export const VK_FORMAT_R32G32B32A32_SFLOAT = 109;
export const VK_FORMAT_B10G11R11_UFLOAT_PACK32 = 122;
export const VK_FORMAT_E5B9G9R9_UFLOAT_PACK32 = 123;

export const VK_FORMAT_BC1_RGB_UNORM_BLOCK = 131;
export const VK_FORMAT_BC1_RGB_SRGB_BLOCK = 132;
export const VK_FORMAT_BC1_RGBA_UNORM_BLOCK = 133;
export const VK_FORMAT_BC1_RGBA_SRGB_BLOCK = 134;
export const VK_FORMAT_BC3_UNORM_BLOCK = 137;
export const VK_FORMAT_BC3_SRGB_BLOCK = 138;
export const VK_FORMAT_BC4_UNORM_BLOCK = 139;
export const VK_FORMAT_BC4_SNORM_BLOCK = 140;
export const VK_FORMAT_BC5_UNORM_BLOCK = 141;
export const VK_FORMAT_BC5_SNORM_BLOCK = 142;
export const VK_FORMAT_BC7_UNORM_BLOCK = 145;
export const VK_FORMAT_BC7_SRGB_BLOCK = 146;

export const VK_FORMAT_ETC2_R8G8B8_SRGB_BLOCK = 148;
export const VK_FORMAT_ETC2_R8G8B8A8_SRGB_BLOCK = 152;

export const VK_FORMAT_EAC_R11_UNORM_BLOCK = 153;
export const VK_FORMAT_EAC_R11_SNORM_BLOCK = 154;
export const VK_FORMAT_EAC_R11G11_UNORM_BLOCK = 155;
export const VK_FORMAT_EAC_R11G11_SNORM_BLOCK = 156;

export const VK_FORMAT_ASTC_4x4_UNORM_BLOCK = 157;
export const VK_FORMAT_ASTC_4x4_SRGB_BLOCK = 158;
export const VK_FORMAT_ASTC_6x6_UNORM_BLOCK = 165;
export const VK_FORMAT_ASTC_6x6_SRGB_BLOCK = 166;

export const VK_FORMAT_ASTC_4x4_SFLOAT_BLOCK_EXT = 1000066000;
export const VK_FORMAT_ASTC_6x6_SFLOAT_BLOCK_EXT = 1000066004;

export const VK_FORMAT_PVRTC1_2BPP_UNORM_BLOCK_IMG = 1000054000;
export const VK_FORMAT_PVRTC1_2BPP_SRGB_BLOCK_IMG = 1000054004;
export const VK_FORMAT_PVRTC1_4BPP_UNORM_BLOCK_IMG = 1000054001;
export const VK_FORMAT_PVRTC1_4BPP_SRGB_BLOCK_IMG = 1000054005;

/** One parsed mip level: `levelData` aliases the source buffer. */
export interface KTX2Level {
  levelData: Uint8Array;
  uncompressedByteLength: number;
}

/** Basis Universal supercompression global data block (`KTX2Loader` only carries it). */
export interface KTX2GlobalData {
  endpointCount: number;
  selectorCount: number;
  imageDescs: {
    imageFlags: number;
    rgbSliceByteOffset: number;
    rgbSliceByteLength: number;
    alphaSliceByteOffset: number;
    alphaSliceByteLength: number;
  }[];
  endpointsData: Uint8Array;
  selectorsData: Uint8Array;
  tablesData: Uint8Array;
  extendedData: Uint8Array;
}

/** One DFD sample. */
export interface KTX2DFDSample {
  bitOffset: number;
  bitLength: number;
  channelType: number;
  samplePosition: number[];
  sampleLower: number;
  sampleUpper: number;
}

/** Basic data format descriptor block (`KHR_df2` texture metadata). */
export interface KTX2DFD {
  vendorId: number;
  descriptorType: number;
  versionNumber: number;
  colorModel: number;
  colorPrimaries: number;
  transferFunction: number;
  flags: number;
  texelBlockDimension: number[];
  bytesPlane: number[];
  samples: KTX2DFDSample[];
}

/** Parsed KTX 2.0 container; the shape `KTX2Loader` consumes. */
export interface KTX2Container {
  vkFormat: number;
  typeSize: number;
  pixelWidth: number;
  pixelHeight: number;
  pixelDepth: number;
  layerCount: number;
  faceCount: number;
  levelCount: number;
  supercompressionScheme: number;
  levels: KTX2Level[];
  dataFormatDescriptor: KTX2DFD[];
  keyValue: Record<string, string>;
  globalData: KTX2GlobalData | null;
}

const MAGIC = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0xd, 0xa, 0x1a, 0xa];

class ByteCursor {
  dataView: DataView;
  littleEndian: boolean;
  offset: number;

  constructor(data: Uint8Array, offset: number, length: number, littleEndian: boolean) {
    this.dataView = new DataView(data.buffer, data.byteOffset + offset, length);
    this.littleEndian = littleEndian;
    this.offset = 0;
  }

  _nextUint8(): number {
    const value = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  _nextUint16(): number {
    const value = this.dataView.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  _nextUint32(): number {
    const value = this.dataView.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  _nextInt32(): number {
    const value = this.dataView.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  _nextUint64(): number {
    const value =
      this.dataView.getUint32(this.offset, this.littleEndian) +
      2 ** 32 * this.dataView.getUint32(this.offset + 4, this.littleEndian);
    this.offset += 8;
    return value;
  }

  _skip(length: number): this {
    this.offset += length;
    return this;
  }

  _scan(length: number, terminator: number = 0): Uint8Array {
    const start = this.offset;
    let result = 0;
    while (this.dataView.getUint8(this.offset) !== terminator && result < length) {
      result++;
      this.offset++;
    }
    if (result < length) this.offset++;
    return new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + start, result);
  }
}
/** Parses a KTX 2.0 container from the given bytes (the `read()` contract). */
export function read(data: Uint8Array): KTX2Container {
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) throw new Error("Missing KTX 2.0 identifier.");
  }

  const container: KTX2Container = {
    vkFormat: 0,
    typeSize: 1,
    pixelWidth: 0,
    pixelHeight: 0,
    pixelDepth: 0,
    layerCount: 0,
    faceCount: 1,
    levelCount: 0,
    supercompressionScheme: 0,
    levels: [],
    dataFormatDescriptor: [
      {
        vendorId: 0,
        descriptorType: 0,
        versionNumber: 2,
        colorModel: 0,
        colorPrimaries: 1,
        transferFunction: 2,
        flags: 0,
        texelBlockDimension: [0, 0, 0, 0],
        bytesPlane: [0, 0, 0, 0, 0, 0, 0, 0],
        samples: [],
      },
    ],
    keyValue: {},
    globalData: null,
  };

  const header = new ByteCursor(data, MAGIC.length, 68, true); // 9 u32 + 4 u32 + 2 u64
  container.vkFormat = header._nextUint32();
  container.typeSize = header._nextUint32();
  container.pixelWidth = header._nextUint32();
  container.pixelHeight = header._nextUint32();
  container.pixelDepth = header._nextUint32();
  container.layerCount = header._nextUint32();
  container.faceCount = header._nextUint32();
  container.levelCount = header._nextUint32();
  container.supercompressionScheme = header._nextUint32();
  const dfdByteOffset = header._nextUint32();
  const dfdByteLength = header._nextUint32();
  const kvpByteOffset = header._nextUint32();
  const kvpByteLength = header._nextUint32();

  const sgdByteOffset = header._nextUint64();
  const sgdByteLength = header._nextUint64();

  // Level index: 3 * max(levelCount, 1) u64 values.
  const levelIndex = new ByteCursor(data, MAGIC.length + 68, 3 * Math.max(container.levelCount, 1) * 8, true);
  for (let i = 0, levelCount = Math.max(container.levelCount, 1); i < levelCount; i++) {
    container.levels.push({
      levelData: new Uint8Array(data.buffer, data.byteOffset + levelIndex._nextUint64(), levelIndex._nextUint64()),
      uncompressedByteLength: levelIndex._nextUint64(),
    });
  }

  // Data format descriptor.
  if (dfdByteLength > 0) {
    const dfd = new ByteCursor(data, dfdByteOffset, dfdByteLength, true);
    dfd._skip(4); // total size of the descriptor section
    const vendorId = dfd._nextUint16();
    const descriptorType = dfd._nextUint16();
    const versionNumber = dfd._nextUint16();
    const descriptorBlockSize = dfd._nextUint16();
    const dfdBlock: KTX2DFD = {
      vendorId,
      descriptorType,
      versionNumber,
      colorModel: dfd._nextUint8(),
      colorPrimaries: dfd._nextUint8(),
      transferFunction: dfd._nextUint8(),
      flags: dfd._nextUint8(),
      texelBlockDimension: [dfd._nextUint8(), dfd._nextUint8(), dfd._nextUint8(), dfd._nextUint8()],
      bytesPlane: [
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
        dfd._nextUint8(),
      ],
      samples: [],
    };
    const sampleCount = (descriptorBlockSize / 4 - 6) / 4;
    for (let i = 0; i < sampleCount; i++) {
      const sample: KTX2DFDSample = {
        bitOffset: dfd._nextUint16(),
        bitLength: dfd._nextUint8(),
        channelType: dfd._nextUint8(),
        samplePosition: [dfd._nextUint8(), dfd._nextUint8(), dfd._nextUint8(), dfd._nextUint8()],
        sampleLower: Number.NEGATIVE_INFINITY,
        sampleUpper: Number.POSITIVE_INFINITY,
      };
      if (sample.channelType & KHR_DF_SAMPLE_DATATYPE_SIGNED) {
        sample.sampleLower = dfd._nextInt32();
        sample.sampleUpper = dfd._nextInt32();
      } else {
        sample.sampleLower = dfd._nextUint32();
        sample.sampleUpper = dfd._nextUint32();
      }
      dfdBlock.samples.push(sample);
    }
    container.dataFormatDescriptor.length = 0;
    container.dataFormatDescriptor.push(dfdBlock);
    dfd._skip(descriptorBlockSize - 28 - sampleCount * 16);
  }

  // Key/value metadata.
  if (kvpByteLength > 0) {
    const kvp = new ByteCursor(data, kvpByteOffset, kvpByteLength, true);
    while (kvp.offset < kvpByteLength) {
      const keyAndValueByteLength = kvp._nextUint32();
      if (keyAndValueByteLength === 0) break;
      const key = kvp._scan(keyAndValueByteLength);
      const value = new Uint8Array(
        data.buffer,
        data.byteOffset + kvpByteOffset + kvp.offset,
        keyAndValueByteLength - key.byteLength - 1,
      );
      kvp.offset += keyAndValueByteLength - key.byteLength - 1;
      const keyText = new TextDecoder().decode(key);
      const valueText = new TextDecoder().decode(value);
      container.keyValue[keyText] = /^ktx/i.test(keyText)
        ? valueText.substring(0, valueText.lastIndexOf("\x00"))
        : valueText;
      kvp._skip(keyAndValueByteLength % 4 ? 4 - (keyAndValueByteLength % 4) : 0);
    }
  }

  // Basis Universal supercompression global data.
  if (sgdByteLength > 0) {
    const sgd = new ByteCursor(data, sgdByteOffset, sgdByteLength, true);
    const endpointCount = sgd._nextUint16();
    const selectorCount = sgd._nextUint16();
    const endpointsByteLength = sgd._nextUint32();
    const selectorsByteLength = sgd._nextUint32();
    const tablesByteLength = sgd._nextUint32();
    const extendedByteLength = sgd._nextUint32();
    const imageDescs = [];
    for (let i = 0, levelCount = Math.max(container.levelCount, 1); i < levelCount; i++) {
      imageDescs.push({
        imageFlags: sgd._nextUint32(),
        rgbSliceByteOffset: sgd._nextUint32(),
        rgbSliceByteLength: sgd._nextUint32(),
        alphaSliceByteOffset: sgd._nextUint32(),
        alphaSliceByteLength: sgd._nextUint32(),
      });
    }
    const globalDataStart = sgdByteOffset + sgd.offset;
    const endpointsStart = globalDataStart;
    const selectorsStart = endpointsStart + endpointsByteLength;
    const tablesStart = selectorsStart + selectorsByteLength;
    const extendedStart = tablesStart + tablesByteLength;
    container.globalData = {
      endpointCount,
      selectorCount,
      imageDescs,
      endpointsData: new Uint8Array(data.buffer, data.byteOffset + endpointsStart, endpointsByteLength),
      selectorsData: new Uint8Array(data.buffer, data.byteOffset + selectorsStart, selectorsByteLength),
      tablesData: new Uint8Array(data.buffer, data.byteOffset + tablesStart, tablesByteLength),
      extendedData: new Uint8Array(data.buffer, data.byteOffset + extendedStart, extendedByteLength),
    };
  }

  return container;
}
