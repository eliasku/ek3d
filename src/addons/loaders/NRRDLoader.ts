import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Matrix4 } from "../../math/Matrix4";
import { Vector3 } from "../../math/Vector3";
import { Volume } from "../misc/Volume";

/** Gzip runtime supplied by the application. */
export interface NRRDGzipDecoder {
  gunzipSync(data: Uint8Array): Uint8Array;
}

type NumericArray =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;
type NumericArrayConstructor = {
  new (length: number): NumericArray;
  new (buffer: ArrayBuffer): NumericArray;
  readonly BYTES_PER_ELEMENT: number;
};

const types: Record<string, NumericArrayConstructor> = {
  uchar: Uint8Array,
  "unsigned char": Uint8Array,
  uint8: Uint8Array,
  uint8_t: Uint8Array,
  "signed char": Int8Array,
  int8: Int8Array,
  int8_t: Int8Array,
  short: Int16Array,
  "short int": Int16Array,
  "signed short": Int16Array,
  "signed short int": Int16Array,
  int16: Int16Array,
  int16_t: Int16Array,
  ushort: Uint16Array,
  "unsigned short": Uint16Array,
  "unsigned short int": Uint16Array,
  uint16: Uint16Array,
  uint16_t: Uint16Array,
  int: Int32Array,
  "signed int": Int32Array,
  int32: Int32Array,
  int32_t: Int32Array,
  uint: Uint32Array,
  "unsigned int": Uint32Array,
  uint32: Uint32Array,
  uint32_t: Uint32Array,
  float: Float32Array,
  double: Float64Array,
};

/** Loads three-dimensional NRRD volumes. Gzip files require an injected decoder. */
export class NRRDLoader extends Loader<Volume> {
  segmentation: boolean = false;
  gzipDecoder: NRRDGzipDecoder | undefined;

  constructor(manager?: LoadingManager, gzipDecoder?: NRRDGzipDecoder) {
    super(manager);
    this.gzipDecoder = gzipDecoder;
  }

