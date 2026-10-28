import type { Matrix3 } from "../math/Matrix3";
import type { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";
import { Vector2 } from "../math/Vector2";
import { denormalize, normalize, getNormalizationScale } from "../math/MathUtils";
import { BufferUsage, TextureType } from "../constants";
import { fromHalfFloat, toHalfFloat } from "../extras/DataUtils";
import { EventDispatcher } from "./EventDispatcher";
const _vector = /*@__PURE__*/ new Vector3();
const _vector2 = /*@__PURE__*/ new Vector2();
let _id = 0;
/**
 * This class stores data for an attribute (such as vertex positions, face
 * indices, normals, colors, UVs, and any custom attributes ) associated with
 * a geometry, which allows for more efficient passing of data to the GPU.
 *
 * When working with vector-like data, the `fromBufferAttribute( attribute, index )`
 * helper methods on vector and color class might be helpful. E.g. {@link Vector3#fromBufferAttribute}.
 */
export class BufferAttribute extends EventDispatcher {
  isBufferAttribute: boolean;
  name: string;
  array:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;
  itemSize: number;
  count: number;
  normalized: boolean;
  usage: BufferUsage;
  updateRanges: { start: number; count: number }[];
  gpuType: TextureType;
  version: number;
  _normalizationScale: number | undefined;
  id!: number;

  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(
    array:
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array,
    itemSize: number,
    normalized: boolean = false,
  ) {
    super();
    if (Array.isArray(array)) {
      throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");
    }
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isBufferAttribute = true;
    /**
     * The ID of the buffer attribute.
     *
     * @name BufferAttribute#id
     * @readonly
     */
    Object.defineProperty(this, "id", { enumerable: false, configurable: false, writable: false, value: _id++ });
    /**
     * The name of the buffer attribute.
     *
     */
    this.name = "";
    /**
     * The array holding the attribute data. It should have `itemSize * numVertices`
     * elements, where `numVertices` is the number of vertices in the associated geometry.
     *
     */
    this.array = array;
    /**
     * The number of values of the array that should be associated with a particular vertex.
     * For instance, if this attribute is storing a 3-component vector (such as a position,
     * normal, or color), then the value should be `3`.
     *
     */
    this.itemSize = itemSize;
    /**
     * Represents the number of items this buffer attribute stores. It is internally computed
     * by dividing the `array` length by the `itemSize`.
     *
     * @readonly
     */
    this.count = array !== undefined ? array.length / itemSize : 0;
    /**
     * Applies to integer data only. Indicates how the underlying data in the buffer maps to
     * the values in the GLSL code. For instance, if `array` is an instance of `UInt16Array`,
     * and `normalized` is `true`, the values `0 - +65535` in the array data will be mapped to
     * `0.0f - +1.0f` in the GLSL attribute. If `normalized` is `false`, the values will be converted
     * to floats unmodified, i.e. `65535` becomes `65535.0f`.
     *
     */
    this.normalized = normalized;
    /**
     * Defines the intended usage pattern of the data store for optimization purposes.
     *
     * Note: After the initial use of a buffer, its usage cannot be changed. Instead,
     * instantiate a new one and set the desired usage before the next render.
     *
     * @default BufferUsage.StaticDraw
     */
    this.usage = BufferUsage.StaticDraw;
    /**
     * This can be used to only update some components of stored vectors (for example, just the
     * component related to color). Use the `addUpdateRange()` function to add ranges to this array.
     *
     */
    this.updateRanges = [];
    /**
     * Configures the bound GPU type for use in shaders.
     *
     * Note: this only has an effect for integer arrays and is not configurable for float arrays.
     * For lower precision float types, use `Float16BufferAttribute`.
     *
     * @default TextureType.Float
     */
    this.gpuType = TextureType.Float;
    /**
     * A version number, incremented every time the `needsUpdate` is set to `true`.
     *
     */
    this.version = 0;
    /**
     * Cached normalization factor, see {@link MathUtils#getNormalizationScale}.
     *
     * @private
     */
    this._normalizationScale = array !== undefined ? getNormalizationScale(array) : undefined;
  }
  /**
   * A callback function that is executed after the renderer has transferred the attribute
   * array data to the GPU.
   */
  onUploadCallback() {}
  /**
   * Flag to indicate that this attribute has changed and should be re-sent to
   * the GPU. Set this to `true` when you modify the value of the array.
   *
   * @default false
   * @param value
   */
  set needsUpdate(value: boolean) {
    if (value === true) this.version++;
  }
  /**
   * Sets the usage of this buffer attribute.
   *
   * @param value - The usage to set.
   * @return A reference to this buffer attribute.
   */
  setUsage(value?: any): BufferAttribute {
    this.usage = value;
    return this;
  }
  /**
   * Adds a range of data in the data array to be updated on the GPU.
   *
   * @param start - Position at which to start update.
   * @param count - The number of components to update.
   */
  addUpdateRange(start: number, count: number) {
    this.updateRanges.push({ start, count });
  }
  /**
   * Clears the update ranges.
   */
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  /**
   * Copies the values of the given buffer attribute to this instance.
   *
   * @param source - The buffer attribute to copy.
   * @return A reference to this instance.
   */
  copy(source: BufferAttribute): this {
    this.name = source.name;
    this.array = new (source.array.constructor as any)(source.array);
    this.itemSize = source.itemSize;
    this.count = source.count;
    this.normalized = source.normalized;
    this.usage = source.usage;
    this.gpuType = source.gpuType;
    this._normalizationScale = source._normalizationScale;
    return this;
  }
  /**
   * Copies a vector from the given buffer attribute to this one. The start
   * and destination position in the attribute buffers are represented by the
   * given indices.
   *
   * @param index1 - The destination index into this buffer attribute.
   * @param attribute - The buffer attribute to copy from.
   * @param index2 - The source index into the given buffer attribute.
   * @return A reference to this instance.
   */
  copyAt(index1: number, attribute: BufferAttribute, index2: number): BufferAttribute {
    index1 *= this.itemSize;
    index2 *= attribute.itemSize;
    for (let i = 0, l = this.itemSize; i < l; i++) {
      this.array[index1 + i] = attribute.array[index2 + i];
    }
    return this;
  }
  /**
   * Copies the given array data into this buffer attribute.
   *
   * @param array - The array to copy.
   * @return A reference to this instance.
   */
  copyArray(
    array:
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array
      | any[],
  ): BufferAttribute;
  copyArray(array?: any): BufferAttribute {
    this.array.set(array);
    return this;
  }
  /**
   * Applies the given 3x3 matrix to the given attribute. Works with
   * item size `2` and `3`.
   *
   * @param m - The matrix to apply.
   * @return A reference to this instance.
   */
  applyMatrix3(m: Matrix3): BufferAttribute {
    if (this.itemSize === 2) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector2.fromBufferAttribute(this, i);
        _vector2.applyMatrix3(m);
        this.setXY(i, _vector2.x, _vector2.y);
      }
    } else if (this.itemSize === 3) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector.fromBufferAttribute(this, i);
        _vector.applyMatrix3(m);
        this.setXYZ(i, _vector.x, _vector.y, _vector.z);
      }
    }
    return this;
  }
  /**
   * Applies the given 4x4 matrix to the given attribute. Only works with
   * item size `3`.
   *
   * @param m - The matrix to apply.
   * @return A reference to this instance.
   */
  applyMatrix4(m: Matrix4): BufferAttribute {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector.fromBufferAttribute(this, i);
      _vector.applyMatrix4(m);
      this.setXYZ(i, _vector.x, _vector.y, _vector.z);
    }
    return this;
  }
  /**
   * Applies the given 3x3 normal matrix to the given attribute. Only works with
   * item size `3`.
   *
   * @param m - The normal matrix to apply.
   * @return A reference to this instance.
   */
  applyNormalMatrix(m: Matrix3): BufferAttribute {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector.fromBufferAttribute(this, i);
      _vector.applyNormalMatrix(m);
      this.setXYZ(i, _vector.x, _vector.y, _vector.z);
    }
    return this;
  }
  /**
   * Applies the given 4x4 matrix to the given attribute. Only works with
   * item size `3` and with direction vectors.
   *
   * @param m - The matrix to apply.
   * @return A reference to this instance.
   */
  transformDirection(m: Matrix4): BufferAttribute {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector.fromBufferAttribute(this, i);
      _vector.transformDirection(m);
      this.setXYZ(i, _vector.x, _vector.y, _vector.z);
    }
    return this;
  }
  /**
   * Sets the given array data in the buffer attribute.
   *
   * @param value - The array data to set.
   * @param [offset=0] - The offset in this buffer attribute's array.
   * @return A reference to this instance.
   */
  set(
    value:
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array
      | any[],
    offset?: number,
  ): BufferAttribute;
  set(value?: any, offset: number = 0): BufferAttribute {
    // Matching BufferAttribute constructor, do not normalize the array.
    this.array.set(value, offset);
    return this;
  }
  /**
   * Returns the given component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param component - The component index.
   * @return The returned value.
   */
  getComponent(index: number, component: number): number {
    let value = this.array[index * this.itemSize + component];
    if (this.normalized) value = this._denormalize(value);
    return value;
  }
  /**
   * Sets the given value to the given component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param component - The component index.
   * @param value - The value to set.
   * @return A reference to this instance.
   */
  setComponent(index: number, component: number, value: number): BufferAttribute {
    if (this.normalized) value = this._normalize(value);
    this.array[index * this.itemSize + component] = value;
    return this;
  }
  /**
   * Returns the x component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The x component.
   */
  getX(index: number): number {
    let x = this.array[index * this.itemSize];
    if (this.normalized) x = this._denormalize(x);
    return x;
  }
  /**
   * Sets the x component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value to set.
   * @return A reference to this instance.
   */
  setX(index: number, x: number): BufferAttribute {
    if (this.normalized) x = this._normalize(x);
    this.array[index * this.itemSize] = x;
    return this;
  }
  /**
   * Returns the y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The y component.
   */
  getY(index: number): number {
    let y = this.array[index * this.itemSize + 1];
    if (this.normalized) y = this._denormalize(y);
    return y;
  }
  /**
   * Sets the y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param y - The value to set.
   * @return A reference to this instance.
   */
  setY(index: number, y: number): BufferAttribute {
    if (this.normalized) y = this._normalize(y);
    this.array[index * this.itemSize + 1] = y;
    return this;
  }
  /**
   * Returns the z component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The z component.
   */
  getZ(index: number): number {
    let z = this.array[index * this.itemSize + 2];
    if (this.normalized) z = this._denormalize(z);
    return z;
  }
  /**
   * Sets the z component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param z - The value to set.
   * @return A reference to this instance.
   */
  setZ(index: number, z: number): BufferAttribute {
    if (this.normalized) z = this._normalize(z);
    this.array[index * this.itemSize + 2] = z;
    return this;
  }
  /**
   * Returns the w component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The w component.
   */
  getW(index: number): number {
    let w = this.array[index * this.itemSize + 3];
    if (this.normalized) w = this._denormalize(w);
    return w;
  }
  /**
   * Sets the w component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param w - The value to set.
   * @return A reference to this instance.
   */
  setW(index: number, w: number): BufferAttribute {
    if (this.normalized) w = this._normalize(w);
    this.array[index * this.itemSize + 3] = w;
    return this;
  }
  /**
   * Sets the x and y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value for the x component to set.
   * @param y - The value for the y component to set.
   * @return A reference to this instance.
   */
  setXY(index: number, x: number, y: number): BufferAttribute {
    index *= this.itemSize;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    return this;
  }
  /**
   * Sets the x, y and z component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value for the x component to set.
   * @param y - The value for the y component to set.
   * @param z - The value for the z component to set.
   * @return A reference to this instance.
   */
  setXYZ(index: number, x: number, y: number, z: number): BufferAttribute {
    index *= this.itemSize;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
      z = this._normalize(z);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    return this;
  }
  /**
   * Sets the x, y, z and w component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value for the x component to set.
   * @param y - The value for the y component to set.
   * @param z - The value for the z component to set.
   * @param w - The value for the w component to set.
   * @return A reference to this instance.
   */
  setXYZW(index: number, x: number, y: number, z: number, w: number): BufferAttribute {
    index *= this.itemSize;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
      z = this._normalize(z);
      w = this._normalize(w);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    this.array[index + 3] = w;
    return this;
  }
  /**
   * Sets the given callback function that is executed after the Renderer has transferred
   * the attribute array data to the GPU. Can be used to perform clean-up operations after
   * the upload when attribute data are not needed anymore on the CPU side.
   *
   * @param callback - The `onUpload()` callback.
   * @return A reference to this instance.
   */
  onUpload(callback: (...args: any[]) => any): BufferAttribute {
    this.onUploadCallback = callback;
    return this;
  }
  /**
   * Returns a new buffer attribute with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)(this.array, this.itemSize).copy(this);
  }
  /**
   * Serializes the buffer attribute into JSON.
   *
   * @return A JSON object representing the serialized buffer attribute.
   */
  toJSON() {
    const data: any = {
      itemSize: this.itemSize,
      type: this.array.constructor.name,
      array: Array.from(this.array),
      normalized: this.normalized,
    };
    (data as any).name = this.name;
    (data as any).usage = this.usage;
    (data as any).gpuType = this.gpuType;
    return data;
  }
  /**
   * Denormalizes the value using cached normalization factor.
   *
   * @private
   */
  _denormalize(value?: any) {
    const scale = this._normalizationScale;
    return scale !== undefined ? Math.max(value / scale, -1.0) : denormalize(value, this.array);
  }
  /**
   * Normalizes the value using cached normalization factor.
   *
   * @private
   */
  _normalize(value?: any) {
    const scale = this._normalizationScale;
    return scale !== undefined ? Math.round(value * scale) : normalize(value, this.array);
  }
}
/**
 * Convenient class that can be used when creating a `Int8` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Int8BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Int8Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `UInt8` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Uint8BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Uint8Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `UInt8Clamped` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Uint8ClampedBufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Uint8ClampedArray(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `Int16` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Int16BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Int16Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `UInt16` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Uint16BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Uint16Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `Int32` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Int32BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Int32Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `UInt32` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Uint32BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Uint32Array(array), itemSize, normalized);
  }
}
/**
 * Convenient class that can be used when creating a `Float16` buffer attribute with
 * a plain `Array` instance.
 *
 * This class automatically converts to and from FP16 via `Uint16Array` since `Float16Array`
 * browser support is still problematic.
 *
 */
