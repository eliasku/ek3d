import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { BatchBVH, type BatchBVHNode } from "../src/addons/math/bvh/BatchBVH";
import { CoordinateSystem } from "../src/constants";
import { EnhancedBatchedMesh } from "../src/addons/objects/EnhancedBatchedMesh";
import { OrthographicCamera } from "../src/cameras/OrthographicCamera";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Box3 } from "../src/math/Box3";
import { Frustum } from "../src/math/Frustum";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";

const box = (x: number): Float32Array => new Float32Array([x, x + 1, 0, 1, 0, 1]);

test("batch BVH builds, moves, inserts and deletes leaves", () => {
  const bvh = new BatchBVH();
  const nodes = new Map<number, BatchBVHNode>();
  bvh.createFromArray(
    new Uint32Array([0, 1, 2]),
    [box(0), box(4), box(8)],
    (node) => nodes.set(node.object, node),
    0.5,
  );
  const hits: number[] = [];
  const collect = (id: number): boolean => {
    hits.push(id);
    return false;
  };
  assert.equal(bvh.intersectsBox(box(4), collect), false);
  assert.deepEqual(hits, [1]);
  const moved = nodes.get(1)!;
  moved.box.set(box(12));
  bvh.move(moved, 0.5);
  hits.length = 0;
  bvh.intersectsBox(box(4), collect);
  assert.deepEqual(hits, []);
  bvh.intersectsBox(box(12), collect);
  assert.deepEqual(hits, [1]);
  bvh.delete(moved);
  bvh.insertRange([3, 4], [box(16), box(20)]);
  hits.length = 0;
  bvh.intersectsBox(box(20), collect);
  assert.deepEqual(hits, [4]);
  bvh.clear();
  assert.equal(
    bvh.intersectsBox(box(0), () => true),
    false,
  );
});

test("batch BVH clips rays and frusta including accurate margins", () => {
  const bvh = new BatchBVH(CoordinateSystem.WebGL);
  bvh.insert(1, new Float32Array([-0.5, 0.5, -0.5, 0.5, -0.5, 0.5]));
  bvh.insert(2, new Float32Array([2, 3, 0, 1, 0, 1]), 1.5);
  const rayHits: number[] = [];
  bvh.rayIntersections([1, 0, 0], [-2, 0, 0], (id) => rayHits.push(id), 0, 3);
  assert.deepEqual(
    rayHits.sort((a, b) => a - b),
    [1, 2],
  );
  rayHits.length = 0;
  bvh.rayIntersections([1, 0, 0], [-2, 4, 0], (id) => rayHits.push(id));
  assert.deepEqual(rayHits, []);
  const visible: number[] = [];
  bvh.frustumCulling([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], (node, frustum, mask) => {
    if (node.object === 1 || frustum.isIntersectedMargin(node.box, mask, 1.5)) visible.push(node.object);
  });
  assert.deepEqual(visible, [1]);
});

test("batch frustum matches native near and far clipping in normal and reversed depth", () => {
  const boxes = [
    new Float32Array([-0.1, 0.1, -0.1, 0.1, -0.5, -0.3]),
    new Float32Array([-0.1, 0.1, -0.1, 0.1, -5.1, -4.9]),
    new Float32Array([-0.1, 0.1, -0.1, 0.1, -11.1, -10.9]),
    new Float32Array([20, 21, -0.1, 0.1, -5.1, -4.9]),
  ];
  const bvh = new BatchBVH();
  boxes.forEach((bounds, id) => bvh.insert(id, bounds));
  for (const camera of [new PerspectiveCamera(60, 1, 1, 10), new OrthographicCamera(-2, 2, 2, -2, 1, 10)]) {
    for (const reversedDepth of [false, true]) {
      camera._reversedDepth = reversedDepth;
      camera.updateProjectionMatrix();
      const native = new Frustum().setFromProjectionMatrix(
        camera.projectionMatrix,
        camera.coordinateSystem,
        reversedDepth,
      );
      const expected = boxes
        .map((bounds, id) =>
          native.intersectsBox(
            new Box3(new Vector3(bounds[0], bounds[2], bounds[4]), new Vector3(bounds[1], bounds[3], bounds[5])),
          )
            ? id
            : -1,
        )
        .filter((id) => id !== -1);
      assert.deepEqual(expected, [1]);
      const actual: number[] = [];
      bvh.frustumCulling(
        camera.projectionMatrix.elements,
        (node) => actual.push(node.object),
        camera.coordinateSystem,
        reversedDepth,
      );
      assert.deepEqual(
        actual.sort((a, b) => a - b),
        expected,
      );
    }
  }
});

test("mesh perspective zoom selects the same LOD with and without BVH", () => {
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial();
  const mesh = new EnhancedBatchedMesh(1, 24, 72, material);
  const geometryId = mesh.addGeometry(geometry, -1, 72);
  mesh.addGeometryLOD(geometryId, geometry, 0.5);
  const id = mesh.addInstance(geometryId);
  mesh.setMatrixAt(id, new Matrix4().makeTranslation(0, 0, -10));
  mesh.updateMatrixWorld();
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  for (const withBVH of [false, true]) {
    if (withBVH) mesh.computeBVH(CoordinateSystem.WebGL);
    for (const [zoom, expectedLOD] of [
      [1, 1],
      [3, 0],
    ] as const) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      let selected = -1;
      mesh.onFrustumEnter = (_id, _camera, _lodCamera, lod) => {
        selected = lod ?? -1;
        return true;
      };
      mesh._updateDrawParameters(camera, mesh.geometry, material);
      assert.equal(mesh._multiDrawCount, 1);
      assert.equal(selected, expectedLOD);
    }
  }
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("mesh reversed-depth culling agrees with and without BVH", () => {
  const geometry = new BoxGeometry(0.2, 0.2, 0.2);
  const material = new MeshBasicMaterial();
  const mesh = new EnhancedBatchedMesh(3, 24, 36, material);
  const geometryId = mesh.addGeometry(geometry);
  for (const z of [-0.4, -5, -11]) {
    const id = mesh.addInstance(geometryId);
    mesh.setMatrixAt(id, new Matrix4().makeTranslation(0, 0, z));
  }
  mesh.updateMatrixWorld();
  const camera = new PerspectiveCamera(60, 1, 1, 10);
  camera._reversedDepth = true;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  for (const withBVH of [false, true]) {
    if (withBVH) mesh.computeBVH(CoordinateSystem.WebGL);
    mesh._updateDrawParameters(camera, mesh.geometry, material);
    assert.equal(mesh._multiDrawCount, 1);
    assert.equal(mesh._indirectTexture!.image.data![0], 1);
  }
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});
