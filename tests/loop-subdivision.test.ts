import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { LoopSubdivision } from "../src/addons/modifiers/LoopSubdivision";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { PlaneGeometry } from "../src/geometries/PlaneGeometry";

function triangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 2, 0, 0, 0, 2, 0], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  geometry.morphAttributes.position = [new Float32BufferAttribute([0, 0, 1, 2, 0, 1, 0, 2, 1], 3)];
  geometry.morphTargetsRelative = true;
  geometry.addGroup(0, 3, 2);
  return geometry;
}

test("flat subdivision creates four triangles, interpolates attributes and preserves groups and morphs", () => {
  const input = triangle();
  const output = LoopSubdivision.modify(input, 1, { split: false, flatOnly: true });
  assert.notEqual(output, input);
  assert.equal(output.index, null);
  assert.deepEqual(
    Array.from((output.getAttribute("position") as Float32BufferAttribute).array),
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 1, 1, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
  );
  assert.equal(output.getAttribute("uv")?.count, 12);
  assert.equal(output.morphAttributes.position[0].count, 12);
  assert.equal(output.morphTargetsRelative, true);
  assert.deepEqual(output.groups, [{ start: 0, count: 12, materialIndex: 2 }]);
  assert.equal(input.getAttribute("position")?.count, 3);
});

test("coplanar presplit and triangle limit control subdivision", () => {
  const plane = new PlaneGeometry();
  const split = LoopSubdivision.modify(plane, 0, { split: true });
  assert.equal(split.getAttribute("position")?.count, 12);
  const limited = LoopSubdivision.modify(plane, 3, { split: false, maxTriangles: 1 });
  assert.equal(limited.getAttribute("position")?.count, plane.getAttribute("position")?.count);
});

test("preserving open edges keeps original triangle corners during smoothing", () => {
  const input = triangle();
  const output = LoopSubdivision.modify(input, 1, { split: false, preserveEdges: true });
  const positions = output.getAttribute("position") as Float32BufferAttribute;
  assert.deepEqual([positions.getX(0), positions.getY(0), positions.getZ(0)], [0, 0, 0]);
  assert.deepEqual([positions.getX(3), positions.getY(3), positions.getZ(3)], [2, 0, 0]);
  assert.equal(positions.count, 12);
});
