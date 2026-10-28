import type { BufferGeometry } from "../core/BufferGeometry";
import type { Color } from "../math/Color";
import type { Intersection } from "../core/Raycaster";
import type { Material } from "../materials/Material";
import type { Raycaster } from "../core/Raycaster";
import { InstancedBufferAttribute } from "../core/InstancedBufferAttribute";
import { Mesh } from "./Mesh";
import { Box3 } from "../math/Box3";
import { Matrix4 } from "../math/Matrix4";
import { Sphere } from "../math/Sphere";
import { DataTexture } from "../textures/DataTexture";
import { TextureType, PixelFormat } from "../constants";
const _instanceLocalMatrix = /*@__PURE__*/ new Matrix4();
const _instanceWorldMatrix = /*@__PURE__*/ new Matrix4();
const _instanceIntersects: Intersection[] = [];
const _box3 = /*@__PURE__*/ new Box3();
const _identity = /*@__PURE__*/ new Matrix4();
let _mesh: Mesh | undefined;
const _sphere = /*@__PURE__*/ new Sphere();
/**
 * A special version of a mesh with instanced rendering support. Use
 * this class if you have to render a large number of objects with the same
 * geometry and material(s) but with different world transformations. The usage
 * of 'InstancedMesh' will help you to reduce the number of draw calls and thus
 * improve the overall rendering performance in your application.
 *
 */
export class InstancedMesh extends Mesh {
  isInstancedMesh: boolean;
  instanceMatrix: InstancedBufferAttribute;
  instanceColor: InstancedBufferAttribute | null;
  morphTexture: DataTexture | null;
  count: number;
  boundingBox: Box3 | null;
  boundingSphere: Sphere | null;

