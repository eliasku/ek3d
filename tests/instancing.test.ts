import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { InstancedMesh } from "../src/objects/InstancedMesh";
import { Mesh } from "../src/objects/Mesh";
import { Object3D } from "../src/core/Object3D";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { InstancedBufferAttribute } from "../src/core/InstancedBufferAttribute";
import { Raycaster } from "../src/core/Raycaster";
import type { Intersection } from "../src/core/Raycaster";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Color } from "../src/math/Color";
import { Vector3 } from "../src/math/Vector3";
import { Frustum } from "../src/math/Frustum";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { DynamicDrawUsage, FloatType, RedFormat } from "../src/constants";
import { InstancedMesh as UpstreamInstancedMesh } from "../upstream/three.js/src/objects/InstancedMesh.js";
import { Mesh as UpstreamMesh } from "../upstream/three.js/src/objects/Mesh.js";
import { BufferGeometry as UpstreamGeometry } from "../upstream/three.js/src/core/BufferGeometry.js";
import { Float32BufferAttribute as UpstreamAttribute } from "../upstream/three.js/src/core/BufferAttribute.js";
import { BoxGeometry as UpstreamBox } from "../upstream/three.js/src/geometries/BoxGeometry.js";
import { MeshBasicMaterial as UpstreamMaterial } from "../upstream/three.js/src/materials/MeshBasicMaterial.js";

function pair(count: number) {
  return [
    new InstancedMesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial(), count),
    new UpstreamInstancedMesh(new UpstreamBox(2, 2, 2), new UpstreamMaterial(), count),
  ] as const;
}

function snapshot(hits: Intersection[]) {
  return hits.map((hit) => ({
    distance: hit.distance,
    point: hit.point.toArray(),
    instanceId: hit.instanceId,
    faceIndex: hit.faceIndex,
    materialIndex: hit.face?.materialIndex,
    uv: hit.uv?.toArray(),
    normal: hit.normal?.toArray(),
  }));
}

function upstreamHits(object: Pick<InstancedMesh, "raycast">, ray: Raycaster) {
  const hits: Intersection[] = [];
  object.raycast(ray, hits);
  return snapshot(hits.sort((a, b) => a.distance - b.distance));
}

function rayAt(x: number, y = 0) {
  return new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1));
}

test("consecutive instanced picks ignore morph rows without leaking proxy morph state between geometries", () => {
  const positions = [-1, -1, 0, 1, -1, 0, 0, 1, 0];
  for (const targetCount of [1, 2, 0]) {
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3));
    const reference = new UpstreamGeometry().setAttribute("position", new UpstreamAttribute(positions, 3));
    geometry.morphAttributes.position = Array.from(
      { length: targetCount },
      () =>
        new Float32BufferAttribute(
          positions.map((value, index) => (index % 3 === 0 ? value + 100 : value)),
          3,
        ),
    );
    Object.assign(reference.morphAttributes, {
      position: Array.from(
        { length: targetCount },
        () =>
          new UpstreamAttribute(
            positions.map((value, index) => (index % 3 === 0 ? value + 100 : value)),
            3,
          ),
      ),
    });
    const actual = new InstancedMesh(geometry, new MeshBasicMaterial(), 1);
    const expected = new UpstreamInstancedMesh(reference, new UpstreamMaterial(), 1);
    if (targetCount > 0) {
      const source = Object.assign(new Mesh(geometry, actual.material), {
        morphTargetInfluences: Array.from({ length: targetCount }, () => 1 / targetCount),
      });
      actual.setMorphAt(0, source);
      const referenceSource = new UpstreamMesh(reference, expected.material);
      referenceSource.morphTargetInfluences = source.morphTargetInfluences;
      expected.setMorphAt(0, referenceSource);
    }
    const hits = rayAt(0).intersectObject(actual);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].instanceId, 0);
    assert.deepEqual(snapshot(hits), upstreamHits(expected, rayAt(0)));
  }
});

