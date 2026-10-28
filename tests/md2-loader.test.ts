import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MD2Loader } from "../src/addons/loaders/MD2Loader";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";

function fixture(): ArrayBuffer {
  const frameSize = 52;
  const frameOffset = 92;
  const end = frameOffset + 2 * frameSize;
  const buffer = new ArrayBuffer(end);
  const view = new DataView(buffer);
  const header = [844121161, 8, 64, 64, frameSize, 0, 3, 3, 1, 0, 2, 68, 68, 80, frameOffset, end, end];
  header.forEach((value, i) => view.setInt32(i * 4, value, true));
  view.setInt16(72, 64, true);
  view.setInt16(78, 64, true);
  for (let i = 0; i < 3; i++) {
    view.setUint16(80 + i * 2, i, true);
    view.setUint16(86 + i * 2, i, true);
  }
  for (let frame = 0; frame < 2; frame++) {
    const offset = frameOffset + frame * frameSize;
    for (let i = 0; i < 3; i++) view.setFloat32(offset + i * 4, 1, true);
    const name = `run0${frame + 1}`;
    for (let i = 0; i < name.length; i++) view.setUint8(offset + 24 + i, name.charCodeAt(i));
    for (let i = 0; i < 3; i++) {
      view.setUint8(offset + 40 + i * 4, i + frame);
      view.setUint8(offset + 41 + i * 4, 2);
      view.setUint8(offset + 42 + i * 4, 3);
      view.setUint8(offset + 43 + i * 4, 5);
    }
  }
  return buffer;
}

test("MD2 expands triangle vertices, converts coordinates and animates morph targets", () => {
  const geometry = new MD2Loader().parse(fixture());
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  assert.ok(position instanceof BufferAttribute);
  assert.ok(uv instanceof BufferAttribute);
  assert.deepEqual(Array.from(position.array), [0, 3, 2, 1, 3, 2, 2, 3, 2]);
  assert.deepEqual(Array.from(uv.array), [0, 1, 1, 1, 0, 0]);
  assert.equal(geometry.animations[0].name, "run");
  assert.equal(geometry.morphAttributes.position[1].name, "run02");
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  const mixer = new AnimationMixer(mesh);
  mixer.clipAction(geometry.animations[0]).play();
  mixer.update(0.05);
  assert.ok(Math.abs((mesh.morphTargetInfluences?.[0] ?? 0) - 0.5) < 1e-6);
  assert.ok(Math.abs((mesh.morphTargetInfluences?.[1] ?? 0) - 0.5) < 1e-6);
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  geometry.dispose();
  material.dispose();
});

test("MD2 rejects corrupt headers and triangle indices", () => {
  const loader = new MD2Loader();
  assert.throws(() => loader.parse(new ArrayBuffer(12)), /header/);
  const data = fixture();
  new DataView(data).setUint16(80, 3, true);
  assert.throws(() => loader.parse(data), /triangle index/);
});
