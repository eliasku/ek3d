import { CoordinateSystem } from "../../constants";
import type { Camera } from "../../cameras/Camera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { BufferGeometry } from "../../core/BufferGeometry";
import type { Intersection, Raycaster } from "../../core/Raycaster";
import type { Material, MaterialProperties } from "../../materials/Material";
import { Box3 } from "../../math/Box3";
import { Frustum } from "../../math/Frustum";
import { Matrix4 } from "../../math/Matrix4";
import { Ray } from "../../math/Ray";
import { Sphere } from "../../math/Sphere";
import { Vector3 } from "../../math/Vector3";
import { BatchedMesh, type BatchedMeshDrawRange, type BatchedMeshSortFunction } from "../../objects/BatchedMesh";
import { Mesh } from "../../objects/Mesh";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { BatchBVH, type BatchBVHNode } from "../math/bvh/BatchBVH";
import { MeshBVH, type MeshBVHOptions } from "../math/bvh/core/MeshBVH";
import { acceleratedRaycast, computeBatchedBoundsTree, type BVHGeometry } from "../math/bvh/utils/ExtensionUtilities";
import { radixSort } from "../utils/SortUtils";

export interface BatchLOD {
  start: number;
  count: number;
  metric: number;
  metricSquared: number;
}

const box = new Box3();
const sphere = new Sphere();
const matrix = new Matrix4();
const projection = new Matrix4();
const inverse = new Matrix4();
const cameraPosition = new Vector3();
const forward = new Vector3();
const frustum = new Frustum();
const localRay = new Ray();
const rayMesh = new Mesh<Material | Material[]>(new BufferGeometry(), new MeshBasicMaterial());
const hits: Intersection[] = [];

export class BatchedMeshBVH {
  readonly target: EnhancedBatchedMesh;
  readonly bvh: BatchBVH;
  readonly nodesMap: Map<number, BatchBVHNode> = new Map();
  readonly margin: number;
  accurateCulling: boolean;
  private readonly origin: Float32Array = new Float32Array(3);
  private readonly direction: Float32Array = new Float32Array(3);
  private readonly boxArray: Float32Array = new Float32Array(6);

  constructor(target: EnhancedBatchedMesh, coordinateSystem: CoordinateSystem, margin = 0, accurateCulling = true) {
    this.target = target;
    this.bvh = new BatchBVH(coordinateSystem);
    this.margin = margin;
    this.accurateCulling = accurateCulling;
  }
  private getBox(id: number, array: Float32Array): Float32Array {
    const info = this.target._instanceInfo[id];
    this.target.getBoundingBoxAt(info.geometryIndex, box)!.applyMatrix4(this.target.getMatrixAt(id, matrix));
    array[0] = box.min.x;
    array[1] = box.max.x;
    array[2] = box.min.y;
    array[3] = box.max.y;
    array[4] = box.min.z;
    array[5] = box.max.z;
    return array;
  }
  create(): void {
    this.clear();
    const objects = new Uint32Array(this.target.instanceCount);
    const boxes: Float32Array[] = [];
    let count = 0;
    for (let i = 0; i < this.target._instanceInfo.length; i++) {
      if (!this.target._instanceInfo[i].active) continue;
      objects[count++] = i;
      boxes.push(this.getBox(i, new Float32Array(6)));
    }
    this.bvh.createFromArray(objects, boxes, (node) => this.nodesMap.set(node.object, node), this.margin);
  }
  insert(id: number): void {
    this.nodesMap.set(id, this.bvh.insert(id, this.getBox(id, new Float32Array(6)), this.margin));
  }
  insertRange(ids: ArrayLike<number>): void {
    const boxes: Float32Array[] = [];
    for (let i = 0; i < ids.length; i++) boxes.push(this.getBox(ids[i], new Float32Array(6)));
    this.bvh.insertRange(ids, boxes, this.margin, (node) => this.nodesMap.set(node.object, node));
  }
  move(id: number): void {
    const node = this.nodesMap.get(id);
    if (node) {
      this.getBox(id, node.box);
      this.bvh.move(node, this.margin);
    }
  }
  delete(id: number): void {
    const node = this.nodesMap.get(id);
    if (node) {
      this.bvh.delete(node);
      this.nodesMap.delete(id);
    }
  }
  clear(): void {
    this.bvh.clear();
    this.nodesMap.clear();
  }
  frustumCulling(
    proj: Matrix4,
    callback: (node: BatchBVHNode) => void,
    coordinateSystem = this.bvh.frustum.coordinateSystem,
    reversedDepth = false,
  ): void {
    this.bvh.frustumCulling(
      proj.elements,
      (node, f, mask) => {
        if (!this.accurateCulling || this.margin <= 0 || f.isIntersectedMargin(node.box, mask, this.margin))
          callback(node);
      },
      coordinateSystem,
      reversedDepth,
    );
  }
  raycast(ray: Ray, callback: (id: number) => void): void {
    ray.origin.toArray(this.origin);
    ray.direction.toArray(this.direction);
    this.bvh.rayIntersections(this.direction, this.origin, callback);
  }
  intersectBox(target: Box3, callback: (id: number) => boolean): boolean {
    const a = this.boxArray;
    a[0] = target.min.x;
    a[1] = target.max.x;
    a[2] = target.min.y;
    a[3] = target.max.y;
    a[4] = target.min.z;
    a[5] = target.max.z;
    return this.bvh.intersectsBox(a, callback);
  }
}

