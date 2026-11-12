import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { WebGLAnimation } from "../src/renderers/webgl/WebGLAnimation";
import { WebGLProperties } from "../src/renderers/webgl/WebGLProperties";
import { WebGLRenderLists } from "../src/renderers/webgl/WebGLRenderLists";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";

test("detached animation methods preserve scheduling, cancellation and thrown callbacks", () => {
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const context = {
    requestAnimationFrame(callback: FrameRequestCallback): number {
      pending.set(++nextId, callback);
      return nextId;
    },
    cancelAnimationFrame(id: number): void {
      pending.delete(id);
    },
  };
  const animation = new WebGLAnimation();
  const { start, stop, setContext, setAnimationLoop } = animation;
  const frames: number[] = [];
  const fire = (time: number) => {
    const [id, callback] = pending.entries().next().value!;
    pending.delete(id);
    callback(time);
  };
  setContext(context);
  start();
  assert.equal(pending.size, 0);
  setAnimationLoop((time: number) => {
    frames.push(time);
    if (frames.length === 2) stop();
  });
  start();
  start();
  assert.equal(pending.size, 1);
  fire(10);
  assert.equal(pending.size, 1);
  fire(20);
  assert.deepEqual(frames, [10, 20]);
  assert.equal(pending.size, 0);
  const error = new Error("animation failure");
  setAnimationLoop(() => {
    throw error;
  });
  start();
  assert.throws(
    () => fire(30),
    (actual) => actual === error,
  );
  assert.equal(pending.size, 1);
  stop();
  assert.equal(pending.size, 0);
});

test("detached property methods retain per-instance caches and reset without mutating old maps", () => {
  const properties = new WebGLProperties();
  const { get, has, update, remove, dispose } = properties;
  const object = {};
  const map = get(object);
  assert.equal(get(object), map);
  update(object, "value", 7);
  assert.equal(get(object).value, 7);
  assert.notEqual(new WebGLProperties().get(object), map);
  dispose();
  assert.equal(has(object), false);
  assert.notEqual(get(object), map);
  assert.equal(map.value, 7);
  remove(object);
  assert.equal(has(object), false);
});

test("detached render-list methods keep nested lists separate and release scene caches", () => {
  const lists = new WebGLRenderLists();
  const { get, dispose } = lists;
  const scene = {};
  const list = get(scene, 0);
  const nested = get(scene, 1);
  const { init, push, finish } = list;
  const geometry = new BufferGeometry();
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  try {
    init();
    push(mesh, geometry, material, 0, 1, null, new PerspectiveCamera());
    finish();
    assert.equal(list.opaque[0].object, mesh);
    assert.equal(nested.opaque.length, 0);
    assert.equal(get(scene, 0), list);
    init();
    finish();
    assert.equal(list.opaque.length, 0);
    dispose();
    assert.notEqual(get(scene, 0), list);
  } finally {
    geometry.dispose();
    material.dispose();
  }
});
