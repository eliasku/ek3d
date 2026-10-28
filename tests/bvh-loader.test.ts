import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { AnimationMixer } from "../src/animation/AnimationMixer";
import { BVHLoader } from "../src/addons/loaders/BVHLoader";
import { QuaternionKeyframeTrack } from "../src/animation/tracks/QuaternionKeyframeTrack";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import type { Bone } from "../src/objects/Bone";

const BVH = [
  "HIERARCHY",
  "ROOT hip",
  "{",
  "  OFFSET 0 0 0",
  "  CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation",
  "  JOINT knee",
  "  {",
  "    OFFSET 0 5 0",
  "    CHANNELS 3 Zrotation Xrotation Yrotation",
  "    End Site",
  "    {",
  "      OFFSET 0 1 0",
  "    }",
  "  }",
  "}",
  "MOTION",
  "Frames: 2",
  "Frame Time: 0.5",
  "0 0 0 0 0 0 0 0 0",
  "1 2 3 180 0 0 0 90 0",
].join("\n");

test("BVH builds the bone hierarchy with offsets and skips end sites in tracks", () => {
  const { skeleton, clip } = new BVHLoader().parse(BVH);

  assert.equal(skeleton.bones.length, 3);
  const [hip, knee, endSite] = skeleton.bones as [Bone, Bone, Bone];
  assert.equal(hip.name, "hip");
  assert.equal(knee.parent, hip);
  assert.equal(endSite.name, "ENDSITE");
  assert.deepEqual(knee.position.toArray(), [0, 5, 0]);
  assert.deepEqual(endSite.position.toArray(), [0, 1, 0]);

  assert.equal(clip.tracks.length, 4);
  const position = clip.tracks[0];
  const quaternion = clip.tracks[1];
  assert.ok(position instanceof VectorKeyframeTrack);
  assert.ok(quaternion instanceof QuaternionKeyframeTrack);
  assert.equal(position.name, "hip.position");
  assert.equal(quaternion.name, "hip.quaternion");
  assert.deepEqual(Array.from(position.times), [0, 0.5]);
  // Joint offsets are added because the animation system animates the position property.
  assert.deepEqual(Array.from(position.values), [0, 0, 0, 1, 2, 3]);
  assert.equal(clip.tracks[2].name, "knee.position");
  assert.deepEqual(Array.from(clip.tracks[2].values as Float32Array), [0, 5, 0, 0, 5, 0]);
  // Rotations are applied in the order the CHANNELS line declares: Z 180°, then Y 0°, then X 0°.
  const last = Array.from(quaternion.values as Float32Array).slice(4);
  const expected = [0, 0, 1, 0];
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(last[i] - expected[i]) < 1e-6);
  assert.equal(clip.duration, 0.5);
});

test("BVH clips drive bone transforms and honor the animate flags", () => {
  const loader = new BVHLoader();
  const { skeleton, clip } = loader.parse(BVH);
  const hip = skeleton.bones[0];
  const mixer = new AnimationMixer(hip);
  mixer.clipAction(clip).play();
  // Halfway between the two keyframes the position is interpolated and the rotation is slerped.
  mixer.update(0.25);
  assert.deepEqual(
    hip.position.toArray().map((value) => Math.round(value * 1e6) / 1e6),
    [0.5, 1, 1.5],
  );
  assert.ok(Math.abs(hip.quaternion.z - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(hip.quaternion.w - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(hip.quaternion.x) < 1e-6);
  assert.ok(Math.abs(hip.quaternion.y) < 1e-6);
  mixer.stopAllAction();
  mixer.uncacheRoot(hip);
  skeleton.dispose();

  const rotationsOnly = new BVHLoader();
  rotationsOnly.animateBonePositions = false;
  assert.equal(rotationsOnly.parse(BVH).clip.tracks.length, 2);
  const positionsOnly = new BVHLoader();
  positionsOnly.animateBoneRotations = false;
  const tracks = positionsOnly.parse(BVH).clip.tracks;
  assert.equal(tracks.length, 2);
  assert.ok(tracks.every((track) => track instanceof VectorKeyframeTrack));
});

test("BVH ignores blank lines and rejects truncated data", () => {
  const spaced = BVH.replace(/\n/g, "\n\n   \n");
  assert.equal(new BVHLoader().parse(spaced).skeleton.bones.length, 3);
  assert.throws(() => new BVHLoader().parse("HIERARCHY\nROOT hip\n{"), /Unexpected end of file/);
});
