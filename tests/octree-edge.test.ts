import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Octree } from "../src/addons/math/Octree";
import { Capsule } from "../src/addons/math/Capsule";
import { Sphere } from "../src/math/Sphere";
import { Triangle } from "../src/math/Triangle";
import { Vector3 } from "../src/math/Vector3";
import { Ray } from "../src/math/Ray";

test("triangle edge collisions and octree candidate deduplication", () => {
  const triangle = new Triangle(new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(0, 2, 0));
  const tree = new Octree().addTriangle(triangle).build();
  const sphere = new Sphere(new Vector3(1, -0.2, 0.1), 0.5);
  const capsule = new Capsule(new Vector3(1, -0.2, 0.1), new Vector3(1, -0.2, 0.3), 0.5);
  const sphereHit = tree.triangleSphereIntersect(sphere, triangle);
  const capsuleHit = tree.triangleCapsuleIntersect(capsule, triangle);
  assert.ok(sphereHit);
  assert.ok(capsuleHit);
  assert.ok(Math.abs(sphereHit.depth - (0.5 - Math.sqrt(0.05))) < 1e-10);
  assert.ok(Math.abs(capsuleHit.depth - (0.5 - Math.sqrt(0.05))) < 1e-10);
  const candidates: Triangle[] = [];
  tree.getRayTriangles(new Ray(new Vector3(0.5, 0.5, 1), new Vector3(0, 0, -1)), candidates);
  assert.deepEqual(candidates, [triangle]);
  assert.equal(tree.rayIntersect(new Ray(new Vector3(0.5, 0.5, -1), new Vector3(0, 0, 1))), false);
});
