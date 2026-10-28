import type { Matrix4 } from "./Matrix4";
import type { Plane } from "./Plane";
import { Box3 } from "./Box3";
import { Vector3 } from "./Vector3";
const _box = /*@__PURE__*/ new Box3();
const _v1 = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();
/**
 * An analytical 3D sphere defined by a center and radius. This class is mainly
 * used as a Bounding Sphere for 3D objects.
 */
export class Sphere {
  isSphere: boolean;
  center: Vector3;
  radius: number;

  /**
   * Constructs a new sphere.
   *
   * @param [center=(0,0,0)] - The center of the sphere
   * @param [radius=-1] - The radius of the sphere.
   */
  constructor(center: Vector3 = new Vector3(), radius: number = -1) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isSphere = true;
    /**
     * The center of the sphere
     *
     */
    this.center = center;
    /**
     * The radius of the sphere.
     *
     */
    this.radius = radius;
  }
  /**
   * Sets the sphere's components by copying the given values.
   *
   * @param center - The center.
   * @param radius - The radius.
   * @return A reference to this sphere.
   */
  set(center: Vector3, radius: number): Sphere {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }
  /**
   * Computes the minimum bounding sphere for list of points.
   * If the optional center point is given, it is used as the sphere's
   * center. Otherwise, the center of the axis-aligned bounding box
   * encompassing the points is calculated.
   *
   * @param points - A list of points in 3D space.
   * @param [optionalCenter] - The center of the sphere.
   * @return A reference to this sphere.
   */
  setFromPoints(points: Vector3[], optionalCenter?: Vector3): Sphere {
    const center = this.center;
    if (optionalCenter !== undefined) {
      center.copy(optionalCenter);
    } else {
      _box.setFromPoints(points).getCenter(center);
    }
    let maxRadiusSq = 0;
    for (let i = 0, il = points.length; i < il; i++) {
      maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(points[i]));
    }
    this.radius = Math.sqrt(maxRadiusSq);
    return this;
  }
  /**
   * Copies the values of the given sphere to this instance.
   *
   * @param sphere - The sphere to copy.
   * @return A reference to this sphere.
   */
  copy(sphere: Sphere): Sphere {
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    return this;
  }
  /**
   * Returns `true` if the sphere is empty (the radius set to a negative number).
   *
   * Spheres with a radius of `0` contain only their center point and are not
   * considered to be empty.
   *
   * @return Whether this sphere is empty or not.
   */
  isEmpty(): boolean {
    return this.radius < 0;
  }
  /**
   * Makes this sphere empty which means in encloses a zero space in 3D.
   *
   * @return A reference to this sphere.
   */
  makeEmpty(): Sphere {
    this.center.set(0, 0, 0);
    this.radius = -1;
    return this;
  }
  /**
   * Returns `true` if this sphere contains the given point inclusive of
   * the surface of the sphere.
   *
   * @param point - The point to check.
   * @return Whether this sphere contains the given point or not.
   */
  containsPoint(point: Vector3): boolean {
    return point.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  /**
   * Returns the closest distance from the boundary of the sphere to the
   * given point. If the sphere contains the point, the distance will
   * be negative.
   *
   * @param point - The point to compute the distance to.
   * @return The distance to the point.
   */
  distanceToPoint(point: Vector3): number {
    return point.distanceTo(this.center) - this.radius;
  }
  /**
   * Returns `true` if this sphere intersects with the given one.
   *
   * @param sphere - The sphere to test.
   * @return Whether this sphere intersects with the given one or not.
   */
  intersectsSphere(sphere: Sphere): boolean {
    const radiusSum = this.radius + sphere.radius;
    return sphere.center.distanceToSquared(this.center) <= radiusSum * radiusSum;
  }
  /**
   * Returns `true` if this sphere intersects with the given box.
   *
   * @param box - The box to test.
   * @return Whether this sphere intersects with the given box or not.
   */
  intersectsBox(box: Box3): boolean {
    return box.intersectsSphere(this);
  }
  /**
   * Returns `true` if this sphere intersects with the given plane.
   *
   * @param plane - The plane to test.
   * @return Whether this sphere intersects with the given plane or not.
   */
  intersectsPlane(plane: Plane): boolean {
    return Math.abs(plane.distanceToPoint(this.center)) <= this.radius;
  }
  /**
   * Clamps a point within the sphere. If the point is outside the sphere, it
   * will clamp it to the closest point on the edge of the sphere. Points
   * already inside the sphere will not be affected.
   *
   * @param point - The plane to clamp.
   * @param target - The target vector that is used to store the method's result.
   * @return The clamped point.
   */
  clampPoint(point: Vector3, target: Vector3): Vector3 {
    const deltaLengthSq = this.center.distanceToSquared(point);
    target.copy(point);
    if (deltaLengthSq > this.radius * this.radius) {
      target.sub(this.center).normalize();
      target.multiplyScalar(this.radius).add(this.center);
    }
    return target;
  }
  /**
   * Returns a bounding box that encloses this sphere.
   *
   * @param target - The target box that is used to store the method's result.
   * @return The bounding box that encloses this sphere.
   */
  getBoundingBox(target: Box3): Box3 {
    if (this.isEmpty()) {
      // Empty sphere produces empty bounding box
      target.makeEmpty();
      return target;
    }
    target.set(this.center, this.center);
    target.expandByScalar(this.radius);
    return target;
  }
  /**
   * Transforms this sphere with the given 4x4 transformation matrix.
   *
   * @param matrix - The transformation matrix.
   * @return A reference to this sphere.
   */
  applyMatrix4(matrix: Matrix4): Sphere {
    this.center.applyMatrix4(matrix);
    this.radius = this.radius * matrix.getMaxScaleOnAxis();
    return this;
  }
  /**
   * Translates the sphere's center by the given offset.
   *
   * @param offset - The offset.
   * @return A reference to this sphere.
   */
  translate(offset: Vector3): Sphere {
    this.center.add(offset);
    return this;
  }
  /**
   * Expands the boundaries of this sphere to include the given point.
   *
   * @param point - The point to include.
   * @return A reference to this sphere.
   */
  expandByPoint(point: Vector3): Sphere {
    if (this.isEmpty()) {
      this.center.copy(point);
      this.radius = 0;
      return this;
    }
    _v1.subVectors(point, this.center);
    const lengthSq = _v1.lengthSq();
    if (lengthSq > this.radius * this.radius) {
      // calculate the minimal sphere
      const length = Math.sqrt(lengthSq);
      const delta = (length - this.radius) * 0.5;
      this.center.addScaledVector(_v1, delta / length);
      this.radius += delta;
    }
    return this;
  }
  /**
   * Expands this sphere to enclose both the original sphere and the given sphere.
   *
   * @param sphere - The sphere to include.
   * @return A reference to this sphere.
   */
  union(sphere: Sphere): Sphere {
    if (sphere.isEmpty()) {
      return this;
    }
    if (this.isEmpty()) {
      this.copy(sphere);
      return this;
    }
    if (this.center.equals(sphere.center) === true) {
      this.radius = Math.max(this.radius, sphere.radius);
    } else {
      _v2.subVectors(sphere.center, this.center).setLength(sphere.radius);
      this.expandByPoint(_v1.copy(sphere.center).add(_v2));
      this.expandByPoint(_v1.copy(sphere.center).sub(_v2));
    }
    return this;
  }
  /**
   * Returns `true` if this sphere is equal with the given one.
   *
   * @param sphere - The sphere to test for equality.
   * @return Whether this bounding sphere is equal with the given one.
   */
  equals(sphere: Sphere): boolean {
    return sphere.center.equals(this.center) && sphere.radius === this.radius;
  }
  /**
   * Returns a new sphere with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Sphere {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Returns a serialized structure of the bounding sphere.
   *
   * @return Serialized structure with fields representing the object state.
   */
  toJSON() {
    return {
      radius: this.radius,
      center: this.center.toArray(),
    };
  }
  /**
   * Returns a serialized structure of the bounding sphere.
   *
   * @param json - The serialized json to set the sphere from.
   * @return A reference to this bounding sphere.
   */
  fromJSON(json?: any): Sphere {
    this.radius = json.radius;
    this.center.fromArray(json.center);
    return this;
  }
}
