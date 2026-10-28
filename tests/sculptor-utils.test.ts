import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import {
  falloff,
  getMemory,
  intersectionRayTriangle,
  removeElement,
  replaceElement,
  tidy,
  triangleInsideSphere,
} from "../src/addons/misc/SculptorUtils";

test("sculpt ray intersection handles misses and extreme scales", () => {
  const hit = [0, 0, 0];
  assert.equal(intersectionRayTriangle([0.25, 0.25, 1], [0, 0, -1], [0, 0, 0], [1, 0, 0], [0, 1, 0], hit), 1);
  assert.deepEqual(hit, [0.25, 0.25, 0]);
  assert.equal(intersectionRayTriangle([2, 2, 1], [0, 0, -1], [0, 0, 0], [1, 0, 0], [0, 1, 0]), -1);
  assert.ok(
    Math.abs(
      intersectionRayTriangle(
        [0.25e-150, 0.25e-150, 1e-150],
        [0, 0, -1e-150],
        [0, 0, 0],
        [1e-150, 0, 0],
        [0, 1e-150, 0],
      ) - 1,
    ) < 1e-12,
  );
});

test("sphere overlap includes triangle interiors and degenerate edges", () => {
  assert.equal(triangleInsideSphere([0.25, 0.25, 0.1], 0.02, [0, 0, 0], [1, 0, 0], [0, 1, 0]), true);
  assert.equal(triangleInsideSphere([0.5, 0.1, 0], 0.02, [0, 0, 0], [1, 0, 0], [1, 0, 0]), true);
  assert.equal(triangleInsideSphere([0.5, 0.2, 0], 0.01, [0, 0, 0], [1, 0, 0], [1, 0, 0]), false);
});

test("sculpt scratch memory and index helpers retain their contracts", () => {
  const memory = getMemory(1);
  assert.equal(getMemory(1), memory);
  assert.ok(getMemory(memory.byteLength + 1).byteLength > memory.byteLength);
  const indices = [3, 1, 3, 2];
  tidy(indices);
  assert.deepEqual(indices, [1, 2, 3]);
  replaceElement(indices, 2, 4);
  removeElement(indices, 1);
  assert.deepEqual(indices, [3, 4]);
  assert.equal(falloff(0), 1);
  assert.equal(falloff(1), 0);
});
