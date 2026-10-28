import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { BatchedMesh } from "../src/objects/BatchedMesh";
import { LOD } from "../src/objects/LOD";
import { Mesh } from "../src/objects/Mesh";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { BufferAttribute, Float32BufferAttribute } from "../src/core/BufferAttribute";
import { InterleavedBuffer } from "../src/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "../src/core/InterleavedBufferAttribute";
import { Object3D } from "../src/core/Object3D";
import { Raycaster } from "../src/core/Raycaster";
import type { Intersection } from "../src/core/Raycaster";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Color } from "../src/math/Color";
import { Vector3 } from "../src/math/Vector3";
import { Vector4 } from "../src/math/Vector4";
import { Box3 } from "../src/math/Box3";
import { Sphere } from "../src/math/Sphere";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { BatchedMesh as UpstreamBatch } from "../upstream/three.js/src/objects/BatchedMesh.js";
import { LOD as UpstreamLOD } from "../upstream/three.js/src/objects/LOD.js";
import { MeshBasicMaterial as UpstreamMaterial } from "../upstream/three.js/src/materials/MeshBasicMaterial.js";

function triangle(indexed = true, x = 0) {
  const geometry = new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute([x - 1, -1, 0, x + 1, -1, 0, x, 1, 0], 3),
  );
  if (indexed) geometry.setIndex([0, 1, 2]);
  return geometry;
}

function batches(count = 4, vertices = 24, indices = 24) {
  return [
    new BatchedMesh(count, vertices, indices, new MeshBasicMaterial()),
    // The untyped baseline's private fields are compared at runtime, not structurally across implementations.
    new UpstreamBatch(count, vertices, indices, new UpstreamMaterial()) as unknown as BatchedMesh,
  ] as const;
}

function storage(batch: BatchedMesh) {
  return {
    instances: batch.instanceCount,
    capacity: batch.maxInstanceCount,
    unusedVertices: batch.unusedVertexCount,
    unusedIndices: batch.unusedIndexCount,
    positions: Array.from((batch.geometry.attributes.position as BufferAttribute).array),
    indices: batch.geometry.index ? Array.from(batch.geometry.index.array) : null,
    ranges: batch._geometryInfo
      .filter((info) => info.active)
      .map(({ boundingBox: _box, boundingSphere: _sphere, ...range }) => range),
    matrices: Array.from(batch._matricesTexture!.image.data!),
    colors: batch._colorsTexture ? Array.from(batch._colorsTexture.image.data!) : null,
  };
}

function picks(object: Pick<BatchedMesh, "raycast">, x = 0) {
  const hits: Intersection[] = [];
  object.raycast(new Raycaster(new Vector3(x, 0, 5), new Vector3(0, 0, -1)), hits);
  return hits;
}

function hitData(hits: Intersection[]) {
  return hits.map((hit) => ({
    distance: hit.distance,
    point: hit.point.toArray(),
    batchId: hit.batchId,
    faceIndex: hit.faceIndex,
  }));
}

test("batch allocation, replacement, deletion, lowest-id reuse and compaction match upstream", () => {
  for (const indexed of [false, true]) {
    const [actual, expected] = batches();
    for (const batch of [actual, expected]) {
      const a = batch.addGeometry(triangle(indexed), 6, 6);
      const b = batch.addGeometry(triangle(indexed, 4), 3, 3);
      assert.equal(a, 0);
      assert.equal(b, 1);
      const ids = [batch.addInstance(a), batch.addInstance(b), batch.addInstance(a)];
      assert.deepEqual(ids, [0, 1, 2]);
      const range = {};
      assert.equal(batch.getGeometryRangeAt(a, range), range);
      assert.equal(batch.getGeometryRangeAt(a).vertexCount, 3);
      batch.setGeometryAt(a, triangle(indexed, 2));
      batch.setMatrixAt(2, new Matrix4().makeTranslation(1, 2, 3));
      batch.setColorAt(2, new Vector4(0.25, 0.5, 0.75, 0.125));
      batch.deleteInstance(2).deleteInstance(0);
      assert.equal(batch.addInstance(b), 0);
      assert.deepEqual(batch.getMatrixAt(0, new Matrix4()).elements, new Matrix4().elements);
      batch.deleteGeometry(a);
      assert.throws(() => batch.getGeometryRangeAt(a), /Invalid geometryId/);
      batch.optimize();
      assert.equal(batch.getGeometryRangeAt(b).vertexStart, 0);
      assert.equal(batch.addGeometry(triangle(indexed, -2)), a);
      assert.equal(batch.addInstance(a), 2);
      batch.setGeometryIdAt(0, a).setVisibleAt(0, false);
      assert.equal(batch.getGeometryIdAt(0), a);
      assert.equal(batch.getVisibleAt(0), false);
    }
    assert.deepEqual(storage(actual), storage(expected));
    actual.dispose();
    expected.dispose();
  }
});

