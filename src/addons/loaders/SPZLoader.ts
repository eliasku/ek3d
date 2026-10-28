import { fromHalfFloat } from "../../extras/DataUtils";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import {
  SH_BAND_COMPONENTS,
  SH_BAND_WORDS,
  SH_C0,
  createGaussianSplatGeometry,
  createPackedSphericalHarmonicsBand,
  writeCovariance,
} from "../utils/GaussianSplatUtils";

export interface SPZGzipRuntime {
  gunzipSync(data: Uint8Array): Uint8Array;
}

export interface SPZZSTDRuntime {
  init?(): Promise<void>;
  decode(data: Uint8Array, uncompressedByteLength: number): Uint8Array;
}

const MAGIC = 0x5053474e;
const SH_VECTORS = [0, 3, 8, 15, 24];
const SCALE = new Float32Array(256);
const COLOR = new Uint8ClampedArray(256);
const QUAT = new Float64Array(1024);
for (let i = 0; i < 256; i++) {
  SCALE[i] = Math.exp(i / 16 - 10);
  COLOR[i] = ((i / 255 - 0.5) * (SH_C0 / 0.15) + 0.5) * 255;
}
for (let i = 0; i < 1024; i++) {
  const value = Math.SQRT1_2 * ((i & 511) / 511);
  QUAT[i] = (i & 512) !== 0 ? -value : value;
}

interface Attributes {
  positions: Uint8Array;
  alphas: Uint8Array;
  colors: Uint8Array;
  scales: Uint8Array;
  rotations: Uint8Array;
  sphericalHarmonics: Uint8Array;
  count: number;
  version: number;
  fractionalBits: number;
  storedShDegree: number;
}

/** Loads compressed SPZ Gaussian splat data into geometry.
 *
 * ```typescript
 * import { SPZLoader, type SPZGzipRuntime, type SPZZSTDRuntime } from "ek3d/addons/loaders/SPZLoader";
 * async function loadSplat(gzip: SPZGzipRuntime, zstd: SPZZSTDRuntime) {
 *   const loader = new SPZLoader().setGzipRuntime(gzip).setZSTDRuntime(zstd);
 *   return await loader.loadAsync("model.spz");
 * }
 * ```
 * Gzip is required for versions 1–3; ZSTD is required for version 4.
 */
export class SPZLoader extends Loader<BufferGeometry> {
  gzipRuntime: SPZGzipRuntime | null = null;
  zstdRuntime: SPZZSTDRuntime | null = null;
  private zstdReady: Promise<void> | null = null;

  setGzipRuntime(runtime: SPZGzipRuntime): this {
    this.gzipRuntime = runtime;
    return this;
  }

