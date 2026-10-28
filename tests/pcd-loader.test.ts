import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { PCDLoader } from "../src/addons/loaders/PCDLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { PointsMaterial } from "../src/materials/PointsMaterial";
import type { BufferGeometry } from "../src/core/BufferGeometry";
import { SRGBColorSpace } from "../src/constants";
import { Color } from "../src/math/Color";

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute, `missing ${name} attribute`);
  return value;
}

function ascii(lines: string[]): ArrayBuffer {
  return new TextEncoder().encode(lines.join("\n")).buffer as ArrayBuffer;
}

function binary(header: string[], body: Uint8Array): ArrayBuffer {
  const prefix = new TextEncoder().encode(`${header.join("\n")}\n`);
  const bytes = new Uint8Array(prefix.byteLength + body.byteLength);
  bytes.set(prefix);
  bytes.set(body, prefix.byteLength);
  return bytes.buffer;
}

test("ASCII xyz plus integer-valued float rgb produces position and color attributes", () => {
  const data = ascii([
    "# .PCD v0.7",
    "VERSION 0.7",
    "FIELDS x y z rgb intensity label",
    "SIZE 4 4 4 4 4 4",
    "TYPE F F F U F U",
    "COUNT 1 1 1 1 1 1",
    "WIDTH 2",
    "HEIGHT 1",
    "POINTS 2",
    "VIEWPOINT 0 0 0 1 0 0 0",
    "DATA ascii",
    "0 1 2 16711680 0.5 7",
    "3 4 5 65280 1.5 9",
    "",
  ]);

  const points = new PCDLoader().parse(data);
  const geometry = points.geometry;

  assert.deepEqual(Array.from(attribute(geometry, "position").array), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(attribute(geometry, "intensity").array), [0.5, 1.5]);
  assert.deepEqual(Array.from(attribute(geometry, "label").array), [7, 9]);
  assert.equal(attribute(geometry, "label").array instanceof Int32Array, true);

  const red = new Color().setRGB(1, 0, 0, SRGBColorSpace);
  const green = new Color().setRGB(0, 1, 0, SRGBColorSpace);
  const color = attribute(geometry, "color");
  assert.deepEqual(Array.from(color.array), [red.r, red.g, red.b, green.r, green.g, green.b]);
  assert.ok(points.material instanceof PointsMaterial);
  assert.equal(points.material.vertexColors, true);
  assert.equal(geometry.boundingSphere !== null, true);
});

test("binary records decode field offsets and honor the endianness flag", () => {
  const header = [
    "VERSION 0.7",
    "FIELDS x y z intensity",
    "SIZE 4 4 4 4",
    "TYPE F F F F",
    "COUNT 1 1 1 1",
    "WIDTH 2",
    "HEIGHT 1",
    "POINTS 2",
    "DATA binary",
  ];
  const body = new Uint8Array(32);
  const view = new DataView(body.buffer);
  [1, 2, 3].forEach((value, index) => view.setFloat32(index * 4, value, true));
  view.setFloat32(12, 0.25, true);
  [4, 5, 6].forEach((value, index) => view.setFloat32(16 + index * 4, value, true));
  view.setFloat32(28, 0.75, true);

  const little = new PCDLoader().parse(binary(header, body));
  assert.deepEqual(Array.from(attribute(little.geometry, "position").array), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Array.from(attribute(little.geometry, "intensity").array), [0.25, 0.75]);

  const bigBody = new Uint8Array(body);
  const bigView = new DataView(bigBody.buffer);
  [1, 2, 3].forEach((value, index) => bigView.setFloat32(index * 4, value, false));
  bigView.setFloat32(12, 0.25, false);
  [4, 5, 6].forEach((value, index) => bigView.setFloat32(16 + index * 4, value, false));
  bigView.setFloat32(28, 0.75, false);

  const loader = new PCDLoader();
  loader.littleEndian = false;
  assert.deepEqual(
    Array.from(attribute(loader.parse(binary(header, bigBody)).geometry, "position").array),
    [1, 2, 3, 4, 5, 6],
  );
});

test("binary_compressed structure-of-arrays payload decompresses and interleaves fields", () => {
  // Two points, structure-of-arrays: XXYYZZ.
  const values = [1, 4, 2, 5, 3, 6];
  const fields = new Uint8Array(values.length * 4);
  values.forEach((value, index) => new DataView(fields.buffer).setFloat32(index * 4, value, true));

  // Literal-only LZF stream: each control byte carries 1..32 literal bytes.
  const compressed: number[] = [];
  for (let offset = 0; offset < fields.length; offset += 32) {
    const run = fields.subarray(offset, offset + 32);
    compressed.push(run.length - 1, ...run);
  }

  const header = [
    "FIELDS x y z",
    "SIZE 4 4 4",
    "TYPE F F F",
    "COUNT 1 1 1",
    "WIDTH 2",
    "HEIGHT 1",
    "POINTS 2",
    "DATA binary_compressed",
  ];
  const prefix = new TextEncoder().encode(`${header.join("\n")}\n`);
  const payload = new Uint8Array(8 + compressed.length);
  new DataView(payload.buffer).setUint32(0, compressed.length, true);
  new DataView(payload.buffer).setUint32(4, fields.length, true);
  payload.set(compressed, 8);

  const bytes = new Uint8Array(prefix.byteLength + payload.byteLength);
  bytes.set(prefix);
  bytes.set(payload, prefix.byteLength);

  const points = new PCDLoader().parse(bytes.buffer);

  assert.deepEqual(Array.from(attribute(points.geometry, "position").array), [1, 2, 3, 4, 5, 6]);
});

test("missing DATA header is reported instead of returning a partial cloud", () => {
  const data = ascii(["VERSION 0.7", "FIELDS x y z", "POINTS 1"]);
  assert.throws(() => new PCDLoader().parse(data), /missing DATA header/);
});
