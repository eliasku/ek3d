import assert from "node:assert/strict";
import { gzipSync, gunzipSync, zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { test } from "vite-plus/test";
import { SPZLoader } from "../src/addons/loaders/SPZLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute);
  return value;
}

function streams(version: number, degree: number): Uint8Array[] {
  const positions =
    version === 1 ? new Uint8Array([0, 60, 0, 192, 0, 66]) : new Uint8Array([2, 0, 0, 252, 255, 255, 6, 0, 0]);
  const rotations = version < 3 ? new Uint8Array([128, 128, 128]) : new Uint8Array([0, 0, 0, 192]);
  const sh = Uint8Array.from({ length: [0, 9, 24, 45, 72][degree] }, (_, i) => i + 1);
  return [
    positions,
    new Uint8Array([200]),
    new Uint8Array([0, 128, 255]),
    new Uint8Array([160, 160, 160]),
    rotations,
    sh,
  ];
}

function raw(version: number, degree: number): Uint8Array {
  const parts = streams(version, degree);
  const bytes = new Uint8Array(16 + parts.reduce((sum, part) => sum + part.length, 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x5053474e, true);
  view.setUint32(4, version, true);
  view.setUint32(8, 1, true);
  view.setUint8(12, degree);
  view.setUint8(13, 1);
  let offset = 16;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function v4(degree: number): ArrayBuffer {
  const uncompressed = streams(4, degree).filter((part) => part.length > 0);
  const parts = uncompressed.map((part) => zstdCompressSync(part));
  const bytes = new Uint8Array(20 + parts.length * 16 + parts.reduce((sum, part) => sum + part.length, 0));
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x5053474e, true);
  view.setUint32(4, 4, true);
  view.setUint32(8, 1, true);
  view.setUint8(12, degree);
  view.setUint8(13, 1);
  view.setUint8(15, parts.length);
  view.setUint32(16, 20, true);
  let offset = 20 + parts.length * 16;
  parts.forEach((part, i) => {
    view.setBigUint64(20 + i * 16, BigInt(part.length), true);
    view.setBigUint64(28 + i * 16, BigInt(uncompressed[i].length), true);
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes.buffer;
}

function assertGeometry(geometry: BufferGeometry, degree: number): void {
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, -2, 3]);
  const covariance = Array.from(attribute(geometry, "covariance").array);
  [1, 0, 0, 1, 0, 1].forEach((expected, i) => assert.ok(Math.abs(covariance[i] - expected) < 1e-5));
  assert.deepEqual(Array.from(attribute(geometry, "color").array), [0, 128, 255, 200]);
  let source = 1;
  for (let band = 1; band <= Math.min(degree, 3); band++) {
    const words = attribute(geometry, `sphericalHarmonics${band}`).array;
    assert.ok(words instanceof Uint32Array);
    const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength);
    const components = [0, 9, 15, 21][band];
    assert.deepEqual(Array.from(bytes), [
      ...Array.from({ length: components }, () => source++),
      ...Array(bytes.length - components).fill(128),
    ]);
  }
}

test("SPZ versions 1–3 decompress gzip and decode positions, covariance and SH", () => {
  const loader = new SPZLoader().setGzipRuntime({ gunzipSync });
  for (const version of [1, 2, 3]) {
    const compressed = Uint8Array.from(gzipSync(raw(version, 4)));
    const geometry = loader.parse(compressed.buffer);
    assert.ok(geometry instanceof BufferGeometry);
    assertGeometry(geometry, 4);
  }
});

test("SPZ v4 initializes injected ZSTD and decodes each independent stream", async () => {
  let initializations = 0;
  let decodes = 0;
  const loader = new SPZLoader().setZSTDRuntime({
    async init() {
      initializations++;
    },
    decode(data, length) {
      decodes++;
      const decoded = zstdDecompressSync(data);
      assert.equal(decoded.length, length);
      return decoded;
    },
  });
  const tocMetadata = v4(3);
  const view = new DataView(tocMetadata);
  for (let i = 0; i < view.getUint8(15); i++) view.setBigUint64(28 + i * 16, 0n, true);
  const [one, two] = await Promise.all([loader.parse(tocMetadata), loader.parse(v4(0))]);
  assert.ok(one && two);
  assertGeometry(one, 3);
  assertGeometry(two, 0);
  assert.equal(initializations, 1);
  assert.equal(decodes, 11);
});

test("SPZ rejects missing runtimes and malformed payloads", async () => {
  const loader = new SPZLoader();
  assert.throws(() => loader.parse(new ArrayBuffer(0)), /Gzip runtime/);
  assert.throws(() => loader.parse(v4(0)), /ZSTD runtime/);
  assert.throws(() => loader.parseRawSPZ(raw(2, 3).subarray(0, 20)), /byte length/);
  const malformed = v4(0);
  new DataView(malformed).setBigUint64(20, 9999n, true);
  loader.setZSTDRuntime({ decode: (data) => data });
  await assert.rejects(loader.parse(malformed) as Promise<BufferGeometry>, /stream length/);
});
