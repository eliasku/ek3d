import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MDDLoader } from "../src/addons/loaders/MDDLoader";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";

/** Builds MDD data: frames times followed by a position per vertex per frame. */
function mdd(times: number[], frames: number[][][]): ArrayBuffer {
  const points = frames[0].length;
  const buffer = new ArrayBuffer(8 + times.length * 4 + frames.length * points * 3 * 4);
  const view = new DataView(buffer);
  view.setUint32(0, times.length);
  view.setUint32(4, points);
  let offset = 8;
  for (const time of times) {
    view.setFloat32(offset, time);
    offset += 4;
  }
  for (const frame of frames) {
    for (const point of frame) {
      for (const value of point) {
        view.setFloat32(offset, value);
        offset += 4;
      }
    }
  }
  return buffer;
}

test("MDD splits frames into morph targets and a discrete influence track", () => {
  const data = mdd(
    [0, 0.5],
    [
      [
        [0, 1, 2],
        [3, 4, 5],
      ],
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
    ],
  );
  const { morphTargets, clip } = new MDDLoader().parse(data);

  assert.equal(morphTargets.length, 2);
  assert.deepEqual(Array.from(morphTargets[0].array), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(morphTargets[1].array), [1, 2, 3, 4, 5, 6]);
  assert.equal(morphTargets[1].itemSize, 3);
  assert.equal(morphTargets[1].name, "morph_1");

  assert.equal(clip.duration, 0.5);
  assert.equal(clip.tracks.length, 1);
  const track = clip.tracks[0];
  assert.equal(track.name, ".morphTargetInfluences");
  assert.deepEqual(Array.from(track.times), [0, 0.5]);
  assert.deepEqual(Array.from(track.values as Float32Array), [1, 0, 0, 1]);
});

test("MDD influence track selects one morph target at a time on a mesh", () => {
  const data = mdd(
    [0, 0.5],
    [
      [
        [0, 0, 0],
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
      ],
      [
        [10, 0, 0],
        [11, 1, 1],
        [12, 2, 2],
        [13, 3, 3],
      ],
    ],
  );
  const { morphTargets, clip } = new MDDLoader().parse(data);
  const geometry = new BoxGeometry();
  geometry.morphAttributes.position = morphTargets;
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  assert.equal(mesh.morphTargetInfluences?.length, 2);
  const mixer = new AnimationMixer(mesh);
  mixer.clipAction(clip).play();
  mixer.update(0.25);
  assert.equal(mesh.morphTargetInfluences?.[0], 0.5);
  assert.equal(mesh.morphTargetInfluences?.[1], 0.5);
  mixer.stopAllAction();
  mixer.uncacheRoot(mesh);
  geometry.dispose();
  material.dispose();
});
