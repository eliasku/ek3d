import { Wrapping, TextureType, TextureFilter, ColorSpace, PixelFormat, Mapping } from "../../constants";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { DataTexture } from "../../textures/DataTexture";
import { toHalfFloat } from "../../extras/DataUtils";
import { FileLoader } from "../../loaders/FileLoader";

/** Precalculated sRGB→linear lookup for byte-ish values 0..1023. */
export const SRGB_TO_LINEAR: Float64Array = new Float64Array(1024);
for (let i = 0; i < 1024; i++) {
  // (1/255) * 0.9478672986 = 0.003717127
  SRGB_TO_LINEAR[i] = Math.pow(i * 0.003717127 + 0.0521327014, 2.4);
}

/** Metadata shared between XMP and ISO 21496-1 sources. */
export interface UltraHDRMetadata {
  version: string | null;
  baseRenditionIsHDR: boolean | null;
  gainMapMin: number | null;
  gainMapMax: number | null;
  gamma: number | null;
  offsetSDR: number | null;
  offsetHDR: number | null;
  hdrCapacityMin: number | null;
  hdrCapacityMax: number | null;
}

/** Texture pixel payload assembled by the parser. */
export interface UltraHDRTextureData {
  width: number;
  height: number;
  data: Uint16Array | Float32Array;
  format: number;
  type: number;
}

/** JPEG segment list layout. */
interface JPEGSection {
  sectionType: number;
  section: Uint8Array;
  sectionOffset: number;
}

/**
 * A loader for the Ultra HDR Image Format.
 *
 * Existing HDR or EXR textures can be converted to Ultra HDR with this [tool](https://gainmap-creator.monogrid.com/).
 *
 * Current feature set:
 * - JPEG headers (required)
 * - XMP metadata (legacy format, supported)
 * - ISO 21496-1 metadata (current standard, supported)
 * - XMP validation (not implemented)
 * - EXIF profile (not implemented)
 * - ICC profile (not implemented)
 * - Binary storage for SDR & HDR images (required)
 * - Gainmap metadata (required)
 * - Non-JPEG image formats (not implemented)
 * - Primary image as an HDR image (not implemented)
 *
 * ```typescript
 * const loader = new UltraHDRLoader();
 * const texture = await loader.loadAsync( 'textures/equirectangular/ice_planet_close.jpg' );
 * texture.mapping = Mapping.EquirectangularReflection;
 *
 * scene.background = texture;
 * scene.environment = texture;
 * ```
 *
 * @augments Loader
 */
export class UltraHDRLoader extends Loader<DataTexture, string> {
  /**
   * The texture type.
   *
   * @default TextureType.HalfFloat
   */
  type: TextureType;

  /**
   * Constructs a new Ultra HDR loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);

    this.type = TextureType.HalfFloat;
  }

  /**
   * Sets the texture type.
   *
   * @param value - The texture type to set.
   * @return A reference to this loader.
   */
  setDataType(value: number): this {
    this.type = value;

    return this;
  }

  /**
   * Parses the given Ultra HDR texture data.
   *
   * @param buffer - The raw texture data.
   * @param onLoad - The `onLoad` callback.
   */
  parse(buffer: ArrayBuffer, onLoad?: (texData: UltraHDRTextureData) => void): void {
    const metadata: UltraHDRMetadata = {
      version: null,
      baseRenditionIsHDR: null,
      gainMapMin: null,
      gainMapMax: null,
      gamma: null,
      offsetSDR: null,
      offsetHDR: null,
      hdrCapacityMin: null,
      hdrCapacityMax: null,
    };
    const textDecoder = new TextDecoder();

    const bytes = new Uint8Array(buffer);

    const sections: JPEGSection[] = [];

    // JPEG segment-aware scanner using length headers
    let offset = 0;

    while (offset < bytes.length - 1) {
      // Find marker prefix
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }

      const markerType = bytes[offset + 1];

      // SOI (0xD8) - Start of Image, no length field
      if (markerType === 0xd8) {
        sections.push({
          sectionType: markerType,
          section: bytes.subarray(offset, offset + 2),
          sectionOffset: offset + 2,
        });

        offset += 2;
        continue;
      }

      // APP0-APP2 segments have length headers
      if (markerType === 0xe0 || markerType === 0xe1 || markerType === 0xe2) {
        // Length is stored as big-endian 16-bit value (includes length bytes, excludes marker)
        const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
        const segmentEnd = offset + 2 + segmentLength;

        sections.push({
          sectionType: markerType,
          section: bytes.subarray(offset, segmentEnd),
          sectionOffset: offset + 2,
        });

        offset = segmentEnd;
        continue;
      }

      // Skip other markers with length fields (0xC0-0xFE range, except RST and EOI)
      if (markerType >= 0xc0 && markerType <= 0xfe && markerType !== 0xd9 && (markerType < 0xd0 || markerType > 0xd7)) {
        const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
        offset += 2 + segmentLength;
        continue;
      }

      // EOI (0xD9) or RST markers (0xD0-0xD7) - no length field
      offset += 2;
    }