test("instance matrices and lazy colors retain capacity and require explicit upload invalidation", () => {
  const [actual, expected] = pair(3);
  assert.ok(actual instanceof Mesh);
  assert.equal(actual.isInstancedMesh, true);
  assert.ok(actual.instanceMatrix instanceof InstancedBufferAttribute);
  assert.equal(actual.instanceMatrix.itemSize, 16);
  assert.equal(actual.instanceMatrix.count, 3);
  assert.equal(actual.instanceColor, null);
  const matrix = new Matrix4();
  const color = new Color(0, 0, 0);
  for (let i = 0; i < 3; i++) {
    assert.equal(actual.getMatrixAt(i, matrix), matrix);
    assert.deepEqual(matrix.elements, new Matrix4().elements);
    assert.equal(actual.getColorAt(i, color), color);
    assert.deepEqual(color.toArray(), [1, 1, 1]);
  }
  actual.count = expected.count = 1;
  const transform = new Matrix4()
    .makeRotationZ(Math.PI / 3)
    .scale(new Vector3(2, 3, 0.5))
    .setPosition(4, -2, 1);
  const tint = new Color(0.125, 0.5, 0.75);
  assert.equal(actual.setMatrixAt(2, transform), actual);
  assert.equal(actual.setColorAt(2, tint), actual);
  expected.setMatrixAt(2, transform);
  expected.setColorAt(2, tint);
  assert.deepEqual(actual.instanceMatrix.array, expected.instanceMatrix.array);
  assert.deepEqual(actual.instanceColor!.array, expected.instanceColor!.array);
  assert.equal(actual.instanceColor!.count, 3);
  assert.deepEqual(actual.getColorAt(0, color).toArray(), [1, 1, 1]);
  assert.deepEqual(actual.getColorAt(2, color).toArray(), tint.toArray());
  assert.deepEqual(actual.getMatrixAt(2, matrix).elements, expected.getMatrixAt(2, new Matrix4()).elements);
  assert.equal(actual.instanceMatrix.version, 0);
  assert.equal(actual.instanceColor!.version, 0);
  actual.instanceMatrix.setUsage(DynamicDrawUsage).addUpdateRange(32, 16);
  actual.instanceColor!.addUpdateRange(6, 3);
  actual.instanceMatrix.needsUpdate = true;
  actual.instanceColor!.needsUpdate = true;
  assert.equal(actual.instanceMatrix.version, 1);
  assert.equal(actual.instanceColor!.version, 1);
  assert.deepEqual(actual.instanceMatrix.updateRanges, [{ start: 32, count: 16 }]);
  assert.deepEqual(actual.instanceColor!.updateRanges, [{ start: 6, count: 3 }]);
});

test("bounds union transformed active instances, including empty counts, without modifying geometry bounds", () => {
  const [actual, expected] = pair(3);
  const transforms = [
    new Matrix4().makeScale(2, 1, 0.5).setPosition(-4, 2, 0),
    new Matrix4().makeRotationZ(Math.PI / 4).setPosition(3, -1, 2),
    new Matrix4().makeTranslation(100, 0, 0),
  ];
  transforms.forEach((matrix, i) => {
    actual.setMatrixAt(i, matrix);
    expected.setMatrixAt(i, matrix);
  });
  for (const count of [3, 2, 1, 0, 3]) {
    actual.count = expected.count = count;
    actual.computeBoundingBox();
    actual.computeBoundingSphere();
    expected.computeBoundingBox();
    expected.computeBoundingSphere();
    assert.deepEqual(actual.boundingBox!.min.toArray(), expected.boundingBox!.min.toArray());
    assert.deepEqual(actual.boundingBox!.max.toArray(), expected.boundingBox!.max.toArray());
    assert.deepEqual(actual.boundingSphere!.center.toArray(), expected.boundingSphere!.center.toArray());
    assert.equal(actual.boundingSphere!.radius, expected.boundingSphere!.radius);
    assert.equal(actual.boundingBox!.isEmpty(), count === 0);
    assert.equal(actual.boundingSphere!.isEmpty(), count === 0);
    if (count === 1) {
      assert.deepEqual(actual.boundingBox!.min.toArray(), [-6, 1, -0.5]);
      assert.deepEqual(actual.boundingBox!.max.toArray(), [-2, 3, 0.5]);
    }
  }
  assert.deepEqual(actual.geometry.boundingBox!.min.toArray(), [-1, -1, -1]);
  assert.deepEqual(actual.geometry.boundingBox!.max.toArray(), [1, 1, 1]);
  const empty = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 0);
  empty.computeBoundingBox();
  empty.computeBoundingSphere();
  assert.equal(empty.instanceMatrix.count, 0);
  assert.equal(empty.boundingBox!.isEmpty(), true);
  assert.equal(empty.boundingSphere!.isEmpty(), true);
  assert.deepEqual(rayAt(0).intersectObject(empty), []);
});

