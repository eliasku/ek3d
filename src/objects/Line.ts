import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { BufferGeometry } from "../core/BufferGeometry";
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
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { warn } from "../utils";
const _vStart = /*@__PURE__*/ new Vector3();
const _vEnd = /*@__PURE__*/ new Vector3();
const _inverseMatrix = /*@__PURE__*/ new Matrix4();
const _ray = /*@__PURE__*/ new Ray();
const _sphere = /*@__PURE__*/ new Sphere();
const _intersectPointOnRay = /*@__PURE__*/ new Vector3();
const _intersectPointOnSegment = /*@__PURE__*/ new Vector3();
/**
 * A continuous line. The line are rendered by connecting consecutive
 * vertices with straight lines.
 *
 * ```typescript
 * import { BufferGeometry } from 'ek3d/core/BufferGeometry';
 * import { Line } from 'ek3d/objects/Line';
 * import { LineBasicMaterial } from 'ek3d/materials/LineBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const scene = new Scene();
 *
 * const material = new LineBasicMaterial( { color: 0x0000ff } );
 *
 * const points = [];
 * points.push( new Vector3( - 10, 0, 0 ) );
 * points.push( new Vector3( 0, 10, 0 ) );
 * points.push( new Vector3( 10, 0, 0 ) );
 *
 * const geometry = new BufferGeometry().setFromPoints( points );
 *
 * const line = new Line( geometry, material );
 * scene.add( line );
 * ```
 *
 */
export class Line<TMaterial extends Material | Material[] = Material | Material[]> extends Object3D {
  isLine: boolean;

  geometry: BufferGeometry;
  material: TMaterial;
  morphTargetDictionary: Record<string, number> | undefined;
  morphTargetInfluences: number[] | undefined;

  /**
   * Constructs a new line.
   *
   * @param geometry - The line geometry.
   * @param material - The line material.
   */
  constructor(geometry: BufferGeometry, material: NoInfer<TMaterial>) {
    super();
    if (geometry === undefined || material === undefined)
      throw new Error("Line requires explicit geometry and material.");
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLine = true;
    this.type = "Line";
    /**
     * The line geometry.
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
  copy(source: Line, recursive?: boolean): this {
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
    this.material = (Array.isArray(source.material) ? source.material.slice() : source.material) as TMaterial;
    this.geometry = source.geometry;
    return this;
  }
  /**
   * Computes an array of distance values which are necessary for rendering dashed lines.
   * For each vertex in the geometry, the method calculates the cumulative length from the
   * current point to the very beginning of the line.
   *
   * @return A reference to this line.
   */
  computeLineDistances(): this {
    const geometry = this.geometry;
    // we assume non-indexed geometry
    if (geometry.index === null) {
      const positionAttribute = geometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
      const lineDistances = [0];
      for (let i = 1, l = positionAttribute.count; i < l; i++) {
        _vStart.fromBufferAttribute(positionAttribute, i - 1);
        _vEnd.fromBufferAttribute(positionAttribute, i);
        lineDistances[i] = lineDistances[i - 1];
        lineDistances[i] += _vStart.distanceTo(_vEnd);
      }
      geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
    } else {
      warn("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    }
    return this;
  }
  /**
   * Returns `true` if this line intersects the given frustum.
   *
   * @param frustum - The frustum to test.
   * @return Whether this line intersects the given frustum or not.
   */
  intersectsFrustum(frustum: Frustum | FrustumArray): boolean;
  intersectsFrustum(frustum?: any): boolean {
    return frustum.intersectsObject(this);
  }
  /**
   * Computes intersection points between a casted ray and this line.
   *
   * @param raycaster - The raycaster.
   * @param intersects - The target array that holds the intersection points.
   */
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Line.threshold;
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
    const step = (this as any).isLineSegments ? 2 : 1;
    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position;
    if (index !== null) {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(index.count, drawRange.start + drawRange.count);
      for (let i = start, l = end - 1; i < l; i += step) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const intersect = checkIntersection(this, raycaster, _ray, localThresholdSq, a, b, i);
        if (intersect) {
          intersects.push(intersect);
        }
      }
      if ((this as any).isLineLoop) {
        const a = index.getX(end - 1);
        const b = index.getX(start);
        const intersect = checkIntersection(this, raycaster, _ray, localThresholdSq, a, b, end - 1);
        if (intersect) {
          intersects.push(intersect);
        }
      }
    } else {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (let i = start, l = end - 1; i < l; i += step) {
        const intersect = checkIntersection(this, raycaster, _ray, localThresholdSq, i, i + 1, i);
        if (intersect) {
          intersects.push(intersect);
        }
      }
      if ((this as any).isLineLoop) {
        const intersect = checkIntersection(this, raycaster, _ray, localThresholdSq, end - 1, start, end - 1);
        if (intersect) {
          intersects.push(intersect);
        }
      }
    }
  }
  /**
   * Sets the values of {@link Line#morphTargetDictionary} and {@link Line#morphTargetInfluences}
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
function checkIntersection(object?: any, raycaster?: any, ray?: any, thresholdSq?: any, a?: any, b?: any, i?: any) {
  const positionAttribute = object.geometry.attributes.position;
  _vStart.fromBufferAttribute(positionAttribute, a);
  _vEnd.fromBufferAttribute(positionAttribute, b);
  const distSq = ray.distanceSqToSegment(_vStart, _vEnd, _intersectPointOnRay, _intersectPointOnSegment);
  if (distSq > thresholdSq) return;
  _intersectPointOnRay.applyMatrix4(object.matrixWorld); // Move back to world space for distance calculation
  const distance = raycaster.ray.origin.distanceTo(_intersectPointOnRay);
  if (distance < raycaster.near || distance > raycaster.far) return;
  return {
    distance: distance,
    // What do we want? intersection point on the ray or on the segment??
    // point: raycaster.ray.at( distance ),
    point: _intersectPointOnSegment.clone().applyMatrix4(object.matrixWorld),
    index: i,
    face: null,
    faceIndex: null,
    barycoord: null,
    object: object,
  };
}
