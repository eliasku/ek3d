import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { OrbitControls } from "../src/addons/controls/OrbitControls";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { Vector3 } from "../src/math/Vector3";

function close(actual: number, expected: number, message: string, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`);
}

test("OrbitControls orbits within the polar angle bounds", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.maxPolarAngle = Math.PI / 4;

  controls.rotateUp(-Math.PI);
  controls.update();

  close(controls.getPolarAngle(), Math.PI / 4, "polar angle must be clamped");
  close(camera.position.length(), 5, "the orbit radius must be preserved", 1e-6);
});

test("OrbitControls restricts the azimuth angle interval", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.minAzimuthAngle = Math.PI / 4;
  controls.maxAzimuthAngle = Math.PI / 2;

  controls.rotateLeft(Math.PI / 2);
  controls.update();
  close(controls.getAzimuthalAngle(), Math.PI / 4, "azimuth lower bound");

  controls.rotateLeft(-Math.PI);
  controls.update();
  close(controls.getAzimuthalAngle(), Math.PI / 2, "azimuth upper bound");
});

test("OrbitControls clamps the dolly distance", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.minDistance = 2;
  controls.maxDistance = 8;

  // A dolly scale above one multiplies the orbit radius, which reaches maxDistance.
  controls.dollyIn(10000);
  close(controls.getDistance(), 8, "dolly in clamps to maxDistance", 1e-6);
  close(camera.position.z, 8, "clamped dolly keeps the camera on the orbit axis", 1e-6);
  close(camera.position.x, 0, "clamped dolly keeps the camera on the orbit axis", 1e-6);

  controls.dollyOut(10000);
  close(controls.getDistance(), 2, "dolly out clamps to minDistance", 1e-6);
  close(camera.position.z, 2, "clamped dolly out keeps the camera on the orbit axis", 1e-6);
});

test("OrbitControls applies damping incrementally and settles", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  // rotateLeft() already calls update(), so this is the first damped step.
  controls.rotateLeft(Math.PI / 2);
  const afterOne = controls.getAzimuthalAngle();
  close(afterOne, (-Math.PI / 2) * 0.1, "first damped step", 1e-9);

  controls.update();
  const afterTwo = controls.getAzimuthalAngle();
  assert.ok(Math.abs(afterTwo) > Math.abs(afterOne), "damping must keep rotating towards the target");
  assert.ok(Math.abs(afterTwo) < Math.PI / 2, "damping must not jump to the full rotation");

  for (let i = 0; i < 200; i++) controls.update();
  close(controls.getAzimuthalAngle(), -Math.PI / 2, "damping must converge", 1e-6);
});

test("OrbitControls without damping applies the full rotation immediately", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);

  controls.rotateLeft(Math.PI / 2);
  controls.update();
  close(controls.getAzimuthalAngle(), -Math.PI / 2, "undamped rotation");
});

test("OrbitControls resets to the saved state", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(3, 4, 5);
  const controls = new OrbitControls(camera, null);
  controls.target.set(1, 2, 3);
  controls.saveState();

  controls.target.set(9, 9, 9);
  controls.rotateLeft(1);
  controls.dollyIn(2);
  controls.update();
  assert.ok(camera.position.distanceTo(new Vector3(3, 4, 5)) > 1e-6, "interaction must change the camera");

  let changes = 0;
  controls.addEventListener("change", () => changes++);
  controls.reset();

  assert.deepEqual(controls.target.toArray(), [1, 2, 3]);
  close(camera.position.x, 3, "reset restores the position x", 1e-6);
  close(camera.position.y, 4, "reset restores the position y", 1e-6);
  close(camera.position.z, 5, "reset restores the position z", 1e-6);
  assert.equal(controls.state, -1);
  assert.ok(changes > 0, "reset must report a change");
});

test("OrbitControls auto-rotates only while idle", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.autoRotate = true;

  controls.update(1);
  const rotated = controls.getAzimuthalAngle();
  assert.ok(Math.abs(rotated) > 0, "auto rotation must move the camera");

  controls.state = 0;
  controls.update(1);
  close(controls.getAzimuthalAngle(), rotated, "auto rotation must stop during interaction");
});

test("OrbitControls zooms an orthographic camera by changing its zoom", () => {
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera, null);
  controls.minZoom = 0.5;
  controls.maxZoom = 4;

  controls.dollyIn(10000);
  close(camera.zoom, 0.5, "orthographic zoom lower clamp");
  controls.dollyOut(10000);
  close(camera.zoom, 4, "orthographic zoom upper clamp");
});
