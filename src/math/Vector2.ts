import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Matrix3 } from "./Matrix3";
import { clamp } from "./MathUtils";
/**
 * Class representing a 2D vector. A 2D vector is an ordered pair of numbers
 * (labeled x and y), which can be used to represent a number of things, such as:
 *
 * - A point in 2D space (i.e. a position on a plane).
 * - A direction and length across a plane. In three.js the length will
 * always be the Euclidean distance(straight-line distance) from `(0, 0)` to `(x, y)`
 * and the direction is also measured from `(0, 0)` towards `(x, y)`.
 * - Any arbitrary ordered pair of numbers.
 *
 * There are other things a 2D vector can be used to represent, such as
 * momentum vectors, complex numbers and so on, however these are the most
 * common uses in three.js.
 *
 * Iterating through a vector instance will yield its components `(x, y)` in
 * the corresponding order.
 * ```ts
 * import { Vector2 } from 'ek3d/math/Vector2';
 *
 * const a = new Vector2( 0, 1 );
 *
 * //no arguments; will be initialised to (0, 0)
 * const b = new Vector2( );
 *
 * const d = a.distanceTo( b );
 * ```
 */
export class Vector2 {
  x: number;
  y: number;
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  get isVector2(): boolean {
    return true;
  }

  /**
   * Constructs a new 2D vector.
   *
   * @param [x=0] - The x value of this vector.
   * @param [y=0] - The y value of this vector.
   */
  constructor(x: number = 0, y: number = 0) {
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
  }
  /**
   * Alias for {@link Vector2#x}.
   *
   */
  get width() {
    return this.x;
  }
  set width(value: number) {
    this.x = value;
  }
  /**
   * Alias for {@link Vector2#y}.
   *
   */
  get height() {
    return this.y;
  }
  set height(value: number) {
    this.y = value;
  }
  /**
   * Sets the vector components.
   *
   * @param x - The value of the x component.
   * @param y - The value of the y component.
   * @return A reference to this vector.
   */
  set(x: number, y: number): Vector2 {
    this.x = x;
    this.y = y;
    return this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param scalar - The value to set for all vector components.
   * @return A reference to this vector.
   */
  setScalar(scalar: number): Vector2 {
    this.x = scalar;
    this.y = scalar;
    return this;
  }
  /**
   * Sets the vector's x component to the given value
   *
   * @param x - The value to set.
   * @return A reference to this vector.
   */
  setX(x: number): Vector2 {
    this.x = x;
    return this;
  }
  /**
   * Sets the vector's y component to the given value
   *
   * @param y - The value to set.
   * @return A reference to this vector.
   */
  setY(y: number): Vector2 {
    this.y = y;
    return this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y.
   * @param value - The value to set.
   * @return A reference to this vector.
   */
  setComponent(index: number, value: number): Vector2 {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      default:
        throw new Error("THREE.Vector2: index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param index - The component index. `0` equals to x, `1` equals to y.
   * @return A vector component value.
   */
  getComponent(index: number): number {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new Error("THREE.Vector2: index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Vector2 {
    return new (this.constructor as any)(this.x, this.y);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param v - The vector to copy.
   * @return A reference to this vector.
   */
  copy(v: Vector2): Vector2 {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param v - The vector to add.
   * @return A reference to this vector.
   */
  add(v: Vector2): Vector2 {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param s - The scalar to add.
   * @return A reference to this vector.
   */
  addScalar(s: number): Vector2 {
    this.x += s;
    this.y += s;
    return this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  addVectors(a: Vector2, b: Vector2): Vector2 {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    return this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param v - The vector.
   * @param s - The factor that scales `v`.
   * @return A reference to this vector.
   */
  addScaledVector(v: Vector2, s: number): Vector2 {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param v - The vector to subtract.
   * @return A reference to this vector.
   */
  sub(v: Vector2): Vector2 {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param s - The scalar to subtract.
   * @return A reference to this vector.
   */
  subScalar(s: number): Vector2 {
    this.x -= s;
    this.y -= s;
    return this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param a - The first vector.
   * @param b - The second vector.
   * @return A reference to this vector.
   */
  subVectors(a: Vector2, b: Vector2): Vector2 {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    return this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param v - The vector to multiply.
   * @return A reference to this vector.
   */
  multiply(v: Vector2): Vector2 {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param scalar - The scalar to multiply.
   * @return A reference to this vector.
   */
  multiplyScalar(scalar: number): Vector2 {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param v - The vector to divide.
   * @return A reference to this vector.
   */
  divide(v: Vector2): Vector2 {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param scalar - The scalar to divide.
   * @return A reference to this vector.
   */
  divideScalar(scalar: number): Vector2 {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * Multiplies this vector (with an implicit 1 as the 3rd component) by
   * the given 3x3 matrix.
   *
   * @param m - The matrix to apply.
   * @return A reference to this vector.
   */
  applyMatrix3(m: Matrix3): Vector2 {
    const x = this.x,
      y = this.y;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6];
    this.y = e[1] * x + e[4] * y + e[7];
    return this;
  }
  /**
   * If this vector's x or y value is greater than the given vector's x or y
   * value, replace that value with the corresponding min value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  min(v: Vector2): Vector2 {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    return this;
  }
  /**
   * If this vector's x or y value is less than the given vector's x or y
   * value, replace that value with the corresponding max value.
   *
   * @param v - The vector.
   * @return A reference to this vector.
   */
  max(v: Vector2): Vector2 {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    return this;
  }
  /**
   * If this vector's x or y value is greater than the max vector's x or y
   * value, it is replaced by the corresponding value.
   * If this vector's x or y value is less than the min vector's x or y value,
   * it is replaced by the corresponding value.
   *
   * @param min - The minimum x and y values.
   * @param max - The maximum x and y values in the desired range.
   * @return A reference to this vector.
   */
  clamp(min: Vector2, max: Vector2): Vector2 {
    // assumes min < max, componentwise
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    return this;
  }
  /**
   * If this vector's x or y values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x or y values are less than the min value, they are
   * replaced by the min value.
   *
   * @param minVal - The minimum value the components will be clamped to.
   * @param maxVal - The maximum value the components will be clamped to.
   * @return A reference to this vector.
   */
  clampScalar(minVal: number, maxVal: number): Vector2 {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
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
  clampLength(min: number, max: number): Vector2 {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  floor(): Vector2 {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return A reference to this vector.
   */
  ceil(): Vector2 {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return A reference to this vector.
   */
  round(): Vector2 {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return A reference to this vector.
   */
  roundToZero(): Vector2 {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    return this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x and y = -y.
   *
   * @return A reference to this vector.
   */
  negate(): Vector2 {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param v - The vector to compute the dot product with.
   * @return The result of the dot product.
   */
  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }
  /**
   * Calculates the cross product of the given vector with this instance.
   *
   * @param v - The vector to compute the cross product with.
   * @return The result of the cross product.
   */
  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0) to (x, y). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return The square length of this vector.
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0) to (x, y).
   *
   * @return The length of this vector.
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return The length of this vector.
   */
  manhattanLength(): number {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return A reference to this vector.
   */
  normalize(): Vector2 {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Computes the angle in radians of this vector with respect to the positive x-axis.
   *
   * @return The angle in radians.
   */
  angle(): number {
    const angle = Math.atan2(-this.y, -this.x) + Math.PI;
    return angle;
  }
  /**
   * Returns the angle between the given vector and this instance in radians.
   *
   * @param v - The vector to compute the angle with.
   * @return The angle in radians.
   */
  angleTo(v: Vector2): number {
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
  distanceTo(v: Vector2): number {
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
  distanceToSquared(v: Vector2): number {
    const dx = this.x - v.x,
      dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  /**
   * Computes the Manhattan distance from the given vector to this instance.
   *
   * @param v - The vector to compute the Manhattan distance to.
   * @return The Manhattan distance.
   */
  manhattanDistanceTo(v: Vector2): number {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param length - The new length of this vector.
   * @return A reference to this vector.
   */
  setLength(length: number): Vector2 {
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
  lerp(v: Vector2, alpha: number): Vector2 {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
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
  lerpVectors(v1: Vector2, v2: Vector2, alpha: number): Vector2 {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    return this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param v - The vector to test for equality.
   * @return Whether this vector is equal with the given one.
   */
  equals(v: Vector2): boolean {
    return v.x === this.x && v.y === this.y;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]` and y
   * value to be `array[ offset + 1 ]`.
   *
   * @param array - An array holding the vector component values.
   * @param [offset=0] - The offset into the array.
   * @return A reference to this vector.
   */
  fromArray(array: number[], offset: number = 0): Vector2 {
    this.x = array[offset];
    this.y = array[offset + 1];
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
    return array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param attribute - The buffer attribute holding vector data.
   * @param index - The index into the attribute.
   * @return A reference to this vector.
   */
  fromBufferAttribute(attribute: BufferAttribute | InterleavedBufferAttribute, index: number): Vector2;
  fromBufferAttribute(attribute: any, index: number): Vector2 {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    return this;
  }
  /**
   * Rotates this vector around the given center by the given angle.
   *
   * @param center - The point around which to rotate.
   * @param angle - The angle to rotate, in radians.
   * @return A reference to this vector.
   */
  rotateAround(center: Vector2, angle: number): Vector2 {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const x = this.x - center.x;
    const y = this.y - center.y;
    this.x = x * c - y * s + center.x;
    this.y = x * s + y * c + center.y;
    return this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return A reference to this vector.
   */
  random(): Vector2 {
    this.x = Math.random();
    this.y = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }
}
