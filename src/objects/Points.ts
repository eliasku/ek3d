import type { BufferGeometry } from "../core/BufferGeometry";
import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Frustum } from "../math/Frustum";
import type { FrustumArray } from "../math/FrustumArray";
import type { Intersection } from "../core/Raycaster";
import type { Material } from "../materials/Material";
import type { Raycaster } from "../core/Raycaster";
import { Sphere } from "../math/Sphere";
import { Ray } from "../math/Ray";
import { Matrix4 } from "../math/Matrix4";
import { Object3D } from "../core/Object3D";
import { Vector3 } from "../math/Vector3";
const _inverseMatrix = /*@__PURE__*/ new Matrix4();
const _ray = /*@__PURE__*/ new Ray();
const _sphere = /*@__PURE__*/ new Sphere();
const _position = /*@__PURE__*/ new Vector3();
/**
 * A class for displaying points or point clouds.
 *
 */
export class Points extends Object3D {
  isPoints: boolean;

  geometry: BufferGeometry;
  material: Material | Material[];
  morphTargetDictionary: Record<string, number> | undefined;
  morphTargetInfluences: number[] | undefined;

  /**
   * Constructs a new point cloud.
   *
   * @param geometry - The points geometry.
   * @param material - The points material.
   */
  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super();
    if (geometry === undefined || material === undefined)
      throw new Error("Points requires explicit geometry and material.");
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isPoints = true;
    this.type = "Points";
    /**
     * The points geometry.
     *
     */
    this.geometry = geometry;
    /**
     * The line material.
     *
     * Supplied explicitly by the caller.
     */
    this.material = material;
    /**
     * A dictionary representing the morph targets in the geometry. The key is the
     * morph targets name, the value its attribute index. This member is `undefined`
     * by default and only set when morph targets are detected in the geometry.
     *
     * @default undefined
     */
    this.morphTargetDictionary = undefined;
    /**
     * An array of weights typically in the range `[0,1]` that specify how much of the morph
     * is applied. This member is `undefined` by default and only set when morph targets are
     * detected in the geometry.
     *
     * @default undefined
     */
    this.morphTargetInfluences = undefined;
    this.updateMorphTargets();
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)(this.geometry, this.material).copy(this, recursive);
  }
  copy(source: Points, recursive?: boolean): this {
    super.copy(source, recursive);
    if (source.morphTargetInfluences !== undefined) {
      this.morphTargetInfluences = source.morphTargetInfluences.slice();
    } else {
      this.morphTargetInfluences = undefined;
    }
    if (source.morphTargetDictionary !== undefined) {
      this.morphTargetDictionary = Object.assign({}, source.morphTargetDictionary);
    } else {
      this.morphTargetDictionary = undefined;
    }
    this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
    this.geometry = source.geometry;
    return this;
  }
  /**
   * Returns `true` if this point cloud intersects the given frustum.
   *
   * @param frustum - The frustum to test.
   * @return Whether this point cloud intersects the given frustum or not.
   */
  intersectsFrustum(frustum: Frustum | FrustumArray): boolean;
  intersectsFrustum(frustum?: any): boolean {
    return frustum.intersectsObject(this);
  }
  /**
   * Computes intersection points between a casted ray and this point cloud.
   *
   * @param raycaster - The raycaster.
   * @param intersects - The target array that holds the intersection points.
   */
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Points.threshold;
    const drawRange = geometry.drawRange;
    // Checking boundingSphere distance to ray
    if (geometry.boundingSphere! === null) geometry.computeBoundingSphere();
    _sphere.copy(geometry.boundingSphere!);
    _sphere.applyMatrix4(matrixWorld);
    _sphere.radius += threshold;
    if (raycaster.ray.intersectsSphere(_sphere) === false) return;
    //
    _inverseMatrix.copy(matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    const localThreshold = threshold / (((this as any).scale.x + (this as any).scale.y + (this as any).scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position as BufferAttribute | InterleavedBufferAttribute;
    if (index !== null) {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(index.count, drawRange.start + drawRange.count);
      for (let i = start, il = end; i < il; i++) {
        const a = index.getX(i);
        _position.fromBufferAttribute(positionAttribute, a);
        testPoint(_position, a, localThresholdSq, matrixWorld, raycaster, intersects, this);
      }
    } else {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (let i = start, l = end; i < l; i++) {
        _position.fromBufferAttribute(positionAttribute, i);
        testPoint(_position, i, localThresholdSq, matrixWorld, raycaster, intersects, this);
      }
    }
  }
  /**
   * Sets the values of {@link Points#morphTargetDictionary} and {@link Points#morphTargetInfluences}
   * to make sure existing morph targets can influence this 3D object.
   */
  updateMorphTargets() {
    const geometry = this.geometry;
    const morphAttributes = geometry.morphAttributes;
    const keys = Object.keys(morphAttributes);
    if (keys.length > 0) {
      const morphAttribute = morphAttributes[keys[0]];
      if (morphAttribute !== undefined) {
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
          const name = morphAttribute[m].name || String(m);
          this.morphTargetInfluences.push(0);
          this.morphTargetDictionary[name] = m;
        }
      }
    }
  }
}
function testPoint(
  point?: any,
  index?: any,
  localThresholdSq?: any,
  matrixWorld?: any,
  raycaster?: any,
  intersects?: any,
  object?: any,
) {
  const rayPointDistanceSq = _ray.distanceSqToPoint(point);
  if (rayPointDistanceSq < localThresholdSq) {
    const intersectPoint = new Vector3();
    _ray.closestPointToPoint(point, intersectPoint);
    intersectPoint.applyMatrix4(matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(intersectPoint);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({
      distance: distance,
      distanceToRay: Math.sqrt(rayPointDistanceSq),
      point: intersectPoint,
      index: index,
      face: null,
      faceIndex: null,
      barycoord: null,
      object: object,
    });
  }
}
