import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { OBB } from "../src/addons/math/OBB";
import { Box3 } from "../src/math/Box3";
import { Matrix3 } from "../src/math/Matrix3";
import { Matrix4 } from "../src/math/Matrix4";
import { Plane } from "../src/math/Plane";
import { Ray } from "../src/math/Ray";
import { Sphere } from "../src/math/Sphere";
import { Vector3 } from "../src/math/Vector3";

const near = (actual: Vector3, expected: Vector3): void => {
  assert.ok(actual.distanceTo(expected) < 1e-10, `${actual.toArray().join(",")} != ${expected.toArray().join(",")}`);
};

test("OBB copies, sizes and converts axis-aligned boxes", () => {
  const box = new OBB().fromBox3(new Box3(new Vector3(-1, -2, -3), new Vector3(3, 4, 5)));
  near(box.center, new Vector3(1, 1, 1));
  near(box.getSize(new Vector3()), new Vector3(4, 6, 8));
  const clone = box.clone();
  assert.ok(clone.equals(box));
  clone.center.x++;
  assert.equal(box.center.x, 1);
  assert.ok(!clone.equals(box));
  assert.ok(clone.copy(box).equals(box));
  assert.equal(clone.set(new Vector3(), new Vector3(1, 1, 1), new Matrix3()), clone);
});

test("rotated OBB clamps points and tests sphere, plane, boxes and rays", () => {
  const rotation = new Matrix3().setFromMatrix4(new Matrix4().makeRotationZ(Math.PI / 2));
  const box = new OBB(new Vector3(2, 0, 0), new Vector3(2, 1, 1), rotation);
  assert.ok(box.containsPoint(new Vector3(2, 1.5, 0)));
  assert.ok(!box.containsPoint(new Vector3(3.5, 0, 0)));
  near(box.clampPoint(new Vector3(4, 3, 0), new Vector3()), new Vector3(3, 2, 0));
  assert.ok(box.intersectsSphere(new Sphere(new Vector3(3.5, 0, 0), 0.5)));
  assert.ok(!box.intersectsSphere(new Sphere(new Vector3(4, 0, 0), 0.5)));
  assert.ok(box.intersectsPlane(new Plane(new Vector3(1, 0, 0), -3)));
  assert.ok(!box.intersectsPlane(new Plane(new Vector3(1, 0, 0), -4)));
  assert.ok(box.intersectsBox3(new Box3(new Vector3(2.5, 1, -0.5), new Vector3(4, 2, 0.5))));
  assert.ok(!box.intersectsBox3(new Box3(new Vector3(4, 0, 0), new Vector3(5, 1, 1))));
  assert.ok(box.intersectsOBB(new OBB(new Vector3(3.5, 0, 0), new Vector3(0.5, 0.5, 0.5))));
  assert.ok(!box.intersectsOBB(new OBB(new Vector3(4, 0, 0), new Vector3(0.5, 0.5, 0.5))));
  const ray = new Ray(new Vector3(-2, 0, 0), new Vector3(1, 0, 0));
  const point = new Vector3();
  assert.equal(box.intersectRay(ray, point), point);
  near(point, new Vector3(1, 0, 0));
  assert.ok(box.intersectsRay(ray));
  const miss = new Ray(new Vector3(-2, 3, 0), new Vector3(1, 0, 0));
  assert.equal(box.intersectRay(miss, point), null);
  assert.ok(!box.intersectsRay(miss));
});

test("OBB world transforms preserve dimensions and collision behavior", () => {
  const box = new OBB(new Vector3(), new Vector3(1, 2, 3));
  const transform = new Matrix4()
    .makeRotationZ(Math.PI / 2)
    .scale(new Vector3(2, 3, 4))
    .setPosition(5, 6, 7);
  assert.equal(box.applyMatrix4(transform), box);
  near(box.center, new Vector3(5, 6, 7));
  near(box.halfSize, new Vector3(2, 6, 12));
  assert.ok(box.containsPoint(new Vector3(0, 6, 7)));
  assert.ok(!box.containsPoint(new Vector3(5, 9, 7)));
});

test("OBB composes world rotation before its local rotation", () => {
  const local = new Matrix4().makeRotationX(0.7);
  const world = new Matrix4().makeRotationZ(0.4);
  const box = new OBB(new Vector3(), new Vector3(1, 2, 3), new Matrix3().setFromMatrix4(local));
  box.applyMatrix4(world);
  const point = new Vector3(0, 1.9, 0).applyMatrix4(local).applyMatrix4(world);
  assert.ok(box.containsPoint(point));
  const expected = new Matrix3().setFromMatrix4(world.clone().multiply(local));
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(box.rotation.elements[i] - expected.elements[i]) < 1e-10);
});

test("OBB mirrored transforms keep nonnegative extents and valid containment", () => {
  const box = new OBB(new Vector3(), new Vector3(1, 2, 3));
  box.applyMatrix4(new Matrix4().makeScale(-2, 3, 4));
  near(box.halfSize, new Vector3(2, 6, 12));
  assert.ok(box.containsPoint(new Vector3(1.9, 5.9, 11.9)));
  assert.ok(!box.containsPoint(new Vector3(2.1, 0, 0)));
});
