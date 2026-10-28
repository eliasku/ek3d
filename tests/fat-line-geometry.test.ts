import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { LineGeometry } from "../src/addons/lines/LineGeometry";
import { LineSegmentsGeometry } from "../src/addons/lines/LineSegmentsGeometry";
import { WireframeGeometry2 } from "../src/addons/lines/WireframeGeometry2";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { EdgesGeometry } from "../src/geometries/EdgesGeometry";
import { WireframeGeometry } from "../src/geometries/WireframeGeometry";
import { LineBasicMaterial } from "../src/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { Line } from "../src/objects/Line";
import { LineSegments } from "../src/objects/LineSegments";
import { Mesh } from "../src/objects/Mesh";

function data(geometry: LineSegmentsGeometry, name: string): InterleavedBufferAttribute {
  const attribute = geometry.getAttribute(name);
  assert.ok(attribute instanceof InterleavedBufferAttribute);
  return attribute;
}

test("segment geometry shares instanced buffers and updates bounds on transform", () => {
  const geometry = new LineSegmentsGeometry();
  const positions = new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0]);
  assert.equal(geometry.setPositions(positions), geometry);
  const start = data(geometry, "instanceStart");
  const end = data(geometry, "instanceEnd");
  assert.equal(start.data, end.data);
  assert.equal(start.array, positions);
  assert.equal(geometry.instanceCount, 2);
  assert.deepEqual(geometry.boundingBox?.min.toArray(), [0, 0, 0]);
  assert.deepEqual(geometry.boundingBox?.max.toArray(), [2, 2, 0]);
  assert.deepEqual(geometry.boundingSphere?.center.toArray(), [1, 1, 0]);
  assert.equal(geometry.boundingSphere?.radius, Math.sqrt(2));
  geometry.setColors([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
  assert.equal(data(geometry, "instanceColorStart").data, data(geometry, "instanceColorEnd").data);
  const version = start.data.version;
  geometry.applyMatrix4(new Matrix4().makeTranslation(3, -1, 2));
  assert.equal(start.data.version, version + 1);
  assert.deepEqual(Array.from(positions), [3, -1, 2, 5, -1, 2, 5, 1, 2, 3, 1, 2]);
  assert.deepEqual(geometry.boundingBox?.min.toArray(), [3, -1, 2]);
  assert.deepEqual(geometry.boundingSphere?.center.toArray(), [4, 0, 2]);
  assert.equal(geometry.boundingSphere?.radius, Math.sqrt(2));
  const json = geometry.toJSON();
  assert.equal(json.instanceCount, 2);
  assert.equal(json.data.attributes.instanceStart.data, json.data.attributes.instanceEnd.data);
  assert.equal(json.data.attributes.instanceStart.offset, 0);
  assert.equal(json.data.attributes.instanceEnd.offset, 3);
  const buffer = json.data.interleavedBuffers[json.data.attributes.instanceStart.data];
  assert.equal(buffer.stride, 6);
  assert.equal(buffer.isInstancedInterleavedBuffer, true);
  assert.deepEqual(json.data.arrayBuffers[buffer.buffer], Array.from(new Uint32Array(positions.buffer)));
});

test("polyline positions, colors and points expand into adjacent pairs", () => {
  const geometry = new LineGeometry();
  geometry.setPositions([0, 0, 0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Array.from(data(geometry, "instanceStart").array), [0, 0, 0, 1, 2, 3, 1, 2, 3, 4, 5, 6]);
  geometry.setColors(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  assert.deepEqual(Array.from(data(geometry, "instanceColorStart").array), [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]);
  geometry.setFromPoints([new Vector2(1, 2), new Vector3(3, 4, 5), new Vector2(6, 7)]);
  assert.deepEqual(Array.from(data(geometry, "instanceStart").array), [1, 2, 0, 3, 4, 5, 3, 4, 5, 6, 7, 0]);
  assert.equal(geometry.instanceCount, 2);
});

test("geometry source conversions preserve non-indexed positions and wireframe edges", () => {
  const source = new BufferGeometry();
  source.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const lineMaterial = new LineBasicMaterial();
  const meshMaterial = new MeshBasicMaterial();
  const line = new Line(source, lineMaterial);
  const segments = new LineSegments(source, lineMaterial);
  const mesh = new Mesh(source, meshMaterial);
  const wire = new WireframeGeometry(source);
  const edges = new EdgesGeometry(source);
  const segmentGeometry = new LineSegmentsGeometry();
  assert.equal(segmentGeometry.fromLineSegments(segments), segmentGeometry);
  assert.equal(
    data(segmentGeometry, "instanceStart").array,
    (source.getAttribute("position") as Float32BufferAttribute).array,
  );
  const lineGeometry = new LineGeometry().fromLine(line);
  assert.deepEqual(Array.from(data(lineGeometry, "instanceStart").array), [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]);
  segmentGeometry.fromWireframeGeometry(wire);
  assert.equal(segmentGeometry.instanceCount, 3);
  const expected = Array.from(data(segmentGeometry, "instanceStart").array);
  segmentGeometry.fromMesh(mesh);
  assert.deepEqual(Array.from(data(segmentGeometry, "instanceStart").array), expected);
  segmentGeometry.fromEdgesGeometry(edges);
  assert.equal(segmentGeometry.instanceCount, 3);
  const fatWire = new WireframeGeometry2(source);
  assert.deepEqual(Array.from(data(fatWire, "instanceStart").array), expected);
});
