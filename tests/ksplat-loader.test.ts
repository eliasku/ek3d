import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { KSPLATLoader } from "../src/addons/loaders/KSPLATLoader";
import { toHalfFloat } from "../src/extras/DataUtils";
import { BufferAttribute } from "../src/core/BufferAttribute";
import type { BufferGeometry } from "../src/core/BufferGeometry";

const components = [0, 9, 24, 45];

function fixture(degrees: number[], compression = 0): ArrayBuffer {
  const rowSizes = degrees.map(
    (degree) =>
      (compression === 0 ? 44 : 24) + components[degree] * (compression === 0 ? 4 : compression === 1 ? 2 : 1),
  );
  // Compressed sections contain one full and one partial bucket with one splat each.
  const count = compression === 0 ? 1 : 2;
  const bucketBytes = compression === 0 ? 0 : 28;
  const buffer = new ArrayBuffer(
    4096 + degrees.length * 1024 + rowSizes.reduce((sum, size) => sum + bucketBytes + size * count, 0),
  );
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint8(1, 1);
  view.setUint32(4, degrees.length, true);
  view.setUint32(8, degrees.length, true);
  view.setUint32(12, degrees.length * count, true);
  view.setUint32(16, degrees.length * count, true);
  view.setUint16(20, compression, true);
  view.setFloat32(36, -1, true);
  view.setFloat32(40, 1, true);
  let data = 4096 + degrees.length * 1024;
  for (let section = 0; section < degrees.length; section++) {
    const header = 4096 + section * 1024;
    view.setUint32(header, count, true);
    view.setUint32(header + 4, count, true);
    view.setUint16(header + 40, degrees[section], true);
    if (compression !== 0) {
      view.setUint32(header + 8, 1, true);
      view.setUint32(header + 12, 2, true);
      view.setFloat32(header + 16, 4, true);
      view.setUint16(header + 20, 12, true);
      view.setUint32(header + 24, 32767, true);
      view.setUint32(header + 32, 1, true);
      view.setUint32(header + 36, 1, true);
      view.setUint32(data, 1, true);
      for (let bucket = 0; bucket < 2; bucket++) {
        for (let axis = 0; axis < 3; axis++)
          view.setFloat32(data + 4 + bucket * 12 + axis * 4, bucket * 10 + axis + 1, true);
      }
    }
    data += bucketBytes;
    for (let row = 0; row < count; row++) {
      const base = data + row * rowSizes[section];
      if (compression === 0) {
        [section + 1, 2, 3, 2, 3, 4, 1, 0, 0, 0].forEach((value, i) => view.setFloat32(base + i * 4, value, true));
      } else {
        for (let axis = 0; axis < 3; axis++) view.setUint16(base + axis * 2, 32767, true);
        [2, 3, 4, 1, 0, 0, 0].forEach((value, i) => view.setUint16(base + 6 + i * 2, toHalfFloat(value), true));
      }
      const colorOffset = compression === 0 ? 40 : 20;
      bytes.set([10, 20, 30, 40], base + colorOffset);
      for (let i = 0; i < components[degrees[section]]; i++) {
        const offset = base + colorOffset + 4 + i * (compression === 0 ? 4 : compression === 1 ? 2 : 1);
        if (compression === 0) view.setFloat32(offset, (i + 1) / 128, true);
        else if (compression === 1) view.setUint16(offset, toHalfFloat((i + 1) / 128), true);
        else view.setUint8(offset, 255);
      }
    }
    data += rowSizes[section] * count;
  }
  return buffer;
}

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const result = geometry.getAttribute(name);
  assert.ok(result instanceof BufferAttribute);
  return result;
}

function shBytes(geometry: BufferGeometry, degree: number): number[] {
  const array = attribute(geometry, `sphericalHarmonics${degree}`).array;
  return Array.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
}

test("parses uncompressed covariance, color and mixed-degree SH bands", () => {
  const geometry = new KSPLATLoader().parse(fixture([0, 3]));
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, 2, 3, 2, 2, 3]);
  assert.deepEqual(Array.from(attribute(geometry, "covariance").array), [4, 0, 0, 9, 0, 16, 4, 0, 0, 9, 0, 16]);
  assert.deepEqual(Array.from(attribute(geometry, "color").array), [10, 20, 30, 40, 10, 20, 30, 40]);
  assert.deepEqual(
    shBytes(geometry, 1),
    [
      128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 129, 132, 135, 130, 133, 136, 131, 134, 137, 128, 128,
      128,
    ],
  );
  assert.deepEqual(
    shBytes(geometry, 2).slice(16, 31),
    [138, 143, 148, 139, 144, 149, 140, 145, 150, 141, 146, 151, 142, 147, 152],
  );
  assert.deepEqual(
    shBytes(geometry, 3).slice(24, 45),
    [153, 160, 167, 154, 161, 168, 155, 162, 169, 156, 163, 170, 157, 164, 171, 158, 165, 172, 159, 166, 173],
  );
});

test("decodes half-float and byte compression with full and partial buckets", () => {
  for (const compression of [1, 2]) {
    const geometry = new KSPLATLoader().parse(fixture([1], compression));
    assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, 2, 3, 11, 12, 13]);
    assert.deepEqual(Array.from(attribute(geometry, "covariance").array), [4, 0, 0, 9, 0, 16, 4, 0, 0, 9, 0, 16]);
    assert.deepEqual(
      shBytes(geometry, 1).slice(0, 9),
      compression === 1 ? [129, 132, 135, 130, 133, 136, 131, 134, 137] : Array(9).fill(255),
    );
  }
});

test("enforces upstream version and structural boundaries", () => {
  const loader = new KSPLATLoader();
  assert.throws(() => loader.parse(new ArrayBuffer(4095)), /Invalid KSPLAT header/);
  const buffer = fixture([0]);
  const view = new DataView(buffer);
  view.setUint8(1, 0);
  assert.throws(() => loader.parse(buffer), /Unsupported KSPLAT version 0\.0/);
  view.setUint8(0, 1);
  view.setUint8(1, 1);
  assert.throws(() => loader.parse(buffer), /Unsupported KSPLAT version 1\.1/);
  view.setUint8(0, 0);
  view.setUint8(1, 2);
  assert.equal(attribute(loader.parse(buffer), "position").count, 1);
  view.setUint16(20, 3, true);
  assert.throws(() => loader.parse(buffer), /Unsupported KSPLAT compression/);
  view.setUint16(20, 0, true);
  view.setUint16(4096 + 40, 4, true);
  assert.throws(() => loader.parse(buffer), /Unsupported KSPLAT spherical harmonics degree/);
  view.setUint16(4096 + 40, 0, true);
  assert.throws(() => loader.parse(buffer.slice(0, buffer.byteLength - 1)), /Invalid KSPLAT byte length/);
  view.setUint32(16, 2, true);
  assert.throws(() => loader.parse(buffer), /splat count mismatch/);
});
