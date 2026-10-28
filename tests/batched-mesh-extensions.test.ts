import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  EnhancedBatchedMesh,
  createRadixSort,
  getBatchedMeshLODCount,
} from "../src/addons/objects/EnhancedBatchedMesh";
import { WebGLCoordinateSystem } from "../src/constants";
import { PerspectiveCamera } from "../src/cameras/PerspectiveCamera";
import { Raycaster, type Intersection } from "../src/core/Raycaster";
import { BoxGeometry } from "../src/geometries/BoxGeometry";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { Matrix4 } from "../src/math/Matrix4";
import { Vector3 } from "../src/math/Vector3";
import { Box3 } from "../src/math/Box3";
import { Sphere } from "../src/math/Sphere";
import type { BVHGeometry } from "../src/addons/math/bvh/utils/ExtensionUtilities";

function fixture() {
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new MeshBasicMaterial();
  const mesh = new EnhancedBatchedMesh(3, 24, 72, material);
  const id = mesh.addGeometry(geometry, -1, 72);
  mesh.addGeometryLOD(id, geometry, 0.1);
  const a = mesh.addInstance(id);
  const b = mesh.addInstance(id);
  mesh.setMatrixAt(a, new Matrix4().makeTranslation(0, 0, -10));
  mesh.setMatrixAt(b, new Matrix4().makeTranslation(100, 0, -10));
  mesh.updateMatrixWorld();
  const camera = new PerspectiveCamera(60, 1, 0.1, 200);
  camera.updateMatrixWorld();
  return { mesh, geometry, material, camera, id, a, b };
}

