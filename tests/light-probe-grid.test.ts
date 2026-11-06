import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { LightProbeGridHelperWebGL } from "../src/addons/helpers/LightProbeGridHelperWebGL";
import { LightProbeGridWebGL } from "../src/addons/lighting/LightProbeGridWebGL";
import { Vector3 } from "../src/math/Vector3";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import { Scene } from "../src/scenes/Scene";

test("grid positions, bounds and helper update follow the active grid", () => {
  const grid = new LightProbeGridWebGL(4, 2, 6, 3, 2, 2);
  grid.position.set(1, 2, 3);
  grid.updateBoundingBox();
  assert.deepEqual(grid.boundingBox.min.toArray(), [-1, 1, 0]);
  assert.deepEqual(grid.getProbePosition(2, 1, 1, new Vector3()).toArray(), [-1 + 10 / 3, 2.5, 4.5]);
  const helper = new LightProbeGridHelperWebGL(grid);
  assert.equal(helper.count, 12);
  const next = new LightProbeGridWebGL(1, 1, 1, 2, 2, 2);
  helper.probes = next;
  helper.update();
  assert.equal(helper.count, 8);
  assert.equal(helper.instanceMatrix.count, 8);
  const uvw = helper.geometry.getAttribute("instanceUVW");
  assert.ok(uvw);
  assert.equal(uvw.count, 8);
  helper.dispose();
  grid.dispose();
  next.dispose();
});

test("probe positions are centered in cells, including single-probe axes", () => {
  const grid = new LightProbeGridWebGL(4, 2, 6, 2, 1, 3);
  grid.position.set(1, 2, 3);
  grid.updateBoundingBox();
  const position = new Vector3();
  assert.deepEqual(grid.getProbePosition(0, 0, 0, position).toArray(), [0, 2, 1]);
  assert.deepEqual(grid.getProbePosition(1, 0, 2, position).toArray(), [2, 2, 5]);
  assert.ok(grid.boundingBox.containsPoint(position));
  const small = new LightProbeGridWebGL(0.1, 0.2, 0.3);
  assert.deepEqual(small.getProbePosition(0, 0, 0, position).toArray(), [0, 0, 0]);
  grid.dispose();
  small.dispose();
});

test("bake rejects invalid ranges and indirect pass ordering before touching renderer", () => {
  const grid = new LightProbeGridWebGL(1, 1, 1, 2, 2, 2);
  const renderer = {} as WebGLRenderer;
  const scene = new Scene();
  assert.throws(() => grid.bake(renderer, scene, { start: 8, count: 1 }), RangeError);
  assert.throws(() => grid.bake(renderer, scene, { bounces: 1, count: 1 }), RangeError);
  assert.throws(() => grid.bake(renderer, scene, { pass: 1, start: 1, count: 1 }), /probe 0/);
  assert.doesNotThrow(() => grid.bake(renderer, scene, { count: 0 }));
  grid.dispose();
});
