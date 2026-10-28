import { Mesh } from "../../../../objects/Mesh";
import { Points } from "../../../../objects/Points";
import { Line } from "../../../../objects/Line";
import { LineLoop } from "../../../../objects/LineLoop";
import { LineSegments } from "../../../../objects/LineSegments";
import { BatchedMesh } from "../../../../objects/BatchedMesh";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import type { Intersection, Raycaster } from "../../../../core/Raycaster";
import { Box3 } from "../../../../math/Box3";
import { Sphere } from "../../../../math/Sphere";
import { MeshBasicMaterial } from "../../../../materials/MeshBasicMaterial";
import type { GeometryBVH } from "../core/GeometryBVH";
import { MeshBVH, type MeshBVHOptions } from "../core/MeshBVH";

export type BVHGeometry = BufferGeometry & { boundsTree?: GeometryBVH | null };
export type BVHRaycaster = Raycaster & { firstHitOnly?: boolean };
export type BVHBatchedMesh = BatchedMesh & { boundsTrees?: (MeshBVH | null)[] };
export type ComputeBVHOptions = MeshBVHOptions & {
  type?: new (geometry: BufferGeometry, options?: MeshBVHOptions) => GeometryBVH;
};

// oxlint-disable-next-line typescript/unbound-method -- Called with the original mesh as this.
const meshRaycast = Mesh.prototype.raycast;
// oxlint-disable-next-line typescript/unbound-method -- Called with the original line as this.
const lineRaycast = Line.prototype.raycast;
// oxlint-disable-next-line typescript/unbound-method -- Called with the original line loop as this.
const lineLoopRaycast = LineLoop.prototype.raycast;
// oxlint-disable-next-line typescript/unbound-method -- Called with the original line segments as this.
const lineSegmentsRaycast = LineSegments.prototype.raycast;
// oxlint-disable-next-line typescript/unbound-method -- Called with the original points as this.
const pointsRaycast = Points.prototype.raycast;
// oxlint-disable-next-line typescript/unbound-method -- Called with the original batched mesh as this.
const batchedMeshRaycast = BatchedMesh.prototype.raycast;
const batchMesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
const batchIntersects: Intersection[] = [];
const batchBox = new Box3();
const batchSphere = new Sphere();

export function acceleratedRaycast(
  this: Mesh | Points | Line | BatchedMesh,
  raycaster: BVHRaycaster,
  intersects: Intersection[],
): void {
  if (this instanceof BatchedMesh) {
    acceleratedBatchedMeshRaycast.call(this, raycaster, intersects);
    return;
  }
  const tree = (this.geometry as BVHGeometry).boundsTree;
  if (tree) {
    tree.raycastObject3D(this, raycaster, intersects);
  } else if (this instanceof Mesh) {
    meshRaycast.call(this, raycaster, intersects);
  } else if (this instanceof LineSegments) {
    lineSegmentsRaycast.call(this, raycaster, intersects);
  } else if (this instanceof LineLoop) {
    lineLoopRaycast.call(this, raycaster, intersects);
  } else if (this instanceof Line) {
    lineRaycast.call(this, raycaster, intersects);
  } else if (this instanceof Points) {
    pointsRaycast.call(this, raycaster, intersects);
  } else {
    throw new Error("BVH: Fallback raycast function not found.");
  }
}

function acceleratedBatchedMeshRaycast(
  this: BVHBatchedMesh,
  raycaster: BVHRaycaster,
  intersects: Intersection[],
): void {
  const trees = this.boundsTrees;
  if (!trees) {
    batchedMeshRaycast.call(this, raycaster, intersects);
    return;
  }

  const geometry = this.geometry as BVHGeometry;
  const oldTree = geometry.boundsTree;
  const oldDrawStart = geometry.drawRange.start;
  const oldDrawCount = geometry.drawRange.count;
  const oldBox = geometry.boundingBox;
  const oldSphere = geometry.boundingSphere;
  const oldMeshGeometry = batchMesh.geometry;
  const oldMeshMaterial = batchMesh.material;
  batchMesh.geometry = geometry;
  batchMesh.material = this.material;
  try {
    for (let i = 0; i < this._instanceInfo.length; i++) {
      const instance = this._instanceInfo[i];
      if (!instance.active || !instance.visible) continue;
      const geometryId = instance.geometryIndex;
      geometry.boundsTree = trees[geometryId];
      this.getMatrixAt(i, batchMesh.matrixWorld).premultiply(this.matrixWorld);
      if (!geometry.boundsTree) {
        geometry.boundingBox = batchBox;
        geometry.boundingSphere = batchSphere;
        this.getBoundingBoxAt(geometryId, batchBox);
        this.getBoundingSphereAt(geometryId, batchSphere);
        const range = this._geometryInfo[geometryId];
        geometry.setDrawRange(range.start, range.count);
      }
      acceleratedRaycast.call(batchMesh, raycaster, batchIntersects);
      for (const hit of batchIntersects) {
        hit.object = this;
        hit.batchId = i;
        intersects.push(hit);
      }
      batchIntersects.length = 0;
    }
  } finally {
    batchIntersects.length = 0;
    geometry.boundsTree = oldTree;
    geometry.setDrawRange(oldDrawStart, oldDrawCount);
    geometry.boundingBox = oldBox;
    geometry.boundingSphere = oldSphere;
    batchMesh.geometry = oldMeshGeometry;
    batchMesh.material = oldMeshMaterial;
  }
}

export function computeBoundsTree(this: BVHGeometry, options: ComputeBVHOptions = {}): GeometryBVH {
  const { type = MeshBVH } = options;
  this.boundsTree = new type(this, options);
  return this.boundsTree;
}

export function disposeBoundsTree(this: BVHGeometry): void {
  this.boundsTree = null;
}

export function computeBatchedBoundsTree(
  this: BVHBatchedMesh,
  index = -1,
  options: MeshBVHOptions = {},
): MeshBVH | (MeshBVH | null)[] | null {
  const ranges = this._geometryInfo;
  const geometryCount = this._geometryCount;
  if (!this.boundsTrees) this.boundsTrees = Array.from({ length: geometryCount }, () => null);
  const trees = this.boundsTrees;
  while (trees.length < geometryCount) trees.push(null);
  if (index < 0) {
    for (let i = 0; i < geometryCount; i++) {
      trees[i] = new MeshBVH(this.geometry, { ...options, range: ranges[i] });
    }
    return trees;
  }
  if (index < ranges.length) trees[index] = new MeshBVH(this.geometry, { ...options, range: ranges[index] });
  return trees[index] || null;
}

export function disposeBatchedBoundsTree(this: BVHBatchedMesh, index = -1): void {
  const trees = this.boundsTrees!;
  if (index < 0) trees.fill(null);
  else if (index < trees.length) trees[index] = null;
}
