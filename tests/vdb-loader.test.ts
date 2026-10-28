import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { VDBLoader } from "../src/addons/loaders/VDBLoader";
import { Data3DTexture } from "../src/textures/Data3DTexture";

function number(size: number, write: (view: DataView) => void): number[] {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return Array.from(bytes);
}
const u32 = (value: number): number[] => number(4, (view) => view.setUint32(0, value, true));
const i64 = (value: number): number[] => number(8, (view) => view.setBigInt64(0, BigInt(value), true));
const f32 = (value: number): number[] => number(4, (view) => view.setFloat32(0, value, true));
const f64 = (value: number): number[] => number(8, (view) => view.setFloat64(0, value, true));
function string(value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  return [...u32(bytes.length), ...bytes];
}
function metadata(name: string, type: string, value: number[]): number[] {
  return [...string(name), ...string(type), ...u32(value.length), ...value];
}
function mask(size: number, first = 0): number[] {
  const bytes = Array.from({ length: size }, () => 0);
  bytes[0] = first;
  return bytes;
}
function grid(zip = false, transform = "TranslationMap"): number[] {
  return [
    ...u32(zip ? 3 : 0),
    ...u32(2),
    ...metadata("class", "string", Array.from(new TextEncoder().encode("fog volume"))),
    ...metadata("count", "int32", u32(7)),
    ...string(transform),
    ...f64(1),
    ...f64(2),
    ...f64(3),
    ...u32(1),
    ...f32(0.25),
    ...u32(0),
    ...u32(zip ? 1 : 0),
    ...(zip
      ? [
          ...u32(4),
          ...u32(5),
          ...u32(6),
          ...mask(4096, 1),
          ...mask(4096),
          0,
          ...i64(0),
          ...mask(512, 1),
          ...mask(512),
          0,
          ...i64(0),
          ...mask(64, 1),
          ...mask(64, 1),
          0,
          ...i64(3),
          9,
          8,
          7,
        ]
      : []),
  ];
}
type Descriptor = { name: string; type: string; body: number[]; parent?: string };
function fixture(grids: Descriptor[], version = 222, offsets = 1): ArrayBuffer {
  const bytes = [
    ...i64(0x56444220),
    ...u32(version),
    ...u32(12),
    ...u32(0),
    offsets,
    ...Array.from({ length: 36 }, () => 0),
    ...u32(0),
    ...u32(grids.length),
  ];
  for (const entry of grids) {
    const header = [...string(entry.name), ...string(entry.type), ...string(entry.parent ?? "")];
    const gridPos = bytes.length + header.length + 24;
    const endPos = gridPos + entry.body.length;
    bytes.push(...header, ...i64(gridPos), ...i64(gridPos), ...i64(endPos), ...entry.body);
  }
  return Uint8Array.from(bytes).buffer;
}
const scalar = "Tree_float_5_4_3";

test("rejects invalid headers and unsupported transforms", () => {
  const loader = new VDBLoader();
  assert.throws(() => loader.parse(new ArrayBuffer(8)), /Not a VDB file/);
  assert.throws(() => loader.parse(fixture([], 221)), /Unsupported file version 221/);
  assert.throws(() => loader.parse(fixture([], 222, 0)), /without grid offsets/);
  assert.throws(
    () => loader.parse(fixture([{ name: "density", type: scalar, body: grid(false, "UnknownMap") }])),
    /Unsupported transform UnknownMap/,
  );
});

test("filters grid descriptors and preserves empty-grid metadata and transform", () => {
  const data = fixture([
    { name: "density\x1eunique", type: scalar, body: grid() },
    { name: "invalid", type: scalar, body: [] },
    { name: "unsupported", type: "Tree_int32_5_4_3", body: [] },
    { name: "instance", type: scalar, parent: "density", body: [] },
  ]);
  const loader = new VDBLoader();
  assert.equal(loader.setGridNames(["density"]), loader);
  const grids = loader.parse(data);
  assert.equal(grids.length, 1);
  const result = grids[0];
  assert.equal(result.name, "density");
  assert.equal(result.type, "float");
  assert.deepEqual(result.metadata, { class: "fog volume", count: 7 });
  assert.equal(result.background, 0.25);
  assert.deepEqual(result.transform.elements.slice(12, 15), [1, 2, 3]);
  assert.equal(result.bbox.isEmpty(), true);
  assert.equal(result.texture, null);
  assert.deepEqual(loader.setGridNames([]).parse(data), []);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const skipped = fixture([
      { name: "unsupported", type: "Tree_int32_5_4_3", body: [] },
      { name: "instance", type: scalar, parent: "density", body: [] },
    ]);
    assert.deepEqual(loader.setGridNames(null).parse(skipped), []);
    assert.equal(warn.mock.calls.length, 2);
  } finally {
    warn.mockRestore();
  }
});

test("uses the injected zlib decoder for active leaf values and checks its output size", () => {
  const data = fixture([{ name: "density", type: scalar, body: grid(true) }]);
  const chunks: number[][] = [];
  const loader = new VDBLoader(undefined, {
    unzlibSync(bytes) {
      chunks.push(Array.from(bytes));
      return Uint8Array.from(f32(2.5));
    },
  });
  const [result] = loader.parse(data);
  assert.deepEqual(chunks, [[9, 8, 7]]);
  assert.deepEqual(result.bbox.min.toArray(), [4, 5, 6]);
  assert.deepEqual(result.bbox.max.toArray(), [4, 5, 6]);
  assert.ok(result.texture instanceof Data3DTexture);
  assert.deepEqual([result.texture.image.width, result.texture.image.height, result.texture.image.depth], [1, 1, 1]);
  assert.ok(result.texture.image.data);
  assert.deepEqual(Array.from(result.texture.image.data), [2.5]);
  assert.throws(
    () => new VDBLoader(undefined, { unzlibSync: () => new Uint8Array(0) }).parse(data),
    /Unexpected data size/,
  );
});
