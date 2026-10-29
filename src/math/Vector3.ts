import type { BufferAttribute } from "../core/BufferAttribute";
import type { Camera } from "../cameras/Camera";
import type { Color } from "./Color";
import type { Cylindrical } from "./Cylindrical";
import type { Euler } from "./Euler";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Matrix3 } from "./Matrix3";
import type { Matrix4 } from "./Matrix4";
import type { Spherical } from "./Spherical";
import type { Vector4 } from "./Vector4";
import { clamp } from "./MathUtils";
import { Quaternion } from "./Quaternion";
/**
 * Class representing a 3D vector. A 3D vector is an ordered triplet of numbers
 * (labeled x, y and z), which can be used to represent a number of things, such as:
 *
 * - A point in 3D space.
 * - A direction and length in 3D space. In three.js the length will
 * always be the Euclidean distance(straight-line distance) from `(0, 0, 0)` to `(x, y, z)`
 * and the direction is also measured from `(0, 0, 0)` towards `(x, y, z)`.
 * - Any arbitrary ordered triplet of numbers.
 *
 * There are other things a 3D vector can be used to represent, such as
 * momentum vectors and so on, however these are the most
 * common uses in three.js.
 *
 * Iterating through a vector instance will yield its components `(x, y, z)` in
 * the corresponding order.
 * ```ts
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const a = new Vector3( 0, 1, 0 );
 *
 * //no arguments; will be initialised to (0, 0, 0)
 * const b = new Vector3( );
 *
 * const d = a.distanceTo( b );
 * ```
 */
export class Vector3 {
  x: number;
  y: number;
  z: number;
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  get isVector3(): boolean {
    return true;
  }

