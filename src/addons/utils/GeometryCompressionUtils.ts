import { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";

type PackedAttribute = (BufferAttribute | InterleavedBufferAttribute) & {
  isPacked?: boolean;
  bytes?: number;
  packingMethod?: string;
};
export type NormalEncoding = "DEFAULT" | "OCT1Byte" | "OCT2Byte" | "ANGLES";

function octEncodeBest(x: number, y: number, z: number, bytes: 1 | 2): Int8Array | Int16Array {
  let best: Int8Array | Int16Array = new Int8Array(2);
  let bestCos = -Infinity;
  for (const xRound of [Math.floor, Math.ceil]) {
    for (const yRound of [Math.floor, Math.ceil]) {
      let a = x / (Math.abs(x) + Math.abs(y) + Math.abs(z));
      let b = y / (Math.abs(x) + Math.abs(y) + Math.abs(z));
      if (z < 0) {
        const nextA = (1 - Math.abs(b)) * (a >= 0 ? 1 : -1);
        const nextB = (1 - Math.abs(a)) * (b >= 0 ? 1 : -1);
        a = nextA;
        b = nextB;
        let diff = 1 - Math.abs(a) - Math.abs(b);
        if (diff > 0) {
          diff += 0.001;
          a += a > 0 ? diff / 2 : -diff / 2;
          b += b > 0 ? diff / 2 : -diff / 2;
        }
      }
      const scale = bytes === 1 ? 127.5 : 32767.5;
      const values = [xRound(a * scale + (a < 0 ? 1 : 0)), yRound(b * scale + (b < 0 ? 1 : 0))];
      const encoded = bytes === 1 ? new Int8Array(values) : new Int16Array(values);
      let dx = encoded[0] / (encoded[0] < 0 ? (bytes === 1 ? 127 : 32767) : bytes === 1 ? 128 : 32768);
      let dy = encoded[1] / (encoded[1] < 0 ? (bytes === 1 ? 127 : 32767) : bytes === 1 ? 128 : 32768);
      const dz = 1 - Math.abs(dx) - Math.abs(dy);
      if (dz < 0) {
        const oldX = dx;
        dx = (1 - Math.abs(dy)) * (dx >= 0 ? 1 : -1);
        dy = (1 - Math.abs(oldX)) * (dy >= 0 ? 1 : -1);
      }
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const cosine = (x * dx + y * dy + z * dz) / length;
      if (cosine > bestCos || bestCos === -Infinity) {
        best = encoded;
        bestCos = cosine;
      }
    }
  }
  return best;
}

/** Compresses normals. Packed attributes require a shader that decodes the selected encoding. */
export function compressNormals(geometry: BufferGeometry, encodeMethod: NormalEncoding): void {
  const normal = geometry.attributes.normal as PackedAttribute;
  if (!normal)
    console.error("THREE.GeometryCompressionUtils.compressNormals(): Geometry must contain normal attribute.");
  if (normal.isPacked) return;
  if (normal.itemSize !== 3)
    console.error(
      "THREE.GeometryCompressionUtils.compressNormals(): normal.itemSize is not 3, which cannot be encoded.",
    );
  const array = normal.array;
  let result: Uint8Array | Int8Array | Int16Array | Uint16Array;
  if (encodeMethod === "DEFAULT") result = new Uint8Array(normal.count * 3);
  else if (encodeMethod === "OCT1Byte") result = new Int8Array(normal.count * 2);
  else if (encodeMethod === "OCT2Byte") result = new Int16Array(normal.count * 2);
  else if (encodeMethod === "ANGLES") result = new Uint16Array(normal.count * 2);
  else {
    console.error("Unrecognized encoding method, should be `DEFAULT` or `ANGLES` or `OCT`. ");
    normal.needsUpdate = true;
    normal.isPacked = true;
    normal.packingMethod = encodeMethod;
    return;
  }
  for (let i = 0; i < array.length; i += 3) {
    const x = array[i],
      y = array[i + 1],
      z = array[i + 2];
    if (encodeMethod === "DEFAULT") {
      result[i] = Math.round((x + 1) * 0.5 * 255);
      result[i + 1] = Math.round((y + 1) * 0.5 * 255);
      result[i + 2] = Math.round((z + 1) * 0.5 * 255);
    } else if (encodeMethod === "ANGLES") {
      result[(i / 3) * 2] = Math.trunc(0.5 * (1 + Math.atan2(y, x) / Math.PI) * 65535);
      result[(i / 3) * 2 + 1] = Math.trunc(0.5 * (1 + z) * 65535);
    } else {
      const encoded = octEncodeBest(x, y, z, encodeMethod === "OCT1Byte" ? 1 : 2);
      result[(i / 3) * 2] = encoded[0];
      result[(i / 3) * 2 + 1] = encoded[1];
    }
  }
  const packed = new BufferAttribute(result, encodeMethod === "DEFAULT" ? 3 : 2, true) as PackedAttribute;
  packed.bytes = result.byteLength;
  packed.needsUpdate = true;
  packed.isPacked = true;
  packed.packingMethod = encodeMethod;
  geometry.setAttribute("normal", packed);
}

function quantize(array: BufferAttribute["array"], dimensions: number): Uint16Array {
  const min = new Float32Array(dimensions).fill(Number.MAX_VALUE);
  const max = new Float32Array(dimensions).fill(-Number.MAX_VALUE);
  for (let i = 0; i < array.length; i += dimensions)
    for (let j = 0; j < dimensions; j++) {
      min[j] = Math.min(min[j], array[i + j]);
      max[j] = Math.max(max[j], array[i + j]);
    }
  const multiplier = new Float32Array(dimensions);
  for (let j = 0; j < dimensions; j++) multiplier[j] = max[j] !== min[j] ? 65535 / (max[j] - min[j]) : 0;
  const result = new Uint16Array(array.length);
  for (let i = 0; i < array.length; i += dimensions)
    for (let j = 0; j < dimensions; j++) result[i + j] = Math.floor((array[i + j] - min[j]) * multiplier[j]);
  return result;
}

export function compressPositions(geometry: BufferGeometry): void {
  const position = geometry.attributes.position as PackedAttribute;
  if (!position)
    console.error("THREE.GeometryCompressionUtils.compressPositions(): Geometry must contain position attribute.");
  if (position.isPacked) return;
  if (position.itemSize !== 3)
    console.error(
      "THREE.GeometryCompressionUtils.compressPositions(): position.itemSize is not 3, which cannot be packed.",
    );
  const result = quantize(position.array, 3);
  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  const packed = new BufferAttribute(result, 3) as PackedAttribute;
  packed.isPacked = true;
  packed.needsUpdate = true;
  packed.bytes = result.byteLength;
  geometry.setAttribute("position", packed);
}

export function compressUvs(geometry: BufferGeometry): void {
  const uv = geometry.attributes.uv as PackedAttribute;
  if (!uv) console.error("THREE.GeometryCompressionUtils.compressUvs(): Geometry must contain uv attribute.");
  if (uv.isPacked) return;
  let min = Infinity,
    max = -Infinity;
  for (const value of uv.array) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const normalized = min >= -1 && max <= 1;
  const result = normalized ? new Uint16Array(uv.array.length) : quantize(uv.array, 2);
  if (normalized) for (let i = 0; i < uv.array.length; i++) result[i] = Math.round((uv.array[i] + 1) * 0.5 * 65535);
  const packed = new BufferAttribute(result, 2, normalized) as PackedAttribute;
  packed.isPacked = true;
  packed.needsUpdate = true;
  packed.bytes = result.byteLength;
  geometry.setAttribute("uv", packed);
}
