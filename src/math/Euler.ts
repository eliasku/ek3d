import type { Vector3 } from "./Vector3";
import { Quaternion } from "./Quaternion";
import { Matrix4 } from "./Matrix4";
import { clamp } from "./MathUtils";
import { warn } from "../utils";
const _matrix = /*@__PURE__*/ new Matrix4();
const _quaternion = /*@__PURE__*/ new Quaternion();
/**
 * A class representing Euler angles.
 *
 * Euler angles describe a rotational transformation by rotating an object on
 * its various axes in specified amounts per axis, and a specified axis
 * order.
 *
 * Iterating through an instance will yield its components (x, y, z,
 * order) in the corresponding order.
 *
 * ```typescript
 * import { Euler } from 'ek3d/math/Euler';
 * import { Vector3 } from 'ek3d/math/Vector3';
 *
 * const a = new Euler( 0, 1, 1.57, 'XYZ' );
 * const b = new Vector3( 1, 0, 1 );
 * b.applyEuler(a);
 * ```
 */
export class Euler {
  isEuler: boolean;
  _x: number;
  _y: number;
  _z: number;
  _order: string;
  static DEFAULT_ORDER: string;

  /**
   * Constructs a new euler instance.
   *
   * @param [x=0] - The angle of the x axis in radians.
   * @param [y=0] - The angle of the y axis in radians.
   * @param [z=0] - The angle of the z axis in radians.
   * @param [order=Euler.DEFAULT_ORDER] - A string representing the order that the rotations are applied.
   */
  constructor(x: number = 0, y: number = 0, z: number = 0, order: string = Euler.DEFAULT_ORDER) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isEuler = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
  }
  /**
   * The angle of the x axis in radians.
   *
   * @default 0
   */
  get x() {
    return this._x;
  }
  set x(value: number) {
    this._x = value;
    this._onChangeCallback();
  }
  /**
   * The angle of the y axis in radians.
   *
   * @default 0
   */
  get y() {
    return this._y;
  }
  set y(value: number) {
    this._y = value;
    this._onChangeCallback();
  }
  /**
   * The angle of the z axis in radians.
   *
   * @default 0
   */
  get z() {
    return this._z;
  }
  set z(value: number) {
    this._z = value;
    this._onChangeCallback();
  }
  /**
   * A string representing the order that the rotations are applied.
   *
   * @default 'XYZ'
   */
  get order() {
    return this._order;
  }
  set order(value: string) {
    this._order = value;
    this._onChangeCallback();
  }
  /**
   * Sets the Euler components.
   *
   * @param x - The angle of the x axis in radians.
   * @param y - The angle of the y axis in radians.
   * @param z - The angle of the z axis in radians.
   * @param [order] - A string representing the order that the rotations are applied.
   * @return A reference to this Euler instance.
   */
  set(x: number, y: number, z: number, order: string = this._order): Euler {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
    this._onChangeCallback();
    return this;
  }
  /**
   * Returns a new Euler instance with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Euler {
    return new (this.constructor as any)(this._x, this._y, this._z, this._order);
  }
  /**
   * Copies the values of the given Euler instance to this instance.
   *
   * @param euler - The Euler instance to copy.
   * @return A reference to this Euler instance.
   */
  copy(euler: Euler): Euler {
    this._x = euler._x;
    this._y = euler._y;
    this._z = euler._z;
    this._order = euler._order;
    this._onChangeCallback();
    return this;
  }
  /**
   * Sets the angles of this Euler instance from a pure rotation matrix.
   *
   * @param m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
   * @param [order] - A string representing the order that the rotations are applied.
   * @param [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return A reference to this Euler instance.
   */
  setFromRotationMatrix(m: Matrix4, order: string = this._order, update: boolean = true): Euler {
    const te = m.elements;
    const m11 = te[0],
      m12 = te[4],
      m13 = te[8];
    const m21 = te[1],
      m22 = te[5],
      m23 = te[9];
    const m31 = te[2],
      m32 = te[6],
      m33 = te[10];
    switch (order) {
      case "XYZ":
        this._y = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) {
          this._x = Math.atan2(-m23, m33);
          this._z = Math.atan2(-m12, m11);
        } else {
          this._x = Math.atan2(m32, m22);
          this._z = 0;
        }
        break;
      case "YXZ":
        this._x = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.9999999) {
          this._y = Math.atan2(m13, m33);
          this._z = Math.atan2(m21, m22);
        } else {
          this._y = Math.atan2(-m31, m11);
          this._z = 0;
        }
        break;
      case "ZXY":
        this._x = Math.asin(clamp(m32, -1, 1));
        if (Math.abs(m32) < 0.9999999) {
          this._y = Math.atan2(-m31, m33);
          this._z = Math.atan2(-m12, m22);
        } else {
          this._y = 0;
          this._z = Math.atan2(m21, m11);
        }
        break;
      case "ZYX":
        this._y = Math.asin(-clamp(m31, -1, 1));
        if (Math.abs(m31) < 0.9999999) {
          this._x = Math.atan2(m32, m33);
          this._z = Math.atan2(m21, m11);
        } else {
          this._x = 0;
          this._z = Math.atan2(-m12, m22);
        }
        break;
      case "YZX":
        this._z = Math.asin(clamp(m21, -1, 1));
        if (Math.abs(m21) < 0.9999999) {
          this._x = Math.atan2(-m23, m22);
          this._y = Math.atan2(-m31, m11);
        } else {
          this._x = 0;
          this._y = Math.atan2(m13, m33);
        }
        break;
      case "XZY":
        this._z = Math.asin(-clamp(m12, -1, 1));
        if (Math.abs(m12) < 0.9999999) {
          this._x = Math.atan2(m32, m22);
          this._y = Math.atan2(m13, m11);
        } else {
          this._x = Math.atan2(-m23, m33);
          this._y = 0;
        }
        break;
      default:
        warn("Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
    }
    this._order = order;
    if (update === true) this._onChangeCallback();
    return this;
  }
  /**
   * Sets the angles of this Euler instance from a normalized quaternion.
   *
   * @param q - A normalized Quaternion.
   * @param [order] - A string representing the order that the rotations are applied.
   * @param [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return A reference to this Euler instance.
   */
  setFromQuaternion(q: Quaternion, order?: string, update?: boolean): Euler {
    _matrix.makeRotationFromQuaternion(q);
    return this.setFromRotationMatrix(_matrix, order, update);
  }
  /**
   * Sets the angles of this Euler instance from the given vector.
   *
   * @param v - The vector.
   * @param [order] - A string representing the order that the rotations are applied.
   * @return A reference to this Euler instance.
   */
  setFromVector3(v: Vector3, order: string = this._order): Euler {
    return this.set(v.x, v.y, v.z, order);
  }
  /**
   * Resets the euler angle with a new order by creating a quaternion from this
   * euler angle and then setting this euler angle with the quaternion and the
   * new order.
   *
   * Warning: This discards revolution information.
   *
   * @param [newOrder] - A string representing the new order that the rotations are applied.
   * @return A reference to this Euler instance.
   */
  reorder(newOrder?: string): Euler {
    _quaternion.setFromEuler(this);
    return this.setFromQuaternion(_quaternion, newOrder);
  }
  /**
   * Returns `true` if this Euler instance is equal with the given one.
   *
   * @param euler - The Euler instance to test for equality.
   * @return Whether this Euler instance is equal with the given one.
   */
  equals(euler: Euler): boolean {
    return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
  }
  /**
   * Sets this Euler instance's components to values from the given array. The first three
   * entries of the array are assign to the x,y and z components. An optional fourth entry
   * defines the Euler order.
   *
   * @param array - An array holding the Euler component values.
   * @return A reference to this Euler instance.
   */
  fromArray(array: (number | string)[]): Euler;
  fromArray(array?: any): Euler {
    this._x = array[0];
    this._y = array[1];
    this._z = array[2];
    if (array[3] !== undefined) this._order = array[3];
    this._onChangeCallback();
    return this;
  }
  /**
   * Writes the components of this Euler instance to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param [array=[]] - The target array holding the Euler components.
   * @param [offset=0] - Index of the first element in the array.
   * @return The Euler components.
   */
  toArray(array?: (number | string)[], offset?: number): number[];
  toArray(array: any = [], offset: number = 0): (number | string)[] {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._order;
    return array;
  }
  _onChange(callback?: any) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._order;
  }
}
/**
 * The default Euler angle order.
 *
 * @static
 * @default 'XYZ'
 */
Euler.DEFAULT_ORDER = "XYZ";
