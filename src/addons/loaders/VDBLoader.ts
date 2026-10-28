/*
 * three-vdb-loader 0.3.0
 * Copyright (c) 2026 Richard Monette
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { TextureType, TextureFilter, PixelFormat } from "../../constants";
import { fromHalfFloat } from "../../extras/DataUtils";
import { FileLoader } from "../../loaders/FileLoader";
import { Loader } from "../../loaders/Loader";
import type { LoadingManager } from "../../loaders/LoadingManager";
import { Box3 } from "../../math/Box3";
import { Matrix4 } from "../../math/Matrix4";
import { Data3DTexture } from "../../textures/Data3DTexture";

export interface VDBRuntime {
  unzlibSync(data: Uint8Array): Uint8Array;
}
export type VDBValueType = "half" | "float" | "double" | "vec3s" | "vec3d";
export type VDBMetadata = Record<string, string | boolean | number | number[]>;
export interface VDBGrid {
  name: string;
  type: VDBValueType;
  metadata: VDBMetadata;
  transform: Matrix4;
  background: number | number[];
  bbox: Box3;
  texture: Data3DTexture | null;
}
type BaseType = "half" | "float" | "double";
interface GridContext {
  name: string;
  compression: number;
  metadata: VDBMetadata;
  transform: Matrix4;
  base: BaseType;
  components: number;
  saveFloatAsHalf: boolean;
  background: number[];
}
interface LeafNode {
  origin: number[];
  valueMask: Uint8Array;
  values: Float32Array | null;
}
interface InternalNode {
  origin: number[];
  log2Dim: number;
  childTotal: number;
  childMask: Uint8Array;
  valueMask: Uint8Array;
  values: Float32Array;
  children: Map<number, TreeNode>;
}
type TreeNode = InternalNode | LeafNode;
interface Dense {
  data: Float32Array;
  bounds: number[];
  width: number;
  height: number;
  stride: number;
}

function decompressZip(reader: Reader, length: number): Uint8Array {
  if (!reader.runtime) throw new Error("VDBLoader: ZIP compression requires a zlib decoder runtime.");
  return reader.runtime.unzlibSync(reader.bytes(length));
}

const MAGIC = 0x56444220;

const FILE_VERSION_NODE_MASK_COMPRESSION = 222;

const COMPRESS_ZIP = 0x1;
const COMPRESS_ACTIVE_MASK = 0x2;
const COMPRESS_BLOSC = 0x4;

const BLOSC_DOSHUFFLE = 0x1;
const BLOSC_MEMCPYED = 0x2;
const BLOSC_DOBITSHUFFLE = 0x4;
const BLOSC_DONT_SPLIT = 0x10;
const BLOSC_LZ4_FORMAT = 1;

const NO_MASK_OR_INACTIVE_VALS = 0;
const NO_MASK_AND_ONE_INACTIVE_VAL = 2;
const MASK_AND_NO_INACTIVE_VALS = 3;
const MASK_AND_ONE_INACTIVE_VAL = 4;
const MASK_AND_TWO_INACTIVE_VALS = 5;
const NO_MASK_AND_ALL_VALS = 6;

const HALF_FLOAT_SUFFIX = "_HalfFloat";
const VALUE_SIZES = { half: 2, float: 4, double: 8 };

const VALUE_TYPES = {
  half: { base: "half", components: 1 },
  float: { base: "float", components: 1 },
  double: { base: "double", components: 1 },
  vec3s: { base: "float", components: 3 },
  vec3d: { base: "double", components: 3 },
} as const;

const MAX_DENSE_VALUES = 1 << 28;

export class VDBLoader extends Loader<VDBGrid[]> {
  gridNames: string[] | null = null;
  runtime?: VDBRuntime;

  constructor(manager?: LoadingManager, runtime?: VDBRuntime) {
    super(manager);
    this.runtime = runtime;
  }

  setGridNames(names: string[] | null): this {
    this.gridNames = names;
    return this;
  }
  override load(
    url: string,
    onLoad?: (grids: VDBGrid[]) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setPriority(this.priority);
    loader.setCache(this.cache);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (buffer) => {
        try {
          if (!(buffer instanceof ArrayBuffer)) throw new TypeError("VDBLoader requires an ArrayBuffer");
          const grids = this.parse(buffer);
          onLoad?.(grids);
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
  parse(buffer: ArrayBuffer): VDBGrid[] {
    const reader = new Reader(buffer, this.runtime);

    if (reader.int64() !== MAGIC) {
      throw new Error("THREE.VDBLoader: Not a VDB file.");
    }

    const fileVersion = reader.uint32();

    if (fileVersion < FILE_VERSION_NODE_MASK_COMPRESSION) {
      throw new Error("THREE.VDBLoader: Unsupported file version " + fileVersion + ".");
    }

    reader.skip(8); // library version

    if (reader.uint8() === 0) {
      throw new Error("THREE.VDBLoader: Files without grid offsets are not supported.");
    }

    reader.skip(36); // uuid

    readMetadata(reader);

    const descriptors = [];
    const gridCount = reader.int32();

    for (let i = 0; i < gridCount; i++) {
      const descriptor = {
        name: reader.string().split("\x1e")[0],
        type: reader.string(),
        instanceParent: reader.string(),
        gridPos: reader.int64(),
        blockPos: reader.int64(),
        endPos: reader.int64(),
      };

      descriptors.push(descriptor);

      reader.offset = descriptor.endPos;
    }

    const grids = [];

    for (const descriptor of descriptors) {
      if (this.gridNames !== null && this.gridNames.includes(descriptor.name) === false) continue;

      let type = descriptor.type;
      let saveFloatAsHalf = false;

      if (type.endsWith(HALF_FLOAT_SUFFIX)) {
        type = type.slice(0, -HALF_FLOAT_SUFFIX.length);
        saveFloatAsHalf = true;
      }

      const match = /^Tree_(float|double|half|vec3s|vec3d)_5_4_3$/.exec(type);

      if (match === null || descriptor.instanceParent !== "") {
        console.warn(
          'THREE.VDBLoader: Skipping unsupported grid "' + descriptor.name + '" of type ' + descriptor.type + ".",
        );
        continue;
      }

      reader.offset = descriptor.gridPos;

      grids.push(readGrid(reader, descriptor.name, match[1] as VDBValueType, saveFloatAsHalf));
    }

    return grids;
  }
}

class Reader {
  buffer: ArrayBuffer;
  view: DataView;
  offset: number;
  runtime?: VDBRuntime;

  constructor(buffer: ArrayBuffer, runtime?: VDBRuntime) {
    this.runtime = runtime;

    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  skip(n: number) {
    this.offset += n;
  }

  uint8() {
    return this.view.getUint8(this.offset++);
  }

  int32() {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  uint32() {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  int64() {
    const value = Number(this.view.getBigInt64(this.offset, true));
    this.offset += 8;
    return value;
  }

  float64() {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  bytes(n: number) {
    const value = new Uint8Array(this.buffer, this.offset, n);
    this.offset += n;
    return value;
  }

  string() {
    const length = this.uint32();
    return new TextDecoder().decode(this.bytes(length));
  }

  mask(size: number) {
    return this.bytes(size >> 3).slice();
  }
}

function readMetadata(reader: Reader): VDBMetadata {
  const metadata: VDBMetadata = {};
  const count = reader.uint32();

  for (let i = 0; i < count; i++) {
    const name = reader.string();
    const type = reader.string();
    const size = reader.uint32();
    const view = new DataView(reader.buffer, reader.offset, size);

    switch (type) {
      case "string":
        metadata[name] = new TextDecoder().decode(reader.bytes(size));
        break;
      case "bool":
        metadata[name] = view.getUint8(0) !== 0;
        break;
      case "int32":
        metadata[name] = view.getInt32(0, true);
        break;
      case "int64":
        metadata[name] = Number(view.getBigInt64(0, true));
        break;
      case "float":
        metadata[name] = view.getFloat32(0, true);
        break;
      case "double":
        metadata[name] = view.getFloat64(0, true);
        break;
      case "vec3i":
        metadata[name] = [view.getInt32(0, true), view.getInt32(4, true), view.getInt32(8, true)];
        break;
      case "vec3s":
        metadata[name] = [view.getFloat32(0, true), view.getFloat32(4, true), view.getFloat32(8, true)];
        break;
      case "vec3d":
        metadata[name] = [view.getFloat64(0, true), view.getFloat64(8, true), view.getFloat64(16, true)];
        break;
    }

    reader.offset = view.byteOffset + size;
  }

  return metadata;
}

function readTransform(reader: Reader): Matrix4 {
  const type = reader.string();
  const vec3 = () => [reader.float64(), reader.float64(), reader.float64()];
  const matrix = new Matrix4();

  switch (type) {
    case "TranslationMap": {
      const t = vec3();
      matrix.makeTranslation(t[0], t[1], t[2]);
      break;
    }

    case "ScaleMap":
    case "UniformScaleMap": {
      const s = vec3();
      reader.skip(4 * 24);
      matrix.makeScale(s[0], s[1], s[2]);
      break;
    }

    case "ScaleTranslateMap":
    case "UniformScaleTranslateMap": {
      const t = vec3();
      const s = vec3();
      reader.skip(4 * 24);
      matrix.makeScale(s[0], s[1], s[2]).setPosition(t[0], t[1], t[2]);
      break;
    }

    case "AffineMap":
    case "UnitaryMap": {
      const elements = [];
      for (let i = 0; i < 16; i++) elements.push(reader.float64());
      matrix.fromArray(elements);
      break;
    }

    default:
      throw new Error("THREE.VDBLoader: Unsupported transform " + type + ".");
  }

  return matrix;
}

function readGrid(reader: Reader, name: string, valueType: VDBValueType, saveFloatAsHalf: boolean): VDBGrid {
  const grid: GridContext = {
    background: [],
    name,
    compression: reader.uint32(),
    metadata: readMetadata(reader),
    transform: readTransform(reader),
    base: VALUE_TYPES[valueType].base,
    components: VALUE_TYPES[valueType].components,
    saveFloatAsHalf,
  };

  reader.skip(4); // buffer count

  grid.background = readValue(reader, grid);

  const tileCount = reader.uint32();
  const childCount = reader.uint32();

  const tiles = [];
  const children = [];

  for (let i = 0; i < tileCount; i++) {
    const origin = [reader.int32(), reader.int32(), reader.int32()];
    const value = readValue(reader, grid);
    const active = reader.uint8() !== 0;
    tiles.push({ origin, value, active });
  }

  for (let i = 0; i < childCount; i++) {
    const origin = [reader.int32(), reader.int32(), reader.int32()];
    children.push(readInternalTopology(reader, grid, origin, 5, 7));
  }

  for (const child of children) readInternalBuffers(reader, grid, child);

  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (const tile of tiles) {
    if (tile.active) expandByCube(bounds, tile.origin, 1 << 12);
  }

  for (const child of children) expandByNode(bounds, child);

  const bbox = new Box3();

  const result: VDBGrid = {
    name,
    type: valueType,
    metadata: grid.metadata,
    transform: grid.transform,
    background: grid.components === 1 ? grid.background[0] : grid.background,
    bbox,
    texture: null,
  };

  if (bounds[0] > bounds[3]) return result;

  bbox.min.fromArray(bounds, 0);
  bbox.max.fromArray(bounds, 3);

  const width = bounds[3] - bounds[0] + 1;
  const height = bounds[4] - bounds[1] + 1;
  const depth = bounds[5] - bounds[2] + 1;

  const stride = grid.components === 1 ? 1 : 4;

  if (width * height * depth * stride > MAX_DENSE_VALUES) {
    throw new Error(
      'THREE.VDBLoader: Grid "' +
        name +
        '" is too large for a dense texture (' +
        width +
        "x" +
        height +
        "x" +
        depth +
        ").",
    );
  }

  const data = new Float32Array(width * height * depth * stride);
  const dense = { data, bounds, width, height, stride };

  fillCube(dense, bounds, Infinity, grid.background);

  for (const tile of tiles) fillCube(dense, tile.origin, 1 << 12, tile.value);
  for (const child of children) fillNode(dense, child);

  const texture = new Data3DTexture(data, width, height, depth);
  texture.format = stride === 1 ? PixelFormat.Red : PixelFormat.RGBA;
  texture.type = TextureType.Float;
  texture.minFilter = TextureFilter.Linear;
  texture.magFilter = TextureFilter.Linear;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  result.texture = texture;

  return result;
}

function readValue(reader: Reader, grid: GridContext): number[] {
  const value = [];

  for (let c = 0; c < grid.components; c++) {
    const offset = reader.offset;

    reader.offset += VALUE_SIZES[grid.base];

    switch (grid.base) {
      case "half":
        value.push(fromHalfFloat(reader.view.getUint16(offset, true)));
        break;
      case "float":
        value.push(reader.view.getFloat32(offset, true));
        break;
      case "double":
        value.push(reader.view.getFloat64(offset, true));
        break;
    }
  }

  return value;
}

function readInternalTopology(
  reader: Reader,
  grid: GridContext,
  origin: number[],
  log2Dim: number,
  childTotal: number,
): InternalNode {
  const size = 1 << (3 * log2Dim);

  const node: InternalNode = {
    origin,
    log2Dim,
    childTotal,
    childMask: reader.mask(size),
    valueMask: new Uint8Array(0),
    values: new Float32Array(0),
    children: new Map<number, TreeNode>(),
  };

  node.valueMask = reader.mask(size);
  node.values = readCompressedValues(reader, grid, size, node.valueMask);

  for (let i = 0; i < size; i++) {
    if (isOn(node.childMask, i) === false) continue;

    const childOrigin = offsetToCoord(i, log2Dim, childTotal, origin);

    node.children.set(
      i,
      log2Dim === 5
        ? readInternalTopology(reader, grid, childOrigin, 4, 3)
        : { origin: childOrigin, valueMask: reader.mask(512), values: null },
    );
  }

  return node;
}

function readInternalBuffers(reader: Reader, grid: GridContext, node: InternalNode): void {
  for (const child of node.children.values()) {
    if ("children" in child) {
      readInternalBuffers(reader, grid, child);
    } else {
      child.valueMask = reader.mask(512);
      child.values = readCompressedValues(reader, grid, 512, child.valueMask);
    }
  }
}

function readCompressedValues(reader: Reader, grid: GridContext, count: number, valueMask: Uint8Array): Float32Array {
  const metadata = reader.uint8();

  let inactiveVal1 = grid.background;
  let inactiveVal0 = metadata === NO_MASK_OR_INACTIVE_VALS ? grid.background : grid.background.map((v) => -v);

  if (
    metadata === NO_MASK_AND_ONE_INACTIVE_VAL ||
    metadata === MASK_AND_ONE_INACTIVE_VAL ||
    metadata === MASK_AND_TWO_INACTIVE_VALS
  ) {
    inactiveVal0 = readValue(reader, grid);

    if (metadata === MASK_AND_TWO_INACTIVE_VALS) inactiveVal1 = readValue(reader, grid);
  }

  let selectionMask = null;

  if (
    metadata === MASK_AND_NO_INACTIVE_VALS ||
    metadata === MASK_AND_ONE_INACTIVE_VAL ||
    metadata === MASK_AND_TWO_INACTIVE_VALS
  ) {
    selectionMask = reader.mask(count);
  }

  const maskCompressed = (grid.compression & COMPRESS_ACTIVE_MASK) !== 0 && metadata !== NO_MASK_AND_ALL_VALS;
  const storedCount = maskCompressed ? countOn(valueMask) : count;
  const stored = readData(reader, grid, storedCount);

  if (storedCount === count) return stored;

  const components = grid.components;
  const values = new Float32Array(count * components);

  for (let i = 0, j = 0; i < count; i++) {
    if (isOn(valueMask, i)) {
      for (let c = 0; c < components; c++) values[i * components + c] = stored[j * components + c];
      j++;
    } else {
      values.set(selectionMask !== null && isOn(selectionMask, i) ? inactiveVal1 : inactiveVal0, i * components);
    }
  }

  return values;
}

function readData(reader: Reader, grid: GridContext, count: number): Float32Array {
  if (grid.saveFloatAsHalf && count === 0) return new Float32Array(0);

  const valueType = grid.saveFloatAsHalf ? "half" : grid.base;
  const length = count * grid.components;
  const byteLength = length * VALUE_SIZES[valueType];

  let bytes: Uint8Array;

  if (grid.compression & COMPRESS_BLOSC) {
    const compressedLength = reader.int64();

    bytes = compressedLength <= 0 ? reader.bytes(-compressedLength) : bloscDecompress(reader.bytes(compressedLength));
  } else if (grid.compression & COMPRESS_ZIP) {
    const zippedLength = reader.int64();

    bytes = zippedLength <= 0 ? reader.bytes(-zippedLength) : decompressZip(reader, zippedLength);
  } else {
    bytes = reader.bytes(byteLength);
  }

  if (bytes.byteLength !== byteLength) {
    throw new Error("THREE.VDBLoader: Unexpected data size.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    switch (valueType) {
      case "half":
        values[i] = fromHalfFloat(view.getUint16(i * 2, true));
        break;
      case "float":
        values[i] = view.getFloat32(i * 4, true);
        break;
      case "double":
        values[i] = view.getFloat64(i * 8, true);
        break;
    }
  }

  return values;
}

function bloscDecompress(src: Uint8Array): Uint8Array {
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);

  const flags = src[2];
  const typeSize = src[3];
  const size = view.getUint32(4, true);
  const blockSize = view.getUint32(8, true);

  const out = new Uint8Array(size);

  if (flags & BLOSC_MEMCPYED) {
    out.set(src.subarray(16, 16 + size));
    return out;
  }

  if (flags >> 5 !== BLOSC_LZ4_FORMAT || flags & BLOSC_DOBITSHUFFLE) {
    throw new Error("THREE.VDBLoader: Unsupported Blosc codec.");
  }

  const shuffle = (flags & BLOSC_DOSHUFFLE) !== 0 && typeSize > 1;
  const split = (flags & BLOSC_DONT_SPLIT) === 0;
  const blockCount = Math.ceil(size / blockSize);
  const tmp = new Uint8Array(blockSize);

  for (let i = 0; i < blockCount; i++) {
    const start = i * blockSize;
    const length = Math.min(blockSize, size - start);
    const leftover = length < blockSize;
    const splits = split && typeSize <= 16 && Math.floor(length / typeSize) >= 128 && !leftover ? typeSize : 1;
    const splitLength = Math.floor(length / splits);
    const target = shuffle ? tmp : out.subarray(start, start + length);

    let offset = view.getInt32(16 + i * 4, true);

    for (let j = 0; j < splits; j++) {
      const compressedLength = view.getInt32(offset, true);
      const chunk = src.subarray(offset + 4, offset + 4 + compressedLength);
      const dst = target.subarray(j * splitLength, (j + 1) * splitLength);

      if (compressedLength === splitLength) {
        dst.set(chunk);
      } else if (lz4Decompress(chunk, dst) !== splitLength) {
        throw new Error("THREE.VDBLoader: Invalid Blosc data.");
      }

      offset += 4 + compressedLength;
    }

    if (shuffle) {
      const count = Math.floor(length / typeSize);

      for (let e = 0; e < count; e++) {
        for (let b = 0; b < typeSize; b++) {
          out[start + e * typeSize + b] = tmp[b * count + e];
        }
      }

      const rest = length - count * typeSize;
      out.set(tmp.subarray(length - rest, length), start + length - rest);
    }
  }

  return out;
}

function lz4Decompress(src: Uint8Array, dst: Uint8Array): number {
  let s = 0;
  let d = 0;

  while (s < src.length) {
    const token = src[s++];

    let literals = token >> 4;

    if (literals === 15) {
      let b;
      do {
        b = src[s++];
        literals += b;
      } while (b === 255);
    }

    dst.set(src.subarray(s, s + literals), d);
    s += literals;
    d += literals;

    if (s >= src.length) break;

    const distance = src[s] | (src[s + 1] << 8);
    s += 2;

    let match = token & 15;

    if (match === 15) {
      let b;
      do {
        b = src[s++];
        match += b;
      } while (b === 255);
    }

    match += 4;

    for (let m = d - distance, end = d + match; d < end;) dst[d++] = dst[m++];
  }

  return d;
}

function isOn(mask: Uint8Array, i: number): boolean {
  return (mask[i >> 3] & (1 << (i & 7))) !== 0;
}

function countOn(mask: Uint8Array): number {
  let count = 0;

  for (let i = 0; i < mask.length; i++) {
    let byte = mask[i];

    while (byte !== 0) {
      byte &= byte - 1;
      count++;
    }
  }

  return count;
}

function offsetToCoord(i: number, log2Dim: number, childTotal: number, origin: number[]): number[] {
  const mask = (1 << log2Dim) - 1;

  return [
    origin[0] + ((i >> (2 * log2Dim)) << childTotal),
    origin[1] + (((i >> log2Dim) & mask) << childTotal),
    origin[2] + ((i & mask) << childTotal),
  ];
}

function expandByCube(bounds: number[], origin: number[], size: number): void {
  for (let i = 0; i < 3; i++) {
    bounds[i] = Math.min(bounds[i], origin[i]);
    bounds[i + 3] = Math.max(bounds[i + 3], origin[i] + size - 1);
  }
}

function expandByNode(bounds: number[], node: TreeNode): void {
  if (!("children" in node)) {
    for (let i = 0; i < 512; i++) {
      if (isOn(node.valueMask, i) === false) continue;

      const x = node.origin[0] + (i >> 6);
      const y = node.origin[1] + ((i >> 3) & 7);
      const z = node.origin[2] + (i & 7);

      if (x < bounds[0]) bounds[0] = x;
      if (y < bounds[1]) bounds[1] = y;
      if (z < bounds[2]) bounds[2] = z;
      if (x > bounds[3]) bounds[3] = x;
      if (y > bounds[4]) bounds[4] = y;
      if (z > bounds[5]) bounds[5] = z;
    }

    return;
  }

  const size = 1 << (3 * node.log2Dim);

  for (let i = 0; i < size; i++) {
    const child = node.children.get(i);

    if (child !== undefined) {
      expandByNode(bounds, child);
    } else if (isOn(node.valueMask, i)) {
      expandByCube(bounds, offsetToCoord(i, node.log2Dim, node.childTotal, node.origin), 1 << node.childTotal);
    }
  }
}

function fillCube(dense: Dense, origin: number[], size: number, value: ArrayLike<number>): void {
  const { data, bounds, width, height, stride } = dense;

  const x0 = Math.max(origin[0], bounds[0]),
    x1 = Math.min(origin[0] + size - 1, bounds[3]);
  const y0 = Math.max(origin[1], bounds[1]),
    y1 = Math.min(origin[1] + size - 1, bounds[4]);
  const z0 = Math.max(origin[2], bounds[2]),
    z1 = Math.min(origin[2] + size - 1, bounds[5]);

  if (x0 > x1 || y0 > y1 || z0 > z1) return;

  for (let z = z0; z <= z1; z++) {
    for (let y = y0; y <= y1; y++) {
      const row = ((z - bounds[2]) * height + (y - bounds[1])) * width - bounds[0];

      if (stride === 1) {
        data.fill(value[0], row + x0, row + x1 + 1);
      } else {
        for (let x = x0; x <= x1; x++) data.set(value, (row + x) * stride);
      }
    }
  }
}

function fillNode(dense: Dense, node: TreeNode): void {
  if (!("children" in node)) {
    const { data, bounds, width, height, stride } = dense;
    const components = stride === 1 ? 1 : 3;

    for (let i = 0; i < 512; i++) {
      const x = node.origin[0] + (i >> 6) - bounds[0];
      const y = node.origin[1] + ((i >> 3) & 7) - bounds[1];
      const z = node.origin[2] + (i & 7) - bounds[2];

      if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z > bounds[5] - bounds[2]) continue;

      const index = ((z * height + y) * width + x) * stride;

      for (let c = 0; c < components; c++) data[index + c] = node.values![i * components + c];
    }

    return;
  }

  const size = 1 << (3 * node.log2Dim);

  for (let i = 0; i < size; i++) {
    const child = node.children.get(i);

    if (child !== undefined) {
      fillNode(dense, child);
    } else {
      const components = dense.stride === 1 ? 1 : 3;

      fillCube(
        dense,
        offsetToCoord(i, node.log2Dim, node.childTotal, node.origin),
        1 << node.childTotal,
        node.values.subarray(i * components, (i + 1) * components),
      );
    }
  }
}
