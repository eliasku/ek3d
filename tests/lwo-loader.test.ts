import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { IFFParser } from "../src/addons/loaders/lwo/IFFParser";
import { LWOLoader } from "../src/addons/loaders/LWOLoader";
import { Mesh } from "../src/objects/Mesh";

function text(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}
function string(value: string): number[] {
  const bytes = [...text(value), 0];
  if (bytes.length % 2) bytes.push(0);
  return bytes;
}
function u16(...values: number[]): number[] {
  return values.flatMap((value) => [(value >>> 8) & 255, value & 255]);
}
function u32(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}
function floats(...values: number[]): number[] {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setFloat32(i * 4, value));
  return Array.from(bytes);
}
function chunk(id: string, body: number[]): number[] {
  return [...text(id), ...u32(body.length), ...body];
}
function fixture(format: string): ArrayBuffer {
  const body = [
    ...text(format),
    ...chunk("LAYR", [...u16(0, 0), ...floats(0, 0, 0), ...string("Quad")]),
    ...chunk("PNTS", floats(0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0)),
    ...chunk("POLS", [...text("FACE"), ...u16(4, 0, 1, 2, 3)]),
    ...chunk("VMAP", [...text("TXUV"), ...u16(2), ...string("UV"), ...u16(2), ...floats(1, 1)]),
    ...chunk("TAGS", string("Surface")),
    ...chunk("PTAG", [...text("SURF"), ...u16(0, 0)]),
  ];
  return Uint8Array.from([...text("FORM"), ...u32(body.length), ...body]).buffer;
}

test.each(["LWO2", "LWO3"])("%s parses quad indices and sparse UVs", (format) => {
  const tree = new IFFParser().parse(fixture(format));
  assert.ok(tree);
  assert.equal(tree.format, format);
  assert.deepEqual(tree.layers[0].geometry?.polygonDimensions, [4]);
  assert.deepEqual(tree.layers[0].geometry?.materialIndices, [0, 0]);
  assert.deepEqual(tree.layers[0].uvs?.UV, { uvIndices: [2], uvs: [1, 1] });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = new LWOLoader().parse(fixture(format), "", "model");
    const mesh = result.meshes[0];
    assert.ok(mesh instanceof Mesh);
    assert.equal(mesh.name, "Quad");
    assert.deepEqual(Array.from(mesh.geometry.getIndex()!.array), [0, 1, 2, 0, 2, 3]);
    const uv = mesh.geometry.getAttribute("uv");
    const position = mesh.geometry.getAttribute("position");
    assert.ok(uv instanceof BufferAttribute);
    assert.ok(position instanceof BufferAttribute);
    assert.deepEqual(Array.from(uv.array), [0, 0, 0, 0, 1, 1, 0, 0]);
    assert.equal(position.getX(1), -1);
  } finally {
    warn.mockRestore();
  }
});

test("missing and unrecognized top forms are rejected", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    assert.equal(new IFFParser().parse(Uint8Array.from(text("NOPE")).buffer), undefined);
    assert.throws(() => new LWOLoader().parse(fixture("BAD!"), "", "model"), /FORM/);
  } finally {
    warn.mockRestore();
  }
});
