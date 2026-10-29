import { fromHalfFloat } from "../../extras/DataUtils";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { LoadingManager } from "../../loaders/LoadingManager";

import {
  SH_BAND_COMPONENTS,
  SH_BAND_WORDS,
  createGaussianSplatGeometry,
  createPackedSphericalHarmonicsBand,
  writeColorBytes,
  writeCovariance,
} from "../utils/GaussianSplatUtils";

const HEADER_SIZE_BYTES = 4096;
const SECTION_HEADER_SIZE_BYTES = 1024;
const CURRENT_VERSION_MAJOR = 0;
const CURRENT_VERSION_MINOR = 1;
const MAX_SPLATS = 10000000;
const SH_DEGREE_TO_COMPONENTS = [0, 9, 24, 45];
const SH_BAND_INDEX = [
  null,
  [0, 3, 6, 1, 4, 7, 2, 5, 8],
  [9, 14, 19, 10, 15, 20, 11, 16, 21, 12, 17, 22, 13, 18, 23],
  [24, 31, 38, 25, 32, 39, 26, 33, 40, 27, 34, 41, 28, 35, 42, 29, 36, 43, 30, 37, 44],
];
const COMPRESSION_LEVELS: Record<number, Compression> = {
  0: {
    bytesPerCenter: 12,
    bytesPerScale: 12,
    bytesPerRotation: 16,
    bytesPerColor: 4,
    bytesPerSphericalHarmonicsComponent: 4,
    scaleOffsetBytes: 12,
    rotationOffsetBytes: 24,
    colorOffsetBytes: 40,
    scaleRange: 1,
  },
  1: {
    bytesPerCenter: 6,
    bytesPerScale: 6,
    bytesPerRotation: 8,
    bytesPerColor: 4,
    bytesPerSphericalHarmonicsComponent: 2,
    scaleOffsetBytes: 6,
    rotationOffsetBytes: 12,
    colorOffsetBytes: 20,
    scaleRange: 32767,
  },
  2: {
    bytesPerCenter: 6,
    bytesPerScale: 6,
    bytesPerRotation: 8,
    bytesPerColor: 4,
    bytesPerSphericalHarmonicsComponent: 1,
    scaleOffsetBytes: 6,
    rotationOffsetBytes: 12,
    colorOffsetBytes: 20,
    scaleRange: 32767,
  },
};

type Compression = {
  bytesPerCenter: number;
  bytesPerScale: number;
  bytesPerRotation: number;
  bytesPerColor: number;
  bytesPerSphericalHarmonicsComponent: number;
  scaleOffsetBytes: number;
  rotationOffsetBytes: number;
  colorOffsetBytes: number;
  scaleRange: number;
};
type Header = {
  versionMajor: number;
  versionMinor: number;
  maxSectionCount: number;
  sectionCount: number;
  maxSplatCount: number;
  splatCount: number;
  compressionLevel: number;
  minSphericalHarmonicsCoeff: number;
  maxSphericalHarmonicsCoeff: number;
};
type Section = {
  splatCount: number;
  maxSplatCount: number;
  bucketSize: number;
  bucketCount: number;
  bucketBlockSize: number;
  bucketStorageSizeBytes: number;
  compressionScaleRange: number;
  fullBucketCount: number;
  partiallyFilledBucketCount: number;
  sphericalHarmonicsDegree: number;
};

/**
 * A loader for GaussianSplats3D `.ksplat` files.
 *
 * Decodes splat geometry with optional packed spherical harmonics attributes.
 *
 * ```ts
 * import { KSPLATLoader } from "ek3d/addons/loaders/KSPLATLoader";
 * const geometry = await new KSPLATLoader().loadAsync("model.ksplat");
 * ```
 */
export class KSPLATLoader extends Loader<BufferGeometry, string> {
  /**
   * Constructs a new Gaussian splat KSPLAT loader.
   *
   * @param manager - The loading manager.
   */
  constructor(manager?: LoadingManager) {
    super(manager);
  }

