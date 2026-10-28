import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { frameCorners } from "../src/addons/utils/CameraUtils";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { Vector3 } from "../src/math/Vector3";

test("frameCorners projects an off-axis rectangle to the viewport", () => {
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 2);
  const corners = [new Vector3(-1, -1, 0), new Vector3(2, -1, 0), new Vector3(-1, 1, 0)];
  frameCorners(camera, corners[0], corners[1], corners[2], true);
  camera.updateMatrixWorld();
  const expected = [
    [-1, -1],
    [1, -1],
    [-1, 1],
  ];
  corners.forEach((corner, i) => {
    const projected = corner.clone().project(camera);
    assert.ok(Math.abs(projected.x - expected[i][0]) < 1e-10);
    assert.ok(Math.abs(projected.y - expected[i][1]) < 1e-10);
  });
  assert.ok(camera.fov > 0);
});