    let primaryImage: Uint8Array | undefined;
    let gainmapImage: Uint8Array | undefined;

    for (let i = 0; i < sections.length; i++) {
      const { sectionType, section, sectionOffset } = sections[i];

      if (sectionType === 0xe0) {
        /* JPEG Header - no useful information */
      } else if (sectionType === 0xe1) {
        /* APP1: XMP Metadata */

        this._parseXMPMetadata(textDecoder.decode(new Uint8Array(section)), metadata);
      } else if (sectionType === 0xe2) {
        /* APP2: Data Sections - MPF / ICC Profile / ISO 21496-1 Metadata */

        const sectionData = new DataView(section.buffer!, section.byteOffset + 2, section.byteLength - 2);

        // Check for ISO 21496-1 namespace: "urn:iso:std:iso:ts:21496:-1\0"
        const isoNameSpace = "urn:iso:std:iso:ts:21496:-1\0";
        if (section.byteLength >= isoNameSpace.length + 2) {
          let isISO = true;
          for (let j = 0; j < isoNameSpace.length; j++) {
            if (section[2 + j] !== isoNameSpace.charCodeAt(j)) {
              isISO = false;
              break;
            }
          }

          if (isISO) {
            // Parse ISO 21496-1 metadata
            const isoData = section.subarray(2 + isoNameSpace.length);
            this._parseISOMetadata(isoData, metadata);
            continue;
          }
        }

        // Check for MPF
        const sectionHeader = sectionData.getUint32(2, false);

        if (sectionHeader === 0x4d504600) {
          /* MPF Section */

          const mpfLittleEndian = sectionData.getUint32(6) === 0x49492a00;
          const mpfBytesOffset = 60;

          /* SDR size includes the metadata length, SDR offset is always 0 */

          const primaryImageSize = sectionData.getUint32(mpfBytesOffset, mpfLittleEndian);
          const primaryImageOffset = sectionData.getUint32(mpfBytesOffset + 4, mpfLittleEndian);

          /* Gainmap size is an absolute value starting from its offset, gainmap offset needs 6 bytes padding to take into account 0x00 bytes at the end of XMP */
          const gainmapImageSize = sectionData.getUint32(mpfBytesOffset + 16, mpfLittleEndian);
          const gainmapImageOffset = sectionData.getUint32(mpfBytesOffset + 20, mpfLittleEndian) + sectionOffset + 6;

          primaryImage = new Uint8Array(buffer, primaryImageOffset, primaryImageSize);

          gainmapImage = new Uint8Array(buffer, gainmapImageOffset, gainmapImageSize);
        }
      }
    }

    /* Minimal sufficient validation - https://developer.android.com/media/platform/hdr-image-format#signal_of_the_format */
    // Version can come from either XMP or ISO metadata
    if (!metadata.version) {
      throw new Error("THREE.UltraHDRLoader: Not a valid UltraHDR image");
    }