test("batch capacity and geometry compatibility retain upstream validation and ignored extras", () => {
  for (const batch of batches(1, 6, 6)) {
    const id = batch.addGeometry(triangle(), 3, 3);
    batch.addInstance(id);
    assert.throws(() => batch.addInstance(id), /Maximum item count/);
    assert.throws(() => batch.addGeometry(triangle(), 4, 4), /maximum buffer size/);
    assert.throws(() => batch.setGeometryAt(9, triangle()), /Maximum geometry count/);
    const larger = triangle();
    larger.setAttribute("position", new Float32BufferAttribute(new Float32Array(12), 3));
    assert.throws(() => batch.setGeometryAt(id, larger), /Reserved space not large enough/);
    assert.throws(() => batch.setGeometryAt(id, triangle(false)), /consistently have "index"/);
    const missing = new BufferGeometry().setIndex([0, 1, 2]);
    assert.throws(() => batch.setGeometryAt(id, missing), /missing "position"/);
    for (const attr of [
      new Float32BufferAttribute(new Float32Array(6), 2),
      new Float32BufferAttribute(new Float32Array(9), 3, true),
    ]) {
      assert.throws(
        () => batch.setGeometryAt(id, triangle().setAttribute("position", attr)),
        /inconsistent itemSize or normalized/,
      );
    }
    const extra = triangle().setAttribute("unused", new Float32BufferAttribute([1, 2, 3], 1));
    batch.setGeometryAt(id, extra);
    assert.equal(batch.geometry.hasAttribute("unused"), false);
    assert.throws(() => batch.setGeometryIdAt(0, 8), /Invalid geometryId/);
    assert.throws(() => batch.getVisibleAt(-1), /Invalid instanceId/);
    batch.deleteInstance(0);
    assert.throws(() => batch.deleteInstance(0), /Invalid instanceId/);
    batch.dispose();
  }
  assert.throws(() => Reflect.construct(BatchedMesh, [1, 3]), /explicit/);
  const defaultIndices = new BatchedMesh(1, 3, undefined, new MeshBasicMaterial());
  assert.equal(defaultIndices.unusedIndexCount, 6);
  defaultIndices.dispose();
});

test("batch CPU attribute copies handle interleaving, numeric conversion and reserved padding", () => {
  const [actual, expected] = batches();
  const interleaved = triangle();
  interleaved.setAttribute(
    "position",
    new InterleavedBufferAttribute(
      new InterleavedBuffer(new Float32Array([-2, -2, 0, 99, 2, -2, 0, 99, 0, 2, 0, 99]), 4),
      3,
      0,
    ),
  );
  const converted = triangle();
  converted.setAttribute("position", new BufferAttribute(new Float64Array([-3, -3, 0, 3, -3, 0, 0, 3, 0]), 3));
  for (const batch of [actual, expected]) {
    const id = batch.addGeometry(triangle(), 6, 6);
    batch.setGeometryAt(id, interleaved);
    assert.deepEqual(
      Array.from((batch.geometry.attributes.position as BufferAttribute).array.slice(0, 9)),
      [-2, -2, 0, 2, -2, 0, 0, 2, 0],
    );
    batch.setGeometryAt(id, converted);
    assert.deepEqual(
      Array.from((batch.geometry.attributes.position as BufferAttribute).array.slice(9, 18)),
      Array(9).fill(0),
    );
    assert.deepEqual(Array.from(batch.geometry.index!.array.slice(0, 6)), [0, 1, 2, 0, 0, 0]);
    assert.ok((batch.geometry.attributes.position as BufferAttribute).updateRanges.length > 0);
  }
  assert.deepEqual(storage(actual), storage(expected));
  actual.dispose();
  expected.dispose();
});