test("frustum and picking use instance bounds and require recomputation after matrix changes", () => {
  const [actual, expected] = pair(1);
  const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 20);
  camera.position.z = 10;
  camera.updateMatrixWorld(true);
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  assert.equal(actual.boundingSphere, null);
  assert.equal(frustum.intersectsObject(actual), true);
  assert.ok(actual.boundingSphere);
  expected.computeBoundingSphere();
  actual.computeBoundingBox();
  const oldBox = actual.boundingBox!.clone();
  for (const object of [actual, expected]) object.setMatrixAt(0, new Matrix4().makeTranslation(30, 0, 0));
  assert.deepEqual(actual.boundingBox, oldBox);
  assert.equal(frustum.intersectsObject(actual), true);
  assert.deepEqual(rayAt(30, 0.2).intersectObject(actual), []);
  actual.computeBoundingBox();
  actual.computeBoundingSphere();
  expected.computeBoundingSphere();
  assert.equal(frustum.intersectsObject(actual), false);
  assert.ok(rayAt(30, 0.2).intersectObject(actual).length > 0);
  assert.deepEqual(snapshot(rayAt(30, 0.2).intersectObject(actual)), upstreamHits(expected, rayAt(30, 0.2)));
  actual.position.x = -30;
  actual.updateMatrixWorld(true);
  assert.equal(frustum.intersectsObject(actual), true);
  assert.ok(rayAt(0, 0.2).intersectObject(actual).length > 0);
});

test("instance picks preserve IDs, world transforms, sorting, active count, clipping, layers and recursion", () => {
  const positions = [-1, -1, 0, 1, -1, 0, 0, 1, 0];
  const actual = new InstancedMesh(
    new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3)),
    new MeshBasicMaterial(),
    3,
  );
  const expected = new UpstreamInstancedMesh(
    new UpstreamGeometry().setAttribute("position", new UpstreamAttribute(positions, 3)),
    new UpstreamMaterial(),
    3,
  );
  const root = new Object3D();
  root.position.set(4, -2, 1);
  root.rotation.z = Math.PI / 2;
  root.add(actual);
  actual.scale.set(2, 3, 2);
  actual.position.z = 1;
  root.updateMatrixWorld(true);
  expected.matrixWorld.copy(actual.matrixWorld);
  for (const [i, z] of [0, 2, -2].entries()) {
    const matrix = new Matrix4().makeTranslation(0, 0, z);
    actual.setMatrixAt(i, matrix);
    expected.setMatrixAt(i, matrix);
  }
  const ray = rayAt(4, -2);
  const hits = ray.intersectObject(actual);
  assert.deepEqual(
    hits.map((hit) => hit.instanceId),
    [1, 0, 2],
  );
  assert.deepEqual(
    hits.map((hit) => hit.distance),
    [4, 8, 12],
  );
  assert.ok(hits.every((hit) => hit.object === actual));
  for (const [near, far] of [
    [0, 20],
    [4, 4],
    [8, 12],
    [4.1, 7.9],
  ]) {
    ray.near = near;
    ray.far = far;
    assert.deepEqual(snapshot(ray.intersectObject(actual)), upstreamHits(expected, ray));
    if (near === 4 && far === 4)
      assert.deepEqual(
        ray.intersectObject(actual).map((hit) => hit.instanceId),
        [1],
      );
  }
  ray.near = 0;
  ray.far = Infinity;
  for (const count of [1, 0, 2, 3]) {
    actual.count = expected.count = count;
    assert.deepEqual(snapshot(ray.intersectObject(actual)), upstreamHits(expected, ray));
    assert.equal(ray.intersectObject(actual).length, count);
  }
  assert.equal(ray.intersectObject(root, false).length, 0);
  assert.equal(ray.intersectObject(root, true).length, 3);
  actual.layers.set(2);
  assert.equal(ray.intersectObject(root).length, 0);
  ray.layers.enable(2);
  assert.equal(ray.intersectObject(root).length, 3);
});

