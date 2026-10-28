import type { ArrayCamera } from "../cameras/ArrayCamera";
import type { Camera } from "../cameras/Camera";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Intersection } from "../core/Raycaster";
import type { Material, MaterialProperties } from "../materials/Material";
import type { Object3D } from "../core/Object3D";
import type { Raycaster } from "../core/Raycaster";
import type { Vector4 } from "../math/Vector4";
import type { WebGLRenderer } from "../renderers/WebGLRenderer";
import { TextureSource } from "../textures/TextureSource";
import { BufferAttribute } from "../core/BufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { DataTexture } from "../textures/DataTexture";
import { FloatType, RedIntegerFormat, UnsignedIntType, RGBAFormat } from "../constants";
import { Matrix4 } from "../math/Matrix4";
import { Mesh } from "./Mesh";
import { ColorManagement } from "../math/ColorManagement";
import { Box3 } from "../math/Box3";
import { Sphere } from "../math/Sphere";
import { Frustum } from "../math/Frustum";
import { Vector3 } from "../math/Vector3";
import { Color } from "../math/Color";
import { FrustumArray } from "../math/FrustumArray";

export interface BatchedMeshGeometryRange {
  vertexStart: number;
  vertexCount: number;
  reservedVertexCount: number;
  indexStart: number;
  indexCount: number;
  reservedIndexCount: number;
  start: number;
  count: number;
}
interface BatchedMeshGeometryInfo extends BatchedMeshGeometryRange {
  boundingBox: Box3 | null;
  boundingSphere: Sphere | null;
  active: boolean;
}
export interface BatchedMeshDrawRange {
  start: number;
  count: number;
  z: number;
  index: number;
}
export type BatchedMeshSortFunction = (this: BatchedMesh, list: BatchedMeshDrawRange[], camera: Camera) => void;
function ascIdSort(a: number, b: number) {
  return a - b;
}
function sortOpaque(a: BatchedMeshDrawRange, b: BatchedMeshDrawRange) {
  return a.z - b.z;
}
function sortTransparent(a: BatchedMeshDrawRange, b: BatchedMeshDrawRange) {
  return b.z - a.z;
}
class MultiDrawRenderList {
  index: number;
  pool: BatchedMeshDrawRange[];
  list: BatchedMeshDrawRange[];

  constructor() {
    this.index = 0;
    this.pool = [];
    this.list = [];
  }
  push(start: number, count: number, z: number, index: number) {
    const pool = this.pool;
    const list = this.list;
    if (this.index >= pool.length) {
      pool.push({
        start: -1,
        count: -1,
        z: -1,
        index: -1,
      });
    }
    const item = pool[this.index];
    list.push(item);
    this.index++;
    item.start = start;
    item.count = count;
    item.z = z;
    item.index = index;
  }
  reset() {
    this.list.length = 0;
    this.index = 0;
  }
}
const _matrix = /*@__PURE__*/ new Matrix4();
const _whiteColor = /*@__PURE__*/ new Color(1, 1, 1);
const _frustum = /*@__PURE__*/ new Frustum();
const _frustumArray = /*@__PURE__*/ new FrustumArray();
const _box = /*@__PURE__*/ new Box3();
const _sphere = /*@__PURE__*/ new Sphere();
const _vector = /*@__PURE__*/ new Vector3();
const _cameraPosition = /*@__PURE__*/ new Vector3();
const _forward = /*@__PURE__*/ new Vector3();
const _temp = /*@__PURE__*/ new Vector3();
const _renderList = /*@__PURE__*/ new MultiDrawRenderList();
let _mesh: (Omit<Mesh, "material"> & { material: Material | Material[] | undefined }) | undefined;
const _batchIntersects: Intersection[] = [];
// copies data from attribute "src" into "target" starting at "targetOffset"
function copyAttributeData(
  src: BufferAttribute | InterleavedBufferAttribute,
  target: BufferAttribute,
  targetOffset: number = 0,
) {
  const itemSize = target.itemSize;
  if (
    (src as InterleavedBufferAttribute).isInterleavedBufferAttribute ||
    src.array.constructor !== target.array.constructor
  ) {
    // use the component getters and setters if the array data cannot
    // be copied directly
    const vertexCount = src.count;
    for (let i = 0; i < vertexCount; i++) {
      for (let c = 0; c < itemSize; c++) {
        target.setComponent(i + targetOffset, c, src.getComponent(i, c));
      }
    }
  } else {
    // faster copy approach using typed array set function
    target.array.set(src.array, targetOffset * itemSize);
  }
  target.needsUpdate = true;
}
// safely copies array contents to a potentially smaller array
function copyArrayContents(
  src:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array,
  target:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array,
) {
  if (src.constructor !== target.constructor) {
    // if arrays are of a different type (eg due to index size increasing) then data must be per-element copied
    const len = Math.min(src.length, target.length);
    for (let i = 0; i < len; i++) {
      target[i] = src[i];
    }
  } else {
    // if the arrays use the same data layout we can use a fast block copy
    const len = Math.min(src.length, target.length);
    target.set(new (src.constructor as any)(src.buffer, 0, len));
  }
}
/**
 * A special version of a mesh with multi draw batch rendering support. Use
 * this class if you have to render a large number of objects with the same
 * material but with different geometries or world transformations. The usage of
 * `BatchedMesh` will help you to reduce the number of draw calls and thus improve the overall
 * rendering performance in your application.
 *
 * ```typescript
 * import { BatchedMesh } from 'ek3d/objects/BatchedMesh';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { Matrix4 } from 'ek3d/math/Matrix4';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { SphereGeometry } from 'ek3d/geometries/SphereGeometry';
 *
 * const scene = new Scene();
 * const boxMatrix1 = new Matrix4().makeTranslation( -3, 0, 0 );
 * const boxMatrix2 = new Matrix4().makeTranslation( -1, 0, 0 );
 * const sphereMatrix1 = new Matrix4().makeTranslation( 1, 0, 0 );
 * const sphereMatrix2 = new Matrix4().makeTranslation( 3, 0, 0 );
 *
 * const box = new BoxGeometry( 1, 1, 1 );
 * const sphere = new SphereGeometry( 1, 12, 12 );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 *
 * // initialize and add geometries into the batched mesh
 * const batchedMesh = new BatchedMesh( 10, 5000, 10000, material );
 * const boxGeometryId = batchedMesh.addGeometry( box );
 * const sphereGeometryId = batchedMesh.addGeometry( sphere );
 *
 * // create instances of those geometries
 * const boxInstancedId1 = batchedMesh.addInstance( boxGeometryId );
 * const boxInstancedId2 = batchedMesh.addInstance( boxGeometryId );
 *
 * const sphereInstancedId1 = batchedMesh.addInstance( sphereGeometryId );
 * const sphereInstancedId2 = batchedMesh.addInstance( sphereGeometryId );
 *
 * // position the geometries
 * batchedMesh.setMatrixAt( boxInstancedId1, boxMatrix1 );
 * batchedMesh.setMatrixAt( boxInstancedId2, boxMatrix2 );
 *
 * batchedMesh.setMatrixAt( sphereInstancedId1, sphereMatrix1 );
 * batchedMesh.setMatrixAt( sphereInstancedId2, sphereMatrix2 );
 *
 * scene.add( batchedMesh );
 * ```
 *
 * The first geometry added defines the layout of the batch. All subsequent geometries must
 * match its index usage and provide its attributes with the same itemSize and normalized
 * values. Additional attributes are ignored.
 *
 */
