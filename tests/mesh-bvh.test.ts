import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MeshBVH } from "../src/addons/math/bvh/core/MeshBVH";
import { ExtendedTriangle } from "../src/addons/math/bvh/math/ExtendedTriangle";
import {
  acceleratedRaycast,
  type BVHGeometry,
  type BVHRaycaster,
} from "../src/addons/math/bvh/utils/ExtensionUtilities";
import { Raycaster, type Intersection } from "../src/core/Raycaster";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { Side } from "../src/constants";
import { Ray } from "../src/math/Ray";
import { Vector3 } from "../src/math/Vector3";
import { Triangle } from "../src/math/Triangle";
import { Line3 } from "../src/math/Line3";

test("extended triangle clones retain independent cached points and SAT intersections", () => {
  const triangle = new ExtendedTriangle(new Vector3(1, 2, 3), new Vector3(4, 2, 3), new Vector3(1, 6, 3));
  triangle.update();
  Object.defineProperty(triangle, "constructor", {
    get() {
      throw new Error("Cloning must not access the instance constructor");
    },
  });
  const clone = triangle.clone();
  assert.equal(clone.constructor, ExtendedTriangle);
  assert.equal(clone.needsUpdate, true);
  assert.deepEqual(clone.points, [clone.a, clone.b, clone.c]);
  for (let i = 0; i < 3; i++) {
    assert.equal(clone.points[i], [clone.a, clone.b, clone.c][i]);
    assert.notEqual(clone.points[i], triangle.points[i]);
    assert.deepEqual(clone.points[i], triangle.points[i]);
  }
  assert.notEqual(clone.satAxes, triangle.satAxes);
  assert.notEqual(clone.satBounds, triangle.satBounds);
  assert.notEqual(clone.plane, triangle.plane);
  const crossing = new Triangle(new Vector3(2, 3, 2), new Vector3(2, 3, 4), new Vector3(3, 3, 3));
  const originalIntersection = new Line3();
  const clonedIntersection = new Line3();
  assert.equal(triangle.intersectsTriangle(crossing, originalIntersection), true);
  assert.equal(clone.intersectsTriangle(crossing, clonedIntersection), true);
  assert.deepEqual(clonedIntersection, originalIntersection);
  assert.equal(clone.needsUpdate, false);
  assert.deepEqual(clone.satAxes, triangle.satAxes);
  assert.deepEqual(clone.satBounds, triangle.satBounds);
  for (const point of clone.points) point.addScalar(10);
  clone.needsUpdate = true;
  assert.equal(clone.intersectsTriangle(crossing), false);
  assert.deepEqual(triangle.a, new Vector3(1, 2, 3));

  class CustomTriangle extends Triangle {}
  class CustomExtendedTriangle extends ExtendedTriangle {}
  assert.equal(new CustomTriangle().clone().constructor, Triangle);
  assert.equal(new CustomExtendedTriangle().clone().constructor, ExtendedTriangle);
});

test("BVH raycasts and serialization preserve direct and indirect geometry", () => {
  for (const indirect of [false, true]) {
    const geometry = new BoxGeometry(2, 2, 2);
    const originalIndex = geometry.index!.array.slice();
    const tree = new MeshBVH(geometry, { indirect, maxLeafSize: 2 });
    if (indirect) assert.deepEqual(geometry.index!.array, originalIndex);
    const ray = new Ray(new Vector3(0.2, 0.1, 5), new Vector3(0, 0, -1));
    const hits = tree.raycast(ray, Side.Double).sort((a, b) => a.distance - b.distance);
    const first = tree.raycastFirst(ray, Side.Double);
    assert.equal(hits.length, 2);
    assert.ok(first);
    assert.equal(first.distance, 4);
    assert.equal(hits[0].distance, first.distance);
    const restored = MeshBVH.deserialize(MeshBVH.serialize(tree), geometry.clone());
    assert.equal(restored.raycastFirst(ray, Side.Double)?.distance, 4);
    assert.equal(restored.raycast(new Ray(new Vector3(5, 5, 5), new Vector3(1, 0, 0)), Side.Double).length, 0);
    geometry.dispose();
  }
});

test("accelerated raycast returns world-space hits and falls back without a tree", () => {
  const geometry: BVHGeometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial({ side: Side.Double });
  const mesh = new Mesh(geometry, material);
  mesh.position.z = 2;
  mesh.updateMatrixWorld();
  const raycaster: BVHRaycaster = new Raycaster(new Vector3(0.2, 0.1, 8), new Vector3(0, 0, -1));
  raycaster.firstHitOnly = true;
  geometry.boundsTree = new MeshBVH(geometry);
  const hits: Intersection[] = [];
  acceleratedRaycast.call(mesh, raycaster, hits);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].distance, 5);
  assert.equal(hits[0].object, mesh);
  geometry.boundsTree = null;
  hits.length = 0;
  acceleratedRaycast.call(mesh, raycaster, hits);
  assert.equal(hits[0].distance, 5);
  geometry.dispose();
  material.dispose();
});