  /**
   * Constructs a new instanced mesh.
   *
   * @param geometry - The mesh geometry.
   * @param material - The mesh material.
   * @param count - The number of instances.
   */
  constructor(geometry: BufferGeometry, material: Material | Material[], count: number) {
    super(geometry, material);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInstancedMesh = true;
    /**
     * Represents the local transformation of all instances. You have to set its
     * {@link BufferAttribute#needsUpdate} flag to true if you modify instanced data
     * via {@link InstancedMesh#setMatrixAt}.
     *
     */
    this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
    /**
     * Represents the color of all instances. You have to set its
     * {@link BufferAttribute#needsUpdate} flag to true if you modify instanced data
     * via {@link InstancedMesh#setColorAt}.
     *
     * @default null
     */
    this.instanceColor = null;
    /**
     * Represents the morph target weights of all instances. You have to set its
     * {@link Texture#needsUpdate} flag to true if you modify instanced data
     * via {@link InstancedMesh#setMorphAt}.
     *
     * @default null
     */
    this.morphTexture = null;
    /**
     * The number of instances.
     *
     */
    this.count = count;
    /**
     * The bounding box of the instanced mesh. Can be computed via {@link InstancedMesh#computeBoundingBox}.
     *
     * @default null
     */
    this.boundingBox = null;
    /**
     * The bounding sphere of the instanced mesh. Can be computed via {@link InstancedMesh#computeBoundingSphere}.
     *
     * @default null
     */
    this.boundingSphere = null;
    for (let i = 0; i < count; i++) {
      this.setMatrixAt(i, _identity);
    }
  }
  /**
   * Computes the bounding box of the instanced mesh, and updates {@link InstancedMesh#boundingBox}.
   * The bounding box is not automatically computed by the engine; this method must be called by your app.
   * You may need to recompute the bounding box if an instance is transformed via {@link InstancedMesh#setMatrixAt}.
   */
  computeBoundingBox() {
    const geometry = this.geometry;
    const count = this.count;
    if (this.boundingBox === null) {
      this.boundingBox = new Box3();
    }
    if (geometry.boundingBox === null) {
      geometry.computeBoundingBox();
    }
    this.boundingBox.makeEmpty();
    for (let i = 0; i < count; i++) {
      this.getMatrixAt(i, _instanceLocalMatrix);
      _box3.copy(geometry.boundingBox!).applyMatrix4(_instanceLocalMatrix);
      this.boundingBox.union(_box3);
    }
  }
  /**
   * Computes the bounding sphere of the instanced mesh, and updates {@link InstancedMesh#boundingSphere}
   * The engine automatically computes the bounding sphere when it is needed, e.g., for ray casting or view frustum culling.
   * You may need to recompute the bounding sphere if an instance is transformed via {@link InstancedMesh#setMatrixAt}.
   */
  computeBoundingSphere() {
    const geometry = this.geometry;
    const count = this.count;
    if (this.boundingSphere === null) {
      this.boundingSphere = new Sphere();
    }
    if (geometry.boundingSphere === null) {
      geometry.computeBoundingSphere();
    }
    this.boundingSphere!.makeEmpty();
    for (let i = 0; i < count; i++) {
      this.getMatrixAt(i, _instanceLocalMatrix);
      _sphere.copy(geometry.boundingSphere!).applyMatrix4(_instanceLocalMatrix);
      this.boundingSphere!.union(_sphere);
    }
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)(this.geometry, this.material, 0).copy(this, recursive);
  }
  copy(source: InstancedMesh, recursive?: boolean): this {
    super.copy(source, recursive);
    this.instanceMatrix.copy(source.instanceMatrix);
    this.morphTexture = source.morphTexture !== null ? source.morphTexture.clone() : null;
    this.instanceColor = source.instanceColor !== null ? source.instanceColor.clone() : null;
    this.count = source.count;
    this.boundingBox = source.boundingBox !== null ? source.boundingBox.clone() : null;
    this.boundingSphere = source.boundingSphere !== null ? source.boundingSphere.clone() : null;
    return this;
  }
  /**
   * Gets the color of the defined instance.
   *
   * @param index - The instance index.
   * @param color - The target object that is used to store the method's result.
   * @return A reference to the target color.
   */
  getColorAt(index: number, color: Color): Color {
    if (this.instanceColor === null) {
      return color.setRGB(1, 1, 1);
    } else {
      return color.fromArray(this.instanceColor.array, index * 3);
    }
  }
  /**
   * Gets the local transformation matrix of the defined instance.
   *
   * @param index - The instance index.
   * @param matrix - The target object that is used to store the method's result.
   * @return A reference to the target matrix.
   */
  getMatrixAt(index: number, matrix: Matrix4): Matrix4 {
    return matrix.fromArray(this.instanceMatrix.array, index * 16);
  }
  /**
   * Gets the morph target weights of the defined instance.
   *
   * @param index - The instance index.
   * @param object - The target object that is used to store the method's result.
   */
  getMorphAt(index: number, object: Mesh & { morphTargetInfluences: number[] }) {
    const objectInfluences = object.morphTargetInfluences;
    const array = this.morphTexture!.source.data.data;
    const len = objectInfluences.length + 1; // All influences + the baseInfluenceSum
    const dataIndex = index * len + 1; // Skip the baseInfluenceSum at the beginning
    for (let i = 0; i < objectInfluences.length; i++) {
      objectInfluences[i] = array[dataIndex + i];
    }
  }
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    const matrixWorld = this.matrixWorld;
    const raycastTimes = this.count;
    if (_mesh === undefined) {
      _mesh = new Mesh(this.geometry, this.material);
      _mesh.morphTargetInfluences = undefined;
    }
    _mesh.geometry = this.geometry;
    _mesh.material = this.material;
    if (_mesh.material === undefined) return;
    // test with bounding sphere first
    if (this.boundingSphere === null) this.computeBoundingSphere();
    _sphere.copy(this.boundingSphere!);
    _sphere.applyMatrix4(matrixWorld);
    if (raycaster.ray.intersectsSphere(_sphere) === false) return;
    // now test each instance
    for (let instanceId = 0; instanceId < raycastTimes; instanceId++) {
      // calculate the world matrix for each instance
      this.getMatrixAt(instanceId, _instanceLocalMatrix);
      _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);
      // the mesh represents this single instance
      _mesh.matrixWorld = _instanceWorldMatrix;
      _mesh.raycast(raycaster, _instanceIntersects);
      // process the result of raycast
      for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
        const intersect = _instanceIntersects[i];
        intersect.instanceId = instanceId;
        intersect.object = this;
        intersects.push(intersect);
      }
      _instanceIntersects.length = 0;
    }
  }
  /**
   * Sets the given color to the defined instance. Make sure you set the `needsUpdate` flag of
   * {@link InstancedMesh#instanceColor} to `true` after updating all the colors.
   *
   * @param index - The instance index.
   * @param color - The instance color.
   * @return A reference to this instanced mesh.
   */
  setColorAt(index: number, color: Color): this {
    if (this.instanceColor === null) {
      this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count * 3).fill(1), 3);
    }
    color.toArray(this.instanceColor.array, index * 3);
    return this;
  }
  /**
   * Sets the given local transformation matrix to the defined instance. Make sure you set the `needsUpdate` flag of
   * {@link InstancedMesh#instanceMatrix} to `true` after updating all the matrices.
   *
   * @param index - The instance index.
   * @param matrix - The local transformation.
   * @return A reference to this instanced mesh.
   */
  setMatrixAt(index: number, matrix: Matrix4): this {
    matrix.toArray(this.instanceMatrix.array, index * 16);
    return this;
  }
  /**
   * Sets the morph target weights to the defined instance. Make sure you set the `needsUpdate` flag of
   * {@link InstancedMesh#morphTexture} to `true` after updating all the influences.
   *
   * @param index - The instance index.
   * @param object -  A mesh which `morphTargetInfluences` property containing the morph target weights
   * of a single instance.
   * @return A reference to this instanced mesh.
   */
  setMorphAt(index: number, object: Mesh & { morphTargetInfluences: number[] }): this {
    const objectInfluences = object.morphTargetInfluences;
    const len = objectInfluences.length + 1; // morphBaseInfluence + all influences
    if (this.morphTexture === null) {
      this.morphTexture = new DataTexture(
        new Float32Array(len * this.count),
        len,
        this.count,
        PixelFormat.Red,
        TextureType.Float,
      );
    }
    const array = this.morphTexture!.source.data.data;
    let morphInfluencesSum = 0;
    for (let i = 0; i < objectInfluences.length; i++) {
      morphInfluencesSum += objectInfluences[i];
    }
    const morphBaseInfluence = this.geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
    const dataIndex = len * index;
    array[dataIndex] = morphBaseInfluence;
    array.set(objectInfluences, dataIndex + 1);
    return this;
  }
  updateMorphTargets() {}
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    if (this.morphTexture !== null) {
      this.morphTexture!.dispose();
      this.morphTexture = null;
    }
  }
}