export class BatchedMesh extends Mesh {
  isBatchedMesh: boolean;
  perObjectFrustumCulled: boolean;
  sortObjects: boolean;
  boundingBox: Box3 | null;
  boundingSphere: Sphere | null;
  customSort: BatchedMeshSortFunction | null;
  _instanceInfo: { visible: boolean; active: boolean; geometryIndex: number }[];
  _geometryInfo: BatchedMeshGeometryInfo[];
  _availableInstanceIds: number[];
  _availableGeometryIds: number[];
  _nextIndexStart: number;
  _nextVertexStart: number;
  _geometryCount: number;
  _visibilityChanged: boolean;
  _geometryInitialized: boolean;
  _maxInstanceCount: number;
  _maxVertexCount: number;
  _maxIndexCount: number;
  _multiDrawCounts: Int32Array;
  _multiDrawStarts: Int32Array;
  _multiDrawCount: number;
  _multiDrawBytesPerElement: number;
  _matricesTexture: DataTexture | null;
  _indirectTexture: DataTexture | null;
  _colorsTexture: DataTexture | null;

  /**
   * Constructs a new batched mesh.
   *
   * @param maxInstanceCount - The maximum number of individual instances planned to be added and rendered.
   * @param maxVertexCount - The maximum number of vertices to be used by all unique geometries.
   * @param [maxIndexCount=maxVertexCount*2] - The maximum number of indices to be used by all unique geometries
   * @param [material] - The mesh material.
   */
  constructor(
    maxInstanceCount: number,
    maxVertexCount: number,
    maxIndexCount: number = maxVertexCount * 2,
    material: Material | Material[],
  ) {
    super(new BufferGeometry(), material);
    if (material === undefined) throw new Error("BatchedMesh requires explicit material.");
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isBatchedMesh = true;
    /**
     * When set ot `true`, the individual objects of a batch are frustum culled.
     *
     * @default true
     */
    this.perObjectFrustumCulled = true;
    /**
     * When set to `true`, the individual objects of a batch are sorted to improve overdraw-related artifacts.
     * If the material is marked as "transparent" objects are rendered back to front and if not then they are
     * rendered front to back.
     *
     * @default true
     */
    this.sortObjects = true;
    /**
     * The bounding box of the batched mesh. Can be computed via {@link BatchedMesh#computeBoundingBox}.
     *
     * @default null
     */
    this.boundingBox = null;
    /**
     * The bounding sphere of the batched mesh. Can be computed via {@link BatchedMesh#computeBoundingSphere}.
     *
     * @default null
     */
    this.boundingSphere = null;
    /**
     * Takes a sort a function that is run before render. The function takes a list of instances to
     * sort and a camera. The objects in the list include a "z" field to perform a depth-ordered
     * sort with.
     *
     * @default null
     */
    this.customSort = null;
    // stores visible, active, and geometry id per instance and reserved buffer ranges for geometries
    this._instanceInfo = [];
    this._geometryInfo = [];
    // instance, geometry ids that have been set as inactive, and are available to be overwritten
    this._availableInstanceIds = [];
    this._availableGeometryIds = [];
    // used to track where the next point is that geometry should be inserted
    this._nextIndexStart = 0;
    this._nextVertexStart = 0;
    this._geometryCount = 0;
    // flags
    this._visibilityChanged = true;
    this._geometryInitialized = false;
    // cached user options
    this._maxInstanceCount = maxInstanceCount;
    this._maxVertexCount = maxVertexCount;
    this._maxIndexCount = maxIndexCount;
    // buffers for multi draw
    this._multiDrawCounts = new Int32Array(maxInstanceCount);
    this._multiDrawStarts = new Int32Array(maxInstanceCount);
    this._multiDrawCount = 0;
    this._multiDrawBytesPerElement = 1;
    // Local matrix per geometry by using data texture
    this._matricesTexture = null;
    this._indirectTexture = null;
    this._colorsTexture = null;
    this._initMatricesTexture();
    this._initIndirectTexture();
  }
  /**
   * The maximum number of individual instances that can be stored in the batch.
   *
   * @readonly
   */
  get maxInstanceCount() {
    return this._maxInstanceCount;
  }
  /**
   * The instance count.
   *
   * @readonly
   */
  get instanceCount() {
    return this._instanceInfo.length - this._availableInstanceIds.length;
  }
  /**
   * The number of unused vertices.
   *
   * @readonly
   */
  get unusedVertexCount() {
    return this._maxVertexCount - this._nextVertexStart;
  }
  /**
   * The number of unused indices.
   *
   * @readonly
   */
  get unusedIndexCount() {
    return this._maxIndexCount - this._nextIndexStart;
  }
  _initMatricesTexture() {
    // layout (1 matrix = 4 pixels)
    //      RGBA RGBA RGBA RGBA (=> column1, column2, column3, column4)
    //  with  8x8  pixel texture max   16 matrices * 4 pixels =  (8 * 8)
    //       16x16 pixel texture max   64 matrices * 4 pixels = (16 * 16)
    //       32x32 pixel texture max  256 matrices * 4 pixels = (32 * 32)
    //       64x64 pixel texture max 1024 matrices * 4 pixels = (64 * 64)
    let size = Math.sqrt(this._maxInstanceCount * 4); // 4 pixels needed for 1 matrix
    size = Math.ceil(size / 4) * 4;
    size = Math.max(size, 4);
    const matricesArray = new Float32Array(size * size * 4); // 4 floats per RGBA pixel
    const matricesTexture = new DataTexture(matricesArray, size, size, RGBAFormat, FloatType);
    this._matricesTexture = matricesTexture;
  }
  _initIndirectTexture() {
    let size = Math.sqrt(this._maxInstanceCount);
    size = Math.ceil(size);
    const indirectArray = new Uint32Array(size * size);
    const indirectTexture = new DataTexture(indirectArray, size, size, RedIntegerFormat, UnsignedIntType);
    this._indirectTexture = indirectTexture;
  }
  _initColorsTexture() {
    let size = Math.sqrt(this._maxInstanceCount);
    size = Math.ceil(size);
    // 4 floats per RGBA pixel initialized to white
    const colorsArray = new Float32Array(size * size * 4).fill(1);
    const colorsTexture = new DataTexture(colorsArray, size, size, RGBAFormat, FloatType);
    colorsTexture.colorSpace = ColorManagement.workingColorSpace;
    this._colorsTexture = colorsTexture;
  }
  _initializeGeometry(reference: BufferGeometry) {
    const geometry = this.geometry;
    const maxVertexCount = this._maxVertexCount;
    const maxIndexCount = this._maxIndexCount;
    if (this._geometryInitialized === false) {
      for (const attributeName in reference.attributes) {
        const srcAttribute = reference.getAttribute(attributeName) as BufferAttribute | InterleavedBufferAttribute;
        const { array, itemSize, normalized } = srcAttribute;
        const dstArray = new (array.constructor as any)(maxVertexCount * itemSize);
        const dstAttribute = new BufferAttribute(dstArray, itemSize, normalized);
        geometry.setAttribute(attributeName, dstAttribute);
      }
      if (reference.getIndex() !== null) {
        // Reserve last u16 index for primitive restart.
        const indexArray = maxVertexCount > 65535 ? new Uint32Array(maxIndexCount) : new Uint16Array(maxIndexCount);
        geometry.setIndex(new BufferAttribute(indexArray, 1));
      }
      this._geometryInitialized = true;
    }
  }
  // Make sure the geometry is compatible with the existing combined geometry attributes
  _validateGeometry(geometry: BufferGeometry) {
    // check to ensure the geometries are using consistent attributes and indices
    const batchGeometry = this.geometry;
    if (Boolean(geometry.getIndex()!) !== Boolean(batchGeometry.getIndex())) {
      throw new Error('THREE.BatchedMesh: All geometries must consistently have "index".');
    }
    for (const attributeName in batchGeometry.attributes) {
      if (!geometry.hasAttribute(attributeName)) {
        throw new Error(
          `THREE.BatchedMesh: Added geometry missing "${attributeName}". All geometries must have consistent attributes.`,
        );
      }
      const srcAttribute = geometry.getAttribute(attributeName) as BufferAttribute | InterleavedBufferAttribute;
      const dstAttribute = batchGeometry.getAttribute(attributeName) as BufferAttribute;
      if (srcAttribute.itemSize !== dstAttribute.itemSize || srcAttribute.normalized !== dstAttribute.normalized) {
        throw new Error(
          `THREE.BatchedMesh: Added geometry attribute "${attributeName}" has an inconsistent itemSize or normalized value.`,
        );
      }
    }
  }
  /**
   * Validates the instance defined by the given ID.
   *
   * @param instanceId - The instance to validate.
   */
  validateInstanceId(instanceId: number) {
    const instanceInfo = this._instanceInfo;
    if (instanceId < 0 || instanceId >= instanceInfo.length || instanceInfo[instanceId].active === false) {
      throw new Error(
        `THREE.BatchedMesh: Invalid instanceId ${instanceId}. Instance is either out of range or has been deleted.`,
      );
    }
  }
  /**
   * Validates the geometry defined by the given ID.
   *
   * @param geometryId - The geometry to validate.
   */
  validateGeometryId(geometryId: number) {
    const geometryInfoList = this._geometryInfo;
    if (geometryId < 0 || geometryId >= geometryInfoList.length || geometryInfoList[geometryId].active === false) {
      throw new Error(
        `THREE.BatchedMesh: Invalid geometryId ${geometryId}. Geometry is either out of range or has been deleted.`,
      );
    }
  }
  /**
   * Takes a sort a function that is run before render. The function takes a list of instances to
   * sort and a camera. The objects in the list include a "z" field to perform a depth-ordered sort with.
   *
   * @param func - The custom sort function.
   * @return A reference to this batched mesh.
   */
  setCustomSort(func: BatchedMeshSortFunction | null): this;
  setCustomSort(func?: any): this {
    this.customSort = func;
    return this;
  }
  /**
   * Computes the bounding box, updating {@link BatchedMesh#boundingBox}.
   * Bounding boxes aren't computed by default. They need to be explicitly computed,
   * otherwise they are `null`. Must be recomputed when instances change.
   */
  computeBoundingBox() {
    if (this.boundingBox === null) {
      this.boundingBox = new Box3();
    }
    const boundingBox = this.boundingBox;
    const instanceInfo = this._instanceInfo;
    boundingBox.makeEmpty();
    for (let i = 0, l = instanceInfo.length; i < l; i++) {
      if (instanceInfo[i].active === false) continue;
      const geometryId = instanceInfo[i].geometryIndex;
      this.getMatrixAt(i, _matrix);
      this.getBoundingBoxAt(geometryId, _box)!.applyMatrix4(_matrix);
      boundingBox.union(_box);
    }
  }
  /**
   * Computes the bounding sphere, updating {@link BatchedMesh#boundingSphere}.
   * The engine computes the bounding sphere once when it is needed. Must be
   * recomputed when instances change.
   */
  computeBoundingSphere() {
    if (this.boundingSphere === null) {
      this.boundingSphere = new Sphere();
    }
    const boundingSphere = this.boundingSphere;
    const instanceInfo = this._instanceInfo;
    boundingSphere.makeEmpty();
    for (let i = 0, l = instanceInfo.length; i < l; i++) {
      if (instanceInfo[i].active === false) continue;
      const geometryId = instanceInfo[i].geometryIndex;
      this.getMatrixAt(i, _matrix);
      this.getBoundingSphereAt(geometryId, _sphere)!.applyMatrix4(_matrix);
      boundingSphere.union(_sphere);
    }
  }
  /**
   * Adds a new instance to the batch using the geometry of the given ID and returns
   * a new id referring to the new instance to be used by other functions.
   *
   * @param geometryId - The ID of a previously added geometry via {@link BatchedMesh#addGeometry}.
   * @return The instance ID.
   */
  addInstance(geometryId: number): number {
    const atCapacity = this._instanceInfo.length >= this.maxInstanceCount;
    // ensure we're not over geometry
    if (atCapacity && this._availableInstanceIds.length === 0) {
      throw new Error("THREE.BatchedMesh: Maximum item count reached.");
    }
    const instanceInfo: any = {
      visible: true,
      active: true,
      geometryIndex: geometryId,
    };
    let drawId: any = null;
    // Prioritize using previously freed instance ids
    if (this._availableInstanceIds.length > 0) {
      this._availableInstanceIds.sort(ascIdSort);
      drawId = this._availableInstanceIds.shift()!;
      this._instanceInfo[drawId] = instanceInfo;
    } else {
      drawId = this._instanceInfo.length;
      this._instanceInfo.push(instanceInfo);
    }
    const matricesTexture = this._matricesTexture!;
    _matrix.identity().toArray(matricesTexture!.image.data!, drawId * 16);
    matricesTexture!.needsUpdate = true;
    const colorsTexture = this._colorsTexture;
    if (colorsTexture) {
      _whiteColor.toArray(colorsTexture.image.data!, drawId * 4);
      colorsTexture.needsUpdate = true;
    }
    this._visibilityChanged = true;
    return drawId;
  }
  /**
   * Adds the given geometry to the batch and returns the associated
   * geometry id referring to it to be used in other functions.
   *
   * @param geometry - The geometry to add.
   * @param [reservedVertexCount=-1] - Optional parameter specifying the amount of
   * vertex buffer space to reserve for the added geometry. This is necessary if it is planned
   * to set a new geometry at this index at a later time that is larger than the original geometry.
   * Defaults to the length of the given geometry vertex buffer.
   * @param [reservedIndexCount=-1] - Optional parameter specifying the amount of index
   * buffer space to reserve for the added geometry. This is necessary if it is planned to set a
   * new geometry at this index at a later time that is larger than the original geometry. Defaults to
   * the length of the given geometry index buffer.
   * @return The geometry ID.
   */
  addGeometry(geometry: BufferGeometry, reservedVertexCount: number = -1, reservedIndexCount: number = -1): number {
    this._initializeGeometry(geometry);
    this._validateGeometry(geometry);
    const geometryInfo: BatchedMeshGeometryInfo = {
      // geometry information
      vertexStart: -1,
      vertexCount: -1,
      reservedVertexCount: -1,
      indexStart: -1,
      indexCount: -1,
      reservedIndexCount: -1,
      // draw range information
      start: -1,
      count: -1,
      // state
      boundingBox: null,
      boundingSphere: null,
      active: true,
    };
    const geometryInfoList = this._geometryInfo;
    geometryInfo.vertexStart = this._nextVertexStart;
    geometryInfo.reservedVertexCount =
      reservedVertexCount === -1
        ? (geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute).count
        : reservedVertexCount;
    const index = geometry.getIndex()!;
    const hasIndex = index !== null;
    if (hasIndex) {
      geometryInfo.indexStart = this._nextIndexStart;
      geometryInfo.reservedIndexCount = reservedIndexCount === -1 ? index.count : reservedIndexCount;
    }
    if (
      (geometryInfo.indexStart !== -1 &&
        geometryInfo.indexStart + geometryInfo.reservedIndexCount > this._maxIndexCount) ||
      geometryInfo.vertexStart + geometryInfo.reservedVertexCount > this._maxVertexCount
    ) {
      throw new Error("THREE.BatchedMesh: Reserved space request exceeds the maximum buffer size.");
    }
    // update id
    let geometryId: any;
    if (this._availableGeometryIds.length > 0) {
      this._availableGeometryIds.sort(ascIdSort);
      geometryId = this._availableGeometryIds.shift()!;
      geometryInfoList[geometryId] = geometryInfo;
    } else {
      geometryId = this._geometryCount;
      this._geometryCount++;
      geometryInfoList.push(geometryInfo);
    }
    // update the geometry
    this.setGeometryAt(geometryId, geometry);
    // increment the next geometry position
    this._nextIndexStart = geometryInfo.indexStart + geometryInfo.reservedIndexCount;
    this._nextVertexStart = geometryInfo.vertexStart + geometryInfo.reservedVertexCount;
    return geometryId;
  }
  /**
   * Replaces the geometry at the given ID with the provided geometry. Throws an error if there
   * is not enough space reserved for geometry. Calling this will change all instances that are
   * rendering that geometry.
   *
   * @param geometryId - The ID of the geometry that should be replaced with the given geometry.
   * @param geometry - The new geometry.
   * @return The geometry ID.
   */
  setGeometryAt(geometryId: number, geometry: BufferGeometry): number {
    if (geometryId >= this._geometryCount) {
      throw new Error("THREE.BatchedMesh: Maximum geometry count reached.");
    }
    this._validateGeometry(geometry);
    const batchGeometry = this.geometry;
    const hasIndex = batchGeometry.getIndex() !== null;
    const dstIndex = batchGeometry.getIndex();
    const srcIndex = geometry.getIndex()!;
    const geometryInfo = this._geometryInfo[geometryId];
    if (
      (hasIndex && srcIndex!.count > geometryInfo.reservedIndexCount) ||
      (geometry.attributes as any).position.count > geometryInfo.reservedVertexCount
    ) {
      throw new Error("THREE.BatchedMesh: Reserved space not large enough for provided geometry.");
    }
    // copy geometry buffer data over
    const vertexStart = geometryInfo.vertexStart;
    const reservedVertexCount = geometryInfo.reservedVertexCount;
    geometryInfo.vertexCount = (
      geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute
    ).count;
    for (const attributeName in batchGeometry.attributes) {
      // copy attribute data
      const srcAttribute = geometry.getAttribute(attributeName) as BufferAttribute | InterleavedBufferAttribute;
      const dstAttribute = batchGeometry.getAttribute(attributeName) as BufferAttribute;
      copyAttributeData(srcAttribute, dstAttribute, vertexStart);
      // fill the rest in with zeroes
      const itemSize = srcAttribute.itemSize;
      for (let i = srcAttribute.count, l = reservedVertexCount; i < l; i++) {
        const index = vertexStart + i;
        for (let c = 0; c < itemSize; c++) {
          dstAttribute.setComponent(index, c, 0);
        }
      }
      dstAttribute.needsUpdate = true;
      dstAttribute.addUpdateRange(vertexStart * itemSize, reservedVertexCount * itemSize);
    }
    // copy index
    if (hasIndex) {
      const indexStart = geometryInfo.indexStart;
      const reservedIndexCount = geometryInfo.reservedIndexCount;
      geometryInfo.indexCount = geometry.getIndex()!.count;
      // copy index data over
      for (let i = 0; i < srcIndex!.count; i++) {
        dstIndex!.setX(indexStart + i, vertexStart + srcIndex!.getX(i));
      }
      // fill the rest in with zeroes
      for (let i = srcIndex!.count, l = reservedIndexCount; i < l; i++) {
        dstIndex!.setX(indexStart + i, vertexStart);
      }
      dstIndex!.needsUpdate = true;
      dstIndex!.addUpdateRange(indexStart, geometryInfo.reservedIndexCount);
    }
    // update the draw range
    geometryInfo.start = hasIndex ? geometryInfo.indexStart : geometryInfo.vertexStart;
    geometryInfo.count = hasIndex ? geometryInfo.indexCount : geometryInfo.vertexCount;
    // store the bounding boxes
    geometryInfo.boundingBox = null;
    if (geometry.boundingBox !== null) {
      geometryInfo.boundingBox = geometry.boundingBox.clone();
    }
    geometryInfo.boundingSphere = null;
    if (geometry.boundingSphere !== null) {
      geometryInfo.boundingSphere = geometry.boundingSphere.clone();
    }
    this._visibilityChanged = true;
    return geometryId;
  }
  /**
   * Deletes the geometry defined by the given ID from this batch. Any instances referencing
   * this geometry will also be removed as a side effect.
   *
   * @param geometryId - The ID of the geometry to remove from the batch.
   * @return A reference to this batched mesh.
   */
  deleteGeometry(geometryId: number): this {
    const geometryInfoList = this._geometryInfo;
    if (geometryId >= geometryInfoList.length || geometryInfoList[geometryId].active === false) {
      return this;
    }
    // delete any instances associated with this geometry
    const instanceInfo = this._instanceInfo;
    for (let i = 0, l = instanceInfo.length; i < l; i++) {
      if (instanceInfo[i].active && instanceInfo[i].geometryIndex === geometryId) {
        this.deleteInstance(i);
      }
    }
    geometryInfoList[geometryId].active = false;
    this._availableGeometryIds.push(geometryId);
    this._visibilityChanged = true;
    return this;
  }
  /**
   * Deletes an existing instance from the batch using the given ID.
   *
   * @param instanceId - The ID of the instance to remove from the batch.
   * @return A reference to this batched mesh.
   */
  deleteInstance(instanceId: number): this {
    this.validateInstanceId(instanceId);
    this._instanceInfo[instanceId].active = false;
    this._availableInstanceIds.push(instanceId);
    this._visibilityChanged = true;
    return this;
  }
  /**
   * Repacks the sub geometries in BatchedMesh to remove any unused space remaining from
   * previously deleted geometry, freeing up space to add new geometry.
   *
   * @return A reference to this batched mesh.
   */
  optimize(): this {
    // track the next indices to copy data to
    let nextVertexStart = 0;
    let nextIndexStart = 0;
    // Iterate over all geometry ranges in order sorted from earliest in the geometry buffer to latest
    // in the geometry buffer. Because draw range objects can be reused there is no guarantee of their order.
    const geometryInfoList = this._geometryInfo;
    const indices = geometryInfoList
      .map((e: any, i: number) => i)
      .sort((a: number, b: number) => {
        return geometryInfoList[a].vertexStart - geometryInfoList[b].vertexStart;
      });
    const geometry = this.geometry;
    for (let i = 0, l = geometryInfoList.length; i < l; i++) {
      // if a geometry range is inactive then don't copy anything
      const index = indices[i];
      const geometryInfo = geometryInfoList[index];
      if (geometryInfo.active === false) {
        continue;
      }
      // if a geometry contains an index buffer then shift it, as well
      if (geometry.index !== null) {
        if (geometryInfo.indexStart !== nextIndexStart) {
          const { indexStart, vertexStart, reservedIndexCount } = geometryInfo;
          const index = geometry.index;
          const array = index.array;
          // shift the index pointers based on how the vertex data will shift
          // adjusting the index must happen first so the original vertex start value is available
          const elementDelta = nextVertexStart - vertexStart;
          for (let j = indexStart; j < indexStart + reservedIndexCount; j++) {
            array[j] = array[j] + elementDelta;
          }
          index.array.copyWithin(nextIndexStart, indexStart, indexStart + reservedIndexCount);
          index.addUpdateRange(nextIndexStart, reservedIndexCount);
          index.needsUpdate = true;
          geometryInfo.indexStart = nextIndexStart;
        }
        nextIndexStart += geometryInfo.reservedIndexCount;
      }
      // if a geometry needs to be moved then copy attribute data to overwrite unused space
      if (geometryInfo.vertexStart !== nextVertexStart) {
        const { vertexStart, reservedVertexCount } = geometryInfo;
        const attributes = geometry.attributes;
        for (const key in attributes) {
          const attribute = attributes[key] as BufferAttribute;
          const { array, itemSize } = attribute;
          array.copyWithin(
            nextVertexStart * itemSize,
            vertexStart * itemSize,
            (vertexStart + reservedVertexCount) * itemSize,
          );
          attribute.addUpdateRange(nextVertexStart * itemSize, reservedVertexCount * itemSize);
          attribute.needsUpdate = true;
        }
        geometryInfo.vertexStart = nextVertexStart;
      }
      nextVertexStart += geometryInfo.reservedVertexCount;
      geometryInfo.start = geometry.index ? geometryInfo.indexStart : geometryInfo.vertexStart;
    }
    this._nextIndexStart = nextIndexStart;
    this._nextVertexStart = nextVertexStart;
    this._visibilityChanged = true;
    return this;
  }
  /**
   * Returns the bounding box for the given geometry.
   *
   * @param geometryId - The ID of the geometry to return the bounding box for.
   * @param target - The target object that is used to store the method's result.
   * @return The geometry's bounding box. Returns `null` if no geometry has been found for the given ID.
   */
  getBoundingBoxAt(geometryId: number, target: Box3): Box3 | null {
    if (geometryId >= this._geometryCount) {
      return null;
    }
    // compute bounding box
    const geometry = this.geometry;
    const geometryInfo = this._geometryInfo[geometryId];
    if (geometryInfo.boundingBox === null) {
      const box = new Box3();
      const index = geometry.index;
      const position = geometry.attributes.position as BufferAttribute;
      for (let i = geometryInfo.start, l = geometryInfo.start + geometryInfo.count; i < l; i++) {
        let iv = i;
        if (index) {
          iv = index.getX(iv);
        }
        box.expandByPoint(_vector.fromBufferAttribute(position, iv));
      }
      geometryInfo.boundingBox = box;
    }
    target.copy(geometryInfo.boundingBox);
    return target;
  }
  /**
   * Returns the bounding sphere for the given geometry.
   *
   * @param geometryId - The ID of the geometry to return the bounding sphere for.
   * @param target - The target object that is used to store the method's result.
   * @return The geometry's bounding sphere. Returns `null` if no geometry has been found for the given ID.
   */
  getBoundingSphereAt(geometryId: number, target: Sphere): Sphere | null {
    if (geometryId >= this._geometryCount) {
      return null;
    }
    // compute bounding sphere
    const geometry = this.geometry;
    const geometryInfo = this._geometryInfo[geometryId];
    if (geometryInfo.boundingSphere === null) {
      const sphere = new Sphere();
      this.getBoundingBoxAt(geometryId, _box)!;
      _box.getCenter(sphere.center);
      const index = geometry.index;
      const position = geometry.attributes.position as BufferAttribute;
      let maxRadiusSq = 0;
      for (let i = geometryInfo.start, l = geometryInfo.start + geometryInfo.count; i < l; i++) {
        let iv = i;
        if (index) {
          iv = index.getX(iv);
        }
        _vector.fromBufferAttribute(position, iv);
        maxRadiusSq = Math.max(maxRadiusSq, sphere.center.distanceToSquared(_vector));
      }
      sphere.radius = Math.sqrt(maxRadiusSq);
      geometryInfo.boundingSphere = sphere;
    }
    target.copy(geometryInfo.boundingSphere);
    return target;
  }
  /**
   * Sets the given local transformation matrix to the defined instance.
   * Negatively scaled matrices are not supported.
   *
   * @param instanceId - The ID of an instance to set the matrix of.
   * @param matrix - A 4x4 matrix representing the local transformation of a single instance.
   * @return A reference to this batched mesh.
   */
  setMatrixAt(instanceId: number, matrix: Matrix4): this {
    this.validateInstanceId(instanceId);
    const matricesTexture = this._matricesTexture!;
    const matricesArray = this._matricesTexture!.image.data!;
    matrix.toArray(matricesArray, instanceId * 16);
    matricesTexture!.needsUpdate = true;
    return this;
  }
  /**
   * Returns the local transformation matrix of the defined instance.
   *
   * @param instanceId - The ID of an instance to get the matrix of.
   * @param matrix - The target object that is used to store the method's result.
   * @return The instance's local transformation matrix.
   */
  getMatrixAt(instanceId: number, matrix: Matrix4): Matrix4 {
    this.validateInstanceId(instanceId);
    return matrix.fromArray(this._matricesTexture!.image.data!, instanceId * 16);
  }
  /**
   * Sets the given color to the defined instance.
   *
   * @param instanceId - The ID of an instance to set the color of.
   * @param color - The color to set the instance to. Use a `Vector4` to also define alpha.
   * @return A reference to this batched mesh.
   */
  setColorAt(instanceId: number, color: Color | Vector4): this;
  setColorAt(instanceId: number, color?: any): this {
    this.validateInstanceId(instanceId);
    if (this._colorsTexture === null) {
      this._initColorsTexture();
    }
    color.toArray(this._colorsTexture!.image.data!, instanceId * 4);
    this._colorsTexture!.needsUpdate = true;
    return this;
  }
  /**
   * Returns the color of the defined instance.
   *
   * @param instanceId - The ID of an instance to get the color of.
   * @param color - The target object that is used to store the method's result.
   * @return The instance's color.  Use a `Vector4` to also retrieve alpha.
   */
  getColorAt<T extends Color | Vector4>(instanceId: number, color: T): T;
  getColorAt(instanceId: number, color?: any): Color | Vector4 {
    this.validateInstanceId(instanceId);
    if (this._colorsTexture === null) {
      if (color.isVector4) {
        return color.set(1, 1, 1, 1);
      } else {
        return color.setRGB(1, 1, 1);
      }
    } else {
      return color.fromArray(this._colorsTexture!.image.data!, instanceId * 4);
    }
  }
  /**
   * Sets the visibility of the instance.
   *
   * @param instanceId - The id of the instance to set the visibility of.
   * @param visible - Whether the instance is visible or not.
   * @return A reference to this batched mesh.
   */
  setVisibleAt(instanceId: number, visible: boolean): this {
    this.validateInstanceId(instanceId);
    if (this._instanceInfo[instanceId].visible === visible) {
      return this;
    }
    this._instanceInfo[instanceId].visible = visible;
    this._visibilityChanged = true;
    return this;
  }
  /**
   * Returns the visibility state of the defined instance.
   *
   * @param instanceId - The ID of an instance to get the visibility state of.
   * @return Whether the instance is visible or not.
   */
  getVisibleAt(instanceId: number): boolean {
    this.validateInstanceId(instanceId);
    return this._instanceInfo[instanceId].visible;
  }
  /**
   * Sets the geometry ID of the instance at the given index.
   *
   * @param instanceId - The ID of the instance to set the geometry ID of.
   * @param geometryId - The geometry ID to be use by the instance.
   * @return A reference to this batched mesh.
   */
  setGeometryIdAt(instanceId: number, geometryId: number): this {
    this.validateInstanceId(instanceId);
    this.validateGeometryId(geometryId);
    this._instanceInfo[instanceId].geometryIndex = geometryId;
    this._visibilityChanged = true;
    return this;
  }
  /**
   * Returns the geometry ID of the defined instance.
   *
   * @param instanceId - The ID of an instance to get the geometry ID of.
   * @return The instance's geometry ID.
   */
  getGeometryIdAt(instanceId: number): number {
    this.validateInstanceId(instanceId);
    return this._instanceInfo[instanceId].geometryIndex;
  }
  /**
   * Get the range representing the subset of triangles related to the attached geometry,
   * indicating the starting offset and count, or throws an error if invalid.
   *
   * @param geometryId - The id of the geometry to get the range of.
   * @param [target] - The target object that is used to store the method's result.
   * @return The result object with range data.
   */
  getGeometryRangeAt(geometryId: number, target: Partial<BatchedMeshGeometryRange> = {}): BatchedMeshGeometryRange {
    this.validateGeometryId(geometryId);
    const geometryInfo = this._geometryInfo[geometryId];
    target.vertexStart = geometryInfo.vertexStart;
    target.vertexCount = geometryInfo.vertexCount;
    target.reservedVertexCount = geometryInfo.reservedVertexCount;
    target.indexStart = geometryInfo.indexStart;
    target.indexCount = geometryInfo.indexCount;
    target.reservedIndexCount = geometryInfo.reservedIndexCount;
    target.start = geometryInfo.start;
    target.count = geometryInfo.count;
    return target as BatchedMeshGeometryRange;
  }
  /**
   * Resizes the necessary buffers to support the provided number of instances.
   * If the provided arguments shrink the number of instances but there are not enough
   * unused Ids at the end of the list then an error is thrown.
   *
   * @param maxInstanceCount - The max number of individual instances that can be added and rendered by the batch.
   */
  setInstanceCount(maxInstanceCount: number) {
    // shrink the available instances as much as possible
    const availableInstanceIds = this._availableInstanceIds;
    const instanceInfo = this._instanceInfo;
    availableInstanceIds.sort(ascIdSort);
    while (availableInstanceIds[availableInstanceIds.length - 1] === instanceInfo.length - 1) {
      instanceInfo.pop();
      availableInstanceIds.pop();
    }
    // throw an error if it can't be shrunk to the desired size
    if (maxInstanceCount < instanceInfo.length) {
      throw new Error(
        `THREE.BatchedMesh: Instance ids outside the range ${maxInstanceCount} are being used. Cannot shrink instance count.`,
      );
    }
    // copy the multi draw counts
    const multiDrawCounts = new Int32Array(maxInstanceCount);
    const multiDrawStarts = new Int32Array(maxInstanceCount);
    copyArrayContents(this._multiDrawCounts, multiDrawCounts);
    copyArrayContents(this._multiDrawStarts, multiDrawStarts);
    this._multiDrawCounts = multiDrawCounts;
    this._multiDrawStarts = multiDrawStarts;
    this._maxInstanceCount = maxInstanceCount;
    // update texture data for instance sampling
    const indirectTexture = this._indirectTexture!;
    const matricesTexture = this._matricesTexture!;
    const colorsTexture = this._colorsTexture;
    indirectTexture!.dispose();
    this._initIndirectTexture();
    copyArrayContents(indirectTexture!.image.data!, this._indirectTexture!.image.data!);
    this._indirectTexture!.needsUpdate = true;
    matricesTexture!.dispose();
    this._initMatricesTexture();
    copyArrayContents(matricesTexture!.image.data!, this._matricesTexture!.image.data!);
    this._matricesTexture!.needsUpdate = true;
    if (colorsTexture) {
      colorsTexture.dispose();
      this._initColorsTexture();
      copyArrayContents(colorsTexture.image.data!, this._colorsTexture!.image.data!);
      this._colorsTexture!.needsUpdate = true;
    }
  }
  /**
   * Resizes the available space in the batch's vertex and index buffer attributes to the provided sizes.
   * If the provided arguments shrink the geometry buffers but there is not enough unused space at the
   * end of the geometry attributes then an error is thrown.
   *
   * @param maxVertexCount - The maximum number of vertices to be used by all unique geometries to resize to.
   * @param maxIndexCount - The maximum number of indices to be used by all unique geometries to resize to.
   */
  setGeometrySize(maxVertexCount: number, maxIndexCount: number) {
    // Check if we can shrink to the requested vertex attribute size
    const validRanges = [...this._geometryInfo].filter((info?: any) => info.active);
    const requiredVertexLength = Math.max(
      ...validRanges.map((range?: any) => range.vertexStart + range.reservedVertexCount),
    );
    if (requiredVertexLength > maxVertexCount) {
      throw new Error(
        `THREE.BatchedMesh: Geometry vertex values are being used outside the range ${maxVertexCount}. Cannot shrink further.`,
      );
    }
    // Check if we can shrink to the requested index attribute size
    if (this.geometry.index) {
      const requiredIndexLength = Math.max(
        ...validRanges.map((range?: any) => range.indexStart + range.reservedIndexCount),
      );
      if (requiredIndexLength > maxIndexCount) {
        throw new Error(
          `THREE.BatchedMesh: Geometry index values are being used outside the range ${maxIndexCount}. Cannot shrink further.`,
        );
      }
    }
    //
    // dispose of the previous geometry
    const oldGeometry = this.geometry;
    oldGeometry.dispose();
    // recreate the geometry needed based on the previous variant
    this._maxVertexCount = maxVertexCount;
    this._maxIndexCount = maxIndexCount;
    if (this._geometryInitialized) {
      this._geometryInitialized = false;
      this.geometry = new BufferGeometry();
      this._initializeGeometry(oldGeometry);
    }
    // copy data from the previous geometry
    const geometry = this.geometry;
    if (oldGeometry.index) {
      copyArrayContents(oldGeometry.index.array, geometry.index!.array);
    }
    for (const key in oldGeometry.attributes) {
      copyArrayContents(
        (oldGeometry.attributes[key] as BufferAttribute).array,
        (geometry.attributes[key] as BufferAttribute).array,
      );
    }
    this._visibilityChanged = true;
  }
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    if (_mesh === undefined) _mesh = new Mesh(new BufferGeometry(), this.material);
    try {
      const instanceInfo = this._instanceInfo;
      const geometryInfoList = this._geometryInfo;
      const matrixWorld = this.matrixWorld;
      const batchGeometry = this.geometry;
      _mesh.material = this.material;
      _mesh.geometry.index = batchGeometry.index;
      _mesh.geometry.attributes = batchGeometry.attributes;
      if (_mesh.geometry.boundingBox === null) {
        _mesh.geometry.boundingBox = new Box3();
      }
      if (_mesh.geometry.boundingSphere === null) {
        _mesh.geometry.boundingSphere = new Sphere();
      }
      for (let i = 0, l = instanceInfo.length; i < l; i++) {
        if (!instanceInfo[i].visible || !instanceInfo[i].active) {
          continue;
        }
        const geometryId = instanceInfo[i].geometryIndex;
        const geometryInfo = geometryInfoList[geometryId];
        _mesh.geometry.setDrawRange(geometryInfo.start, geometryInfo.count);
        // get the intersects
        this.getMatrixAt(i, _mesh.matrixWorld).premultiply(matrixWorld);
        this.getBoundingBoxAt(geometryId, _mesh.geometry.boundingBox)!;
        this.getBoundingSphereAt(geometryId, _mesh.geometry.boundingSphere)!;
        _mesh.raycast(raycaster, _batchIntersects);
        // add batch id to the intersects
        for (let j = 0, l = _batchIntersects.length; j < l; j++) {
          const intersect = _batchIntersects[j];
          intersect.object = this;
          intersect.batchId = i;
          intersects.push(intersect);
        }
        _batchIntersects.length = 0;
      }
    } finally {
      _batchIntersects.length = 0;
      _mesh.material = undefined;
      _mesh.geometry.index = null;
      _mesh.geometry.attributes = {};
      _mesh.geometry.setDrawRange(0, Infinity);
    }
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)(0, 0, 0, this.material).copy(this, recursive);
  }
  copy(source: BatchedMesh, recursive: boolean = true): this {
    this.geometry.dispose();
    this._matricesTexture!.dispose();
    this._indirectTexture!.dispose();
    this._colorsTexture?.dispose();
    super.copy(source, recursive);
    this.customSort = source.customSort;
    this._visibilityChanged = true;
    this.geometry = source.geometry.clone();
    this.perObjectFrustumCulled = source.perObjectFrustumCulled;
    this.sortObjects = source.sortObjects;
    this.boundingBox = source.boundingBox !== null ? source.boundingBox.clone() : null;
    this.boundingSphere = source.boundingSphere !== null ? source.boundingSphere.clone() : null;
    this._geometryInfo = source._geometryInfo.map((info?: any) => ({
      ...info,
      boundingBox: info.boundingBox !== null ? info.boundingBox.clone() : null,
      boundingSphere: info.boundingSphere !== null ? info.boundingSphere.clone() : null,
    }));
    this._instanceInfo = source._instanceInfo.map((info?: any) => ({ ...info }));
    this._availableInstanceIds = source._availableInstanceIds.slice();
    this._availableGeometryIds = source._availableGeometryIds.slice();
    this._nextIndexStart = source._nextIndexStart;
    this._nextVertexStart = source._nextVertexStart;
    this._geometryCount = source._geometryCount;
    this._maxInstanceCount = source._maxInstanceCount;
    this._maxVertexCount = source._maxVertexCount;
    this._maxIndexCount = source._maxIndexCount;
    this._geometryInitialized = source._geometryInitialized;
    this._multiDrawCounts = source._multiDrawCounts.slice();
    this._multiDrawStarts = source._multiDrawStarts.slice();
    this._multiDrawBytesPerElement = source._multiDrawBytesPerElement;
    this._indirectTexture = source._indirectTexture!.clone();
    this._indirectTexture!.source = new TextureSource({
      ...source._indirectTexture!.image,
      data: source._indirectTexture!.image.data!.slice(),
    });
    this._indirectTexture!.needsUpdate = true;
    this._matricesTexture = source._matricesTexture!.clone();
    this._matricesTexture!.source = new TextureSource({
      ...source._matricesTexture!.image,
      data: source._matricesTexture!.image.data!.slice(),
    });
    this._matricesTexture!.needsUpdate = true;
    if (source._colorsTexture !== null) {
      this._colorsTexture = source._colorsTexture!.clone();
      this._colorsTexture!.source = new TextureSource({
        ...source._colorsTexture!.image,
        data: source._colorsTexture!.image.data!.slice(),
      });
      this._colorsTexture!.needsUpdate = true;
    } else {
      this._colorsTexture = null;
    }
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    // Assuming the geometry is not shared with other meshes
    this.geometry.dispose();
    this._matricesTexture!.dispose();
    this._matricesTexture = null;
    this._indirectTexture!.dispose();
    this._indirectTexture = null;
    if (this._colorsTexture !== null) {
      this._colorsTexture!.dispose();
      this._colorsTexture = null;
    }
  }
  /**
   * Updates the draw parameters for the next draw. Depending on {@link BatchedMesh#perObjectFrustumCulled}
   * and {@link BatchedMesh#sortObjects}, this includes per-object frustum culling and sorting.
   *
   * @private
   * @param camera - The camera of the next draw.
   * @param geometry - The batch's geometry.
   * @param material - The material of the next draw.
   */
  _updateDrawParameters(camera: Camera, geometry: BufferGeometry, material: Material) {
    // if visibility has not changed and frustum culling and object sorting is not required
    // then skip iterating over all items
    if (!this._visibilityChanged && !this.perObjectFrustumCulled && !this.sortObjects) {
      return;
    }
    // the indexed version of the multi draw function requires specifying the start
    // offset in bytes.
    const index = geometry.getIndex()!;
    let bytesPerElement = index === null ? 1 : index.array.BYTES_PER_ELEMENT;
    // the "wireframe" attribute implicitly creates a line attribute in the renderer, which is double
    // the vertices to draw (3 lines per triangle) so we multiply the draw counts / starts and make
    // assumptions about the index buffer byte size.
    let multiDrawMultiplier = 1;
    if ((material as Material & MaterialProperties).wireframe) {
      multiDrawMultiplier = 2;
      bytesPerElement = (geometry.attributes as any).position.count > 65535 ? 4 : 2;
    }
    const instanceInfo = this._instanceInfo;
    const multiDrawStarts = this._multiDrawStarts;
    const multiDrawCounts = this._multiDrawCounts;
    const geometryInfoList = this._geometryInfo;
    const perObjectFrustumCulled = this.perObjectFrustumCulled;
    const indirectTexture = this._indirectTexture!;
    const indirectArray = indirectTexture!.image.data!;
    const frustum = (camera as any).isArrayCamera ? _frustumArray : _frustum;
    // prepare the frustum in the local frame
    if (perObjectFrustumCulled) {
      if ((camera as any).isArrayCamera) {
        (frustum as any).setFromArrayCamera(camera as ArrayCamera);
      } else {
        _matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.matrixWorld);
        (frustum as any).setFromProjectionMatrix(_matrix, camera.coordinateSystem, camera.reversedDepth);
      }
    }
    let multiDrawCount = 0;
    if (this.sortObjects) {
      // get the camera position in the local frame
      _matrix.copy(this.matrixWorld).invert();
      _cameraPosition.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(_matrix);
      _forward.set(0, 0, -1).transformDirection(camera.matrixWorld).transformDirection(_matrix);
      for (let i = 0, l = instanceInfo.length; i < l; i++) {
        if (instanceInfo[i].visible && instanceInfo[i].active) {
          const geometryId = instanceInfo[i].geometryIndex;
          // get the bounds in world space
          this.getMatrixAt(i, _matrix);
          this.getBoundingSphereAt(geometryId, _sphere)!.applyMatrix4(_matrix);
          // determine whether the batched geometry is within the frustum
          let culled = false;
          if (perObjectFrustumCulled) {
            culled = !frustum.intersectsSphere(_sphere);
          }
          if (!culled) {
            // get the distance from camera used for sorting
            const geometryInfo = geometryInfoList[geometryId];
            const z = _temp.subVectors(_sphere.center, _cameraPosition).dot(_forward);
            _renderList.push(geometryInfo.start, geometryInfo.count, z, i);
          }
        }
      }
      // Sort the draw ranges and prep for rendering
      const list = _renderList.list;
      const customSort = this.customSort;
      if (customSort === null) {
        list.sort(material.transparent ? sortTransparent : sortOpaque);
      } else {
        customSort.call(this, list, camera);
      }
      for (let i = 0, l = list.length; i < l; i++) {
        const item = list[i];
        (multiDrawStarts as any)[multiDrawCount] = item.start * bytesPerElement * multiDrawMultiplier;
        (multiDrawCounts as any)[multiDrawCount] = item.count * multiDrawMultiplier;
        indirectArray[multiDrawCount] = item.index;
        multiDrawCount++;
      }
      _renderList.reset();
    } else {
      for (let i = 0, l = instanceInfo.length; i < l; i++) {
        if (instanceInfo[i].visible && instanceInfo[i].active) {
          const geometryId = instanceInfo[i].geometryIndex;
          // determine whether the batched geometry is within the frustum
          let culled = false;
          if (perObjectFrustumCulled) {
            // get the bounds in world space
            this.getMatrixAt(i, _matrix);
            this.getBoundingSphereAt(geometryId, _sphere)!.applyMatrix4(_matrix);
            culled = !frustum.intersectsSphere(_sphere);
          }
          if (!culled) {
            const geometryInfo = geometryInfoList[geometryId];
            (multiDrawStarts as any)[multiDrawCount] = geometryInfo.start * bytesPerElement * multiDrawMultiplier;
            (multiDrawCounts as any)[multiDrawCount] = geometryInfo.count * multiDrawMultiplier;
            indirectArray[multiDrawCount] = i;
            multiDrawCount++;
          }
        }
      }
    }
    indirectTexture!.needsUpdate = true;
    this._multiDrawCount = multiDrawCount;
    this._multiDrawBytesPerElement = bytesPerElement;
    this._visibilityChanged = false;
  }
  onBeforeRender(
    renderer: WebGLRenderer,
    scene: Object3D,
    camera: Camera,
    geometry: BufferGeometry,
    material: Material,
  ) {
    this._updateDrawParameters(camera, geometry, material);
  }
  onBeforeShadow(
    renderer: WebGLRenderer,
    object: Object3D,
    camera: Camera,
    shadowCamera: Camera,
    geometry: BufferGeometry,
    depthMaterial: Material,
  ) {
    this._updateDrawParameters(shadowCamera, geometry, depthMaterial);
  }
}
