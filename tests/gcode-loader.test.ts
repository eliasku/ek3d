import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GCodeLoader } from "../src/addons/loaders/GCodeLoader";
import type { Group } from "../src/objects/Group";
import { LineSegments } from "../src/objects/LineSegments";
import { BufferAttribute } from "../src/core/BufferAttribute";

function positions(object: Group, index: number): number[] {
  const child = object.children[index];
  assert.ok(child instanceof LineSegments);
  const attribute = child.geometry.getAttribute("position");
  assert.ok(attribute instanceof BufferAttribute);
  return Array.from(attribute.array);
}

function dispose(object: Group): void {
  object.traverse((child) => {
    if (!(child instanceof LineSegments)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
  });
}

test("GCode separates travel from extrusion and splits layers at extruding Z changes", () => {
  const loader = new GCodeLoader();
  loader.splitLayer = true;
  const object = loader.parse("; comment\r\nG0 X1 Y2\nG1 X3 E1\nG0 X4\nG1 Z1 E2\nG2 X99\nG3 Y99");
  assert.equal(object.children.length, 4);
  assert.deepEqual(positions(object, 1), [0, 0, 0, 1, 2, 0, 3, 2, 0, 4, 2, 0]);
  assert.deepEqual(positions(object, 0), [1, 2, 0, 3, 2, 0]);
  assert.deepEqual(positions(object, 2), [4, 2, 0, 4, 2, 1]);
  assert.equal(object.rotation.x, -Math.PI / 2);
  dispose(object);
});

test("GCode M82/M83 override extrusion mode and G90/G91 clear the override", () => {
  const object = new GCodeLoader().parse(
    "G90\nM83\nG1 X1 E1\nG1 X2 E1\nG91\nM82\nG1 X1 E3\nG1 X1 E2\nG90\nG1 X9 E4\nG92 X0 E0\nG1 X2 E1",
  );
  assert.deepEqual(
    positions(object, 0),
    [0, 0, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0, 0, 9, 0, 0, 0, 0, 0, 2, 0, 0],
  );
  assert.deepEqual(positions(object, 1), [3, 0, 0, 4, 0, 0]);
  dispose(object);
  const relative = new GCodeLoader().parse("G90\nM82\nG1 E5\nG91\nG1 X2 E1\nG90\nG1 X3 E7");
  assert.deepEqual(positions(relative, 0), [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 3, 0, 0]);
  dispose(relative);
});
