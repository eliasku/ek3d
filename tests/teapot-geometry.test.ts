import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { TeapotGeometry } from "../src/addons/geometries/TeapotGeometry";
import { BufferAttribute } from "../src/core/BufferAttribute";

function near(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-4, `${actual} != ${expected}`);
}

test("teapot tessellation produces finite vertices, normals, UVs and nondegenerate triangles", () => {
  const geometry = new TeapotGeometry(50, 3);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  assert.ok(position instanceof BufferAttribute);
  assert.ok(normal instanceof BufferAttribute);
  assert.ok(uv instanceof BufferAttribute);
  assert.ok(index);
  assert.equal(position.count, 32 * 16);
  assert.equal(normal.count, position.count);
  assert.equal(uv.count, position.count);
  assert.equal(index.count, (32 * 2 * 3 * 3 - 8 * 3) * 3);
  for (let i = 0; i < position.count; i++) {
    for (const value of [
      position.getX(i),
      position.getY(i),
      position.getZ(i),
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i),
      uv.getX(i),
      uv.getY(i),
    ])
      assert.ok(Number.isFinite(value));
    near(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)), 1);
  }
  for (let i = 0; i < index.count; i += 3) {
    const vertices: number[] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    assert.ok(vertices.every((v) => v < position.count));
    assert.equal(new Set(vertices.map((v) => `${position.getX(v)},${position.getY(v)},${position.getZ(v)}`)).size, 3);
  }
  geometry.dispose();
});

test("teapot patch selection, minimum tessellation and lid fitting are deterministic", () => {
  const parts = [
    [true, false, false, 4, 24],
    [false, true, false, 8, 56],
    [false, false, true, 20, 160],
    [false, false, false, 0, 0],
  ] as const;
  for (const [bottom, lid, body, patches, triangles] of parts) {
    const geometry = new TeapotGeometry(50, 1, bottom, lid, body);
    assert.equal(geometry.getAttribute("position")?.count, patches * 9);
    assert.equal(geometry.getIndex()?.count, triangles * 3);
    geometry.dispose();
  }
  const loose = new TeapotGeometry(50, 2, false, true, false, false);
  const snug = new TeapotGeometry(50, 2, false, true, false, true);
  const original = new TeapotGeometry(50, 2, false, true, false, false, false);
  const a = loose.getAttribute("position");
  const b = snug.getAttribute("position");
  const c = original.getAttribute("position");
  assert.ok(a instanceof BufferAttribute);
  assert.ok(b instanceof BufferAttribute);
  assert.ok(c instanceof BufferAttribute);
  let changedHeight = false;
  for (let i = 0; i < a.count; i++) {
    near(b.getX(i), a.getX(i) * 1.077);
    near(b.getZ(i), a.getZ(i) * 1.077);
    near(b.getY(i), a.getY(i));
    if (Math.abs(c.getY(i) - a.getY(i)) > 1e-4) changedHeight = true;
  }
  // Original scaling changes width after normalizing to the same height.
  assert.ok(Math.abs(c.getX(3)) < Math.abs(a.getX(3)));
  assert.equal(changedHeight, false);
  loose.dispose();
  snug.dispose();
  original.dispose();
});
