import { ColorManagement } from "../../math/ColorManagement";
import { DataTexture } from "../../textures/DataTexture";
import type { Data3DTexture } from "../../textures/Data3DTexture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import {
  FloatType,
  HalfFloatType,
  UnsignedByteType,
  RGBAFormat,
  RGFormat,
  RedFormat,
  NoColorSpace,
  LinearSRGBColorSpace,
  SRGBColorSpace,
  SRGBTransfer,
  REVISION,
} from "../../constants";
import type { KTX2Container } from "../loaders/KTX2Container";

/** The ktx-parse runtime is supplied by the consumer, not bundled with ek3d. */
export interface KTX2Writer {
  createDefaultContainer(): KTX2Container;
  write(container: KTX2Container, options: { keepWriter: boolean }): Uint8Array;
  KHR_DF_CHANNEL_RGBSDA_RED: number;
  KHR_DF_CHANNEL_RGBSDA_GREEN: number;
  KHR_DF_CHANNEL_RGBSDA_BLUE: number;
  KHR_DF_CHANNEL_RGBSDA_ALPHA: number;
  KHR_DF_MODEL_RGBSDA: number;
  KHR_DF_PRIMARIES_BT709: number;
  KHR_DF_PRIMARIES_UNSPECIFIED: number;
  KHR_DF_SAMPLE_DATATYPE_FLOAT: number;
  KHR_DF_SAMPLE_DATATYPE_LINEAR: number;
  KHR_DF_SAMPLE_DATATYPE_SIGNED: number;
  KHR_DF_TRANSFER_LINEAR: number;
  KHR_DF_TRANSFER_SRGB: number;
  VK_FORMAT_R16_SFLOAT: number;
  VK_FORMAT_R16G16_SFLOAT: number;
  VK_FORMAT_R16G16B16A16_SFLOAT: number;
  VK_FORMAT_R32_SFLOAT: number;
  VK_FORMAT_R32G32_SFLOAT: number;
  VK_FORMAT_R32G32B32A32_SFLOAT: number;
  VK_FORMAT_R8_SRGB: number;
  VK_FORMAT_R8_UNORM: number;
  VK_FORMAT_R8G8_SRGB: number;
  VK_FORMAT_R8G8_UNORM: number;
  VK_FORMAT_R8G8B8A8_SRGB: number;
  VK_FORMAT_R8G8B8A8_UNORM: number;
}

export class KTX2Exporter {
  writer: KTX2Writer;

  constructor(writer: KTX2Writer) {
    this.writer = writer;
  }

  async parse(input: DataTexture | Data3DTexture | WebGLRenderer, target?: WebGLRenderTarget): Promise<Uint8Array> {
    let texture: DataTexture | Data3DTexture;
    if (
      input &&
      (("isDataTexture" in input && input.isDataTexture) || ("isData3DTexture" in input && input.isData3DTexture))
    ) {
      texture = input as DataTexture | Data3DTexture;
    } else if (input && "isWebGLRenderer" in input && input.isWebGLRenderer && target?.isRenderTarget) {
      const count = channelCount(target.texture.format);
      const size = target.width * target.height * count;
      const data =
        target.texture.type === FloatType
          ? new Float32Array(size)
          : target.texture.type === HalfFloatType
            ? new Uint16Array(size)
            : target.texture.type === UnsignedByteType
              ? new Uint8Array(size)
              : null;
      if (!data)
        throw new Error("THREE.KTX2Exporter: Supported types are FloatType, HalfFloatType, or UnsignedByteType.");
      await input.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, data);
      texture = new DataTexture(data, target.width, target.height, target.texture.format, target.texture.type);
      texture.colorSpace = target.texture.colorSpace;
    } else {
      throw new Error(
        "THREE.KTX2Exporter: Supported inputs are DataTexture, Data3DTexture, or WebGLRenderer and WebGLRenderTarget.",
      );
    }

