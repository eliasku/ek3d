import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Capsule } from "../src/addons/math/Capsule";
import { Octree } from "../src/addons/math/Octree";
import { OctreeHelper } from "../src/addons/helpers/OctreeHelper";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { Object3D } from "../src/core/Object3D";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Mesh } from "../src/objects/Mesh";
import { Box3 } from "../src/math/Box3";
import { Ray } from "../src/math/Ray";
import { Sphere } from "../src/math/Sphere";
import { Triangle } from "../src/math/Triangle";
import { Vector3 } from "../src/math/Vector3";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

test("capsule copies, translates and checks bounding boxes", () => {
  const capsule = new Capsule(new Vector3(0, 0, 0), new Vector3(0, 1, 0), 0.5);
  const copy = capsule.clone().translate(new Vector3(2, 0, 0));
  assert.deepEqual(capsule.getCenter(new Vector3()).toArray(), [0, 0.5, 0]);
  assert.deepEqual(copy.getCenter(new Vector3()).toArray(), [2, 0.5, 0]);
  assert.equal(copy.intersectsBox(new Box3(new Vector3(1.8, 0, -0.1), new Vector3(2.2, 1, 0.1))), true);
  assert.equal(copy.intersectsBox(new Box3(new Vector3(3, 0, 0), new Vector3(4, 1, 1))), false);
});

test("octree intersects a ray, capsule, sphere and box without modifying inputs", () => {
  const triangle = new Triangle(new Vector3(-2, -2, 0), new Vector3(2, -2, 0), new Vector3(0, 2, 0));
  const tree = new Octree().addTriangle(triangle).build();
  const ray = new Ray(new Vector3(0, 0, 2), new Vector3(0, 0, -1));
  const hit = tree.rayIntersect(ray);
  assert.ok(hit);
  close(hit.distance, 2);
  assert.deepEqual(hit.position.toArray(), [0, 0, 0]);
  assert.equal(tree.rayIntersect(new Ray(new Vector3(3, 0, 2), new Vector3(0, 0, -1))), false);

  const capsule = new Capsule(new Vector3(0, 0, 0.25), new Vector3(0, 0, 1), 0.5);
  const sphere = new Sphere(new Vector3(0, 0, 0.25), 0.5);
  const box = new Box3(new Vector3(-0.1, -0.1, -0.25), new Vector3(0.1, 0.1, 0.25));
  for (const result of [tree.capsuleIntersect(capsule), tree.sphereIntersect(sphere), tree.boxIntersect(box)]) {
    assert.ok(result);
    close(result.depth, 0.25);
    close(result.normal.z, 1);
  }
  close(capsule.start.z, 0.25);
  close(sphere.center.z, 0.25);
  close(box.min.z, -0.25);
  assert.equal(tree.sphereIntersect(new Sphere(new Vector3(0, 0, 3), 0.5)), false);
});

test("graph extraction uses world transforms and layers; helper tracks and disposes geometry", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-2, -2, 0, 2, -2, 0, 0, 2, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const mesh = new Mesh<MeshBasicMaterial>(geometry, new MeshBasicMaterial());
  mesh.position.z = 2;
  const group = new Object3D();
  group.add(mesh);
  const tree = new Octree().fromGraphNode(group);
  const hit = tree.rayIntersect(new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1)));
  assert.ok(hit);
  close(hit.distance, 3);
  const helper = new OctreeHelper(tree);
  assert.ok(helper.geometry.getAttribute("position")!.count > 0);
  tree.clear();
  helper.update();
  assert.equal(helper.geometry.getAttribute("position")!.count, 0);
  helper.dispose();
  mesh.layers.set(1);
  tree.fromGraphNode(group);
  assert.equal(tree.rayIntersect(new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1))), false);
  geometry.dispose();
  mesh.material.dispose();
});