test("batch resize preserves instance data, enforces live ranges and promotes index storage", () => {
  const [actual, expected] = batches();
  for (const batch of [actual, expected]) {
    const id = batch.addGeometry(triangle());
    batch.addInstance(id);
    batch.addInstance(id);
    batch.setMatrixAt(0, new Matrix4().makeTranslation(4, 5, 6));
    batch.setColorAt(0, new Vector4(0.5, 0.25, 0.75, 0.125));
    assert.throws(() => batch.setInstanceCount(1), /Cannot shrink instance count/);
    batch.deleteInstance(1);
    batch.setInstanceCount(1);
    assert.equal(batch.maxInstanceCount, 1);
    batch.setInstanceCount(8);
    assert.equal(batch.addInstance(id), 1);
    assert.throws(() => batch.setGeometrySize(2, 3), /Cannot shrink further/);
    assert.throws(() => batch.setGeometrySize(3, 2), /Cannot shrink further/);
    batch.setGeometrySize(65536, 12);
    assert.ok(batch.geometry.index!.array instanceof Uint32Array);
    batch.setGeometrySize(3, 3);
    assert.ok(batch.geometry.index!.array instanceof Uint16Array);
    assert.deepEqual(batch.getMatrixAt(0, new Matrix4()).elements.slice(12, 15), [4, 5, 6]);
    assert.deepEqual(batch.getColorAt(0, new Vector4()).toArray(), [0.5, 0.25, 0.75, 0.125]);
  }
  assert.deepEqual(storage(actual), storage(expected));
  actual.dispose();
  expected.dispose();
});

test("batch per-geometry and aggregate bounds and picking match upstream across visibility and replacement", () => {
  for (const indexed of [false, true]) {
    const [actual, expected] = batches();
    for (const batch of [actual, expected]) {
      const id = batch.addGeometry(triangle(indexed));
      batch.addInstance(id);
      batch.addInstance(id);
      batch.setMatrixAt(1, new Matrix4().makeTranslation(4, 0, 0));
      batch.setVisibleAt(1, false);
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      assert.equal(batch.boundingBox!.max.x, 5); // Invisible but active instances still contribute.
      assert.equal(batch.getBoundingBoxAt(99, new Box3()), null);
      assert.equal(batch.getBoundingSphereAt(99, new Sphere()), null);
      batch.updateMatrixWorld(true);
    }
    assert.deepEqual(actual.boundingBox!.min.toArray(), expected.boundingBox!.min.toArray());
    assert.equal(actual.boundingSphere!.radius, expected.boundingSphere!.radius);
    assert.deepEqual(hitData(picks(actual)), hitData(picks(expected)));
    assert.equal(picks(actual)[0].batchId, 0);
    assert.equal(picks(actual)[0].object, actual);
    assert.equal(picks(actual, 4).length, 0);
    for (const batch of [actual, expected]) {
      batch.setVisibleAt(1, true);
      batch.setGeometryAt(0, triangle(indexed, 1));
      batch.computeBoundingBox();
    }
    assert.deepEqual(hitData(picks(actual, 5)), hitData(picks(expected, 5)));
    assert.equal(picks(actual, 5)[0].batchId, 1);
    actual.dispose();
    expected.dispose();
  }
});

