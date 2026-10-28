import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { PromiseGroup } from "../src/addons/loaders/GLTFProgressivePromises";

test("promise groups capture once per object and wait for frames and work", async () => {
  const group = new PromiseGroup(0, { frames: 2 });
  let resolve!: () => void;
  const promise = new Promise<void>((callback) => {
    resolve = callback;
  });
  const object = {};
  group.add(object, promise);
  group.add(object, promise);
  group.update(3);
  resolve();
  await promise;
  group.update(4);
  assert.deepEqual(await group.ready, { cancelled: false, awaited_count: 1, resolved_count: 1 });
});

test("promise groups wait for first capture and support abort", async () => {
  const controller = new AbortController();
  const group = new PromiseGroup(0, { waitForFirstCapture: true, signal: controller.signal });
  group.update(20);
  controller.abort();
  assert.deepEqual(await group.ready, { cancelled: true, awaited_count: 0, resolved_count: 0 });
});
