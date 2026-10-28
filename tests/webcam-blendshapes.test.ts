import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { applyBlendshapes } from "../examples/webgl_morphtargets_webcam_blendshapes";

test("webcam blendshapes map face scores and combine opposing eye movements", () => {
  const influences = [0, 0];
  const left = { rotation: { x: 0, z: 0 } };
  const right = { rotation: { x: 0, z: 0 } };
  applyBlendshapes(
    [
      { categoryName: "jawOpen", score: 0.7 },
      { categoryName: "eyeBlinkLeft", score: 0.4 },
      { categoryName: "eyeLookInLeft", score: 0.8 },
      { categoryName: "eyeLookOutLeft", score: 0.2 },
      { categoryName: "eyeLookInRight", score: 0.3 },
      { categoryName: "eyeLookOutRight", score: 0.9 },
      { categoryName: "eyeLookUpLeft", score: 0.6 },
      { categoryName: "eyeLookDownLeft", score: 0.1 },
      { categoryName: "eyeLookUpRight", score: 0.2 },
      { categoryName: "eyeLookDownRight", score: 0.8 },
      { categoryName: "_neutral", score: 1 },
    ],
    { jawOpen: 0, eyeBlink_L: 1 },
    influences,
    left,
    right,
  );
  assert.deepEqual(influences, [0.7, 0.4]);
  assert.ok(Math.abs(left.rotation.z - (0.6 * Math.PI) / 6) < 1e-12);
  assert.ok(Math.abs(right.rotation.z - (0.6 * Math.PI) / 6) < 1e-12);
  assert.ok(Math.abs(left.rotation.x + (0.5 * Math.PI) / 6) < 1e-12);
  assert.ok(Math.abs(right.rotation.x - (0.6 * Math.PI) / 6) < 1e-12);
});
