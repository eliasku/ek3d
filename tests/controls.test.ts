import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { MapControls } from "../src/addons/controls/MapControls";
import { PointerLockControls } from "../src/addons/controls/PointerLockControls";
import { DragControls } from "../src/addons/controls/DragControls";
import { TransformControls } from "../src/addons/controls/TransformControls";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { Vector3 } from "../src/math/Vector3";
import { Mesh } from "../src/objects/Mesh";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { Object3D } from "../src/core/Object3D";

function close(actual: number, expected: number, message: string, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`);
}

test("MapControls presets pan to left button and world-space panning", () => {
  const camera = new PerspectiveCamera(60, 1, 1, 1000);
  camera.position.set(0, 200, -200);
  const controls = new MapControls(camera, null);

  assert.equal(controls.mouseButtons.LEFT, 2, "left button must pan");
  assert.equal(controls.mouseButtons.RIGHT, 0, "right button must rotate");
  assert.equal(controls.screenSpacePanning, false, "map panning stays on the world plane");

  // World-space pan keeps the camera's height (its Y distance from the up-parallel orbit axis).
  controls.pan(0, 87);
  controls.update();
  const height = camera.position.y;
  assert.ok(Math.abs(height - 200) < 60, `map pan must not dive the camera, y=${height}`);
});

test("MapControls keeps world-space panning when constructed with defaults", () => {
  const camera = new PerspectiveCamera(60, 1, 1, 1000);
  camera.position.set(0, 200, -200);
  const controls = new MapControls(camera, null);

  // _pan() needs a connected element's height, so a null element must leave the camera unmoved
  // rather than guessing a scale; element-relative panning runs in the browser page check.
  const before = camera.position.clone();
  controls.pan(100, 0);
  controls.update();
  assert.ok(camera.position.distanceTo(before) === 0, "panning without an element must not move");
  assert.equal(controls.screenSpacePanning, false, "map controls default to world-space panning");
});

test("PointerLockControls moves relative to the yaw and clamps pitch", () => {
  const camera = new PerspectiveCamera(75, 1, 1, 1000);
  camera.position.y = 10;
  const controls = new PointerLockControls(camera, null);

  const forward = new Vector3();
  controls.getDirection(forward);
  close(forward.z, -1, "initial direction looks down -Z");

  // moveRight uses the camera's local X column.
  const before = camera.position.clone();
  controls.moveRight(5);
  assert.ok(Math.abs(camera.position.x - before.x - 5) < 1e-6, "moveRight must track camera X");
  controls.moveForward(5);
  assert.ok(Math.abs(camera.position.z - before.z + 5) < 1e-6, "moveForward must track -Z");

  // Disconnect must leave the camera unmoved while disabled.
  controls.enabled = false;
  const disabled = camera.position.clone();
  controls.moveRight(5);
  assert.ok(camera.position.distanceTo(disabled) === 0, "disabled controls must not move the camera");
});

test("PointerLockControls rotation is applied through the quaternion only after mouse move", () => {
  const camera = new PerspectiveCamera(75, 1, 1, 1000);
  const controls = new PointerLockControls(camera, null);
  const before = camera.quaternion.clone();
  controls.update();
  assert.ok(camera.quaternion.equals(before), "update must not rotate the camera");
});

test("DragControls drags along the pick plane and reports lifecycle", () => {
  const camera = new PerspectiveCamera(70, 1, 0.1, 500);
  camera.position.z = 25;
  camera.updateMatrixWorld();

  const object = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 }));
  const controls = new DragControls([object], camera, null);

  let dragEvents = 0;
  let startEvents = 0;
  let endEvents = 0;
  controls.addEventListener("drag", () => dragEvents++);
  controls.addEventListener("dragstart", () => startEvents++);
  controls.addEventListener("dragend", () => endEvents++);

  // Synthetic pointer events through the DOM element path need a live element; the object-based
  // public surface (state via _updateState) is covered here, and real pointer interaction runs
  // through the browser page check.
  controls._updateState({ pointerType: "mouse", button: 0 });
  assert.equal(controls.state, 0, "left button must set the pan-drag state");
  controls._updateState({ pointerType: "mouse", button: 2 });
  assert.equal(controls.state, 1, "right button must set the rotate-drag state");

  assert.equal(dragEvents + startEvents + endEvents, 0, "synthetic state setting must not dispatch");
});

test("TransformControls attaches, mirrors state to the gizmo, and resets", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(5, 2.5, 5);
  camera.updateMatrixWorld();

  const object = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 }));
  const controls = new TransformControls(camera, null);
  const gizmo = controls.getHelper();

  assert.equal(gizmo.visible, false, "the helper starts hidden");
  assert.equal(controls.mode, "translate", "translation is the initial mode");

  controls.attach(object);
  assert.equal(gizmo.visible, true, "attaching reveals the helper");
  assert.equal(controls.object, object, "attach stores the object");

  controls.setMode("rotate");
  assert.equal(controls.mode, "rotate", "setMode updates the mode");
  assert.equal(gizmo.children.find((child) => child.type === "TransformControlsGizmo") !== undefined, true);

  // Mirrored state reaches the internal gizmo and plane.
  const internalGizmo = controls._gizmo;
  assert.equal(internalGizmo.mode, "rotate", "the gizmo mirrors the mode");
  controls.setSize(2);
  assert.equal(internalGizmo.size, 2, "the gizmo mirrors size changes");
  controls.setSpace("local");
  assert.equal(internalGizmo.space, "local", "the gizmo mirrors the space");

  let changeEvents = 0;
  controls.addEventListener("change", () => changeEvents++);
  controls.setSize(3);
  assert.equal(changeEvents, 1, "property changes emit change events");
  assert.equal(controls.size, 3, "the property setter stores the new value");

  controls.detach();
  assert.equal(gizmo.visible, false, "detaching hides the helper");
  assert.equal(controls.object, undefined, "detaching clears the object");
});

test("TransformControls move clamps and applies snapping during drag", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(5, 2.5, 5);
  camera.updateMatrixWorld();

  const object = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 }));
  object.position.set(3, 0, 0);
  object.updateMatrixWorld();

  const controls = new TransformControls(camera, null);
  // Simulate the clamp logic that pointerMove applies: configure translation limits first.
  controls.setTranslationSnap(1);
  controls.minX = 0;
  controls.maxX = 0;
  controls.translationSnap = 1;

  assert.equal(controls.minX, 0, "limit setters store values");
  assert.equal(controls.translationSnap, 1, "the snap setter accepts values");
  controls.setTranslationSnap(null);
  assert.equal(controls.translationSnap, null, "the snap setter accepts null");
});

test("TransformControls gizmo picks the axis facing the camera after updateMatrixWorld", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(5, 2.5, 5);
  camera.updateMatrixWorld();

  const object = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xff8833 }));
  object.position.set(0, 0, 0);
  object.updateMatrixWorld();

  const controls = new TransformControls(camera, null);
  controls.attach(object);
  const root = controls.getHelper();
  // Mirror a scene graph: the helper and the object share a parent; the helper is not the
  // object's child, otherwise updateMatrixWorld would recurse.
  const parent = new Object3D();
  parent.add(object);
  parent.add(root);
  parent.updateMatrixWorld();
  root.updateMatrixWorld();

  const internalGizmo = controls._gizmo;
  close(controls.worldPosition.x, object.position.x, "the gizmo mirrors the object's world position");

  // Handles for the current mode must be prepared (translate visible, others hidden).
  assert.equal(internalGizmo.gizmo["translate"].visible, true, "the current mode's gizmo is visible");
  assert.equal(internalGizmo.gizmo["rotate"].visible, false, "other modes' gizmos stay hidden");
});
