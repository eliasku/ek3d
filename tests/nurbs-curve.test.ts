import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { NURBSCurve } from "../src/addons/curves/NURBSCurve";
import { Vector4 } from "../src/math/Vector4";

test("NURBSCurve evaluates weighted control points and a unit tangent", () => {
  const curve = new NURBSCurve(
    2,
    [0, 0, 0, 1, 1, 1],
    [new Vector4(0, 0, 0, 1), new Vector4(5, 10, 0, 1), new Vector4(10, 0, 0, 1)],
  );

  const start = curve.getPoint(0);
  assert.deepEqual([start.x, start.y, start.z], [0, 0, 0]);

  const middle = curve.getPoint(0.5);
  assert.ok(Math.abs(middle.y - 5) < 1e-9, `midpoint y was ${middle.y}`);

  const tangent = curve.getTangent(0.5);
  assert.ok(Math.abs(tangent.length() - 1) < 1e-9, "tangent must be normalized");
});
