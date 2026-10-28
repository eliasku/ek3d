import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildData3DTexture, VOXLoader } from "../src/addons/loaders/VOXLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { MeshStandardMaterial } from "../src/materials/MeshStandardMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Data3DTexture } from "../src/textures/Data3DTexture";

function u32(...values: number[]): number[] {
  return values.flatMap((value) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return Array.from(bytes);
  });
}

function bytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function chunk(id: string, body: number[]): number[] {
  return [...bytes(id), ...u32(body.length), ...u32(0), ...body];
}

function main(chunks: number[][], version = 150): ArrayBuffer {
  // Like real files, MAIN carries no payload of its own; its child-chunk byte count is the second field.
  const body = chunks.flat();
  return Uint8Array.from([...bytes("VOX "), ...u32(version), ...bytes("MAIN"), ...u32(0), ...u32(body.length), ...body])
    .buffer as ArrayBuffer;
}

function dictionary(entries: Record<string, string>): number[] {
  const keys = Object.keys(entries);
  const out: number[] = u32(keys.length);
  for (const key of keys) {
    for (const value of [key, entries[key]]) out.push(...u32(value.length), ...bytes(value));
  }
  return out;
}

function rgba(index: number): number {
  return index === 0 ? 0x000000ff : 0xff0000ff;
}

test("SIZE/XYZI voxels become one greedy-meshed mesh with palette colors", () => {
  const result = new VOXLoader().parse(
    main([
      chunk("SIZE", u32(2, 2, 2)),
      chunk("XYZI", [...u32(1), 0, 0, 0, 1]),
      chunk("nTRN", [
        ...u32(0),
        ...dictionary({}),
        ...u32(1),
        ...u32(0xffffffff),
        ...u32(0),
        ...u32(1),
        ...dictionary({}),
      ]),
      chunk("nSHP", [...u32(1), ...dictionary({}), ...u32(1), ...u32(0), ...dictionary({})]),
      chunk("RGBA", Array.from({ length: 256 }, (_, index) => u32(rgba(index))).flat()),
    ]),
  );

  assert.ok(result !== undefined);
  assert.equal(result.chunks.length, 1);
  const scene = result.scene;
  assert.ok(scene instanceof Mesh, "a transform with a single-model shape is flattened into a mesh");
  assert.ok(scene.material instanceof MeshStandardMaterial);
  assert.equal(scene.material.vertexColors, true);

  const position = scene.geometry.getAttribute("position");
  assert.ok(position instanceof BufferAttribute);
  assert.equal(position.count, 24);
  assert.equal(scene.geometry.getIndex()?.count, 36);

  const color = scene.geometry.getAttribute("color");
  assert.ok(color instanceof BufferAttribute);
  assert.equal(color.count, 24);
  assert.deepEqual(Array.from(color.array.slice(0, 3)), [1, 0, 0]);
});

test("transform nodes translate in VOX Z-up coordinates and name the object", () => {
  const result = new VOXLoader().parse(
    main([
      chunk("SIZE", u32(1, 1, 1)),
      chunk("XYZI", [...u32(1), 0, 0, 0, 1]),
      chunk("nTRN", [
        ...u32(0),
        ...dictionary({ _name: "root" }),
        ...u32(1),
        ...u32(0xffffffff),
        ...u32(0),
        ...u32(1),
        ...dictionary({ _t: "1 2 3" }),
      ]),
      chunk("nSHP", [...u32(1), ...dictionary({}), ...u32(1), ...u32(0), ...dictionary({})]),
    ]),
  );

  assert.ok(result !== undefined);
  const node = result.scene;
  assert.ok(node instanceof Mesh, "a single-model shape is flattened into a mesh");
  assert.equal(node.name, "root");
  assert.deepEqual([node.position.x, node.position.y, node.position.z], [1, 3, -2]);
});

test("group nodes collect multiple shapes and unsupported versions are rejected", () => {
  const result = new VOXLoader().parse(
    main([
      chunk("SIZE", u32(1, 1, 1)),
      chunk("XYZI", [...u32(1), 0, 0, 0, 1]),
      chunk("SIZE", u32(1, 1, 1)),
      chunk("XYZI", [...u32(1), 1, 1, 1, 1]),
      chunk("nGRP", [...u32(0), ...dictionary({}), ...u32(2), ...u32(1), ...u32(2)]),
      chunk("nSHP", [...u32(1), ...dictionary({}), ...u32(1), ...u32(0), ...dictionary({})]),
      chunk("nSHP", [...u32(2), ...dictionary({}), ...u32(1), ...u32(1), ...dictionary({})]),
    ]),
  );

  assert.ok(result !== undefined);
  assert.equal(result.chunks.length, 2);
  assert.equal(result.scene?.children.length, 2);

  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(new VOXLoader().parse(main([], 99)), undefined);
  } finally {
    console.error = originalError;
  }
  assert.equal(errors.length, 1);
  assert.match(String(errors[0][0]), /Unsupported version/);
});

test("buildData3DTexture marks occupied voxels in a single-channel volume", () => {
  const result = new VOXLoader().parse(
    main([chunk("SIZE", u32(2, 1, 1)), chunk("XYZI", [...u32(2), 0, 0, 0, 1, 1, 0, 0, 2])]),
  );

  assert.ok(result !== undefined);
  const texture = buildData3DTexture(result.chunks[0]);
  assert.equal(texture instanceof Data3DTexture, true);
  assert.deepEqual([texture.image.width, texture.image.height, texture.image.depth], [2, 1, 1]);
  assert.deepEqual(Array.from(texture.image.data as Uint8Array), [255, 255]);
});