  load(
    url: string,
    onLoad?: (volume: Volume) => void,
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
      (data) => {
        try {
          if (!(data instanceof ArrayBuffer)) throw new Error("NRRDLoader: Expected an ArrayBuffer");
          onLoad?.(this.parse(data));
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  setSegmentation(segmentation: boolean): void {
    this.segmentation = segmentation;
  }

  parse(data: ArrayBuffer): Volume {
    // The upstream parser is based on the XTK NRRD parser: https://github.com/xtk/X
    const bytes = new Uint8Array(data);
    let headerEnd = -1;
    let dataStart = -1;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 10 && bytes[i + 1] === 10) {
        headerEnd = i;
        dataStart = i + 2;
        break;
      }
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
        headerEnd = i;
        dataStart = i + 4;
        break;
      }
    }
    if (headerEnd < 0) throw new Error("THREE.NRRDLoader: Missing header terminator");
    const lines = new TextDecoder().decode(bytes.subarray(0, headerEnd)).split(/\r?\n/);
    if (!lines.some((line) => /NRRD\d+/.test(line))) throw new Error("THREE.NRRDLoader: Not an NRRD file");
    const header: Record<string, unknown> = { isNrrd: true };
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const match = /^(.*?):(.*)$/.exec(line);
      if (!match) continue;
      const field = match[1].trim();
      const value = match[2].trim();
      switch (field) {
        case "dimension":
          header.dim = Number(value);
          break;
        case "sizes":
          header.sizes = value.split(/\s+/).map(Number);
          break;
        case "spacings":
          header.spacings = value.split(/\s+/).map(Number);
          break;
        case "space origin":
          header.space_origin = value.slice(value.indexOf("(") + 1, value.indexOf(")")).split(",");
          break;
        case "space directions":
          header.vectors = (value.match(/\(.*?\)/g) ?? []).map((part) => part.slice(1, -1).split(",").map(Number));
          break;
        default:
          header[field] = value;
      }
    }
    const type = types[String(header.type)];
    if (!type) throw new Error("THREE.NRRDLoader: Unsupported NRRD data type: " + String(header.type));
    header.__array = type;
    const sizes = header.sizes as number[] | undefined;
    if (
      header.dim !== 3 ||
      !sizes ||
      sizes.length !== 3 ||
      sizes.some((size) => !Number.isSafeInteger(size) || size <= 0)
    ) {
      throw new Error("THREE.NRRDLoader: Expected three positive integer volume sizes");
    }
    const sampleCount = sizes[0] * sizes[1] * sizes[2];
    if (!Number.isSafeInteger(sampleCount)) throw new Error("THREE.NRRDLoader: Invalid volume size");
    const encoding = typeof header.encoding === "string" ? header.encoding : "";
    if (encoding === "bz2" || encoding === "bzip2") throw new Error("THREE.NRRDLoader: Bzip is not supported");
    let vectors = header.vectors as number[][] | undefined;
    if (!vectors) {
      const spacings = header.spacings as number[] | undefined;
      vectors = [0, 1, 2].map((axis) =>
        [0, 1, 2].map((component) =>
          axis === component ? (spacings && !Number.isNaN(spacings[axis]) ? spacings[axis] : 1) : 0,
        ),
      );
      header.vectors = vectors;
    }
    let values: NumericArray;
    if (encoding === "ascii" || encoding === "text" || encoding === "txt" || encoding === "hex") {
      const text = new TextDecoder().decode(bytes.subarray(dataStart)).trim();
      const numbers = text ? text.split(/\s+/) : [];
      if (numbers.length !== sampleCount)
        throw new Error("THREE.NRRDLoader: Payload sample count does not match sizes");
      values = new type(sampleCount);
      const floating = type === Float32Array || type === Float64Array;
      for (let i = 0; i < numbers.length; i++)
        values[i] = floating ? parseFloat(numbers[i]) : parseInt(numbers[i], encoding === "hex" ? 16 : 10);
    } else {
      let payload: Uint8Array = bytes.subarray(dataStart);
      if (encoding.startsWith("gz")) {
        if (!this.gzipDecoder) throw new Error("THREE.NRRDLoader: Gzip decoder is required");
        payload = this.gzipDecoder.gunzipSync(payload);
      } else if (encoding !== "raw") {
        throw new Error("THREE.NRRDLoader: Unsupported encoding: " + encoding);
      }
      if (payload.length !== sampleCount * type.BYTES_PER_ELEMENT) {
        throw new Error("THREE.NRRDLoader: Payload sample count does not match sizes");
      }
      // Copy the exact view, including decoder outputs with nonzero byte offsets.
      const copy = new Uint8Array(payload.length);
      copy.set(payload);
      const nativeLittle = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
      const fileLittle = header.endian !== "big";
      if (nativeLittle !== fileLittle && type.BYTES_PER_ELEMENT > 1) {
        const size = type.BYTES_PER_ELEMENT;
        for (let i = 0; i < copy.length; i += size) {
          for (let j = 0; j < size / 2; j++) {
            const tmp = copy[i + j];
            copy[i + j] = copy[i + size - 1 - j];
            copy[i + size - 1 - j] = tmp;
          }
        }
      }
      values = new type(copy.buffer);
    }
    const volume = new Volume();
    volume.header = header;
    volume.segmentation = this.segmentation;
    volume.data = values;
    const [min, max] = volume.computeMinMax();
    volume.windowLow = min;
    volume.windowHigh = max;
    volume.dimensions = [sizes[0], sizes[1], sizes[2]];
    [volume.xLength, volume.yLength, volume.zLength] = volume.dimensions;
    const xIndex = vectors.findIndex((vector) => vector[0] !== 0);
    const yIndex = vectors.findIndex((vector) => vector[1] !== 0);
    const zIndex = vectors.findIndex((vector) => vector[2] !== 0);
    const axisOrder = ["x", "y", "z"];
    if (xIndex >= 0 && yIndex >= 0 && zIndex >= 0 && xIndex !== yIndex && xIndex !== zIndex && yIndex !== zIndex) {
      axisOrder[xIndex] = "x";
      axisOrder[yIndex] = "y";
      axisOrder[zIndex] = "z";
    }
    volume.axisOrder = axisOrder;
    const spacing = vectors.slice(0, 3).map((vector) => new Vector3().fromArray(vector).length());
    volume.spacing = spacing;
    const transition = new Matrix4();
    if (header.space === "left-posterior-superior") transition.set(-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    else if (header.space === "left-anterior-superior") transition.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1);
    const v = vectors;
    const ijkToTransition = new Matrix4().set(
      v[0][0],
      v[1][0],
      v[2][0],
      0,
      v[0][1],
      v[1][1],
      v[2][1],
      0,
      v[0][2],
      v[1][2],
      v[2][2],
      0,
      0,
      0,
      0,
      1,
    );
    volume.matrix = new Matrix4().multiplyMatrices(ijkToTransition, transition);
    volume.inverseMatrix = new Matrix4().copy(volume.matrix).invert();
    volume.RASDimensions = [
      Math.floor(volume.xLength * spacing[0]),
      Math.floor(volume.yLength * spacing[1]),
      Math.floor(volume.zLength * spacing[2]),
    ];
    if (volume.lowerThreshold === -Infinity) volume.lowerThreshold = min;
    if (volume.upperThreshold === Infinity) volume.upperThreshold = max;
    return volume;
  }

  _parseChars(array: Uint8Array, start = 0, end = array.length): string {
    let output = "";
    for (let i = start; i < end; i++) output += String.fromCharCode(array[i]);
    return output;
  }
}