  /**
   * Starts loading from the given URL and passes the loaded splat data to
   * the `onLoad()` callback.
   *
   * @param url - The path/URL of the file to be loaded. This can also be a data URI.
   * @param onLoad - Executed when the loading process has been finished.
   * @param onProgress - Executed while the loading is in progress.
   * @param onError - Executed when errors occur.
   */
  override load(
    url: string,
    onLoad?: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (buffer) => {
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new TypeError("KSPLATLoader requires array buffer data");
          onLoad?.(this.parse(buffer));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }

          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Parses the given `.ksplat` data.
   *
   * @param buffer - The raw KSPLAT file as an array buffer.
   * @return The parsed splat geometry.
   */
  parse(buffer: ArrayBuffer): BufferGeometry {
    if (buffer.byteLength < HEADER_SIZE_BYTES) {
      throw new Error("THREE.KSPLATLoader: Invalid KSPLAT header.");
    }

    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const header = parseHeader(view);

    if (header.versionMajor !== CURRENT_VERSION_MAJOR || header.versionMinor < CURRENT_VERSION_MINOR) {
      throw new Error(`THREE.KSPLATLoader: Unsupported KSPLAT version ${header.versionMajor}.${header.versionMinor}.`);
    }

    if (header.compressionLevel < 0 || header.compressionLevel > 2) {
      throw new Error(`THREE.KSPLATLoader: Unsupported KSPLAT compression level ${header.compressionLevel}.`);
    }

    if (header.splatCount > MAX_SPLATS) {
      throw new Error(`THREE.KSPLATLoader: KSPLAT file contains too many splats (${header.splatCount}).`);
    }

    const sectionHeadersOffset = HEADER_SIZE_BYTES;
    const sectionDataOffset = HEADER_SIZE_BYTES + header.maxSectionCount * SECTION_HEADER_SIZE_BYTES;

    if (bytes.byteLength < sectionDataOffset) {
      throw new Error("THREE.KSPLATLoader: Invalid KSPLAT section headers.");
    }

    const compression = COMPRESSION_LEVELS[header.compressionLevel];
    const centers = new Float32Array(header.splatCount * 3);
    const covariances = new Float32Array(header.splatCount * 6);
    const colors = new Uint8ClampedArray(header.splatCount * 4);
    const sphericalHarmonics: Record<string, Uint32Array> = {};
    const sphericalHarmonicsBytes: Record<string, Uint8ClampedArray> = {};
    let splatOffset = 0;
    let sectionBase = sectionDataOffset;

    for (let sectionIndex = 0; sectionIndex < header.maxSectionCount; sectionIndex++) {
      const sectionHeaderOffset = sectionHeadersOffset + sectionIndex * SECTION_HEADER_SIZE_BYTES;
      const section = parseSectionHeader(view, sectionHeaderOffset, compression);
      const shComponents = SH_DEGREE_TO_COMPONENTS[section.sphericalHarmonicsDegree];

      if (shComponents === undefined) {
        throw new Error(
          `THREE.KSPLATLoader: Unsupported KSPLAT spherical harmonics degree ${section.sphericalHarmonicsDegree}.`,
        );
      }

      const bytesPerSplat =
        compression.bytesPerCenter +
        compression.bytesPerScale +
        compression.bytesPerRotation +
        compression.bytesPerColor +
        shComponents * compression.bytesPerSphericalHarmonicsComponent;
      const bucketsMetaDataSizeBytes = section.partiallyFilledBucketCount * 4;
      const bucketsStorageSizeBytes = section.bucketStorageSizeBytes * section.bucketCount + bucketsMetaDataSizeBytes;
      const splatDataStorageSizeBytes = bytesPerSplat * section.maxSplatCount;
      const storageSizeBytes = bucketsStorageSizeBytes + splatDataStorageSizeBytes;

      if (sectionBase + storageSizeBytes > bytes.byteLength) {
        throw new Error("THREE.KSPLATLoader: Invalid KSPLAT byte length.");
      }

      if (section.splatCount > 0) {
        readSection(
          view,
          bytes,
          section,
          compression,
          sectionBase,
          bucketsMetaDataSizeBytes,
          bucketsStorageSizeBytes,
          bytesPerSplat,
          splatOffset,
          centers,
          covariances,
          colors,
          sphericalHarmonics,
          sphericalHarmonicsBytes,
          header,
        );

        splatOffset += section.splatCount;
      }

      sectionBase += storageSizeBytes;
    }

    if (splatOffset !== header.splatCount) {
      throw new Error("THREE.KSPLATLoader: KSPLAT splat count mismatch.");
    }

    return createGaussianSplatGeometry(centers, covariances, colors, sphericalHarmonics);
  }
}

function parseHeader(view: DataView) {
  return {
    versionMajor: view.getUint8(0),
    versionMinor: view.getUint8(1),
    maxSectionCount: view.getUint32(4, true),
    sectionCount: view.getUint32(8, true),
    maxSplatCount: view.getUint32(12, true),
    splatCount: view.getUint32(16, true),
    compressionLevel: view.getUint16(20, true),
    minSphericalHarmonicsCoeff: view.getFloat32(36, true) || -1.5,
    maxSphericalHarmonicsCoeff: view.getFloat32(40, true) || 1.5,
  };
}

function parseSectionHeader(view: DataView, offset: number, compression: Compression) {
  return {
    splatCount: view.getUint32(offset, true),
    maxSplatCount: view.getUint32(offset + 4, true),
    bucketSize: view.getUint32(offset + 8, true),
    bucketCount: view.getUint32(offset + 12, true),
    bucketBlockSize: view.getFloat32(offset + 16, true),
    bucketStorageSizeBytes: view.getUint16(offset + 20, true),
    compressionScaleRange: view.getUint32(offset + 24, true) || compression.scaleRange,
    fullBucketCount: view.getUint32(offset + 32, true),
    partiallyFilledBucketCount: view.getUint32(offset + 36, true),
    sphericalHarmonicsDegree: view.getUint16(offset + 40, true),
  };
}

function readSection(
  view: DataView,
  bytes: Uint8Array,
  section: Section,
  compression: Compression,
  sectionBase: number,
  bucketsMetaDataSizeBytes: number,
  bucketsStorageSizeBytes: number,
  bytesPerSplat: number,
  splatOffset: number,
  centers: Float32Array,
  covariances: Float32Array,
  colors: Uint8ClampedArray,
  sphericalHarmonics: Record<string, Uint32Array>,
  sphericalHarmonicsBytes: Record<string, Uint8ClampedArray>,
  header: Header,
) {
  const bucketsBase = sectionBase + bucketsMetaDataSizeBytes;
  const dataBase = sectionBase + bucketsStorageSizeBytes;
  const fullBucketSplats = section.fullBucketCount * section.bucketSize;
  const compressionScaleFactor = section.bucketBlockSize / 2 / section.compressionScaleRange;
  const sphericalHarmonicsOffset = compression.colorOffsetBytes + compression.bytesPerColor;
  let partialBucketIndex = section.fullBucketCount;
  let partialBucketBase = fullBucketSplats;

  ensureSphericalHarmonics(
    sphericalHarmonics,
    sphericalHarmonicsBytes,
    header.splatCount,
    section.sphericalHarmonicsDegree,
  );

  for (let i = 0; i < section.splatCount; i++) {
    const bucketIndex = getBucketIndex(
      view,
      section,
      sectionBase,
      i,
      fullBucketSplats,
      partialBucketIndex,
      partialBucketBase,
    );

    if (bucketIndex.partialBucketIndex !== undefined) {
      partialBucketIndex = bucketIndex.partialBucketIndex;
      partialBucketBase = bucketIndex.partialBucketBase!;
    }

    const rowOffset = dataBase + i * bytesPerSplat;
    const outIndex = splatOffset + i;
    const i3 = outIndex * 3;

    if (compression.bytesPerCenter === 12) {
      centers[i3] = view.getFloat32(rowOffset, true);
      centers[i3 + 1] = view.getFloat32(rowOffset + 4, true);
      centers[i3 + 2] = view.getFloat32(rowOffset + 8, true);
    } else {
      const bucketBase = bucketsBase + bucketIndex.value * section.bucketStorageSizeBytes;
      centers[i3] =
        (view.getUint16(rowOffset, true) - section.compressionScaleRange) * compressionScaleFactor +
        view.getFloat32(bucketBase, true);
      centers[i3 + 1] =
        (view.getUint16(rowOffset + 2, true) - section.compressionScaleRange) * compressionScaleFactor +
        view.getFloat32(bucketBase + 4, true);
      centers[i3 + 2] =
        (view.getUint16(rowOffset + 4, true) - section.compressionScaleRange) * compressionScaleFactor +
        view.getFloat32(bucketBase + 8, true);
    }

    const sx = readCompressedFloat(view, rowOffset + compression.scaleOffsetBytes, compression.bytesPerScale);
    const sy = readCompressedFloat(
      view,
      rowOffset + compression.scaleOffsetBytes + compression.bytesPerScale / 3,
      compression.bytesPerScale,
    );
    const sz = readCompressedFloat(
      view,
      rowOffset + compression.scaleOffsetBytes + (compression.bytesPerScale / 3) * 2,
      compression.bytesPerScale,
    );
    const qw = readCompressedFloat(view, rowOffset + compression.rotationOffsetBytes, compression.bytesPerRotation);
    const qx = readCompressedFloat(
      view,
      rowOffset + compression.rotationOffsetBytes + compression.bytesPerRotation / 4,
      compression.bytesPerRotation,
    );
    const qy = readCompressedFloat(
      view,
      rowOffset + compression.rotationOffsetBytes + (compression.bytesPerRotation / 4) * 2,
      compression.bytesPerRotation,
    );
    const qz = readCompressedFloat(
      view,
      rowOffset + compression.rotationOffsetBytes + (compression.bytesPerRotation / 4) * 3,
      compression.bytesPerRotation,
    );

    writeCovariance(covariances, outIndex * 6, sx, sy, sz, qx, qy, qz, qw);
    writeColorBytes(
      colors,
      outIndex * 4,
      bytes[rowOffset + compression.colorOffsetBytes],
      bytes[rowOffset + compression.colorOffsetBytes + 1],
      bytes[rowOffset + compression.colorOffsetBytes + 2],
      bytes[rowOffset + compression.colorOffsetBytes + 3],
    );

    for (let degree = 1; degree <= section.sphericalHarmonicsDegree; degree++) {
      writeKSPLATSphericalHarmonicsBand(
        sphericalHarmonicsBytes[`sh${degree}`],
        outIndex,
        SH_BAND_COMPONENTS[degree],
        SH_BAND_WORDS[degree] * 4,
        SH_BAND_INDEX[degree]!,
        view,
        rowOffset + sphericalHarmonicsOffset,
        compression.bytesPerSphericalHarmonicsComponent,
        header,
      );
    }
  }
}

function ensureSphericalHarmonics(
  sphericalHarmonics: Record<string, Uint32Array>,
  sphericalHarmonicsBytes: Record<string, Uint8ClampedArray>,
  count: number,
  degree: number,
) {
  for (let i = 1; i <= degree; i++) {
    if (sphericalHarmonics[`sh${i}`] === undefined) {
      const band = createPackedSphericalHarmonicsBand(count, i);
      sphericalHarmonics[`sh${i}`] = band.packed;
      sphericalHarmonicsBytes[`sh${i}`] = band.bytes;
    }
  }
}

function writeKSPLATSphericalHarmonicsBand(
  target: Uint8ClampedArray,
  index: number,
  bandComponents: number,
  byteStride: number,
  componentIndexes: number[],
  view: DataView,
  rowOffset: number,
  bytesPerComponent: number,
  header: Header,
) {
  const targetOffset = index * byteStride;

  for (let i = 0; i < bandComponents; i++) {
    target[targetOffset + i] =
      readCompressedSphericalHarmonic(
        view,
        rowOffset + componentIndexes[i] * bytesPerComponent,
        bytesPerComponent,
        header,
      ) *
        128 +
      128;
  }
}

function getBucketIndex(
  view: DataView,
  section: Section,
  sectionBase: number,
  splatIndex: number,
  fullBucketSplats: number,
  partialBucketIndex: number,
  partialBucketBase: number,
) {
  if (section.bucketCount === 0) {
    return { value: 0 };
  }

  if (splatIndex < fullBucketSplats) {
    return { value: Math.floor(splatIndex / section.bucketSize) };
  }

  while (partialBucketIndex < section.bucketCount) {
    const partialIndex = partialBucketIndex - section.fullBucketCount;
    const bucketLength = view.getUint32(sectionBase + partialIndex * 4, true);

    if (splatIndex < partialBucketBase + bucketLength) {
      return { value: partialBucketIndex, partialBucketIndex, partialBucketBase };
    }

    partialBucketIndex++;
    partialBucketBase += bucketLength;
  }

  throw new Error("THREE.KSPLATLoader: Invalid KSPLAT bucket data.");
}

function readCompressedFloat(view: DataView, offset: number, bytesPerVector: number) {
  if (bytesPerVector === 12 || bytesPerVector === 16) {
    return view.getFloat32(offset, true);
  }

  return fromHalfFloat(view.getUint16(offset, true));
}

function readCompressedSphericalHarmonic(view: DataView, offset: number, bytesPerComponent: number, header: Header) {
  if (bytesPerComponent === 4) {
    return view.getFloat32(offset, true);
  }

  if (bytesPerComponent === 2) {
    return fromHalfFloat(view.getUint16(offset, true));
  }

  const t = view.getUint8(offset) / 255;

  return (
    header.minSphericalHarmonicsCoeff + t * (header.maxSphericalHarmonicsCoeff - header.minSphericalHarmonicsCoeff)
  );
}
