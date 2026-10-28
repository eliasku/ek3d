import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { ConvexObjectBreaker } from "../src/addons/misc/ConvexObjectBreaker";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Plane } from "../src/math/Plane";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";

test("breaking an indexed box preserves material and clones motion into both pieces", () => {
  const breaker = new ConvexObjectBreaker();
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial();
  const object = new Mesh(geometry, material);
  const velocity = new Vector3(1, 2, 3);
  const angularVelocity = new Vector3(4, 5, 6);
  breaker.prepareBreakableObject(object, 8, velocity, angularVelocity, true);
  assert.notEqual(object.userData.velocity, velocity);
  assert.notEqual(object.userData.angularVelocity, angularVelocity);

  const output: { object1: Mesh | null; object2: Mesh | null } = { object1: null, object2: null };
  assert.equal(breaker.cutByPlane(object, new Plane(new Vector3(1, 0, 0), 0), output), 2);
  assert.ok(output.object1);
  assert.ok(output.object2);
  for (const piece of [output.object1, output.object2]) {
    assert.equal(piece.material, material);
    assert.equal(piece.userData.mass, 4);
    assert.deepEqual(piece.userData.velocity, velocity);
    assert.deepEqual(piece.userData.angularVelocity, angularVelocity);
    assert.notEqual(piece.userData.velocity, object.userData.velocity);
    piece.geometry.dispose();
  }
  assert.ok(output.object1.position.x < 0);
  assert.ok(output.object2.position.x > 0);
  geometry.dispose();
  material.dispose();
});

test("a plane outside the box returns one piece and clears the other output", () => {
  const breaker = new ConvexObjectBreaker();
  const indexedGeometry = new BoxGeometry(2, 2, 2);
  const geometry = indexedGeometry.toNonIndexed();
  const material = new MeshBasicMaterial();
  const object = new Mesh(geometry, material);
  breaker.prepareBreakableObject(object, 2, new Vector3(), new Vector3(), true);
  const output: { object1: Mesh | null; object2: Mesh | null } = { object1: object, object2: object };
  assert.equal(breaker.cutByPlane(object, new Plane(new Vector3(1, 0, 0), -10), output), 1);
  assert.ok(output.object1);
  assert.equal(output.object2, null);
  output.object1.geometry.dispose();
  geometry.dispose();
  indexedGeometry.dispose();
  material.dispose();
});
