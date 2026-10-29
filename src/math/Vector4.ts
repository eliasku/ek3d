import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Matrix4 } from "./Matrix4";
import type { Quaternion } from "./Quaternion";
import type { Vector3 } from "./Vector3";
import { clamp } from "./MathUtils";
/**
 * Class representing a 4D vector. A 4D vector is an ordered quadruplet of numbers
 * (labeled x, y, z and w), which can be used to represent a number of things, such as:
 *
 * - A point in 4D space.
 * - A direction and length in 4D space. In three.js the length will
 * always be the Euclidean distance(straight-line distance) from `(0, 0, 0, 0)` to `(x, y, z, w)`
 * and the direction is also measured from `(0, 0, 0, 0)` towards `(x, y, z, w)`.
 * - Any arbitrary ordered quadruplet of numbers.
 *
 * There are other things a 4D vector can be used to represent, however these
 * are the most common uses in *three.js*.
 *
 * Iterating through a vector instance will yield its components `(x, y, z, w)` in
 * the corresponding order.
 * ```ts
 * import { Vector4 } from 'ek3d/math/Vector4';
 *
 * const a = new Vector4( 0, 1, 0, 0 );
 *
 * //no arguments; will be initialised to (0, 0, 0, 1)
 * const b = new Vector4( );
 *
 * const d = a.dot( b );
 * ```
 */