test("batch clone isolates all owned storage, preserves subtype, sorting and recursive control", () => {
  class Cluster extends BatchedMesh {}
  const material = new MeshBasicMaterial();
  const source = new Cluster(2, 6, 6, material);
  const id = source.addGeometry(triangle());
  source.addInstance(id);
  source.setMatrixAt(0, new Matrix4().makeTranslation(1, 2, 3));
  source.setColorAt(0, new Vector4(0.5, 0.25, 0.75, 0.125));
  source.setCustomSort((list) => list.reverse());
  source.computeBoundingBox();
  source.computeBoundingSphere();
  source.add(new Object3D());
  const clone = source.clone();
  assert.ok(clone instanceof Cluster);
  assert.equal(clone.material, material);
  assert.equal(clone.customSort, source.customSort);
  assert.notEqual(clone.children[0], source.children[0]);
  assert.notEqual(clone.geometry, source.geometry);
  assert.notEqual(
    (clone.geometry.attributes.position as BufferAttribute).array.buffer,
    (source.geometry.attributes.position as BufferAttribute).array.buffer,
  );
  assert.notEqual(clone.boundingBox, source.boundingBox);
  assert.notEqual(clone.boundingSphere, source.boundingSphere);
  for (const name of ["_matricesTexture", "_indirectTexture", "_colorsTexture"] as const) {
    const original = source[name]!;
    const copied = clone[name]!;
    assert.notEqual(copied, original);
    assert.notEqual(copied.source, original.source);
    assert.notEqual(copied.image, original.image);
    assert.notEqual(copied.image.data!.buffer, original.image.data!.buffer);
    assert.deepEqual(copied.image.data, original.image.data);
  }
  clone.setMatrixAt(0, new Matrix4().makeTranslation(9, 8, 7));
  clone.setColorAt(0, new Color(1, 0, 0));
  clone._indirectTexture!.image.data![0] = 1;
  assert.equal(source.getMatrixAt(0, new Matrix4()).elements[12], 1);
  assert.deepEqual(source.getColorAt(0, new Vector4()).toArray(), [0.5, 0.25, 0.75, 0.125]);
  assert.equal(source._indirectTexture!.image.data![0], 0);
  const shallow = source.clone(false);
  assert.equal(shallow.children.length, 0);
  const replacement = new BatchedMesh(1, 3, 3, material);
  replacement.copy(source, false);
  assert.deepEqual(storage(replacement), storage(source));
  const uncolored = new BatchedMesh(1, 3, 3, material);
  replacement.copy(uncolored, false);
  assert.equal(replacement._colorsTexture, null);
  clone.dispose();
  shallow.dispose();
  replacement.dispose();
  uncolored.dispose();
  source.dispose();
});

test("batch disposal and resizing release only owned resources", () => {
  const geometry = triangle();
  const material = new MeshBasicMaterial();
  const batch = new BatchedMesh(2, 6, 6, material);
  batch.addInstance(batch.addGeometry(geometry));
  batch.setColorAt(0, new Color(1, 0, 0));
  let external = 0;
  geometry.addEventListener("dispose", () => external++);
  material.addEventListener("dispose", () => external++);
  let owned = 0;
  for (const resource of [batch.geometry, batch._matricesTexture!, batch._indirectTexture!, batch._colorsTexture!])
    resource.addEventListener("dispose", () => owned++);
  batch.setInstanceCount(4);
  assert.equal(owned, 3);
  batch.setGeometrySize(12, 12);
  assert.equal(owned, 4);
  let terminal = 0;
  for (const resource of [
    batch,
    batch.geometry,
    batch._matricesTexture!,
    batch._indirectTexture!,
    batch._colorsTexture!,
  ])
    resource.addEventListener("dispose", () => terminal++);
  batch.dispose();
  assert.equal(terminal, 5);
  assert.equal(external, 0);
  assert.equal(batch._matricesTexture, null);
  assert.equal(batch._indirectTexture, null);
  assert.equal(batch._colorsTexture, null);
});

test("LOD sorts absolute distances stably, removes levels and matches upstream hysteresis and zoom", () => {
  const actual = new LOD();
  const expected = new UpstreamLOD() as unknown as LOD;
  for (const lod of [actual, expected]) {
    for (const distance of [20, 0, -10, 10]) {
      const object = new Object3D();
      object.name = `level-${lod.levels.length}`;
      lod.addLevel(object, distance, 0.2);
    }
    assert.deepEqual(
      lod.levels.map((level) => level.distance),
      [0, 10, 10, 20],
    );
    assert.deepEqual(
      lod.levels.map((level) => level.object.name),
      ["level-1", "level-2", "level-3", "level-0"],
    );
    assert.equal(lod.removeLevel(-10), false);
    const removed = lod.levels[1].object;
    assert.equal(lod.removeLevel(10), true);
    assert.equal(removed.parent, null);
    lod.updateMatrixWorld(true);
  }
  for (const camera of [new PerspectiveCamera(), new OrthographicCamera()]) {
    for (const [distance, zoom] of [
      [0, 1],
      [10, 1],
      [9, 1],
      [8, 1],
      [7.9, 1],
      [20, 1],
      [17, 1],
      [15.9, 1],
      [30, 2],
    ]) {
      camera.position.z = distance;
      camera.zoom = zoom;
      camera.updateMatrixWorld(true);
      actual.update(camera);
      expected.update(camera);
      assert.equal(actual.getCurrentLevel(), expected.getCurrentLevel());
      assert.deepEqual(
        actual.levels.map((level) => level.object.visible),
        expected.levels.map((level) => level.object.visible),
      );
      assert.equal(actual.getObjectForDistance(distance)?.name, expected.getObjectForDistance(distance)?.name);
    }
  }
  actual.autoUpdate = false;
  const camera = new PerspectiveCamera();
  camera.position.z = 100;
  camera.updateMatrixWorld(true);
  actual.update(camera); // autoUpdate gates renderer calls, not explicit updates.
  assert.equal(actual.getCurrentLevel(), 2);
  assert.equal(new LOD().getObjectForDistance(1), null);
});

