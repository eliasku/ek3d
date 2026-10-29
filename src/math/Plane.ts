import type { Box3 } from "./Box3";
import type { Line3 } from "./Line3";
import type { Matrix4 } from "./Matrix4";
import type { Sphere } from "./Sphere";
import { Matrix3 } from "./Matrix3";
import { Vector3 } from "./Vector3";
const _vector1 = /*@__PURE__*/ new Vector3();
const _vector2 = /*@__PURE__*/ new Vector3();
const _normalMatrix = /*@__PURE__*/ new Matrix3();
/**
 * A two dimensional surface that extends infinitely in 3D space, represented
 * in [Hessian normal form](https://mathworld.wolfram.com/HessianNormalForm.html)
 * by a unit length normal vector and a constant.
 */
export class Plane {
  isPlane: boolean;
  normal: Vector3;
  constant: number;

  /**
   * Constructs a new plane.
   *
   * @param [normal=(1,0,0)] - A unit length vector defining the normal of the plane.
   * @param [constant=0] - The signed distance from the origin to the plane.
   */
  constructor(normal: Vector3 = new Vector3(1, 0, 0), constant: number = 0) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isPlane = true;
    /**
     * A unit length vector defining the normal of the plane.
     *
     */
    this.normal = normal;
    /**
     * The signed distance from the origin to the plane.
     *
     * @default 0
     */
    this.constant = constant;
  }
  /**
   * Sets the plane components by copying the given values.
   *
   * @param normal - The normal.
   * @param constant - The constant.
   * @return A reference to this plane.
   */
  set(normal: Vector3, constant: number): Plane {
    this.normal.copy(normal);
    this.constant = constant;
    return this;
  }
  /**
   * Sets the plane components by defining `x`, `y`, `z` as the
   * plane normal and `w` as the constant.
   *
   * @param x - The value for the normal's x component.
   * @param y - The value for the normal's y component.
   * @param z - The value for the normal's z component.
   * @param w - The constant value.
   * @return A reference to this plane.
   */
  setComponents(x: number, y: number, z: number, w: number): Plane {
    this.normal.set(x, y, z);
    this.constant = w;
    return this;
  }
  /**
   * Sets the plane from the given normal and coplanar point (that is a point
   * that lies onto the plane).
   *
   * @param normal - The normal.
   * @param point - A coplanar point.
   * @return A reference to this plane.
   */
  setFromNormalAndCoplanarPoint(normal: Vector3, point: Vector3): Plane {
    this.normal.copy(normal);
    this.constant = -point.dot(this.normal);
    return this;
  }
  /**
   * Sets the plane from three coplanar points. The winding order is
   * assumed to be counter-clockwise, and determines the direction of
   * the plane normal.
   *
   * @param a - The first coplanar point.
   * @param b - The second coplanar point.
   * @param c - The third coplanar point.
   * @return A reference to this plane.
   */
  setFromCoplanarPoints(a: Vector3, b: Vector3, c: Vector3): Plane {
    const normal = _vector1.subVectors(c, b).cross(_vector2.subVectors(a, b)).normalize();
    // Q: should an error be thrown if normal is zero (e.g. degenerate plane)?
    this.setFromNormalAndCoplanarPoint(normal, a);
    return this;
  }
  /**
   * Copies the values of the given plane to this instance.
   *
   * @param plane - The plane to copy.
   * @return A reference to this plane.
   */
  copy(plane: Plane): Plane {
    this.normal.copy(plane.normal);
    this.constant = plane.constant;
    return this;
  }
  /**
   * Normalizes the plane normal and adjusts the constant accordingly.
   *
   * @return A reference to this plane.
   */
  normalize(): Plane {
    // Note: will lead to a divide by zero if the plane is invalid.
    const inverseNormalLength = 1.0 / this.normal.length();
    this.normal.multiplyScalar(inverseNormalLength);
    this.constant *= inverseNormalLength;
    return this;
  }
  /**
   * Negates both the plane normal and the constant.
   *
   * @return A reference to this plane.
   */
  negate(): Plane {
    this.constant *= -1;
    this.normal.negate();
    return this;
  }
  /**
   * Returns the signed distance from the given point to this plane.
   *
   * @param point - The point to compute the distance for.
   * @return The signed distance.
   */
  distanceToPoint(point: Vector3): number {
    return this.normal.dot(point) + this.constant;
  }
  /**
   * Returns the signed distance from the given sphere to this plane.
   *
   * @param sphere - The sphere to compute the distance for.
   * @return The signed distance.
   */
  distanceToSphere(sphere: Sphere): number {
    return this.distanceToPoint(sphere.center) - sphere.radius;
  }
  /**
   * Projects a the given point onto the plane.
   *
   * @param point - The point to project.
   * @param target - The target vector that is used to store the method's result.
   * @return The projected point on the plane.
   */
  projectPoint(point: Vector3, target: Vector3): Vector3 {
    return target.copy(point).addScaledVector(this.normal, -this.distanceToPoint(point));
  }
  /**
   * Returns the intersection point of the passed line and the plane. Returns
   * `null` if the line does not intersect. Returns the line's starting point if
   * the line is coplanar with the plane.
   *
   * @param line - The line to compute the intersection for.
   * @param target - The target vector that is used to store the method's result.
   * @param [clampToLine=true] - Whether to clamp the intersection to the line segment.
   * @return The intersection point. Returns `null` if no intersection is detected.
   */
  intersectLine(line: Line3, target: Vector3, clampToLine: boolean = true): Vector3 | null {
    const direction = line.delta(_vector1);
    const denominator = this.normal.dot(direction);
    if (denominator === 0) {
      // line is coplanar, return origin
      if (this.distanceToPoint(line.start) === 0) {
        return target.copy(line.start);
      }
      // Unsure if this is the correct method to handle this case.
      return null;
    }
    const t = -(line.start.dot(this.normal) + this.constant) / denominator;
    if (clampToLine === true && (t < 0 || t > 1)) {
      return null;
    }
    return target.copy(line.start).addScaledVector(direction, t);
  }
  /**
   * Returns `true` if the given line segment intersects with (passes through) the plane.
   *
   * @param line - The line to test.
   * @return Whether the given line segment intersects with the plane or not.
   */
  intersectsLine(line: Line3): boolean {
    // Note: this tests if a line intersects the plane, not whether it (or its end-points) are coplanar with it.
    const startSign = this.distanceToPoint(line.start);
    const endSign = this.distanceToPoint(line.end);
    return (startSign < 0 && endSign > 0) || (endSign < 0 && startSign > 0);
  }
  /**
   * Returns `true` if the given bounding box intersects with the plane.
   *
   * @param box - The bounding box to test.
   * @return Whether the given bounding box intersects with the plane or not.
   */
  intersectsBox(box: Box3): boolean {
    return box.intersectsPlane(this);
  }
  /**
   * Returns `true` if the given bounding sphere intersects with the plane.
   *
   * @param sphere - The bounding sphere to test.
   * @return Whether the given bounding sphere intersects with the plane or not.
   */
  intersectsSphere(sphere: Sphere): boolean {
    return sphere.intersectsPlane(this);
  }
  /**
   * Returns a coplanar vector to the plane, by calculating the
   * projection of the normal at the origin onto the plane.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The coplanar point.
   */
  coplanarPoint(target: Vector3): Vector3 {
    return target.copy(this.normal).multiplyScalar(-this.constant);
  }
  /**
   * Apply a 4x4 matrix to the plane. The matrix must be an affine, homogeneous transform.
   *
   * The optional normal matrix can be pre-computed like so:
   * ```ts
   * import { Matrix4 } from 'ek3d/math/Matrix4';
   * import { Matrix3 } from 'ek3d/math/Matrix3';
   *
   * const matrix = new Matrix4();
   * const optionalNormalMatrix = new Matrix3().getNormalMatrix( matrix );
   * ```
   *
   * @param matrix - The transformation matrix.
   * @param [optionalNormalMatrix] - A pre-computed normal matrix.
   * @return A reference to this plane.
   */
  applyMatrix4(matrix: Matrix4, optionalNormalMatrix?: Matrix3): Plane {
    const normalMatrix = optionalNormalMatrix || _normalMatrix.getNormalMatrix(matrix);
    const referencePoint = this.coplanarPoint(_vector1).applyMatrix4(matrix);
    const normal = this.normal.applyMatrix3(normalMatrix).normalize();
    this.constant = -referencePoint.dot(normal);
    return this;
  }
  /**
   * Translates the plane by the distance defined by the given offset vector.
   * Note that this only affects the plane constant and will not affect the normal vector.
   *
   * @param offset - The offset vector.
   * @return A reference to this plane.
   */
  translate(offset: Vector3): Plane {
    this.constant -= offset.dot(this.normal);
    return this;
  }
  /**
   * Returns `true` if this plane is equal with the given one.
   *
   * @param plane - The plane to test for equality.
   * @return Whether this plane is equal with the given one.
   */
  equals(plane: Plane): boolean {
    return plane.normal.equals(this.normal) && plane.constant === this.constant;
  }
  /**
   * Returns a new plane with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Plane {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Returns a serialized structure of the plane.
   *
   * @return Serialized structure with fields representing the object state.
   */
  toJSON() {
    return {
      normal: this.normal.toArray(),
      constant: this.constant,
    };
  }
  /**
   * Sets the plane properties from the given JSON.
   *
   * @param json - The serialized json to set the plane from.
   * @return A reference to this plane.
   */
  fromJSON(json?: any): Plane {
    this.normal.fromArray(json.normal);
    this.constant = json.constant;
    return this;
  }
}
