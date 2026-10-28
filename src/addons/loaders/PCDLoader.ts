import { SRGBColorSpace } from "../../constants";
import { Float32BufferAttribute, Int32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import { Color } from "../../math/Color";
import { PointsMaterial } from "../../materials/PointsMaterial";
import { Points } from "../../objects/Points";

interface PCDHeader {
  /** The DATA payload token: `ascii`, `binary` or `binary_compressed`. */
  data: string;
  /** Length of the textual header in bytes. */
  headerLen: number;
  /** Header text without comments. */
  str: string;
  fields: string[];
  size: number[];
  type: string[];
  count: number[];
  width: number;
  height: number;
  points: number;
  /** Field offsets: byte offsets for binary data, column indices for ASCII. */
  offset: Record<string, number | undefined>;
  rowSize: number;
  version?: number;
  viewpoint?: string;
}

/** One field's byte layout inside a binary PCD payload. */
interface PCDFieldAccessor {
  column: number;
  step: number;
  size: number;
  type: string;
}

// from https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
function decompressLZF(inData: Uint8Array, outLength: number): Uint8Array {
  const inLength = inData.length;
  const outData = new Uint8Array(outLength);
  let inPtr = 0;
  let outPtr = 0;
  let ctrl: number;
  let len: number;
  let ref: number;
  do {
    ctrl = inData[inPtr++];
    if (ctrl < 1 << 5) {
      ctrl++;
      if (outPtr + ctrl > outLength) throw new Error("THREE.PCDLoader: Output buffer is not large enough");
      if (inPtr + ctrl > inLength) throw new Error("THREE.PCDLoader: Invalid compressed data");
      do {
        outData[outPtr++] = inData[inPtr++];
      } while (--ctrl);
    } else {
      len = ctrl >> 5;
      ref = outPtr - ((ctrl & 0x1f) << 8) - 1;
      if (inPtr >= inLength) throw new Error("THREE.PCDLoader: Invalid compressed data");
      if (len === 7) {
        len += inData[inPtr++];
        if (inPtr >= inLength) throw new Error("THREE.PCDLoader: Invalid compressed data");
      }
      ref -= inData[inPtr++];
      if (outPtr + len + 2 > outLength) throw new Error("THREE.PCDLoader: Output buffer is not large enough");
      if (ref < 0) throw new Error("THREE.PCDLoader: Invalid compressed data");
      if (ref >= outPtr) throw new Error("THREE.PCDLoader: Invalid compressed data");
      do {
        outData[outPtr++] = outData[ref++];
      } while (--len + 2);
    }
  } while (inPtr < inLength);
  return outData;
}

function parseHeader(binaryData: ArrayBuffer): PCDHeader {
  const buffer = new Uint8Array(binaryData);

  let text = "";
  let line = "";
  let i = 0;
  let end = false;

  while (i < buffer.length && end === false) {
    const char = String.fromCharCode(buffer[i++]);
    if (char === "\n" || char === "\r") {
      if (line.trim().toLowerCase().startsWith("data")) end = true;
      line = "";
    } else {
      line += char;
    }
    text += char;
  }

  // Match on a slice starting one character early so the leading line break is part of the header length.
  const result1 = text.search(/[\r\n]DATA\s(\S*)\s/i);
  const result2 = result1 < 0 ? null : /[\r\n]DATA\s(\S*)\s/i.exec(text.slice(result1 - 1));

  if (result2 === null) throw new Error("THREE.PCDLoader: missing DATA header.");

  const header: PCDHeader = {
    data: result2[1],
    headerLen: result2[0].length + result1,
    str: "",
    fields: [],
    size: [],
    type: [],
    count: [],
    width: 0,
    height: 0,
    points: 0,
    offset: {},
    rowSize: 0,
  };

  // remove comments
  header.str = text.slice(0, header.headerLen).replace(/^#.*/gm, "");

  const version = /^VERSION (.*)/im.exec(header.str);
  const fields = /^FIELDS (.*)/im.exec(header.str);
  const size = /^SIZE (.*)/im.exec(header.str);
  const type = /^TYPE (.*)/im.exec(header.str);
  const count = /^COUNT (.*)/im.exec(header.str);
  const width = /^WIDTH (.*)/im.exec(header.str);
  const height = /^HEIGHT (.*)/im.exec(header.str);
  const viewpoint = /^VIEWPOINT (.*)/im.exec(header.str);
  const points = /^POINTS (.*)/im.exec(header.str);

  if (version !== null) header.version = parseFloat(version[1]);
  if (fields !== null) header.fields = fields[1].split(" ");
  if (size !== null) header.size = size[1].split(" ").map((value) => parseInt(value, 10));
  if (type !== null) header.type = type[1].split(" ");
  if (count !== null) header.count = count[1].split(" ").map((value) => parseInt(value, 10));
  else header.count = header.fields.map(() => 1);
  if (width !== null) header.width = parseInt(width[1]);
  if (height !== null) header.height = parseInt(height[1]);
  if (viewpoint !== null) header.viewpoint = viewpoint[1];
  header.points = points !== null ? parseInt(points[1], 10) : header.width * header.height;

  let sizeSum = 0;
  let countSum = 0;
  for (let index = 0; index < header.fields.length; index++) {
    if (header.data === "ascii") {
      header.offset[header.fields[index]] = countSum;
      countSum += header.count[index];
    } else {
      header.offset[header.fields[index]] = sizeSum;
      sizeSum += header.size[index] * header.count[index];
    }
  }

  // for binary only
  header.rowSize = sizeSum;

  return header;
}

/**
 * A loader for the Point Cloud Data (PCD) format.
 *
 * PCDLoader supports ASCII and (compressed) binary files as well as the following PCD fields:
 * - x y z
 * - rgb
 * - normal_x normal_y normal_z
 * - intensity
 * - label
 *
 * ```typescript
 * import { PCDLoader } from "ek3d/addons/loaders/PCDLoader";
 *
 * const loader = new PCDLoader();
 * const points = await loader.loadAsync("models/pcd/binary/Zaghetto.pcd");
 * points.geometry.center(); // optional
 * points.geometry.rotateX(Math.PI); // optional
 * scene.add(points);
 * ```
 */
export class PCDLoader extends Loader<Points, string> {
  /** Whether the binary payload uses little-endian byte order. */
  littleEndian: boolean = true;

  override load(
    url: string,
    onLoad?: (points: Points) => void,
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
      (data: unknown) => {
        try {
          onLoad?.(this.parse(data as ArrayBuffer));
        } catch (error) {
          if (onError !== undefined) onError(error);
          else console.error(error);
          this.manager.itemError(url);
        }
      },
      onProgress,
      onError,
    );
  }

  /**
   * Get a dataview value by field type and size.
   */
  private _getDataView(dataview: DataView, offset: number, type: string, size: number): number {
    switch (type) {
      case "F":
        return size === 8
          ? dataview.getFloat64(offset, this.littleEndian)
          : dataview.getFloat32(offset, this.littleEndian);
      case "I":
        if (size === 1) return dataview.getInt8(offset);
        if (size === 2) return dataview.getInt16(offset, this.littleEndian);
        return dataview.getInt32(offset, this.littleEndian);
      case "U":
        if (size === 1) return dataview.getUint8(offset);
        if (size === 2) return dataview.getUint16(offset, this.littleEndian);
        return dataview.getUint32(offset, this.littleEndian);
    }
    // Unknown field types cannot be read; upstream produced NaN through `undefined` values here.
    return NaN;
  }

  /**
   * Parses the given PCD data and returns a point cloud.
   *
   * @param data - The raw PCD data as an array buffer.
   * @return The parsed point cloud.
   */
  parse(data: ArrayBuffer): Points {
    const header = parseHeader(data);

    const position: number[] = [];
    const normal: number[] = [];
    const color: number[] = [];
    const intensity: number[] = [];
    const label: number[] = [];
    const offsets = header.offset;
    const c = new Color();

    // Upstream reads y and z as soon as x exists, so a partial xyz declaration is a malformed header.
    const { x: columnX, y: columnY, z: columnZ } = offsets;
    const hasPosition = columnX !== undefined && columnY !== undefined && columnZ !== undefined;
    if (!hasPosition && (columnX !== undefined || columnY !== undefined || columnZ !== undefined)) {
      throw new Error("THREE.PCDLoader: x, y and z fields must be declared together.");
    }

    if (header.data === "ascii") {
      const textData = new TextDecoder().decode(data);
      const lines = textData.slice(header.headerLen).split("\n");
      const rgbFieldIndex = header.fields.findIndex((field) => field === "rgb");
      const rgbType = header.type[rgbFieldIndex];

      for (let i = 0, l = lines.length; i < l; i++) {
        if (lines[i] === "") continue;

        const line = lines[i].trim().split(/\s+/);

        if (columnX !== undefined && columnY !== undefined && columnZ !== undefined) {
          position.push(parseFloat(line[columnX]), parseFloat(line[columnY]), parseFloat(line[columnZ]));
        }

        if (offsets.rgb !== undefined) {
          const value = parseFloat(line[offsets.rgb]);
          let rgb = value;

          if (rgbType === "F") {
            // Treat float values as int.
            // https://github.com/daavoo/pyntcloud/pull/204/commits/7b4205e64d5ed09abe708b2e91b615690c24d518
            const farr = new Float32Array(1);
            farr[0] = value;
            rgb = new Int32Array(farr.buffer)[0];
          }

          c.setRGB(
            ((rgb >> 16) & 0x0000ff) / 255,
            ((rgb >> 8) & 0x0000ff) / 255,
            (rgb & 0x0000ff) / 255,
            SRGBColorSpace,
          );
          color.push(c.r, c.g, c.b);
        }

        if (offsets.normal_x !== undefined && offsets.normal_y !== undefined && offsets.normal_z !== undefined) {
          normal.push(
            parseFloat(line[offsets.normal_x]),
            parseFloat(line[offsets.normal_y]),
            parseFloat(line[offsets.normal_z]),
          );
        }

        if (offsets.intensity !== undefined) intensity.push(parseFloat(line[offsets.intensity]));

        if (offsets.label !== undefined) label.push(parseInt(line[offsets.label]));
      }
    } else if (header.data === "binary" || header.data === "binary_compressed") {
      // Binary data is an array of structures (XYZRGBXYZRGB); binary_compressed is a structure of
      // arrays (XXYYZZRGBRGB), so both share offset/stride arithmetic but differ in the stride.
      const compressed = header.data === "binary_compressed";
      let dataview: DataView;
      if (compressed) {
        const sizes = new Uint32Array(data.slice(header.headerLen, header.headerLen + 8));
        const compressedSize = sizes[0];
        const decompressedSize = sizes[1];
        const decompressed = decompressLZF(
          new Uint8Array(data, header.headerLen + 8, compressedSize),
          decompressedSize,
        );
        dataview = new DataView(decompressed.buffer);
      } else {
        dataview = new DataView(data, header.headerLen);
      }

      const accessor = (field: string): PCDFieldAccessor | undefined => {
        const fieldOffset = offsets[field];
        if (fieldOffset === undefined) return undefined;
        const index = header.fields.indexOf(field);
        const size = header.size[index];
        return {
          column: compressed ? header.points * fieldOffset : fieldOffset,
          step: compressed ? size : header.rowSize,
          size,
          type: header.type[index],
        };
      };

      const read = (field: PCDFieldAccessor, point: number): number =>
        this._getDataView(dataview, field.column + field.step * point, field.type, field.size);

      const x = accessor("x");
      const y = accessor("y");
      const z = accessor("z");
      const rgb = accessor("rgb");
      const normalX = accessor("normal_x");
      const normalY = accessor("normal_y");
      const normalZ = accessor("normal_z");
      const intensityField = accessor("intensity");
      const labelField = accessor("label");

      for (let i = 0; i < header.points; i++) {
        if (x !== undefined && y !== undefined && z !== undefined) position.push(read(x, i), read(y, i), read(z, i));
        if (rgb !== undefined) {
          const base = rgb.column + rgb.step * i;
          c.setRGB(
            dataview.getUint8(base + 2) / 255,
            dataview.getUint8(base + 1) / 255,
            dataview.getUint8(base + 0) / 255,
            SRGBColorSpace,
          );
          color.push(c.r, c.g, c.b);
        }
        if (normalX !== undefined && normalY !== undefined && normalZ !== undefined) {
          normal.push(read(normalX, i), read(normalY, i), read(normalZ, i));
        }
        if (intensityField !== undefined) intensity.push(read(intensityField, i));
        if (labelField !== undefined) label.push(read(labelField, i));
      }
    }

    // build geometry

    const geometry = new BufferGeometry();

    if (position.length > 0) geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
    if (normal.length > 0) geometry.setAttribute("normal", new Float32BufferAttribute(normal, 3));
    if (color.length > 0) geometry.setAttribute("color", new Float32BufferAttribute(color, 3));
    if (intensity.length > 0) geometry.setAttribute("intensity", new Float32BufferAttribute(intensity, 1));
    if (label.length > 0) geometry.setAttribute("label", new Int32BufferAttribute(label, 1));

    geometry.computeBoundingSphere();

    // build material

    const material = new PointsMaterial({ size: 0.005 });
    if (color.length > 0) material.vertexColors = true;

    // build point cloud

    return new Points(geometry, material);
  }
}
