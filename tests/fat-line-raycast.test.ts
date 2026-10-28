import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { LineMaterial } from "../src/addons/lines/LineMaterial";
import { LineSegments2 } from "../src/addons/lines/LineSegments2";
import { LineSegmentsGeometry } from "../src/addons/lines/LineSegmentsGeometry";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { Raycaster } from "../src/core/Raycaster";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";

test("fat lines accumulate segment distances and raycast world-unit widths", () => {
  const geometry = new LineSegmentsGeometry().setPositions([-1, 0, -5, 1, 0, -5, 1, 0, -5, 1, 3, -5]);
  const material = new LineMaterial({ worldUnits: true, linewidth: 1 });
  const line = new LineSegments2(geometry, material).computeLineDistances();
  const start = geometry.getAttribute("instanceDistanceStart") as InterleavedBufferAttribute;
  const end = geometry.getAttribute("instanceDistanceEnd") as InterleavedBufferAttribute;
  assert.deepEqual([start.getX(0), end.getX(0), start.getX(1), end.getX(1)], [0, 2, 2, 5]);
  line.updateMatrixWorld();
  const raycaster = new Raycaster(new Vector3(0, 0.4, 0), new Vector3(0, 0, -1));
  const hits = raycaster.intersectObject(line);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].faceIndex, 0);
  assert.ok(hits[0].pointOnLine!.distanceTo(new Vector3(0, 0, -5)) < 1e-7);
  raycaster.ray.origin.y = 0.6;
  assert.equal(raycaster.intersectObject(line).length, 0);
  raycaster.params.Line2 = { threshold: 0.3 };
  assert.equal(raycaster.intersectObject(line).length, 1);
  geometry.instanceCount = 0;
  assert.equal(raycaster.intersectObject(line).length, 0);
});

test("screen-space fat lines respect pixel width and camera near clipping", () => {
  const geometry = new LineSegmentsGeometry().setPositions([-1, 0, -5, 1, 0, -5]);
  const material = new LineMaterial({ linewidth: 10 });
  material.resolution.set(100, 100);
  const line = new LineSegments2(geometry, material);
  line.updateMatrixWorld();
  const camera = new PerspectiveCamera(90, 1, 1, 100);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0.08), camera);
  assert.equal(raycaster.intersectObject(line).length, 1);
  raycaster.setFromCamera(new Vector2(0, 0.12), camera);
  assert.equal(raycaster.intersectObject(line).length, 0);
  geometry.setPositions([-1, 0, -0.5, 1, 0, -0.5]);
  raycaster.setFromCamera(new Vector2(), camera);
  assert.equal(raycaster.intersectObject(line).length, 0);
});
