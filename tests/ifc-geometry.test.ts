import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { ifcGeometryToBuffer } from "../examples/ifc-geometry";
import { ColorSpace } from "../src/constants";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { Color } from "../src/math/Color";

test("IFC geometry preserves normals, linear RGBA and indices after WASM memory is released", () => {
  const vertices = new Float32Array([1, 2, 3, 0, 1, 0, 4, 5, 6, 1, 0, 0, 7, 8, 9, 0, 0, 1]);
  const indices = new Uint32Array([0, 2, 1]);
  const geometry = ifcGeometryToBuffer({ x: 0.5, y: 0.25, z: 1, w: 0.4 }, vertices, indices);
  vertices.fill(0);
  indices.fill(0);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  assert.ok(positions instanceof BufferAttribute);
  assert.ok(normals instanceof BufferAttribute);
  assert.deepEqual(Array.from(positions.array), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(Array.from(normals.array), [0, 1, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 2, 1]);
  const color = new Color().setRGB(0.5, 0.25, 1, ColorSpace.SRGB);
  const rgba = geometry.getAttribute("color");
  assert.ok(rgba instanceof BufferAttribute);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(rgba.getX(i) - color.r) < 1e-7);
    assert.ok(Math.abs(rgba.getY(i) - color.g) < 1e-7);
    assert.equal(rgba.getZ(i), 1);
    assert.ok(Math.abs(rgba.getW(i) - 0.4) < 1e-7);
  }
});

test("IFC geometry rejects truncated interleaved data", () => {
  assert.throws(
    () => ifcGeometryToBuffer({ x: 1, y: 1, z: 1, w: 1 }, new Float32Array(5), new Uint32Array()),
    /position\/normal/,
  );
});