  /**
   * Constructs a new 3D vector.
   *
   * @param [x=0] - The x value of this vector.
   * @param [y=0] - The y value of this vector.
   * @param [z=0] - The z value of this vector.
   */
  constructor(x: number = 0, y: number = 0, z: number = 0) {
    /**
     * The x value of this vector.
     *
     */
    this.x = x;
    /**
     * The y value of this vector.
     *
     */
    this.y = y;
    /**
     * The z value of this vector.
     *
     */
    this.z = z;
  }
  /**
   * Sets the vector components.
   *
   * @param x - The value of the x component.
   * @param y - The value of the y component.
   * @param z - The value of the z component.
   * @return A reference to this vector.
   */
  set(x: number, y: number, z: number): Vector3 {
    if (z === undefined) z = this.z; // sprite.scale.set(x,y)
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param scalar - The value to set for all vector components.
   * @return A reference to this vector.
   */
  setScalar(scalar: number): Vector3 {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    return this;
  }
  /**
   * Sets the vector's x component to the given value.
   *
   * @param x - The value to set.
   * @return A reference to this vector.
   */
  setX(x: number): Vector3 {
    this.x = x;
    return this;
  }
  /**
   * Sets the vector's y component to the given value.
   *
   * @param y - The value to set.
   * @return A reference to this vector.
   */
  setY(y: number): Vector3 {
    this.y = y;
    return this;
  }
  /**
   * Sets the vector's z component to the given value.
   *
   * @param z - The value to set.
   * @return A reference to this vector.
   */
  setZ(z: number): Vector3 {
    this.z = z;
    return this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @param value - The value to set.
   * @return A reference to this vector.
   */
  setComponent(index: number, value: number): Vector3 {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @return A vector component value.
   */
  getComponent(index: number): number {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Vector3 {
    return new (this.constructor as any)(this.x, this.y, this.z);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param v - The vector to copy.
   * @return A reference to this vector.
   */
  copy(v: Vector3): Vector3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param v - The vector to add.
   * @return A reference to this vector.
   */
  add(v: Vector3): Vector3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param s - The scalar to add.
   * @return A reference to this vector.
   */
  addScalar(s: number): Vector3 {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  addVectors(a: Vector3, b: Vector3): Vector3 {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param v - The vector.
   * @param s - The factor that scales `v`.
   * @return A reference to this vector.
   */
  addScaledVector(v: Vector3 | Vector4, s: number): Vector3;
  addScaledVector(v: any, s: number): Vector3 {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param v - The vector to subtract.
   * @return A reference to this vector.
   */
  sub(v: Vector3): Vector3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param s - The scalar to subtract.
   * @return A reference to this vector.
   */
  subScalar(s: number): Vector3 {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    return this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  subVectors(a: Vector3, b: Vector3): Vector3 {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param v - The vector to multiply.
   * @return A reference to this vector.
   */
  multiply(v: Vector3): Vector3 {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param scalar - The scalar to multiply.
   * @return A reference to this vector.
   */
  multiplyScalar(scalar: number): Vector3 {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  /**
   * Multiplies the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  multiplyVectors(a: Vector3, b: Vector3): Vector3 {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  }
  /**
   * Applies the given Euler rotation to this vector.
   *
   * @param euler - The Euler angles.
   * @return A reference to this vector.
   */
  applyEuler(euler: Euler): Vector3 {
    return this.applyQuaternion(_quaternion.setFromEuler(euler));
  }
  /**
   * Applies a rotation specified by an axis and an angle to this vector.
   *
   * @param axis - A normalized vector representing the rotation axis.
   * @param angle - The angle in radians.
   * @return A reference to this vector.
   */
  applyAxisAngle(axis: Vector3, angle: number): Vector3 {
    return this.applyQuaternion(_quaternion.setFromAxisAngle(axis, angle));
  }
  /**
   * Multiplies this vector with the given 3x3 matrix.
   *
   * @param m - The 3x3 matrix.
   * @return A reference to this vector.
   */
  applyMatrix3(m: Matrix3): Vector3 {
    const x = this.x,
      y = this.y,
      z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  /**
   * Multiplies this vector by the given normal matrix and normalizes
   * the result.
   *
   * @param m - The normal matrix.
   * @return A reference to this vector.
   */
  applyNormalMatrix(m: Matrix3): Vector3 {
    return this.applyMatrix3(m).normalize();
  }
  /**
   * Multiplies this vector (with an implicit 1 in the 4th dimension) by m, and
   * divides by perspective.
   *
   * @param m - The matrix to apply.
   * @return A reference to this vector.
   */
  applyMatrix4(m: Matrix4): Vector3 {
    const x = this.x,
      y = this.y,
      z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  /**
   * Applies the given Quaternion to this vector.
   *
   * @param q - The Quaternion.
   * @return A reference to this vector.
   */
  applyQuaternion(q: Quaternion): Vector3 {
    // quaternion q is assumed to have unit length
    const vx = this.x,
      vy = this.y,
      vz = this.z;
    const qx = q.x,
      qy = q.y,
      qz = q.z,
      qw = q.w;
    // t = 2 * cross( q.xyz, v );
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    // v + q.w * t + cross( q.xyz, t );
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  /**
   * Projects this vector from world space into the camera's normalized
   * device coordinate (NDC) space.
   *
   * @param camera - The camera.
   * @return A reference to this vector.
   */
  project(camera: Camera): Vector3 {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  /**
   * Unprojects this vector from the camera's normalized device coordinate (NDC)
   * space into world space.
   *
   * @param camera - The camera.
   * @return A reference to this vector.
   */
  unproject(camera: Camera): Vector3 {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  /**
   * Transforms this vector by the upper left 3x3 sub-matrix of the given 4x4 matrix,
   * and normalizes the result.
   *
   * @param m - The matrix.
   * @return A reference to this vector.
   */
  transformDirection(m: Matrix4): Vector3 {
    // input: THREE.Matrix4 affine matrix
    // vector interpreted as a direction
    const x = this.x,
      y = this.y,
      z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param v - The vector to divide.
   * @return A reference to this vector.
   */
  divide(v: Vector3): Vector3 {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param scalar - The scalar to divide.
   * @return A reference to this vector.
   */
  divideScalar(scalar: number): Vector3 {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * If this vector's x, y or z value is greater than the given vector's x, y or z
   * value, replace that value with the corresponding min value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  min(v: Vector3): Vector3 {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  /**
   * If this vector's x, y or z value is less than the given vector's x, y or z
   * value, replace that value with the corresponding max value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  max(v: Vector3): Vector3 {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  /**
   * If this vector's x, y or z value is greater than the max vector's x, y or z
   * value, it is replaced by the corresponding value.
   * If this vector's x, y or z value is less than the min vector's x, y or z value,
   * it is replaced by the corresponding value.
   *
   * @param min - The minimum x, y and z values.
   * @param max - The maximum x, y and z values in the desired range.
   * @return A reference to this vector.
   */
  clamp(min: Vector3, max: Vector3): Vector3 {
    // assumes min < max, componentwise
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    return this;
  }
  /**
   * If this vector's x, y or z values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x, y or z values are less than the min value, they are
   * replaced by the min value.
   *
   * @param minVal - The minimum value the components will be clamped to.
   * @param maxVal - The maximum value the components will be clamped to.
   * @return A reference to this vector.
   */
  clampScalar(minVal: number, maxVal: number): Vector3 {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    return this;
  }
  /**
   * If this vector's length is greater than the max value, it is replaced by
   * the max value.
   * If this vector's length is less than the min value, it is replaced by the
   * min value.
   *
   * @param min - The minimum value the vector length will be clamped to.
   * @param max - The maximum value the vector length will be clamped to.
   * @return A reference to this vector.
   */
  clampLength(min: number, max: number): Vector3 {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  floor(): Vector3 {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  ceil(): Vector3 {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return A reference to this vector.
   */
  round(): Vector3 {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return A reference to this vector.
   */
  roundToZero(): Vector3 {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    return this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x, y = -y and z = -z.
   *
   * @return A reference to this vector.
   */
  negate(): Vector3 {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param v - The vector to compute the dot product with.
   * @return The result of the dot product.
   */
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0, 0) to (x, y, z). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return The square length of this vector.
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0, 0) to (x, y, z).
   *
   * @return The length of this vector.
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return The length of this vector.
   */
  manhattanLength(): number {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return A reference to this vector.
   */
  normalize(): Vector3 {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param length - The new length of this vector.
   * @return A reference to this vector.
   */
  setLength(length: number): Vector3 {
    return this.normalize().multiplyScalar(length);
  }
  /**
   * Linearly interpolates between the given vector and this instance, where
   * alpha is the percent distance along the line - alpha = 0 will be this
   * vector, and alpha = 1 will be the given one.
   *
   * @param v - The vector to interpolate towards.
   * @param alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return A reference to this vector.
   */
  lerp(v: Vector3, alpha: number): Vector3 {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  /**
   * Linearly interpolates between the given vectors, where alpha is the percent
   * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
   * be the second one. The result is stored in this instance.
   *
   * @param v1 - The first vector.
   * @param v2 - The second vector.
   * @param alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return A reference to this vector.
   */
  lerpVectors(v1: Vector3, v2: Vector3, alpha: number): Vector3 {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  /**
   * Calculates the cross product of the given vector with this instance.
   *
   * @param v - The vector to compute the cross product with.
   * @return The result of the cross product.
   */
  cross(v: Vector3): Vector3 {
    return this.crossVectors(this, v);
  }
  /**
   * Calculates the cross product of the given vectors and stores the result
   * in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  crossVectors(a: Vector3, b: Vector3): Vector3 {
    const ax = a.x,
      ay = a.y,
      az = a.z;
    const bx = b.x,
      by = b.y,
      bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  /**
   * Projects this vector onto the given one.
   *
   * @param v - The vector to project to.
   * @return A reference to this vector.
   */
  projectOnVector(v: Vector3): Vector3 {
    const denominator = v.lengthSq();
    if (denominator === 0) return this.set(0, 0, 0);
    const scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  /**
   * Projects this vector onto a plane by subtracting this
   * vector projected onto the plane's normal from this vector.
   *
   * @param planeNormal - The plane normal.
   * @return A reference to this vector.
   */
  projectOnPlane(planeNormal: Vector3): Vector3 {
    _vector.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector);
  }
  /**
   * Reflects this vector off a plane orthogonal to the given normal vector.
   *
   * @param normal - The (normalized) normal vector.
   * @return A reference to this vector.
   */
  reflect(normal: Vector3): Vector3 {
    return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  /**
   * Returns the angle between the given vector and this instance in radians.
   *
   * @param v - The vector to compute the angle with.
   * @return The angle in radians.
   */
  angleTo(v: Vector3): number {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    // clamp, to handle numerical problems
    return Math.acos(clamp(theta, -1, 1));
  }
  /**
   * Computes the distance from the given vector to this instance.
   *
   * @param v - The vector to compute the distance to.
   * @return The distance.
   */
  distanceTo(v: Vector3): number {
    return Math.sqrt(this.distanceToSquared(v));
  }
  /**
   * Computes the squared distance from the given vector to this instance.
   * If you are just comparing the distance with another distance, you should compare
   * the distance squared instead as it is slightly more efficient to calculate.
   *
   * @param v - The vector to compute the squared distance to.
   * @return The squared distance.
   */
  distanceToSquared(v: Vector3): number {
    const dx = this.x - v.x,
      dy = this.y - v.y,
      dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  /**
   * Computes the Manhattan distance from the given vector to this instance.
   *
   * @param v - The vector to compute the Manhattan distance to.
   * @return The Manhattan distance.
   */
  manhattanDistanceTo(v: Vector3): number {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param s - The spherical coordinates.
   * @return A reference to this vector.
   */
  setFromSpherical(s: Spherical): Vector3 {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param radius - The radius.
   * @param phi - The phi angle in radians.
   * @param theta - The theta angle in radians.
   * @return A reference to this vector.
   */
  setFromSphericalCoords(radius: number, phi: number, theta: number): Vector3 {
    const sinPhiRadius = Math.sin(phi) * radius;
    this.x = sinPhiRadius * Math.sin(theta);
    this.y = Math.cos(phi) * radius;
    this.z = sinPhiRadius * Math.cos(theta);
    return this;
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param c - The cylindrical coordinates.
   * @return A reference to this vector.
   */
  setFromCylindrical(c: Cylindrical): Vector3 {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param radius - The radius.
   * @param theta - The theta angle in radians.
   * @param y - The y value.
   * @return A reference to this vector.
   */
  setFromCylindricalCoords(radius: number, theta: number, y: number): Vector3 {
    this.x = radius * Math.sin(theta);
    this.y = y;
    this.z = radius * Math.cos(theta);
    return this;
  }
  /**
   * Sets the vector components to the position elements of the
   * given transformation matrix.
   *
   * @param m - The 4x4 matrix.
   * @return A reference to this vector.
   */
  setFromMatrixPosition(m: Matrix4): Vector3 {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
  /**
   * Sets the vector components to the scale elements of the
   * given transformation matrix.
   *
   * @param m - The 4x4 matrix.
   * @return A reference to this vector.
   */
  setFromMatrixScale(m: Matrix4): Vector3 {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this.x = sx;
    this.y = sy;
    this.z = sz;
    return this;
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param m - The 4x4 matrix.
   * @param index - The column index.
   * @return A reference to this vector.
   */
  setFromMatrixColumn(m: Matrix4, index: number): Vector3 {
    return this.fromArray(m.elements, index * 4);
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param m - The 3x3 matrix.
   * @param index - The column index.
   * @return A reference to this vector.
   */
  setFromMatrix3Column(m: Matrix3, index: number): Vector3 {
    return this.fromArray(m.elements, index * 3);
  }
  /**
   * Sets the vector components from the given Euler angles.
   *
   * @param e - The Euler angles to set.
   * @return A reference to this vector.
   */
  setFromEuler(e: Euler): Vector3 {
    this.x = e._x;
    this.y = e._y;
    this.z = e._z;
    return this;
  }
  /**
   * Sets the vector components from the RGB components of the
   * given color.
   *
   * @param c - The color to set.
   * @return A reference to this vector.
   */
  setFromColor(c: Color): Vector3 {
    this.x = c.r;
    this.y = c.g;
    this.z = c.b;
    return this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param v - The vector to test for equality.
   * @return Whether this vector is equal with the given one.
   */
  equals(v: Vector3): boolean {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`
   * and z value to be `array[ offset + 2 ]`.
   *
   * @param array - An array holding the vector component values.
   * @param [offset=0] - The offset into the array.
   * @return A reference to this vector.
   */
  fromArray(array: ArrayLike<number>, offset: number = 0): Vector3 {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    return this;
  }
  /**
   * Writes the components of this vector to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param [array=[]] - The target array holding the vector components.
   * @param [offset=0] - Index of the first element in the array.
   * @return The vector components.
   */
  toArray(array?: number[], offset?: number): number[];
  toArray<
    T extends
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array,
  >(array: T, offset?: number): T;
  toArray(
    array:
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array = [],
    offset: number = 0,
  ):
    | number[]
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param attribute - The buffer attribute holding vector data.
   * @param index - The index into the attribute.
   * @return A reference to this vector.
   */
  fromBufferAttribute(attribute: BufferAttribute | InterleavedBufferAttribute, index: number): Vector3;
  fromBufferAttribute(attribute: any, index: number): Vector3 {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    return this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return A reference to this vector.
   */
  random(): Vector3 {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    return this;
  }
  /**
   * Sets this vector to a uniformly random point on a unit sphere.
   *
   * @return A reference to this vector.
   */
  randomDirection(): Vector3 {
    // https://mathworld.wolfram.com/SpherePointPicking.html
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const c = Math.sqrt(1 - u * u);
    this.x = c * Math.cos(theta);
    this.y = u;
    this.z = c * Math.sin(theta);
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
  }
}
const _vector = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