  setZSTDRuntime(runtime: SPZZSTDRuntime): this {
    this.zstdRuntime = runtime;
    this.zstdReady = null;
    return this;
  }

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
        const reportError = (error: unknown): void => {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        };
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new TypeError("SPZLoader requires array buffer data");
          const result = this.parse(buffer);
          if (result instanceof Promise) result.then(onLoad).catch(reportError);
          else if (result !== undefined) onLoad?.(result);
        } catch (error) {
          reportError(error);
        }
      },
      onProgress,
      onError,
    );
  }

  parse(
    buffer: ArrayBuffer,
    onLoad?: (geometry: BufferGeometry) => void,
    onError?: (error: unknown) => void,
  ): BufferGeometry | Promise<BufferGeometry> | undefined {
    try {
      if (buffer.byteLength >= 8 && new DataView(buffer).getUint32(0, true) === MAGIC) {
        const version = new DataView(buffer).getUint32(4, true);
        if (version !== 4) throw new Error(`THREE.SPZLoader: SPZ version ${version} is not supported.`);
        const runtime = this.zstdRuntime;
        if (runtime === null) throw new Error("THREE.SPZLoader: ZSTD runtime is required.");
        if (this.zstdReady === null) {
          const ready = Promise.resolve()
            .then(() => runtime.init?.())
            .catch((error: unknown) => {
              if (this.zstdReady === ready) this.zstdReady = null;
              throw error;
            });
          this.zstdReady = ready;
        }
        const promise = this.zstdReady.then(() => this.parseRawSPZV4(new Uint8Array(buffer), runtime));
        if (onLoad !== undefined || onError !== undefined) {
          const callback = promise.then(onLoad);
          if (onError !== undefined) callback.catch(onError);
        }
        return promise;
      }
      if (this.gzipRuntime === null) throw new Error("THREE.SPZLoader: Gzip runtime is required.");
      const geometry = this.parseRawSPZ(this.gzipRuntime.gunzipSync(new Uint8Array(buffer)));
      onLoad?.(geometry);
      return geometry;
    } catch (error) {
      if (onError !== undefined) {
        onError(error);
        return undefined;
      }
      throw error;
    }
  }

  parseRawSPZ(bytes: Uint8Array): BufferGeometry {
    if (bytes.byteLength < 16) throw new Error("THREE.SPZLoader: Invalid SPZ header.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== MAGIC) throw new Error("THREE.SPZLoader: Invalid SPZ magic.");
    const version = view.getUint32(4, true);
    if (version < 1 || version > 3) throw new Error(`THREE.SPZLoader: SPZ version ${version} is not supported.`);
    const count = view.getUint32(8, true);
    const storedShDegree = view.getUint8(12);
    if (storedShDegree >= SH_VECTORS.length)
      throw new Error(`THREE.SPZLoader: Unsupported SPZ spherical harmonics degree ${storedShDegree}.`);
    const fractionalBits = view.getUint8(13);
    const sizes = [
      count * 3 * (version === 1 ? 2 : 3),
      count,
      count * 3,
      count * 3,
      count * (version === 3 ? 4 : 3),
      count * SH_VECTORS[storedShDegree] * 3,
    ];
    const expected = 16 + sizes.reduce((a, b) => a + b, 0) + ((view.getUint8(14) & 0x80) !== 0 ? count * 6 : 0);
    if (bytes.byteLength !== expected) throw new Error("THREE.SPZLoader: Invalid SPZ byte length.");
    let offset = 16;
    const streams = sizes.map((size) => {
      const stream = bytes.subarray(offset, offset + size);
      offset += size;
      return stream;
    });
    return parseAttributes({
      positions: streams[0],
      alphas: streams[1],
      colors: streams[2],
      scales: streams[3],
      rotations: streams[4],
      sphericalHarmonics: streams[5],
      count,
      version,
      fractionalBits,
      storedShDegree,
    });
  }

  parseRawSPZV4(bytes: Uint8Array, zstd: SPZZSTDRuntime): BufferGeometry {
    if (bytes.byteLength < 20) throw new Error("THREE.SPZLoader: Invalid SPZ header.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 4)
      throw new Error("THREE.SPZLoader: Invalid SPZ v4 header.");
    const count = view.getUint32(8, true);
    const storedShDegree = view.getUint8(12);
    if (storedShDegree >= SH_VECTORS.length)
      throw new Error(`THREE.SPZLoader: Unsupported SPZ spherical harmonics degree ${storedShDegree}.`);
    const fractionalBits = view.getUint8(13);
    if ((view.getUint8(14) & 2) !== 0)
      console.warn("THREE.SPZLoader: SPZ vendor extensions are not supported and will be skipped.");
    const numStreams = view.getUint8(15);
    const tocOffset = view.getUint32(16, true);
    if (tocOffset < 20 || tocOffset + numStreams * 16 > bytes.length)
      throw new Error("THREE.SPZLoader: Invalid SPZ table of contents.");
    const sizes = [count * 9, count, count * 3, count * 3, count * 4, count * SH_VECTORS[storedShDegree] * 3];
    let compressedOffset = tocOffset + numStreams * 16;
    let index = 0;
    const streams = sizes.map((size) => {
      if (size === 0) return new Uint8Array();
      if (index >= numStreams) throw new Error("THREE.SPZLoader: Missing SPZ stream.");
      const length = view.getBigUint64(tocOffset + index++ * 16, true);
      if (length > BigInt(bytes.length - compressedOffset))
        throw new Error("THREE.SPZLoader: Invalid SPZ stream length.");
      const end = compressedOffset + Number(length);
      const decoded = zstd.decode(bytes.subarray(compressedOffset, end), size);
      compressedOffset = end;
      if (decoded.byteLength !== size) throw new Error("THREE.SPZLoader: Invalid decoded SPZ stream length.");
      return decoded;
    });
    return parseAttributes({
      positions: streams[0],
      alphas: streams[1],
      colors: streams[2],
      scales: streams[3],
      rotations: streams[4],
      sphericalHarmonics: streams[5],
      count,
      version: 4,
      fractionalBits,
      storedShDegree,
    });
  }
}

function parseAttributes(data: Attributes): BufferGeometry {
  const {
    positions,
    alphas,
    colors,
    scales,
    rotations,
    sphericalHarmonics,
    count,
    version,
    fractionalBits,
    storedShDegree,
  } = data;
  const centers = new Float32Array(count * 3);
  const covariances = new Float32Array(count * 6);
  const colorBytes = new Uint8ClampedArray(count * 4);
  const bands: Record<string, Uint32Array> = {};
  const bandBytes: { bytes: Uint8ClampedArray; components: number; stride: number }[] = [];
  for (let band = 1; band <= Math.min(storedShDegree, 3); band++) {
    const packed = createPackedSphericalHarmonicsBand(count, band);
    bands[`sh${band}`] = packed.packed;
    bandBytes.push({ bytes: packed.bytes, components: SH_BAND_COMPONENTS[band], stride: SH_BAND_WORDS[band] * 4 });
  }
  readCenters(positions, centers, count, version, fractionalBits);
  const packedRotations =
    version >= 3
      ? rotations.byteOffset % 4 === 0
        ? new Uint32Array(rotations.buffer, rotations.byteOffset, count)
        : new Uint32Array(rotations.slice().buffer)
      : null;
  const q = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    if (packedRotations !== null) {
      readSmallestThreeQuaternion(packedRotations[i], q);
    } else {
      const offset = i * 3;
      q[0] = rotations[offset] / 127.5 - 1;
      q[1] = rotations[offset + 1] / 127.5 - 1;
      q[2] = rotations[offset + 2] / 127.5 - 1;
      q[3] = Math.sqrt(Math.max(0, 1 - q[0] * q[0] - q[1] * q[1] - q[2] * q[2]));
    }
    const i3 = i * 3,
      i4 = i * 4;
    writeCovariance(
      covariances,
      i * 6,
      SCALE[scales[i3]],
      SCALE[scales[i3 + 1]],
      SCALE[scales[i3 + 2]],
      q[0],
      q[1],
      q[2],
      q[3],
    );
    for (let c = 0; c < 3; c++) colorBytes[i4 + c] = COLOR[colors[i3 + c]];
    colorBytes[i4 + 3] = alphas[i];
    let source = i * SH_VECTORS[storedShDegree] * 3;
    for (const band of bandBytes) {
      for (let j = 0; j < band.components; j++) band.bytes[i * band.stride + j] = sphericalHarmonics[source++];
    }
  }
  return createGaussianSplatGeometry(centers, covariances, colorBytes, bands);
}