export class EnhancedBatchedMesh extends BatchedMesh {
  bvh: BatchedMeshBVH | null = null;
  boundsTrees: (MeshBVH | null)[] = [];
  useDistanceForLOD: boolean = false;
  onFrustumEnter: ((id: number, camera: Camera, cameraLOD?: Camera, lodIndex?: number) => boolean) | null = null;
  private readonly lods: Map<number, BatchLOD[] | null> = new Map();
  private readonly drawList: BatchedMeshDrawRange[] = [];
  private readonly drawPool: BatchedMeshDrawRange[] = [];

  addInstance(geometryId: number): number {
    const id = super.addInstance(geometryId);
    this.boundingBox = null;
    this.boundingSphere = null;
    this.bvh?.insert(id);
    return id;
  }
  setMatrixAt(instanceId: number, value: Matrix4): this {
    super.setMatrixAt(instanceId, value);
    this.boundingBox = null;
    this.boundingSphere = null;
    this.bvh?.move(instanceId);
    this._visibilityChanged = true;
    return this;
  }
  deleteInstance(instanceId: number): this {
    super.deleteInstance(instanceId);
    this.boundingBox = null;
    this.boundingSphere = null;
    this.bvh?.delete(instanceId);
    return this;
  }
  setGeometryIdAt(instanceId: number, geometryId: number): this {
    super.setGeometryIdAt(instanceId, geometryId);
    this.boundingBox = null;
    this.boundingSphere = null;
    this.bvh?.move(instanceId);
    return this;
  }
  setGeometryAt(geometryId: number, geometry: BufferGeometry): number {
    const id = super.setGeometryAt(geometryId, geometry);
    this.boundingBox = null;
    this.boundingSphere = null;
    this.lods.delete(id);
    this.boundsTrees[id] = null;
    if (this.bvh) {
      for (let i = 0; i < this._instanceInfo.length; i++) {
        const instance = this._instanceInfo[i];
        if (instance.active && instance.geometryIndex === id) this.bvh.move(i);
      }
    }
    return id;
  }
  deleteGeometry(geometryId: number): this {
    super.deleteGeometry(geometryId);
    this.lods.delete(geometryId);
    this.boundsTrees[geometryId] = null;
    return this;
  }
  optimize(): this {
    const starts = this._geometryInfo.map((info) => info.start);
    super.optimize();
    for (const [id, levels] of this.lods) {
      if (levels) {
        const delta = this._geometryInfo[id].start - starts[id];
        for (const level of levels) level.start += delta;
      }
    }
    this.boundsTrees.fill(null);
    return this;
  }
  setGeometrySize(maxVertexCount: number, maxIndexCount: number): void {
    super.setGeometrySize(maxVertexCount, maxIndexCount);
    this.boundsTrees.fill(null);
  }
  copy(source: BatchedMesh, recursive = true): this {
    if (source === this) return this;
    super.copy(source, recursive);
    this.bvh = null;
    this.boundsTrees = [];
    this.lods.clear();
    if (source instanceof EnhancedBatchedMesh) {
      for (const [id, levels] of source.lods) {
        this.lods.set(id, levels?.map((level) => ({ ...level })) ?? null);
      }
      this.useDistanceForLOD = source.useDistanceForLOD;
      this.onFrustumEnter = source.onFrustumEnter;
    } else {
      this.useDistanceForLOD = false;
      this.onFrustumEnter = null;
    }
    return this;
  }