test("LOD cloning and serialization retain levels, hysteresis and autoUpdate", () => {
  class Detail extends LOD {}
  const lod = new Detail();
  lod.autoUpdate = false;
  lod.addLevel(new Mesh(triangle(), new MeshBasicMaterial()), 0);
  lod.addLevel(new Mesh(triangle(), new MeshBasicMaterial()), 10, 0.15);
  const clone = lod.clone();
  assert.ok(clone instanceof Detail);
  assert.equal(clone.autoUpdate, false);
  assert.equal(clone.levels.length, 2);
  assert.equal(clone.children.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.notEqual(clone.levels[i].object, lod.levels[i].object);
    assert.equal(clone.levels[i].object.parent, clone);
    assert.equal(clone.levels[i].distance, lod.levels[i].distance);
    assert.equal(clone.levels[i].hysteresis, lod.levels[i].hysteresis);
  }
  const json = lod.toJSON();
  assert.equal(json.object.autoUpdate, false);
  assert.deepEqual(
    json.object.levels,
    lod.levels.map((level) => ({ object: level.object.uuid, distance: level.distance, hysteresis: level.hysteresis })),
  );
  assert.equal(json.object.children.length, 2);
});

test("LOD picking delegates only to the distance-selected level and preserves its object identity", () => {
  for (const lod of [new LOD(), new UpstreamLOD() as unknown as LOD]) {
    assert.equal(picks(lod).length, 0);
    const near = new Mesh(triangle(), new MeshBasicMaterial());
    const far = new Mesh(triangle(), new MeshBasicMaterial());
    lod.addLevel(near, 0).addLevel(far, 4, 0.25);
    lod.updateMatrixWorld(true);
    const hits = picks(lod);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].object, far);
    assert.equal(hits[0].batchId, undefined);
    const closeHits: Intersection[] = [];
    lod.raycast(new Raycaster(new Vector3(0, 0, 2), new Vector3(0, 0, -1)), closeHits);
    assert.equal(closeHits[0].object, near);
  }
});

test("batch draw preparation sorts, culls, honors custom sorting and updates visibility without sorting", () => {
  const [actual, expected] = batches();
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld(true);
  for (const batch of [actual, expected]) {
    const geometryId = batch.addGeometry(triangle());
    for (const z of [-2, -5, -9]) {
      const id = batch.addInstance(geometryId);
      batch.setMatrixAt(id, new Matrix4().makeTranslation(0, 0, z));
    }
    const material = new MeshBasicMaterial();
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.deepEqual(Array.from(batch._indirectTexture!.image.data!.slice(0, 3)), [0, 1, 2]);
    material.transparent = true;
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.deepEqual(Array.from(batch._indirectTexture!.image.data!.slice(0, 3)), [2, 1, 0]);
    batch.setCustomSort(function (list, sortCamera) {
      assert.equal(this, batch);
      assert.equal(sortCamera, camera);
      assert.deepEqual(
        list.map((item) => item.z),
        [2, 5, 9],
      );
      list.sort((a, b) => b.index - a.index);
    });
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.equal(batch._multiDrawCount, 3);
    assert.deepEqual(Array.from(batch._multiDrawCounts.slice(0, 3)), [3, 3, 3]);
    batch.setCustomSort(null);
    batch.setMatrixAt(1, new Matrix4().makeTranslation(1000, 0, -5));
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.equal(batch._multiDrawCount, 2);
    batch.perObjectFrustumCulled = false;
    batch.sortObjects = false;
    batch.setVisibleAt(2, false);
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.deepEqual(Array.from(batch._indirectTexture!.image.data!.slice(0, 2)), [0, 1]);
    assert.equal(batch._multiDrawCount, 2);
    const version = batch._indirectTexture!.version;
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.equal(batch._indirectTexture!.version, version);
    batch.setVisibleAt(2, true);
    material.wireframe = true;
    batch._updateDrawParameters(camera, batch.geometry, material);
    assert.deepEqual(Array.from(batch._multiDrawCounts.slice(0, 3)), [6, 6, 6]);
  }
  assert.deepEqual(storage(actual), storage(expected));
  actual.dispose();
  expected.dispose();
});