function readCenters(
  bytes: Uint8Array,
  centers: Float32Array,
  count: number,
  version: number,
  fractionalBits: number,
): void {
  if (version === 1) {
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const offset = i3 * 2;
      centers[i3] = fromHalfFloat(bytes[offset] | (bytes[offset + 1] << 8));
      centers[i3 + 1] = fromHalfFloat(bytes[offset + 2] | (bytes[offset + 3] << 8));
      centers[i3 + 2] = fromHalfFloat(bytes[offset + 4] | (bytes[offset + 5] << 8));
    }
    return;
  }
  const fixedScale = 1 / (1 << fractionalBits);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const offset = i * 9;
    centers[i3] = readInt24(bytes, offset) * fixedScale;
    centers[i3 + 1] = readInt24(bytes, offset + 3) * fixedScale;
    centers[i3 + 2] = readInt24(bytes, offset + 6) * fixedScale;
  }
}

function readInt24(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 8) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 24)) >> 8;
}

function readSmallestThreeQuaternion(packed: number, target: number[]): void {
  const largest = packed >>> 30;
  const a = QUAT[packed & 1023];
  const b = QUAT[(packed >>> 10) & 1023];
  const c = QUAT[(packed >>> 20) & 1023];
  switch (largest) {
    case 0:
      target[1] = c;
      target[2] = b;
      target[3] = a;
      break;
    case 1:
      target[0] = c;
      target[2] = b;
      target[3] = a;
      break;
    case 2:
      target[0] = c;
      target[1] = b;
      target[3] = a;
      break;
    default:
      target[0] = c;
      target[1] = b;
      target[2] = a;
  }
  target[largest] = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c * c)));
}
