import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Brush } from "../src/addons/math/csg/core/Brush";
import { Evaluator } from "../src/addons/math/csg/core/Evaluator";
import { ADDITION, INTERSECTION, SUBTRACTION } from "../src/addons/math/csg/core/constants";
import cdt2d from "../src/addons/math/csg/triangulation/cdt2d";
import { orient } from "../src/addons/math/csg/triangulation/predicates";
import { computeMeshVolume } from "../src/addons/math/csg/utils/computeMeshVolume";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";

test("constrained triangulation retains its diagonal and resolves near-collinear orientation", () => {
  const points = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  const triangles = cdt2d(points, [[0, 2]]);
  assert.equal(triangles.length, 2);
  assert.equal(triangles.filter((triangle) => triangle.includes(0) && triangle.includes(2)).length, 2);
  const epsilon = Number.EPSILON;
  assert.ok(orient([0, 0], [1, 1], [2, 2 + 2 * epsilon]) < 0);
  assert.ok(orient([0, 0], [2, 2 + 2 * epsilon], [1, 1]) > 0);
});

test("CSG operations preserve transformed volumes and material group boundaries", () => {
  for (const useCDTClipping of [false, true]) {
    const geometry = new BoxGeometry(2, 2, 2);
    geometry.clearGroups();
    geometry.addGroup(0, 18, 0);
    geometry.addGroup(18, 18, 1);
    const materials = [new MeshBasicMaterial(), new MeshBasicMaterial()];
    const otherMaterial = new MeshBasicMaterial();
    const a = new Brush(geometry, materials);
    const b = new Brush(new BoxGeometry(2, 2, 2), otherMaterial);
    a.position.set(2, 3, -4);
    b.position.set(2.5, 3.25, -3.875);
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const evaluator = new Evaluator();
    evaluator.useCDTClipping = useCDTClipping;
    const overlap = 1.5 * 1.75 * 1.875;
    for (const [operation, expected] of [
      [SUBTRACTION, 8 - overlap],
      [INTERSECTION, overlap],
      [ADDITION, 16 - overlap],
    ] as const) {
      const result = evaluator.evaluate(a, b, operation);
      assert.ok(Math.abs(computeMeshVolume(result) - expected) < 1e-4);
      assert.deepEqual(result.position.toArray(), a.position.toArray());
      assert.ok(Array.isArray(result.material));
      let end = 0;
      for (const group of result.geometry.groups) {
        assert.equal(group.start, end);
        assert.equal(group.count % 3, 0);
        assert.ok(
          group.materialIndex !== undefined && group.materialIndex >= 0 && group.materialIndex < result.material.length,
        );
        end += group.count;
      }
      assert.equal(end, result.geometry.drawRange.count);
      assert.ok(result.material.includes(otherMaterial));
      result.geometry.dispose();
    }
    evaluator.useGroups = false;
    const ungrouped = evaluator.evaluate(a, b, SUBTRACTION);
    assert.equal(ungrouped.material, materials[0]);
    assert.ok(Math.abs(computeMeshVolume(ungrouped) - (8 - overlap)) < 1e-4);
    ungrouped.geometry.dispose();
    a.geometry.dispose();
    b.geometry.dispose();
    for (const material of [...materials, otherMaterial]) material.dispose();
  }
});
