import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { SunLight } from "../src/addons/lights/SunLight";
import { Gyroscope } from "../src/addons/misc/Gyroscope";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { Object3D } from "../src/core/Object3D";
import { Quaternion } from "../src/math/Quaternion";
import { Vector3 } from "../src/math/Vector3";

test("gyroscope follows its parent's position without inheriting rotation", () => {
  const parent = new Object3D();
  const gyro = new Gyroscope();
  gyro.position.set(1, 0, 0);
  parent.position.set(2, 0, 0);
  parent.rotation.y = Math.PI / 2;
  parent.add(gyro);
  parent.updateMatrixWorld(true);
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  gyro.matrixWorld.decompose(position, rotation, scale);
  assert.ok(Math.abs(position.x - 2) < 1e-8);
  assert.ok(Math.abs(position.z + 1) < 1e-8);
  assert.ok(Math.abs(rotation.y) < 1e-8);
  assert.ok(Math.abs(rotation.w - 1) < 1e-8);
});

test("sun shadow fits two finite cascades to the view camera", () => {
  const light = new SunLight();
  light.position.set(200, 450, 500);
  light.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(45, 1, 1, 4000);
  camera.position.set(0, 150, 1300);
  camera.updateMatrixWorld(true);
  light.shadow.camera.far = 2000;
  light.shadow.updateMatrices(light, camera);
  assert.equal(light.shadow.getViewportCount(), 2);
  assert.equal(light.shadow._cascadeSplits[0], 1);
  assert.equal(light.shadow._cascadeSplits[2], 2000);
  assert.ok(light.shadow._cascadeSplits[1] > 1 && light.shadow._cascadeSplits[1] < 2000);
  assert.ok(light.shadow.getMatrix(0).elements.every(Number.isFinite));
  assert.ok(light.shadow.getMatrix(1).elements.every(Number.isFinite));
  light.dispose();
});
