import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { InstancedFlow } from "../src/addons/modifiers/CurveModifier";
import { CatmullRomCurve3 } from "../src/extras/curves/CatmullRomCurve3";
import { toHalfFloat } from "../src/extras/DataUtils";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshStandardMaterial } from "../src/materials/MeshStandardMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";

test("instanced flow samples curves and writes instance offsets", () => {
  const flow = new InstancedFlow(2, 1, new BoxGeometry(), new MeshStandardMaterial());
  const curve = new CatmullRomCurve3(
    [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1)],
    true,
  );
  flow.updateCurve(0, curve);
  const point = curve.getPointAt(0.25);
  const data = flow.splineTexture.image.data as Uint16Array;
  assert.deepEqual(Array.from(data.slice(256 * 4, 256 * 4 + 4)), [
    toHalfFloat(point.x),
    toHalfFloat(point.y),
    toHalfFloat(point.z),
    toHalfFloat(1),
  ]);
  flow.setCurve(1, 0);
  flow.moveIndividualAlongCurve(1, 0.25);
  const matrix = new Matrix4();
  flow.object3D.getMatrixAt(1, matrix);
  assert.equal(matrix.elements[13], 0);
  assert.equal(matrix.elements[14], 0.25);
});