test("instanced picking respects indexed and nonindexed material groups and draw ranges", () => {
  const positions = [-2, -1, 0, 0, -1, 0, -1, 1, 0, 0, -1, 0, 2, -1, 0, 1, 1, 0];
  for (const indexed of [false, true]) {
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3));
    const reference = new UpstreamGeometry().setAttribute("position", new UpstreamAttribute(positions, 3));
    for (const shape of [geometry, reference]) {
      if (indexed) shape.setIndex([0, 1, 2, 3, 4, 5]);
      shape.addGroup(0, 3, 0);
      shape.addGroup(3, 3, 1);
    }
    const actual = new InstancedMesh(geometry, [new MeshBasicMaterial(), new MeshBasicMaterial()], 2);
    const expected = new UpstreamInstancedMesh(reference, [new UpstreamMaterial(), new UpstreamMaterial()], 2);
    actual.setMatrixAt(1, new Matrix4().makeTranslation(0, 0, -2));
    expected.setMatrixAt(1, new Matrix4().makeTranslation(0, 0, -2));
    for (const [start, count] of [
      [0, 6],
      [3, 3],
      [0, 0],
    ]) {
      geometry.setDrawRange(start, count);
      reference.setDrawRange(start, count);
      for (const x of [-1, 1]) {
        const hits = rayAt(x).intersectObject(actual);
        assert.deepEqual(snapshot(hits), upstreamHits(expected, rayAt(x)));
        assert.equal(hits.length, count === 0 || (start === 3 && x === -1) ? 0 : 2);
        for (const hit of hits) assert.equal(hit.face!.materialIndex, x === -1 ? 0 : 1);
      }
    }
  }
});

test("clone and copy preserve subtype and resource sharing but isolate instance storage and bounds", () => {
  class Cluster extends InstancedMesh {}
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const source = new Cluster(geometry, [material], 2);
  source.setMatrixAt(1, new Matrix4().makeTranslation(4, 0, 0)).setColorAt(1, new Color(0.25, 0.5, 0.75));
  source.computeBoundingBox();
  source.computeBoundingSphere();
  source.add(new Object3D());
  const clone = source.clone();
  assert.ok(clone instanceof Cluster);
  assert.notEqual(clone.children[0], source.children[0]);
  assert.equal(source.clone(false).children.length, 0);
  const copied = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 0);
  assert.equal(copied.copy(source, false), copied);
  assert.equal(copied.children.length, 0);
  for (const result of [clone, copied]) {
    assert.equal(result.count, 2);
    assert.equal(result.geometry, geometry);
    assert.notEqual(result.material, source.material);
    assert.deepEqual(result.material, [material]);
    assert.notEqual(result.instanceMatrix, source.instanceMatrix);
    assert.notEqual(result.instanceMatrix.array.buffer, source.instanceMatrix.array.buffer);
    assert.notEqual(result.instanceColor!.array.buffer, source.instanceColor!.array.buffer);
    assert.deepEqual(result.instanceMatrix.array, source.instanceMatrix.array);
    assert.deepEqual(result.instanceColor!.array, source.instanceColor!.array);
    assert.notEqual(result.boundingBox, source.boundingBox);
    assert.notEqual(result.boundingSphere, source.boundingSphere);
    result.setMatrixAt(1, new Matrix4().makeTranslation(20, 0, 0)).setColorAt(1, new Color(1, 0, 0));
    result.boundingBox!.min.x = -100;
    result.boundingSphere!.radius = 100;
  }
  assert.equal(source.getMatrixAt(1, new Matrix4()).elements[12], 4);
  assert.deepEqual(source.getColorAt(1, new Color()).toArray(), [0.25, 0.5, 0.75]);
  assert.equal(source.boundingBox!.min.x, -0.5);
  assert.ok(source.boundingSphere!.radius < 100);
  const plain = new InstancedMesh(geometry, material, 1);
  copied.copy(plain, false);
  assert.equal(copied.material, material);
  assert.equal(copied.count, 1);
  assert.equal(copied.instanceColor, null);
  assert.equal(copied.boundingBox, null);
  assert.equal(copied.boundingSphere, null);
});

