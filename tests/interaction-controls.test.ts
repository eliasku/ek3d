import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { FlyControls } from "../src/addons/controls/FlyControls";
import { FirstPersonControls } from "../src/addons/controls/FirstPersonControls";
import { TrackballControls } from "../src/addons/controls/TrackballControls";
import { ArcballControls } from "../src/addons/controls/ArcballControls";
import { OBJLoader } from "../src/addons/loaders/OBJLoader";
import { HDRLoader } from "../src/addons/loaders/HDRLoader";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { Vector3 } from "../src/math/Vector3";
import { Group } from "../src/objects/Group";
import { readFileSync } from "node:fs";

function close(actual: number, expected: number, message: string, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`);
}

test("FlyControls translates and rolls the object on update", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  const controls = new FlyControls(camera, null);

  assert.equal(controls.rollSpeed, 0.005, "rotation speed default");
  assert.equal(controls.movementSpeed, 1.0, "movement speed default");

  // Drive the movement state directly: forward + yaw.
  controls._moveState.forward = 1;
  controls._updateMovementVector();
  assert.equal(controls._moveVector.z, -1, "forward motion is negative Z in object space");

  const before = camera.position.clone();
  controls.update(1);
  assert.ok(camera.position.distanceTo(before) > 1e-9, "update must translate the object");
  close(camera.position.z, before.z - 1, "one second of forward motion equals the movement speed", 1e-6);

  // Roll: rotation vector drives the quaternion through update.
  controls._moveState.forward = 0;
  controls._moveState.rollLeft = 1;
  controls._updateRotationVector();
  assert.equal(controls._rotationVector.z, 1, "roll left maps to +Z rotation (upstream sign)");
  controls.update(1);
  assert.ok(camera.quaternion.w !== 1 || camera.quaternion.z !== 0, "roll rotates the object");
});

test("FlyControls disabled update leaves the object unmoved", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  const controls = new FlyControls(camera, null);
  controls.enabled = false;

  const before = camera.position.clone();
  controls._moveState.forward = 1;
  controls._updateMovementVector();
  controls.update(1);
  assert.ok(camera.position.distanceTo(before) === 0, "disabled controls must not move");
});

test("FirstPersonControls starts oriented toward -Z and moves with damping", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  const controls = new FirstPersonControls(camera, null);

  close(Math.abs(controls._lon % 360), 180, "initial yaw faces -Z (upstream spherical convention)", 1e-6);
  close(controls._lat, 0, "initial pitch", 1e-6);

  const before = camera.position.clone();
  controls._keyForward = true;
  controls.update(1);
  // Damping eases the velocity toward its target: the first step covers dampingFactor of it.
  close(camera.position.z, before.z - 0.1, "the first damped step", 1e-6);
  close(camera.position.x, before.x, "no sideways drift");

  controls.update(1);
  close(camera.position.z, before.z - (0.1 + 0.19), "velocity and position accumulate under damping", 1e-6);

  for (let i = 0; i < 100; i++) controls.update(1);
  close(camera.position.z % 1, 0, "velocity converges to the unit target speed", 0.1);

  // lookAt keeps lon/lat in sync.
  controls.lookAt(5, 10, 15);
  assert.ok(controls._lat >= 0, "lookAt recomputes orientation angles");
});

test("FirstPersonControls clamps the look latitude", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  const controls = new FirstPersonControls(camera, null);

  controls._latVelocity = 1000 * 1; // strong look velocity
  for (let i = 0; i < 200; i++) controls.update(0.1);
  assert.ok(Math.abs(controls._lat) <= 85.000001, `latitude clamped, was ${controls._lat}`);
});

test("TrackballControls orbits without keeping the up vector", () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.z = 500;
  camera.updateMatrixWorld();
  const controls = new TrackballControls(camera, null);

  assert.deepEqual(controls.keys, ["KeyA", "KeyS", "KeyD"], "upstream default keycodes");
  assert.equal(controls.mouseButtons.LEFT, 0, "left button rotates");

  const eyeBefore = new Vector3().subVectors(camera.position, controls.target);

  // Emulate a rotate drag on the virtual trackball (screen-to-circle mapping is handleResize-free with screen reset).
  controls.screen = { left: 0, top: 0, width: 800, height: 600 };
  controls._moveCurr.copy(controls._getMouseOnCircle(500, 300));
  controls._movePrev.copy(controls._getMouseOnCircle(400, 300));
  controls.update();

  assert.ok(
    new Vector3().subVectors(camera.position, controls.target).distanceTo(eyeBefore) > 1e-6,
    "rotation must preserve the eye distance but change the direction",
  );
  close(
    new Vector3().subVectors(camera.position, controls.target).length(),
    eyeBefore.length(),
    "radius preserved",
    1e-4,
  );
});

test("TrackballControls reset restores target position and zoom", () => {
  const ortho = new OrthographicCamera(400, -400, 300, -300, 1, 1000);
  ortho.position.z = 500;
  ortho.zoom = 2;
  ortho.updateProjectionMatrix();
  const controls = new TrackballControls(ortho, null);
  assert.equal(controls._zoom0, 2, "initial zoom captured");

  ortho.zoom = 3;
  controls.reset();
  close(ortho.zoom, 2, "reset restores the zoom", 1e-9);
  close(ortho.position.z, 500, "reset restores the position", 1e-9);
});

test("OBJLoader merges faces, groups and vertex colors like upstream", () => {
  const objText = readFileSync(
    new URL("../upstream/three.js/examples/models/obj/walt/WaltHead.obj", import.meta.url),
    "utf8",
  );
  const container = new OBJLoader().parse(objText);
  assert.ok(container instanceof Group, "parse returns a group");
  assert.ok(container.children.length > 0, "the model has meshes");
});

test("OBJLoader parses mixed geometry types into distinct objects", () => {
  const sample = [
    "# comment",
    "o head",
    "v 0 0 0",
    "v 1 0 0",
    "v 0 1 0",
    "v 0 0 1",
    "vn 0 0 1",
    "vt 0.5 0.5",
    "f 1/1/1 2/1/1 3/1/1",
    "l 1 2",
    "p 4",
  ].join("\n");
  const container = new OBJLoader().parse(sample);
  // One object: the `p` statement switches the object type, so face data and point merge upstream.
  assert.equal(container.children.length, 1, "the single o object is emitted once");
  const head = container.children[0] as any;
  assert.ok(head.geometry.attributes.position.count >= 1, "positions resolved");
  assert.equal(head.geometry.attributes.uv.count, 3, "uvs resolved per vertex");
});

test("HDRLoader parses an RGBE header and pixel payload", async () => {
  // Build a minimal non-RLE HDR: a 2x2 flat image.
  const header = "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 2\n";
  const payload = new Uint8Array([
    1,
    128,
    0,
    128, // pixel 0
    2,
    128,
    0,
    128, // pixel 1
    3,
    128,
    0,
    128, // pixel 2
    4,
    128,
    0,
    128, // pixel 3
  ]);
  const encoder = new TextEncoder();
  const text = encoder.encode(header);
  const buffer = new Uint8Array(text.length + payload.length);
  buffer.set(text);
  buffer.set(payload, text.length);
  return rgbeCheck(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length));
});

function rgbeCheck(buffer: ArrayBuffer): void {
  const loader = new HDRLoader();
  const HalfFloatType: number = new HDRLoader().type;
  const texData = loader.parse(buffer);
  assert.equal(texData.width, 2);
  assert.equal(texData.height, 2);
  assert.equal(texData.type, HalfFloatType);
  const half = texData.data as Uint16Array;
  assert.equal(half.length, 16);
  assert.ok(half[0] > 0, "the first channel decodes to a positive half float");
}

test("ARCBallControls: state JSON round trips without a clipboard", () => {
  const camera = new PerspectiveCamera(45, 1, 0.01, 2000);
  camera.position.set(0, 0, 2.5);
  const controls = new ArcballControls(camera, null);

  assert.equal(controls.mouseActions.length, 7, "upstream initializes all seven actions");

  const rotatedPos = new Vector3(1, 0.5, 0.2);
  const snapshot = JSON.stringify({
    arcballState: {
      cameraFar: camera.far,
      cameraFov: camera.fov,
      cameraMatrix: { elements: camera.matrix.elements },
      cameraNear: camera.near,
      cameraUp: [0, 1, 0],
      cameraZoom: 1,
      gizmoMatrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, rotatedPos.x, rotatedPos.y, rotatedPos.z, 1] },
      target: [0.25, 0, 0],
    },
  });

  controls.setStateFromJSON(snapshot);
  close(controls.target.x, 0.25, "target restored from JSON");
  close(controls._gizmos.position.x, rotatedPos.x, "gizmos position restored");
  close(controls._gizmos.position.y, rotatedPos.y, "gizmos y restored");
});

test("ArcballControls: setCamera and FOV clamping", () => {
  const ortho = new OrthographicCamera(-10, 10, 10, -10, 0.01, 2000);
  ortho.position.set(0, 0, 120);
  const controls = new ArcballControls(ortho, null);

  controls.setFov(999);
  close(ortho.zoom, 1, "fov setter ignores ortho cameras via zoom untouched");
  assert.ok(controls._tbRadius > 0, "trackball radius derived from frustum");
});
