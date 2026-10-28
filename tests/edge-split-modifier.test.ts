import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { EdgeSplitModifier } from "../src/addons/modifiers/EdgeSplitModifier";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";

test("edge splitting duplicates shared vertices only across sharp faces", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  geometry.setIndex([0, 1, 2, 1, 0, 3]);
  geometry.computeVertexNormals();
  const modifier = new EdgeSplitModifier();
  const sharp = modifier.modify(geometry, Math.PI / 4, false);
  const smooth = modifier.modify(geometry, Math.PI, false);
  assert.notEqual(sharp.index!.array[0], sharp.index!.array[4]);
  assert.notEqual(sharp.index!.array[1], sharp.index!.array[3]);
  assert.equal(smooth.index!.array[0], smooth.index!.array[4]);
  assert.equal(smooth.index!.array[1], smooth.index!.array[3]);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 1, 2, 1, 0, 3]);
});