export class Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  get isVector4(): boolean {
    return true;
  }

  /**
   * Constructs a new 4D vector.
   *
   * @param [x=0] - The x value of this vector.
   * @param [y=0] - The y value of this vector.
   * @param [z=0] - The z value of this vector.
   * @param [w=1] - The w value of this vector.
   */
  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
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
    /**
     * The w value of this vector.
     *
     */
    this.w = w;
  }
  /**
   * Alias for {@link Vector4#z}.
   *
   */
  get width() {
    return this.z;
  }
  set width(value: number) {
    this.z = value;
  }
  /**
   * Alias for {@link Vector4#w}.
   *
   */
  get height() {
    return this.w;
  }
  set height(value: number) {
    this.w = value;
  }
  /**
   * Sets the vector components.
   *
   * @param x - The value of the x component.
   * @param y - The value of the y component.
   * @param z - The value of the z component.
   * @param w - The value of the w component.
   * @return A reference to this vector.
   */
  set(x: number, y: number, z: number, w: number): Vector4 {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param scalar - The value to set for all vector components.
   * @return A reference to this vector.
   */
  setScalar(scalar: number): Vector4 {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    this.w = scalar;
    return this;
  }
  /**
   * Sets the vector's x component to the given value
   *
   * @param x - The value to set.
   * @return A reference to this vector.
   */
  setX(x: number): Vector4 {
    this.x = x;
    return this;
  }
  /**
   * Sets the vector's y component to the given value
   *
   * @param y - The value to set.
   * @return A reference to this vector.
   */
  setY(y: number): Vector4 {
    this.y = y;
    return this;
  }
  /**
   * Sets the vector's z component to the given value
   *
   * @param z - The value to set.
   * @return A reference to this vector.
   */
  setZ(z: number): Vector4 {
    this.z = z;
    return this;
  }
  /**
   * Sets the vector's w component to the given value
   *
   * @param w - The value to set.
   * @return A reference to this vector.
   */
  setW(w: number): Vector4 {
    this.w = w;
    return this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y,
   * `2` equals to z, `3` equals to w.
   * @param value - The value to set.
   * @return A reference to this vector.
   */
  setComponent(index: number, value: number): Vector4 {
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
      case 3:
        this.w = value;
        break;
      default:
        throw new Error("THREE.Vector4: index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y,
   * `2` equals to z, `3` equals to w.
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
      case 3:
        return this.w;
      default:
        throw new Error("THREE.Vector4: index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Vector4 {
    return new (this.constructor as any)(this.x, this.y, this.z, this.w);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param v - The vector to copy.
   * @return A reference to this vector.
   */
  copy(v: Vector3 | Vector4): Vector4;
  copy(v?: any): Vector4 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w !== undefined ? v.w : 1;
    return this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param v - The vector to add.
   * @return A reference to this vector.
   */
  add(v: Vector4): Vector4 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param s - The scalar to add.
   * @return A reference to this vector.
   */
  addScalar(s: number): Vector4 {
    this.x += s;
    this.y += s;
    this.z += s;
    this.w += s;
    return this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  addVectors(a: Vector4, b: Vector4): Vector4 {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    this.w = a.w + b.w;
    return this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param v - The vector.
   * @param s - The factor that scales `v`.
   * @return A reference to this vector.
   */
  addScaledVector(v: Vector4, s: number): Vector4 {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    this.w += v.w * s;
    return this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param v - The vector to subtract.
   * @return A reference to this vector.
   */
  sub(v: Vector4): Vector4 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param s - The scalar to subtract.
   * @return A reference to this vector.
   */
  subScalar(s: number): Vector4 {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    this.w -= s;
    return this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  subVectors(a: Vector4, b: Vector4): Vector4 {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    this.w = a.w - b.w;
    return this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param v - The vector to multiply.
   * @return A reference to this vector.
   */
  multiply(v: Vector4): Vector4 {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param scalar - The scalar to multiply.
   * @return A reference to this vector.
   */
  multiplyScalar(scalar: number): Vector4 {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }
  /**
   * Multiplies this vector with the given 4x4 matrix.
   *
   * @param m - The 4x4 matrix.
   * @return A reference to this vector.
   */
  applyMatrix4(m: Matrix4): Vector4 {
    const x = this.x,
      y = this.y,
      z = this.z,
      w = this.w;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
    this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
    return this;
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param v - The vector to divide.
   * @return A reference to this vector.
   */
  divide(v: Vector4): Vector4 {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    this.w /= v.w;
    return this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param scalar - The scalar to divide.
   * @return A reference to this vector.
   */
  divideScalar(scalar: number): Vector4 {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * Sets the x, y and z components of this
   * vector to the quaternion's axis and w to the angle.
   *
   * @param q - The Quaternion to set.
   * @return A reference to this vector.
   */
  setAxisAngleFromQuaternion(q: Quaternion): Vector4 {
    // q is assumed to be normalized
    this.w = 2 * Math.acos(q.w);
    const s = Math.sqrt(1 - q.w * q.w);
    if (s < 0.0001) {
      this.x = 1;
      this.y = 0;
      this.z = 0;
    } else {
      this.x = q.x / s;
      this.y = q.y / s;
      this.z = q.z / s;
    }
    return this;
  }
  /**
   * Sets the x, y and z components of this
   * vector to the axis of rotation and w to the angle.
   *
   * @param m - A 4x4 matrix of which the upper left 3x3 matrix is a pure rotation matrix.
   * @return A reference to this vector.
   */
  setAxisAngleFromRotationMatrix(m: Matrix4): Vector4 {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    let angle: any, x: any, y: any, z: any; // variables for result
    const epsilon = 0.01, // margin to allow for rounding errors
      epsilon2 = 0.1, // margin to distinguish between 0 and 180 degrees
      te = m.elements,
      m11 = te[0],
      m12 = te[4],
      m13 = te[8],
      m21 = te[1],
      m22 = te[5],
      m23 = te[9],
      m31 = te[2],
      m32 = te[6],
      m33 = te[10];
    if (Math.abs(m12 - m21) < epsilon && Math.abs(m13 - m31) < epsilon && Math.abs(m23 - m32) < epsilon) {
      // singularity found
      // first check for identity matrix which must have +1 for all terms
      // in leading diagonal and zero in other terms
      if (
        Math.abs(m12 + m21) < epsilon2 &&
        Math.abs(m13 + m31) < epsilon2 &&
        Math.abs(m23 + m32) < epsilon2 &&
        Math.abs(m11 + m22 + m33 - 3) < epsilon2
      ) {
        // this singularity is identity matrix so angle = 0
        this.set(1, 0, 0, 0);
        return this; // zero angle, arbitrary axis
      }
      // otherwise this singularity is angle = 180
      angle = Math.PI;
      const xx = (m11 + 1) / 2;
      const yy = (m22 + 1) / 2;
      const zz = (m33 + 1) / 2;
      const xy = (m12 + m21) / 4;
      const xz = (m13 + m31) / 4;
      const yz = (m23 + m32) / 4;
      if (xx > yy && xx > zz) {
        // m11 is the largest diagonal term
        if (xx < epsilon) {
          x = 0;
          y = 0.707106781;
          z = 0.707106781;
        } else {
          x = Math.sqrt(xx);
          y = xy / x;
          z = xz / x;
        }
      } else if (yy > zz) {
        // m22 is the largest diagonal term
        if (yy < epsilon) {
          x = 0.707106781;
          y = 0;
          z = 0.707106781;
        } else {
          y = Math.sqrt(yy);
          x = xy / y;
          z = yz / y;
        }
      } else {
        // m33 is the largest diagonal term so base result on this
        if (zz < epsilon) {
          x = 0.707106781;
          y = 0.707106781;
          z = 0;
        } else {
          z = Math.sqrt(zz);
          x = xz / z;
          y = yz / z;
        }
      }
      this.set(x, y, z, angle);
      return this; // return 180 deg rotation
    }
    // as we have reached here there are no singularities so we can handle normally
    let s = Math.sqrt((m32 - m23) * (m32 - m23) + (m13 - m31) * (m13 - m31) + (m21 - m12) * (m21 - m12)); // used to normalize
    if (Math.abs(s) < 0.001) s = 1;
    // prevent divide by zero, should not happen if matrix is orthogonal and should be
    // caught by singularity test above, but I've left it in just in case
    this.x = (m32 - m23) / s;
    this.y = (m13 - m31) / s;
    this.z = (m21 - m12) / s;
    this.w = Math.acos((m11 + m22 + m33 - 1) / 2);
    return this;
  }
  /**
   * Sets the vector components to the position elements of the
   * given transformation matrix.
   *
   * @param m - The 4x4 matrix.
   * @return A reference to this vector.
   */
  setFromMatrixPosition(m: Matrix4): Vector4 {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    this.w = e[15];
    return this;
  }
  /**
   * If this vector's x, y, z or w value is greater than the given vector's x, y, z or w
   * value, replace that value with the corresponding min value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  min(v: Vector4): Vector4 {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    this.w = Math.min(this.w, v.w);
    return this;
  }
  /**
   * If this vector's x, y, z or w value is less than the given vector's x, y, z or w
   * value, replace that value with the corresponding max value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  max(v: Vector4): Vector4 {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    this.w = Math.max(this.w, v.w);
    return this;
  }
  /**
   * If this vector's x, y, z or w value is greater than the max vector's x, y, z or w
   * value, it is replaced by the corresponding value.
   * If this vector's x, y, z or w value is less than the min vector's x, y, z or w value,
   * it is replaced by the corresponding value.
   *
   * @param min - The minimum x, y and z values.
   * @param max - The maximum x, y and z values in the desired range.
   * @return A reference to this vector.
   */
  clamp(min: Vector4, max: Vector4): Vector4 {
    // assumes min < max, componentwise
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    this.w = clamp(this.w, min.w, max.w);
    return this;
  }
  /**
   * If this vector's x, y, z or w values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x, y, z or w values are less than the min value, they are
   * replaced by the min value.
   *
   * @param minVal - The minimum value the components will be clamped to.
   * @param maxVal - The maximum value the components will be clamped to.
   * @return A reference to this vector.
   */
  clampScalar(minVal: number, maxVal: number): Vector4 {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    this.w = clamp(this.w, minVal, maxVal);
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
  clampLength(min: number, max: number): Vector4 {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  floor(): Vector4 {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    this.w = Math.floor(this.w);
    return this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  ceil(): Vector4 {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    this.w = Math.ceil(this.w);
    return this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return A reference to this vector.
   */
  round(): Vector4 {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    this.w = Math.round(this.w);
    return this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return A reference to this vector.
   */
  roundToZero(): Vector4 {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    this.w = Math.trunc(this.w);
    return this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x, y = -y, z = -z, w = -w.
   *
   * @return A reference to this vector.
   */
  negate(): Vector4 {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param v - The vector to compute the dot product with.
   * @return The result of the dot product.
   */
  dot(v: Vector4): number {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0, 0, 0) to (x, y, z, w). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return The square length of this vector.
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0, 0, 0) to (x, y, z, w).
   *
   * @return The length of this vector.
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return The length of this vector.
   */
  manhattanLength(): number {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return A reference to this vector.
   */
  normalize(): Vector4 {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param length - The new length of this vector.
   * @return A reference to this vector.
   */
  setLength(length: number): Vector4 {
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
  lerp(v: Vector4, alpha: number): Vector4 {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    this.w += (v.w - this.w) * alpha;
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
  lerpVectors(v1: Vector4, v2: Vector4, alpha: number): Vector4 {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    this.w = v1.w + (v2.w - v1.w) * alpha;
    return this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param v - The vector to test for equality.
   * @return Whether this vector is equal with the given one.
   */
  equals(v: Vector4): boolean {
    return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`,
   * z value to be `array[ offset + 2 ]`, w value to be `array[ offset + 3 ]`.
   *
   * @param array - An array holding the vector component values.
   * @param [offset=0] - The offset into the array.
   * @return A reference to this vector.
   */
  fromArray(array: number[], offset: number = 0): Vector4 {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    this.w = array[offset + 3];
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
  toArray(array: number[] = [], offset: number = 0): number[] {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    array[offset + 3] = this.w;
    return array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param attribute - The buffer attribute holding vector data.
   * @param index - The index into the attribute.
   * @return A reference to this vector.
   */
  fromBufferAttribute(attribute: BufferAttribute | InterleavedBufferAttribute, index: number): Vector4;
  fromBufferAttribute(attribute: any, index: number): Vector4 {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    this.w = attribute.getW(index);
    return this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return A reference to this vector.
   */
  random(): Vector4 {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    this.w = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
    yield this.w;
  }
}