  computeBVH(coordinateSystem: CoordinateSystem, config: { margin?: number; accurateCulling?: boolean } = {}): void {
    this.bvh = new BatchedMeshBVH(this, coordinateSystem, config.margin, config.accurateCulling);
    this.bvh.create();
  }
  computeBoundsTree(index = -1, options: MeshBVHOptions = {}): MeshBVH | (MeshBVH | null)[] | null {
    return computeBatchedBoundsTree.call(this, index, options);
  }
  getGeometryLOD(id: number): BatchLOD[] | null {
    return this.lods.get(id) ?? null;
  }
  setGeometryLOD(id: number, levels: BatchLOD[] | null): void {
    this.lods.set(id, levels);
    this._visibilityChanged = true;
  }
  addGeometryLOD(id: number, geometry: BufferGeometry | ArrayLike<number>, metric: number): void {
    const info = this._geometryInfo[id];
    const source =
      "isBufferGeometry" in geometry ? (geometry as BufferGeometry).getIndex()!.array : (geometry as ArrayLike<number>);
    const levels = this.getGeometryLOD(id) ?? [
      { start: info.start, count: info.count, metric: Infinity, metricSquared: Infinity },
    ];
    const last = levels[levels.length - 1];
    const start = last.start + last.count;
    if (start - info.start + source.length > info.reservedIndexCount)
      throw new Error("BatchedMesh LOD: Reserved space request exceeds the maximum buffer size.");
    const index = this.geometry.getIndex();
    if (!index) throw new Error("BatchedMesh LOD requires indexed geometry.");
    for (let i = 0; i < source.length; i++) index.array[start + i] = source[i] + info.vertexStart;
    index.addUpdateRange(start, source.length);
    index.needsUpdate = true;
    levels.push({ start, count: source.length, metric, metricSquared: metric * metric });
    this.setGeometryLOD(id, levels);
  }
  getLODIndex(levels: BatchLOD[], metric: number, squared = false): number {
    for (let i = levels.length - 1; i > 0; i--) {
      const threshold = squared ? levels[i].metricSquared : levels[i].metric;
      if (this.useDistanceForLOD ? metric >= threshold : metric <= threshold) return i;
    }
    return 0;
  }
  _updateDrawParameters(camera: Camera, geometry: BufferGeometry, material: Material): void {
    if (!this._visibilityChanged && !this.perObjectFrustumCulled && !this.sortObjects && this.lods.size === 0) return;
    const index = geometry.getIndex();
    let bytes = index ? index.array.BYTES_PER_ELEMENT : 1;
    let multiplier = 1;
    if ((material as Material & MaterialProperties).wireframe) {
      multiplier = 2;
      bytes = geometry.getAttribute("position")!.count > 65535 ? 4 : 2;
    }
    inverse.copy(this.matrixWorld).invert();
    cameraPosition.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
    forward.set(0, 0, -1).transformDirection(camera.matrixWorld).transformDirection(inverse);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.matrixWorld);
    frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
    const perspective = camera as PerspectiveCamera;
    const isPerspective = perspective.isPerspectiveCamera === true;
    const projectionScale = camera.projectionMatrix.elements[5];
    const viewSize = 2 / projectionScale;
    const indirect = this._indirectTexture!;
    const array = indirect.image.data!;
    const list = this.drawList;
    let count = 0;
    const add = (id: number): void => {
      const instance = this._instanceInfo[id];
      if (!instance.active || !instance.visible) return;
      const info = this._geometryInfo[instance.geometryIndex];
      this.getBoundingSphereAt(instance.geometryIndex, sphere)!.applyMatrix4(this.getMatrixAt(id, matrix));
      if (this.perObjectFrustumCulled && !this.bvh && !frustum.intersectsSphere(sphere)) return;
      let start = info.start,
        length = info.count;
      const levels = this.getGeometryLOD(instance.geometryIndex);
      if (levels) {
        const distance = sphere.center.distanceToSquared(cameraPosition);
        if (!isPerspective && this.useDistanceForLOD)
          throw new Error("BatchedMesh: useDistanceForLOD cannot be used with orthographic camera.");
        const metric = isPerspective
          ? this.useDistanceForLOD
            ? distance
            : (sphere.radius ** 2 * projectionScale ** 2) / distance
          : (sphere.radius * 2) / viewSize;
        const lod = this.getLODIndex(levels, metric, isPerspective);
        if (this.onFrustumEnter && !this.onFrustumEnter(id, camera, camera, lod)) return;
        start = levels[lod].start;
        length = levels[lod].count;
      } else if (this.onFrustumEnter && !this.onFrustumEnter(id, camera)) return;
      if (this.sortObjects) {
        const item =
          this.drawPool[list.length] ?? (this.drawPool[list.length] = { start: 0, count: 0, z: 0, index: 0 });
        item.start = start;
        item.count = length;
        item.index = id;
        item.z = sphere.center.sub(cameraPosition).dot(forward);
        list.push(item);
      } else {
        this._multiDrawStarts[count] = start * bytes * multiplier;
        this._multiDrawCounts[count] = length * multiplier;
        array[count++] = id;
      }
    };
    if (this.perObjectFrustumCulled && this.bvh)
      this.bvh.frustumCulling(projection, (node) => add(node.object), camera.coordinateSystem, camera.reversedDepth);
    else for (let i = 0; i < this._instanceInfo.length; i++) add(i);
    if (this.sortObjects) {
      if (this.customSort) this.customSort.call(this, list, camera);
      else list.sort(material.transparent ? (a, b) => b.z - a.z : (a, b) => a.z - b.z);
      for (const item of list) {
        this._multiDrawStarts[count] = item.start * bytes * multiplier;
        this._multiDrawCounts[count] = item.count * multiplier;
        array[count++] = item.index;
      }
      list.length = 0;
    }
    indirect.needsUpdate = true;
    this._multiDrawCount = count;
    this._multiDrawBytesPerElement = bytes;
    this._visibilityChanged = false;
  }
  raycast(raycaster: Raycaster, result: Intersection[]): void {
    const geometry = this.geometry as BVHGeometry;
    const oldTree = geometry.boundsTree,
      oldBox = geometry.boundingBox,
      oldSphere = geometry.boundingSphere;
    const oldStart = geometry.drawRange.start,
      oldCount = geometry.drawRange.count;
    const oldGeometry = rayMesh.geometry,
      oldMaterial = rayMesh.material;
    rayMesh.geometry = geometry;
    rayMesh.material = this.material;
    const check = (id: number): void => {
      const instance = this._instanceInfo[id];
      if (!instance.active || !instance.visible) return;
      const geometryId = instance.geometryIndex;
      geometry.boundsTree = this.boundsTrees[geometryId];
      this.getMatrixAt(id, rayMesh.matrixWorld).premultiply(this.matrixWorld);
      if (!geometry.boundsTree) {
        geometry.boundingBox = box;
        geometry.boundingSphere = sphere;
        this.getBoundingBoxAt(geometryId, box);
        this.getBoundingSphereAt(geometryId, sphere);
        const info = this._geometryInfo[geometryId];
        geometry.setDrawRange(info.start, info.count);
      }
      acceleratedRaycast.call(rayMesh, raycaster, hits);
      for (const hit of hits) {
        hit.object = this;
        hit.batchId = id;
        result.push(hit);
      }
      hits.length = 0;
    };
    try {
      if (this.bvh) {
        inverse.copy(this.matrixWorld).invert();
        localRay.copy(raycaster.ray).applyMatrix4(inverse);
        this.bvh.raycast(localRay, check);
      } else for (let i = 0; i < this._instanceInfo.length; i++) check(i);
    } finally {
      hits.length = 0;
      geometry.boundsTree = oldTree;
      geometry.boundingBox = oldBox;
      geometry.boundingSphere = oldSphere;
      geometry.drawRange.start = oldStart;
      geometry.drawRange.count = oldCount;
      rayMesh.geometry = oldGeometry;
      rayMesh.material = oldMaterial;
    }
  }
}