test("LOD indices, reservation, sorting and culling agree with and without BVH", () => {
  const { mesh, geometry, material, camera, id, a } = fixture();
  assert.deepEqual(getBatchedMeshLODCount([[geometry, geometry]]).LODIndexCount, [72]);
  const levels = mesh.getGeometryLOD(id)!;
  assert.equal(mesh.getLODIndex(levels, 0.09), 1);
  assert.equal(mesh.getLODIndex(levels, 0.11), 0);
  assert.throws(() => mesh.addGeometryLOD(id, geometry, 0.01), /Reserved space/);
  mesh.customSort = createRadixSort(mesh);
  mesh._updateDrawParameters(camera, mesh.geometry, material);
  assert.equal(mesh._multiDrawCount, 1);
  assert.equal(mesh._indirectTexture!.image.data![0], a);
  const start = mesh._multiDrawStarts[0];
  mesh.computeBVH(WebGLCoordinateSystem);
  mesh._updateDrawParameters(camera, mesh.geometry, material);
  assert.equal(mesh._multiDrawCount, 1);
  assert.equal(mesh._indirectTexture!.image.data![0], a);
  assert.equal(mesh._multiDrawStarts[0], start);
  mesh.setGeometryLOD(id, null);
  mesh._updateDrawParameters(camera, mesh.geometry, material);
  assert.equal(mesh._multiDrawStarts[0], mesh._geometryInfo[id].start * mesh._multiDrawBytesPerElement);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("batch BVH and linear raycasts return world-space hits with BLAS", () => {
  const { mesh, geometry, material, a } = fixture();
  mesh.position.x = 2;
  mesh.updateMatrixWorld();
  mesh.computeBoundsTree();
  const raycaster = new Raycaster(new Vector3(2, 0, 0), new Vector3(0, 0, -1));
  const linear: Intersection[] = [];
  mesh.raycast(raycaster, linear);
  assert.ok(linear.length > 0);
  assert.equal(linear[0].batchId, a);
  assert.equal(linear[0].distance, 9);
  mesh.computeBVH(WebGLCoordinateSystem);
  const accelerated: Intersection[] = [];
  mesh.raycast(raycaster, accelerated);
  assert.deepEqual(
    accelerated.map((hit) => [hit.batchId, hit.distance]),
    linear.map((hit) => [hit.batchId, hit.distance]),
  );
  mesh.bvh!.delete(a);
  accelerated.length = 0;
  mesh.raycast(raycaster, accelerated);
  assert.equal(accelerated.length, 0);
  mesh.bvh!.insert(a);
  mesh.raycast(raycaster, accelerated);
  assert.ok(accelerated.length > 0);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("instance mutations keep the hierarchy synchronized, including reused ids", () => {
  const { mesh, geometry, material, camera, id, a, b } = fixture();
  mesh.computeBVH(WebGLCoordinateSystem);
  const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  const ids = () => {
    const result: Intersection[] = [];
    mesh.raycast(raycaster, result);
    return [...new Set(result.map((hit) => hit.batchId))];
  };
  assert.deepEqual(ids(), [a]);
  mesh.setMatrixAt(a, new Matrix4().makeTranslation(100, 0, -10));
  mesh.setMatrixAt(b, new Matrix4().makeTranslation(0, 0, -10));
  assert.deepEqual(ids(), [b]);
  mesh._updateDrawParameters(camera, mesh.geometry, material);
  assert.equal(mesh._multiDrawCount, 1);
  assert.equal(mesh._indirectTexture!.image.data![0], b);
  mesh.deleteInstance(b);
  assert.deepEqual(ids(), []);
  assert.equal(mesh.addInstance(id), b);
  mesh.setMatrixAt(b, new Matrix4().makeTranslation(0, 0, -10));
  assert.deepEqual(ids(), [b]);
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("geometry replacement, deletion, reuse and optimization invalidate derived state", () => {
  const material = new MeshBasicMaterial();
  const small = new BoxGeometry(2, 2, 2);
  const large = new BoxGeometry(4, 4, 4);
  const mesh = new EnhancedBatchedMesh(3, 96, 288, material);
  const first = mesh.addGeometry(small, 24, 72);
  const second = mesh.addGeometry(small, 24, 72);
  mesh.addGeometryLOD(second, small, 0.1);
  const instance = mesh.addInstance(second);
  mesh.setMatrixAt(instance, new Matrix4().makeTranslation(0, 0, -10));
  mesh.updateMatrixWorld();
  mesh.computeBVH(WebGLCoordinateSystem);
  mesh.computeBoundsTree();
  const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  const distance = () => {
    const result: Intersection[] = [];
    mesh.raycast(raycaster, result);
    return result[0]?.distance;
  };
  assert.equal(distance(), 9);
  mesh.deleteGeometry(first);
  const previousStart = mesh.getGeometryLOD(second)![1].start;
  mesh.optimize();
  assert.equal(mesh.getGeometryLOD(second)![1].start, previousStart - 72);
  assert.equal(mesh.boundsTrees[second], null);
  assert.equal(distance(), 9);
  mesh.computeBoundsTree(second);
  mesh.setGeometrySize(120, 360);
  assert.equal(mesh.boundsTrees[second], null);
  assert.equal(distance(), 9);
  mesh.setGeometryAt(second, large);
  assert.equal(mesh.getGeometryLOD(second), null);
  assert.equal(distance(), 8);
  const edgeRay = new Raycaster(new Vector3(1.5, 0, 0), new Vector3(0, 0, -1));
  const edgeHits: Intersection[] = [];
  mesh.raycast(edgeRay, edgeHits);
  assert.ok(edgeHits.length > 0);
  const replacement = mesh.addGeometry(small, 24, 72);
  assert.equal(replacement, first);
  mesh.setGeometryIdAt(instance, replacement);
  assert.equal(distance(), 9);
  edgeHits.length = 0;
  mesh.raycast(edgeRay, edgeHits);
  assert.equal(edgeHits.length, 0);
  mesh.computeBoundsTree(replacement);
  mesh.deleteGeometry(replacement);
  assert.equal(mesh.boundsTrees[replacement], null);
  assert.equal(distance(), undefined);
  assert.equal(mesh.addGeometry(large, 24, 72), replacement);
  assert.equal(mesh.addInstance(replacement), instance);
  mesh.setMatrixAt(instance, new Matrix4().makeTranslation(0, 0, -10));
  assert.equal(distance(), 8);
  mesh.dispose();
  small.dispose();
  large.dispose();
  material.dispose();
});

test("copy and clone keep independent LOD data without stale acceleration", () => {
  const { mesh, geometry, material, id } = fixture();
  mesh.computeBVH(WebGLCoordinateSystem);
  mesh.computeBoundsTree();
  const clone = mesh.clone();
  assert.equal(clone.bvh, null);
  assert.equal(clone.boundsTrees.length, 0);
  assert.deepEqual(clone.getGeometryLOD(id), mesh.getGeometryLOD(id));
  clone.getGeometryLOD(id)![0].start++;
  assert.notEqual(clone.getGeometryLOD(id)![0].start, mesh.getGeometryLOD(id)![0].start);
  clone.copy(mesh);
  assert.deepEqual(clone.getGeometryLOD(id), mesh.getGeometryLOD(id));
  clone.dispose();
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});

test("raycast restores geometry state even if draw range setup throws", () => {
  const { mesh, geometry, material } = fixture();
  mesh.computeBoundsTree();
  const batchGeometry = mesh.geometry as BVHGeometry;
  const tree = mesh.boundsTrees[0];
  const originalBox = new Box3();
  const originalSphere = new Sphere();
  batchGeometry.boundsTree = tree;
  batchGeometry.boundingBox = originalBox;
  batchGeometry.boundingSphere = originalSphere;
  batchGeometry.setDrawRange(5, 7);
  mesh.boundsTrees.fill(null);
  const setDrawRange = batchGeometry.setDrawRange.bind(batchGeometry);
  batchGeometry.setDrawRange = function (start, count) {
    setDrawRange(start, count);
    throw new Error("draw range failed");
  };
  const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  assert.throws(() => mesh.raycast(raycaster, []), /draw range failed/);
  assert.equal(batchGeometry.boundsTree, tree);
  assert.equal(batchGeometry.boundingBox, originalBox);
  assert.equal(batchGeometry.boundingSphere, originalSphere);
  assert.deepEqual(batchGeometry.drawRange, { start: 5, count: 7 });
  batchGeometry.setDrawRange = setDrawRange;
  const other = fixture();
  const hits: Intersection[] = [];
  other.mesh.raycast(raycaster, hits);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].object, other.mesh);
  other.mesh.dispose();
  other.geometry.dispose();
  other.material.dispose();
  mesh.dispose();
  geometry.dispose();
  material.dispose();
});