test("JSON retains active count, full-capacity instance attributes and shared resource references", () => {
  const [actual, expected] = pair(2);
  for (const object of [actual, expected]) {
    object.setMatrixAt(1, new Matrix4().makeTranslation(2, 3, 4));
    object.setColorAt(1, new Color(0.25, 0.5, 0.75));
    object.count = 1;
  }
  const json = actual.toJSON();
  const reference = expected.toJSON("") as { object: { instanceMatrix: unknown; instanceColor?: unknown } };
  assert.equal(json.object.type, "InstancedMesh");
  assert.equal(json.object.count, 1);
  assert.deepEqual(json.object.instanceMatrix, reference.object.instanceMatrix);
  assert.deepEqual(json.object.instanceColor, reference.object.instanceColor);
  assert.equal(json.object.geometry, actual.geometry.uuid);
  assert.equal(json.object.material, (actual.material as MeshBasicMaterial).uuid);
  assert.equal(json.geometries.length, 1);
  assert.equal(json.materials.length, 1);
  const plain = new InstancedMesh(actual.geometry, actual.material, 0).toJSON();
  assert.equal(plain.object.count, 0);
  assert.equal("instanceColor" in plain.object, false);
});

test("low-level morph rows preserve relative and absolute base weights and explicit texture updates", () => {
  for (const relative of [false, true]) {
    const [actual, expected] = pair(2);
    actual.geometry.morphTargetsRelative = expected.geometry.morphTargetsRelative = relative;
    const weights = Object.assign(new Mesh(actual.geometry, actual.material), { morphTargetInfluences: [0.25, 0.5] });
    const referenceWeights = new UpstreamMesh(expected.geometry, expected.material);
    referenceWeights.morphTargetInfluences = weights.morphTargetInfluences;
    assert.equal(actual.setMorphAt(0, weights), actual);
    expected.setMorphAt(0, referenceWeights);
    weights.morphTargetInfluences = [0.75, 0.5];
    actual.setMorphAt(1, weights);
    referenceWeights.morphTargetInfluences = weights.morphTargetInfluences;
    expected.setMorphAt(1, referenceWeights);
    const texture = actual.morphTexture!;
    assert.deepEqual(texture.image.data, expected.morphTexture!.image.data);
    assert.deepEqual(Array.from(texture.image.data!), [
      relative ? 1 : 0.25,
      0.25,
      0.5,
      relative ? 1 : -0.25,
      0.75,
      0.5,
    ]);
    assert.equal(texture.image.width, 3);
    assert.equal(texture.image.height, 2);
    assert.equal(texture.format, RedFormat);
    assert.equal(texture.type, FloatType);
    const version = texture.version;
    weights.morphTargetInfluences = [0, 0];
    actual.getMorphAt(1, weights);
    assert.deepEqual(weights.morphTargetInfluences, [0.75, 0.5]);
    actual.getMorphAt(0, weights);
    assert.deepEqual(weights.morphTargetInfluences, [0.25, 0.5]);
    actual.setMorphAt(1, weights);
    assert.equal(texture.version, version);
    texture.needsUpdate = true;
    assert.equal(texture.version, version + 1);
    const clone = actual.clone();
    assert.notEqual(clone.morphTexture, texture);
    assert.deepEqual(clone.morphTexture!.image.data, texture.image.data);
    clone.copy(new InstancedMesh(actual.geometry, actual.material, 2));
    assert.equal(clone.morphTexture, null);
  }
});

test("disposal releases owned morph textures without disposing shared geometry or materials", () => {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  mesh.setColorAt(0, new Color(1, 0, 0));
  mesh.setMorphAt(0, Object.assign(new Mesh(geometry, material), { morphTargetInfluences: [0.5] }));
  let meshDisposals = 0;
  let textureDisposals = 0;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  mesh.addEventListener("dispose", () => meshDisposals++);
  mesh.morphTexture!.addEventListener("dispose", () => textureDisposals++);
  geometry.addEventListener("dispose", () => geometryDisposals++);
  material.addEventListener("dispose", () => materialDisposals++);
  mesh.dispose();
  assert.equal(meshDisposals, 1);
  assert.equal(textureDisposals, 1);
  assert.equal(mesh.morphTexture, null);
  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  mesh.dispose();
  assert.equal(meshDisposals, 2);
  assert.equal(textureDisposals, 1);
});