export function getBatchedMeshLODCount(geometryLOD: BufferGeometry[][]): {
  vertexCount: number;
  indexCount: number;
  LODIndexCount: number[];
} {
  let vertexCount = 0,
    indexCount = 0;
  const LODIndexCount: number[] = [];
  for (const geometries of geometryLOD) {
    let count = 0;
    for (const geometry of geometries) {
      const n = geometry.getIndex()!.count;
      count += n;
      indexCount += n;
      vertexCount += geometry.getAttribute("position")!.count;
    }
    LODIndexCount.push(count);
  }
  return { vertexCount, indexCount, LODIndexCount };
}

export function createRadixSort(target: BatchedMesh): BatchedMeshSortFunction {
  const aux: BatchedMeshDrawRange[] = [];
  return function (list): void {
    let min = Infinity,
      max = -Infinity;
    for (const item of list) {
      min = Math.min(min, item.z);
      max = Math.max(max, item.z);
    }
    const factor = max === min ? 0 : 0xffffffff / (max - min);
    for (const item of list) (item as BatchedMeshDrawRange & { zSort: number }).zSort = (item.z - min) * factor;
    const material = Array.isArray(target.material) ? target.material[0] : target.material;
    radixSort(list, {
      aux,
      get: (item) => (item as BatchedMeshDrawRange & { zSort: number }).zSort,
      reversed: material.transparent,
    });
  };
}
