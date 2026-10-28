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
  assert.deepEqual(grid.getProbePosition(2, 1, 1, new Vector3()).toArray(), [3, 3, 6]);
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
