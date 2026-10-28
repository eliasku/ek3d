import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { PLYLoader } from "../src/addons/loaders/PLYLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { Color } from "../src/math/Color";
import { SRGBColorSpace } from "../src/constants";

function attribute(geometry: { getAttribute(name: string): unknown }, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute, `missing ${name} attribute`);
  return value;
}

function index(geometry: { getIndex(): { array: ArrayLike<number> } | null }): { array: ArrayLike<number> } {
  const value = geometry.getIndex();
  assert.ok(value !== null, "missing index");
  return value;
}

function header(lines: string[]): string {
  return ["ply", ...lines, "end_header", ""].join("\n");
}

function binaryHeader(format: string, lines: string[]): Uint8Array {
  return new TextEncoder().encode(header([`format ${format} 1.0`, ...lines]));
}

function concat(parts: Uint8Array[]): ArrayBuffer {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes.buffer;
}

test("ASCII vertices, normals and quads follow the upstream index semantics", () => {
  const text = [
    header([
      "format ascii 1.0",
      "element vertex 4",
      "property float x",
      "property float y",
      "property float z",
      "element face 1",
      "property list uchar int vertex_indices",
    ]),
    "0 0 0",
    "1 0 0",
    "1 1 0",
    "0 1 0",
    "4 0 1 2 3",
    "",
  ].join("\n");

  const geometry = new PLYLoader().parse(text);

  assert.equal(attribute(geometry, "position").count, 4);
  assert.deepEqual(Array.from(index(geometry).array), [0, 1, 2, 0, 2, 3]);
  assert.equal(geometry.boundingSphere !== null, true);
});

test("binary little and big endian bodies decode to the same geometry", () => {
  const properties = [
    "element vertex 2",
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
  ];

  function body(littleEndian: boolean): Uint8Array {
    // vertex: float32 x, y, z followed by uchar red, green, blue (15 bytes each)
    const bytes = new Uint8Array(30);
    const view = new DataView(bytes.buffer);
    const coordinates = [0, 0.5, -1, 1, 2, 3];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) view.setFloat32(i * 15 + j * 4, coordinates[i * 3 + j], littleEndian);
    }
    bytes.set([255, 0, 0], 12);
    bytes.set([0, 255, 0], 27);
    return bytes;
  }

  const little = new PLYLoader().parse(concat([binaryHeader("binary_little_endian", properties), body(true)]));
  const big = new PLYLoader().parse(concat([binaryHeader("binary_big_endian", properties), body(false)]));

  for (const geometry of [little, big]) {
    assert.deepEqual(Array.from(attribute(geometry, "position").array), [0, 0.5, -1, 1, 2, 3]);
    const color = attribute(geometry, "color");
    assert.equal(color.array instanceof Uint8Array, true);
    assert.equal(color.normalized, true);
  }
});

test("double properties keep 64-bit attributes and normalized color conversion applies", () => {
  const text = [
    header([
      "format ascii 1.0",
      "element vertex 1",
      "property double x",
      "property double y",
      "property double z",
      "property uchar red",
      "property uchar green",
      "property uchar blue",
    ]),
    "1.5 2.5 3.5 128 0 0",
    "",
  ].join("\n");

  const geometry = new PLYLoader().parse(text);

  const position = attribute(geometry, "position");
  assert.equal(position.array instanceof Float64Array, true);
  assert.deepEqual(Array.from(position.array), [1.5, 2.5, 3.5]);

  // sRGB 128 -> linear working color -> back to 8 bit is lossy, exactly as upstream.
  const expected = Math.round(new Color().setRGB(128 / 255, 0, 0, SRGBColorSpace).r * 255);
  assert.notEqual(expected, 128);
  assert.deepEqual(Array.from(attribute(geometry, "color").array), [expected, 0, 0]);
});

test("face texcoord data expands the geometry to non-indexed uv attributes", () => {
  const text = [
    header([
      "format ascii 1.0",
      "element vertex 4",
      "property float x",
      "property float y",
      "property float z",
      "element face 1",
      "property list uchar int vertex_indices",
      "property list uchar float texcoord",
    ]),
    "0 0 0",
    "1 0 0",
    "1 1 0",
    "0 1 0",
    "4 0 1 2 3 8 0 0 1 0 1 1 0 1",
    "",
  ].join("\n");

  const geometry = new PLYLoader().parse(text);

  assert.equal(geometry.getIndex(), null);
  assert.equal(attribute(geometry, "position").count, 6);
  assert.deepEqual(Array.from(attribute(geometry, "uv").array), [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
});

test("property and custom mappings select renamed and extra attributes", () => {
  const text = [
    header([
      "format ascii 1.0",
      "element vertex 2",
      "property float x",
      "property float y",
      "property float z",
      "property uchar diffuse_r",
      "property uchar diffuse_g",
      "property uchar diffuse_b",
      "property float quality",
      "property float confidence",
    ]),
    "0 0 0 255 255 255 0.25 0.75",
    "1 0 0 0 0 0 0.5 1",
    "",
  ].join("\n");

  const loader = new PLYLoader();
  loader.setPropertyNameMapping({ diffuse_r: "red", diffuse_g: "green", diffuse_b: "blue" });
  loader.setCustomPropertyNameMapping({ custom: ["quality", "confidence"] });

  const geometry = loader.parse(text);

  assert.deepEqual(Array.from(attribute(geometry, "color").array), [255, 255, 255, 0, 0, 0]);
  const custom = attribute(geometry, "custom");
  assert.equal(custom.itemSize, 2);
  assert.equal(custom.array instanceof Float32Array, true);
  assert.deepEqual(Array.from(custom.array), [0.25, 0.75, 0.5, 1]);
});

test("unknown elements with list properties are consumed without desynchronising vertices", () => {
  const text = [
    header([
      "format ascii 1.0",
      "element vertex 2",
      "property float x",
      "property float y",
      "property float z",
      "element edge 1",
      "property list uchar int endpoints",
      "element face 1",
      "property list uchar int vertex_indices",
    ]),
    "0 0 0",
    "1 1 1",
    "2 0 1",
    "3 0 1 0",
    "",
  ].join("\n");

  const geometry = new PLYLoader().parse(text);

  assert.deepEqual(Array.from(attribute(geometry, "position").array), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(Array.from(index(geometry).array), [0, 1, 0]);
});

test("a truncated ASCII body keeps the vertices read so far", () => {
  const text = [
    header(["format ascii 1.0", "element vertex 3", "property float x", "property float y", "property float z"]),
    "0 0 0",
    "1 1 1",
    "",
  ].join("\n");

  const geometry = new PLYLoader().parse(text);

  assert.equal(attribute(geometry, "position").count, 2);
});

test("missing end_header yields an empty geometry instead of throwing", () => {
  const geometry = new PLYLoader().parse("ply\nformat ascii 1.0\n");

  assert.equal(attribute(geometry, "position").count, 0);
});
