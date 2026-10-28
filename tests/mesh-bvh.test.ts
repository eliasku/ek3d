import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { MeshBVH } from "../src/addons/math/bvh/core/MeshBVH";
import {
  acceleratedRaycast,
  type BVHGeometry,
  type BVHRaycaster,
} from "../src/addons/math/bvh/utils/ExtensionUtilities";
import { Raycaster, type Intersection } from "../src/core/Raycaster";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { DoubleSide } from "../src/constants";
import { Ray } from "../src/math/Ray";
import { Vector3 } from "../src/math/Vector3";

test("BVH raycasts and serialization preserve direct and indirect geometry", () => {
  for (const indirect of [false, true]) {
    const geometry = new BoxGeometry(2, 2, 2);
    const originalIndex = geometry.index!.array.slice();
    const tree = new MeshBVH(geometry, { indirect, maxLeafSize: 2 });
    if (indirect) assert.deepEqual(geometry.index!.array, originalIndex);
    const ray = new Ray(new Vector3(0.2, 0.1, 5), new Vector3(0, 0, -1));
    const hits = tree.raycast(ray, DoubleSide).sort((a, b) => a.distance - b.distance);
    const first = tree.raycastFirst(ray, DoubleSide);
    assert.equal(hits.length, 2);
    assert.ok(first);
    assert.equal(first.distance, 4);
    assert.equal(hits[0].distance, first.distance);
    const restored = MeshBVH.deserialize(MeshBVH.serialize(tree), geometry.clone());
    assert.equal(restored.raycastFirst(ray, DoubleSide)?.distance, 4);
    assert.equal(restored.raycast(new Ray(new Vector3(5, 5, 5), new Vector3(1, 0, 0)), DoubleSide).length, 0);
    geometry.dispose();
  }
});

test("accelerated raycast returns world-space hits and falls back without a tree", () => {
  const geometry: BVHGeometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial({ side: DoubleSide });
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
