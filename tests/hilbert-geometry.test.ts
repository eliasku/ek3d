import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { gosper, hilbert2D, hilbert3D } from "../src/addons/utils/GeometryUtils";
import { Vector3 } from "../src/math/Vector3";

test("Hilbert subdivisions visit all corners in a continuous curve", () => {
  const base = hilbert3D(new Vector3(), 8, 0);
  assert.equal(base.length, 8);
  assert.deepEqual(base[0].toArray(), [-4, 4, -4]);
  const points = hilbert3D(new Vector3(), 8, 1);
  assert.equal(points.length, 64);
  assert.equal(new Set(points.map((p) => p.toArray().join(","))).size, 64);
  for (let i = 1; i < points.length; i++) assert.equal(points[i].distanceTo(points[i - 1]), 4);
});

test("2D Hilbert subdivisions preserve the center plane and continuous spacing", () => {
  const points = hilbert2D(new Vector3(3, 7, -2), 8, 1);
  assert.equal(points.length, 16);
  assert.equal(new Set(points.map((point) => point.toArray().join(","))).size, 16);
  for (const point of points) assert.equal(point.y, 7);
  for (let i = 1; i < points.length; i++) assert.equal(points[i].distanceTo(points[i - 1]), 4);
});

test("Gosper curve keeps unit-length steps in its plane and scales about the origin", () => {
  const points = gosper();
  const scaled = gosper(3);
  for (let i = 0; i < points.length; i += 3) {
    assert.equal(points[i + 2], 0);
    assert.equal(scaled[i + 2], 0);
    assert.ok(Math.abs(scaled[i] - points[i] * 3) < 1e-9);
    assert.ok(Math.abs(scaled[i + 1] - points[i + 1] * 3) < 1e-9);
    if (i > 0) assert.ok(Math.abs(Math.hypot(points[i] - points[i - 3], points[i + 1] - points[i - 2]) - 1) < 1e-12);
  }
});