    const count = channelCount(texture.format);
    const w = this.writer;
    const formats: Record<number, Record<number, Record<string, number>>> = {
      [RGBAFormat]: {
        [FloatType]: {
          [NoColorSpace]: w.VK_FORMAT_R32G32B32A32_SFLOAT,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R32G32B32A32_SFLOAT,
        },
        [HalfFloatType]: {
          [NoColorSpace]: w.VK_FORMAT_R16G16B16A16_SFLOAT,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R16G16B16A16_SFLOAT,
        },
        [UnsignedByteType]: {
          [NoColorSpace]: w.VK_FORMAT_R8G8B8A8_UNORM,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R8G8B8A8_UNORM,
          [SRGBColorSpace]: w.VK_FORMAT_R8G8B8A8_SRGB,
        },
      },
      [RGFormat]: {
        [FloatType]: { [NoColorSpace]: w.VK_FORMAT_R32G32_SFLOAT, [LinearSRGBColorSpace]: w.VK_FORMAT_R32G32_SFLOAT },
        [HalfFloatType]: {
          [NoColorSpace]: w.VK_FORMAT_R16G16_SFLOAT,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R16G16_SFLOAT,
        },
        [UnsignedByteType]: {
          [NoColorSpace]: w.VK_FORMAT_R8G8_UNORM,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R8G8_UNORM,
          [SRGBColorSpace]: w.VK_FORMAT_R8G8_SRGB,
        },
      },
      [RedFormat]: {
        [FloatType]: { [NoColorSpace]: w.VK_FORMAT_R32_SFLOAT, [LinearSRGBColorSpace]: w.VK_FORMAT_R32_SFLOAT },
        [HalfFloatType]: { [NoColorSpace]: w.VK_FORMAT_R16_SFLOAT, [LinearSRGBColorSpace]: w.VK_FORMAT_R16_SFLOAT },
        [UnsignedByteType]: {
          [NoColorSpace]: w.VK_FORMAT_R8_UNORM,
          [LinearSRGBColorSpace]: w.VK_FORMAT_R8_UNORM,
          [SRGBColorSpace]: w.VK_FORMAT_R8_SRGB,
        },
      },
    };
    const types = formats[texture.format];
    if (!types[texture.type])
      throw new Error("THREE.KTX2Exporter: Supported types are FloatType, HalfFloatType, or UnsignedByteType.");
    const format = types[texture.type][texture.colorSpace];
    if (format === undefined)
      throw new Error(
        "THREE.KTX2Exporter: Supported color spaces are SRGBColorSpace (UnsignedByteType only), LinearSRGBColorSpace, or NoColorSpace.",
      );
    const image = texture.image as {
      data: Uint8Array | Uint16Array | Float32Array | null;
      width: number;
      height: number;
      depth?: number;
    };
    const array = image.data;
    if (!array) throw new Error("THREE.KTX2Exporter: Texture has no pixel data.");
    const container = w.createDefaultContainer();
    container.vkFormat = format;
    container.typeSize = array.BYTES_PER_ELEMENT;
    container.pixelWidth = image.width;
    container.pixelHeight = image.height;
    if ("isData3DTexture" in texture && texture.isData3DTexture) container.pixelDepth = image.depth ?? 0;
    const desc = container.dataFormatDescriptor[0];
    desc.colorModel = w.KHR_DF_MODEL_RGBSDA;
    desc.colorPrimaries =
      texture.colorSpace === NoColorSpace ? w.KHR_DF_PRIMARIES_UNSPECIFIED : w.KHR_DF_PRIMARIES_BT709;
    desc.transferFunction =
      ColorManagement.getTransfer(texture.colorSpace) === SRGBTransfer
        ? w.KHR_DF_TRANSFER_SRGB
        : w.KHR_DF_TRANSFER_LINEAR;
    desc.texelBlockDimension = [0, 0, 0, 0];
    desc.bytesPlane = [container.typeSize * count, 0, 0, 0, 0, 0, 0, 0];
    const channels = [
      w.KHR_DF_CHANNEL_RGBSDA_RED,
      w.KHR_DF_CHANNEL_RGBSDA_GREEN,
      w.KHR_DF_CHANNEL_RGBSDA_BLUE,
      w.KHR_DF_CHANNEL_RGBSDA_ALPHA,
    ];
    for (let i = 0; i < count; i++) {
      let channelType = channels[i];
      if (channelType === w.KHR_DF_CHANNEL_RGBSDA_ALPHA && desc.transferFunction !== w.KHR_DF_TRANSFER_LINEAR)
        channelType |= w.KHR_DF_SAMPLE_DATATYPE_LINEAR;
      if (texture.type === FloatType || texture.type === HalfFloatType)
        channelType |= w.KHR_DF_SAMPLE_DATATYPE_FLOAT | w.KHR_DF_SAMPLE_DATATYPE_SIGNED;
      desc.samples.push({
        channelType,
        bitOffset: i * array.BYTES_PER_ELEMENT * 8,
        bitLength: array.BYTES_PER_ELEMENT * 8 - 1,
        samplePosition: [0, 0, 0, 0],
        sampleLower: texture.type === UnsignedByteType ? 0 : 0xbf800000,
        sampleUpper: texture.type === UnsignedByteType ? 255 : 0x3f800000,
      });
    }
    container.levelCount = 1;
    container.levels = [
      {
        levelData: new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
        uncompressedByteLength: array.byteLength,
      },
    ];
    container.keyValue.KTXwriter = `three.js ${REVISION}`;
    return w.write(container, { keepWriter: true });
  }
}

function channelCount(format: number): number {
  if (format === RGBAFormat) return 4;
  if (format === RGFormat) return 2;
  if (format === RedFormat) return 1;
  throw new Error("THREE.KTX2Exporter: Supported formats are RGBAFormat, RGFormat, or RedFormat.");
}