test("batch colors default to white and preserve upstream Color versus Vector4 alpha semantics", () => {
  for (const batch of batches()) {
    const id = batch.addInstance(batch.addGeometry(triangle()));
    assert.deepEqual(batch.getColorAt(id, new Color()).toArray(), [1, 1, 1]);
    assert.deepEqual(batch.getColorAt(id, new Vector4()).toArray(), [1, 1, 1, 1]);
    batch.setColorAt(id, new Vector4(0.5, 0.25, 0.75, 0.125));
    batch.setColorAt(id, new Color(1, 0, 0));
    assert.deepEqual(batch.getColorAt(id, new Vector4()).toArray(), [1, 0, 0, 0.125]);
    batch.deleteInstance(id);
    assert.equal(batch.addInstance(0), id);
    // Upstream resets RGB on reused IDs, but leaves the prior alpha intact.
    assert.deepEqual(batch.getColorAt(id, new Vector4()).toArray(), [1, 1, 1, 0.125]);
    batch.dispose();
  }
});

test("batch raycast proxy releases borrowed resources and partial results after exceptions", () => {
  const batch = new BatchedMesh(1, 3, 3, new MeshBasicMaterial());
  batch.addInstance(batch.addGeometry(triangle()));
  const proxies: Mesh[] = [];
  const raycast = vi.spyOn(Mesh.prototype, "raycast").mockImplementation(function (this: Mesh, _raycaster, intersects) {
    proxies.push(this);
    intersects.push({ distance: 1, point: new Vector3(), object: this });
    throw new Error("raycast failed");
  });
  try {
    assert.throws(() => picks(batch), /raycast failed/);
  } finally {
    raycast.mockRestore();
  }
  const [proxy] = proxies;
  assert.ok(proxy);
  assert.equal(proxy.material, undefined);
  assert.equal(proxy.geometry.index, null);
  assert.deepEqual(proxy.geometry.attributes, {});
  assert.deepEqual(proxy.geometry.drawRange, { start: 0, count: Infinity });
  assert.equal(picks(batch).length, 1);
  batch.dispose();
});

test("batch replacement textures are uploadable after growth and clone even on the no-sort fast path", () => {
  const batch = new BatchedMesh(1, 3, 3, new MeshBasicMaterial());
  batch.addInstance(batch.addGeometry(triangle()));
  batch.setColorAt(0, new Vector4(1, 0, 0, 0.5));
  batch.perObjectFrustumCulled = false;
  batch.sortObjects = false;
  const camera = new PerspectiveCamera();
  const material = new MeshBasicMaterial();
  batch._updateDrawParameters(camera, batch.geometry, material);
  const oldTextures = [batch._matricesTexture, batch._indirectTexture, batch._colorsTexture];
  batch.setInstanceCount(8);
  const replacementTextures = [batch._matricesTexture!, batch._indirectTexture!, batch._colorsTexture!];
  replacementTextures.forEach((texture, index) => {
    assert.notEqual(texture, oldTextures[index]);
    assert.ok(texture.version > 0);
    assert.ok(texture.source.version > 0);
  });
  const versions = replacementTextures.map((texture) => texture.version);
  batch._updateDrawParameters(camera, batch.geometry, material);
  assert.deepEqual(
    replacementTextures.map((texture) => texture.version),
    versions,
  );
  const clone = batch.clone();
  for (const texture of [clone._matricesTexture!, clone._indirectTexture!, clone._colorsTexture!]) {
    assert.ok(texture.version > 0);
    assert.ok(texture.source.version > 0);
  }
  assert.deepEqual(batch.getMatrixAt(0, new Matrix4()).elements, new Matrix4().elements);
  assert.deepEqual(batch.getColorAt(0, new Vector4()).toArray(), [1, 0, 0, 0.5]);
  clone.dispose();
  batch.dispose();
});