export class Float16BufferAttribute extends BufferAttribute {
  isFloat16BufferAttribute: boolean;

  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Uint16Array(array), itemSize, normalized);
    this.isFloat16BufferAttribute = true;
  }
  getX(index?: any) {
    let x = fromHalfFloat(this.array[index * this.itemSize]);
    if (this.normalized) x = denormalize(x, this.array);
    return x;
  }
  setX(index: any, x?: any) {
    if (this.normalized) x = normalize(x, this.array);
    this.array[index * this.itemSize] = toHalfFloat(x);
    return this;
  }
  getY(index?: any) {
    let y = fromHalfFloat(this.array[index * this.itemSize + 1]);
    if (this.normalized) y = denormalize(y, this.array);
    return y;
  }
  setY(index: any, y?: any) {
    if (this.normalized) y = normalize(y, this.array);
    this.array[index * this.itemSize + 1] = toHalfFloat(y);
    return this;
  }
  getZ(index?: any) {
    let z = fromHalfFloat(this.array[index * this.itemSize + 2]);
    if (this.normalized) z = denormalize(z, this.array);
    return z;
  }
  setZ(index: any, z?: any) {
    if (this.normalized) z = normalize(z, this.array);
    this.array[index * this.itemSize + 2] = toHalfFloat(z);
    return this;
  }
  getW(index?: any) {
    let w = fromHalfFloat(this.array[index * this.itemSize + 3]);
    if (this.normalized) w = denormalize(w, this.array);
    return w;
  }
  setW(index: any, w?: any) {
    if (this.normalized) w = normalize(w, this.array);
    this.array[index * this.itemSize + 3] = toHalfFloat(w);
    return this;
  }
  setXY(index: any, x: any, y?: any) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
    }
    this.array[index + 0] = toHalfFloat(x);
    this.array[index + 1] = toHalfFloat(y);
    return this;
  }
  setXYZ(index: any, x: any, y: any, z?: any) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
    }
    this.array[index + 0] = toHalfFloat(x);
    this.array[index + 1] = toHalfFloat(y);
    this.array[index + 2] = toHalfFloat(z);
    return this;
  }
  setXYZW(index: any, x: any, y: any, z: any, w?: any) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
      w = normalize(w, this.array);
    }
    this.array[index + 0] = toHalfFloat(x);
    this.array[index + 1] = toHalfFloat(y);
    this.array[index + 2] = toHalfFloat(z);
    this.array[index + 3] = toHalfFloat(w);
    return this;
  }
}
/**
 * Convenient class that can be used when creating a `Float32` buffer attribute with
 * a plain `Array` instance.
 *
 */
export class Float32BufferAttribute extends BufferAttribute {
  /**
   * Constructs a new buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(array: number | ArrayLike<number>, itemSize: number, normalized?: boolean);
  constructor(array: any, itemSize: number, normalized?: boolean) {
    super(new Float32Array(array), itemSize, normalized);
  }
}
//