    if (primaryImage && gainmapImage && onLoad) {
      this._applyGainmapToSDR(
        metadata,
        primaryImage,
        gainmapImage,
        (hdrBuffer, width, height) => {
          onLoad({
            width,
            height,
            data: hdrBuffer,
            format: PixelFormat.RGBA,
            type: this.type,
          });
        },
        (error) => {
          throw new Error(error);
        },
      );
    } else {
      throw new Error("THREE.UltraHDRLoader: Could not parse UltraHDR images");
    }
  }

  /**
   * Starts loading from the given URL and passes the loaded Ultra HDR texture
   * to the `onLoad()` callback.
   *
   * @param url - The path/URL of the files to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   * @return The Ultra HDR texture.
   */
  override load(
    url: string,
    onLoad?: (texture: DataTexture, texData: UltraHDRTextureData) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): DataTexture {
    const texture = new DataTexture(
      this.type === TextureType.HalfFloat ? new Uint16Array() : new Float32Array(),
      0,
      0,
      PixelFormat.RGBA,
      this.type,
      Mapping.UV,
      Wrapping.ClampToEdge,
      Wrapping.ClampToEdge,
      TextureFilter.Linear,
      TextureFilter.LinearMipMapLinear,
      1,
      ColorSpace.LinearSRGB,
    );
    texture.generateMipmaps = true;
    texture.flipY = true;

    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setPath(this.path);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (buffer) => {
        try {
          this.parse(buffer as ArrayBuffer, (texData) => {
            texture.image = {
              data: texData.data,
              width: texData.width,
              height: texData.height,
            } as never;
            texture.needsUpdate = true;

            if (onLoad) onLoad(texture, texData);
          });
        } catch (error) {
          if (onError) onError(error);

          console.error(error);
        }
      },
      onProgress,
      onError,
    );

    return texture;
  }

  _parseXMPMetadata(xmpDataString: string, metadata: UltraHDRMetadata): void {
    const domParser = new DOMParser();

    const xmpXml = domParser.parseFromString(
      xmpDataString.substring(xmpDataString.indexOf("<"), xmpDataString.lastIndexOf(">") + 1),
      "text/xml",
    );

    /* Determine if given XMP metadata is the primary GContainer descriptor or a gainmap descriptor */
    const [hasHDRContainerDescriptor] = xmpXml.getElementsByTagName("Container:Directory") as unknown as Element[];

    if (hasHDRContainerDescriptor) {
      /* There's not much useful information in the container descriptor besides memory-validation */
    } else {
      /* Gainmap descriptor - defaults from https://developer.android.com/media/platform/hdr-image-format#HDR_gain_map_metadata */

      const [gainmapNode] = xmpXml.getElementsByTagName("rdf:Description") as unknown as Element[];

      metadata.version = gainmapNode.getAttribute("hdrgm:Version");
      metadata.baseRenditionIsHDR = gainmapNode.getAttribute("hdrgm:BaseRenditionIsHDR") === "True";
      metadata.gainMapMin = parseFloat(gainmapNode.getAttribute("hdrgm:GainMapMin") || "0.0");
      metadata.gainMapMax = parseFloat(gainmapNode.getAttribute("hdrgm:GainMapMax") || "1.0");
      metadata.gamma = parseFloat(gainmapNode.getAttribute("hdrgm:Gamma") || "1.0");
      metadata.offsetSDR = parseFloat(gainmapNode.getAttribute("hdrgm:OffsetSDR") || "0") / (1 / 64);
      metadata.offsetHDR = parseFloat(gainmapNode.getAttribute("hdrgm:OffsetHDR") || "0") / (1 / 64);
      metadata.hdrCapacityMin = parseFloat(gainmapNode.getAttribute("hdrgm:HDRCapacityMin") || "0.0");
      metadata.hdrCapacityMax = parseFloat(gainmapNode.getAttribute("hdrgm:HDRCapacityMax") || "1.0");
    }
  }

  _srgbToLinear(value: number): number {
    // 0.04045 * 255 = 10.31475
    if (value < 10.31475) {
      // (1/255) * 0.0773993808
      return value * 0.000303527;
    }

    if (value < 1024) {
      return SRGB_TO_LINEAR[value | 0];
    }

    // (1/255) * 0.9478672986 = 0.003717127
    return Math.pow(value * 0.003717127 + 0.0521327014, 2.4);
  }

  /**
   * Parses ISO 21496-1 gainmap metadata from binary data.
   *
   * @param data - The binary ISO metadata.
   * @param metadata - The metadata object to populate.
   */
  _parseISOMetadata(data: Uint8Array, metadata: UltraHDRMetadata): void {
    const view = new DataView(data.buffer as unknown as ArrayBuffer, data.byteOffset, data.byteLength);

    // Skip minimum version (2 bytes) and writer version (2 bytes)
    let offset = 4;

    // Read flags (1 byte)
    const flags = view.getUint8(offset);
    offset += 1;

    const backwardDirection = (flags & 0x4) !== 0;
    const useCommonDenominator = (flags & 0x8) !== 0;

    let gainMapMin: number;
    let gainMapMax: number;
    let gamma: number;
    let offsetSDR: number;
    let offsetHDR: number;
    let hdrCapacityMin: number;
    let hdrCapacityMax: number;

    if (useCommonDenominator) {
      // Read common denominator (4 bytes, unsigned)
      const commonDenominator = view.getUint32(offset, false);
      offset += 4;

      // Read baseHdrHeadroom (4 bytes, unsigned)
      const baseHdrHeadroomN = view.getUint32(offset, false);
      offset += 4;
      hdrCapacityMin = Math.log2(baseHdrHeadroomN / commonDenominator);

      // Read alternateHdrHeadroom (4 bytes, unsigned)
      const alternateHdrHeadroomN = view.getUint32(offset, false);
      offset += 4;
      hdrCapacityMax = Math.log2(alternateHdrHeadroomN / commonDenominator);

      // Read first channel (or only channel) parameters
      const gainMapMinN = view.getInt32(offset, false);
      offset += 4;
      gainMapMin = gainMapMinN / commonDenominator;

      const gainMapMaxN = view.getInt32(offset, false);
      offset += 4;
      gainMapMax = gainMapMaxN / commonDenominator;

      const gammaN = view.getUint32(offset, false);
      offset += 4;
      gamma = gammaN / commonDenominator;

      const offsetSDRN = view.getInt32(offset, false);
      offset += 4;
      offsetSDR = (offsetSDRN / commonDenominator) * 255.0;

      const offsetHDRN = view.getInt32(offset, false);
      offsetHDR = (offsetHDRN / commonDenominator) * 255.0;
    } else {
      const baseHdrHeadroomN = view.getUint32(offset, false);
      offset += 4;
      const baseHdrHeadroomD = view.getUint32(offset, false);
      offset += 4;
      hdrCapacityMin = Math.log2(baseHdrHeadroomN / baseHdrHeadroomD);

      const alternateHdrHeadroomN = view.getUint32(offset, false);
      offset += 4;
      const alternateHdrHeadroomD = view.getUint32(offset, false);
      offset += 4;
      hdrCapacityMax = Math.log2(alternateHdrHeadroomN / alternateHdrHeadroomD);

      const gainMapMinN = view.getInt32(offset, false);
      offset += 4;
      const gainMapMinD = view.getUint32(offset, false);
      offset += 4;
      gainMapMin = gainMapMinN / gainMapMinD;

      const gainMapMaxN = view.getInt32(offset, false);
      offset += 4;
      const gainMapMaxD = view.getUint32(offset, false);
      offset += 4;
      gainMapMax = gainMapMaxN / gainMapMaxD;

      const gammaN = view.getUint32(offset, false);
      offset += 4;
      const gammaD = view.getUint32(offset, false);
      offset += 4;
      gamma = gammaN / gammaD;

      const offsetSDRN = view.getInt32(offset, false);
      offset += 4;
      const offsetSDRD = view.getUint32(offset, false);
      offset += 4;
      offsetSDR = (offsetSDRN / offsetSDRD) * 255.0;

      const offsetHDRN = view.getInt32(offset, false);
      offset += 4;
      const offsetHDRD = view.getUint32(offset, false);
      offsetHDR = (offsetHDRN / offsetHDRD) * 255.0;
    }

    // The ISO variant does not encode a version string; use the current standard default.
    metadata.version = "1.0";
    metadata.baseRenditionIsHDR = backwardDirection;
    metadata.gainMapMin = gainMapMin;
    metadata.gainMapMax = gainMapMax;
    metadata.gamma = gamma;
    metadata.offsetSDR = offsetSDR;
    metadata.offsetHDR = offsetHDR;
    metadata.hdrCapacityMin = hdrCapacityMin;
    metadata.hdrCapacityMax = hdrCapacityMax;
  }

  _applyGainmapToSDR(
    metadata: UltraHDRMetadata,
    sdrBuffer: Uint8Array,
    gainmapBuffer: Uint8Array,
    onSuccess: (hdrBuffer: Uint16Array | Float32Array, width: number, height: number) => void,
    onError: (error: string) => void,
  ): void {
    const decodeImage = (data: Uint8Array) =>
      createImageBitmap(new Blob([data as unknown as BlobPart], { type: "image/jpeg" }));

    Promise.all([decodeImage(sdrBuffer), decodeImage(gainmapBuffer)])
      .then(([sdrImage, gainmapImage]) => {
        const sdrWidth = sdrImage.width;
        const sdrHeight = sdrImage.height;
        const sdrImageAspect = sdrWidth / sdrHeight;
        const gainmapImageAspect = gainmapImage.width / gainmapImage.height;

        if (sdrImageAspect !== gainmapImageAspect) {
          onError("THREE.UltraHDRLoader Error: Aspect ratio mismatch between SDR and Gainmap images");

          return;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
          colorSpace: "srgb",
        }) as CanvasRenderingContext2D;

        canvas.width = sdrWidth;
        canvas.height = sdrHeight;

        /* Use out-of-the-box interpolation of Canvas API to scale gainmap to fit the SDR resolution */
        ctx.drawImage(gainmapImage, 0, 0, gainmapImage.width, gainmapImage.height, 0, 0, sdrWidth, sdrHeight);
        const gainmapImageData = ctx.getImageData(0, 0, sdrWidth, sdrHeight, { colorSpace: "srgb" } as never);

        ctx.drawImage(sdrImage, 0, 0);
        const sdrImageData = ctx.getImageData(0, 0, sdrWidth, sdrHeight, { colorSpace: "srgb" } as never);

        /* HDR Recovery formula - https://developer.android.com/media/platform/hdr-image-format#use_the_gain_map_to_create_adapted_HDR_rendition */

        /* 1.8 instead of 2 near-perfectly rectifies approximations introduced by precalculated SRGB_TO_LINEAR values */
        const hdrCapacityMax = metadata.hdrCapacityMax ?? 1;
        const hdrCapacityMin = metadata.hdrCapacityMin ?? 0;
        const maxDisplayBoost = 1.8 ** (hdrCapacityMax * 0.5);
        const unclampedWeightFactor = (Math.log2(maxDisplayBoost) - hdrCapacityMin) / (hdrCapacityMax - hdrCapacityMin);
        const weightFactor = Math.min(Math.max(unclampedWeightFactor, 0.0), 1.0);

        const sdrData = sdrImageData.data;
        const gainmapData = gainmapImageData.data;
        const dataLength = sdrData.length;
        const gainMapMin = metadata.gainMapMin as number;
        const gainMapMax = metadata.gainMapMax as number;
        const offsetSDR = metadata.offsetSDR as number;
        const offsetHDR = metadata.offsetHDR as number;
        const invGamma = 1.0 / (metadata.gamma as number);
        const useGammaOne = metadata.gamma === 1.0;
        const isHalfFloat = this.type === TextureType.HalfFloat;
        const toHalfFloatLocal = toHalfFloat;
        const srgbToLinear = this._srgbToLinear.bind(this);

        const hdrBuffer = isHalfFloat
          ? new Uint16Array(dataLength).fill(15360)
          : new Float32Array(dataLength).fill(1.0);

        for (let i = 0; i < dataLength; i += 4) {
          for (let c = 0; c < 3; c++) {
            const idx = i + c;
            const sdrValue = sdrData[idx];
            const gainmapValue = gainmapData[idx] * 0.00392156862745098; // 1/255

            const logRecovery = useGammaOne ? gainmapValue : Math.pow(gainmapValue, invGamma);

            const logBoost = gainMapMin + (gainMapMax - gainMapMin) * logRecovery;

            const hdrValue =
              (sdrValue + offsetSDR) * (logBoost * weightFactor === 0.0 ? 1.0 : Math.pow(2, logBoost * weightFactor)) -
              offsetHDR;

            const linearHDRValue = Math.min(Math.max(srgbToLinear(hdrValue), 0), 65504);

            hdrBuffer[idx] = isHalfFloat ? toHalfFloatLocal(linearHDRValue) : linearHDRValue;
          }
        }

        onSuccess(hdrBuffer, sdrWidth, sdrHeight);
      })
      .catch((e) => {
        onError(e);
      });
  }
}
