import type { InterleavedBuffer } from "./InterleavedBuffer";
import type { InterleavedBufferCloneData } from "./InterleavedBuffer";
import type { InterleavedBufferSerializationData } from "./InterleavedBuffer";
import type { Matrix3 } from "../math/Matrix3";
import type { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";
import { BufferAttribute } from "./BufferAttribute";
import { denormalize, normalize, getNormalizationScale } from "../math/MathUtils";
import { log } from "../utils";
const _vector = /*@__PURE__*/ new Vector3();
/**
 * An alternative version of a buffer attribute with interleaved data. Interleaved
 * attributes share a common interleaved data storage ({@link InterleavedBuffer}) and refer with
 * different offsets into the buffer.
 */
export class InterleavedBufferAttribute {
  isInterleavedBufferAttribute: boolean;
  name: string;
  data: InterleavedBuffer;
  itemSize: number;
  offset: number;
  normalized: boolean;
  _normalizationScale: number | undefined;

  /**
   * Constructs a new interleaved buffer attribute.
   *
   * @param interleavedBuffer - The buffer holding the interleaved data.
   * @param itemSize - The item size.
   * @param offset - The attribute offset into the buffer.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(interleavedBuffer: InterleavedBuffer, itemSize: number, offset: number, normalized: boolean = false) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInterleavedBufferAttribute = true;
    /**
     * The name of the buffer attribute.
     *
     */
    this.name = "";
    /**
     * The buffer holding the interleaved data.
     *
     */
    this.data = interleavedBuffer;
    /**
     * The item size, see {@link BufferAttribute#itemSize}.
     *
     */
    this.itemSize = itemSize;
    /**
     * The attribute offset into the buffer.
     *
     */
    this.offset = offset;
    /**
     * Whether the data are normalized or not, see {@link BufferAttribute#normalized}
     *
     */
    this.normalized = normalized;
    /**
     * Cached normalization factor, see {@link MathUtils#getNormalizationScale}.
     *
     * @private
     */
    this._normalizationScale =
      interleavedBuffer !== undefined ? getNormalizationScale(interleavedBuffer.array) : undefined;
  }
  /**
   * The item count of this buffer attribute.
   *
   * @readonly
   */
  get count() {
    return this.data.count;
  }
  /**
   * The array holding the interleaved buffer attribute data.
   *
   */
  get array() {
    return this.data.array;
  }
  /**
   * Flag to indicate that this attribute has changed and should be re-sent to
   * the GPU. Set this to `true` when you modify the value of the array.
   *
   * @default false
   * @param value
   */
  set needsUpdate(value: boolean) {
    this.data.needsUpdate = value;
  }
  /**
   * Applies the given 4x4 matrix to the given attribute. Only works with
   * item size `3`.
   *
   * @param m - The matrix to apply.
   * @return A reference to this instance.
   */
  applyMatrix4(m: Matrix4): InterleavedBufferAttribute {
    for (let i = 0, l = this.data.count; i < l; i++) {
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
  applyNormalMatrix(m: Matrix3): InterleavedBufferAttribute {
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
  transformDirection(m: Matrix4): InterleavedBufferAttribute {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector.fromBufferAttribute(this, i);
      _vector.transformDirection(m);
      this.setXYZ(i, _vector.x, _vector.y, _vector.z);
    }
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
    let value = this.array[index * this.data.stride + this.offset + component];
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
  setComponent(index: number, component: number, value: number): InterleavedBufferAttribute {
    if (this.normalized) value = this._normalize(value);
    this.data.array[index * this.data.stride + this.offset + component] = value;
    return this;
  }
  /**
   * Sets the x component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value to set.
   * @return A reference to this instance.
   */
  setX(index: number, x: number): InterleavedBufferAttribute {
    if (this.normalized) x = this._normalize(x);
    this.data.array[index * this.data.stride + this.offset] = x;
    return this;
  }
  /**
   * Sets the y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param y - The value to set.
   * @return A reference to this instance.
   */
  setY(index: number, y: number): InterleavedBufferAttribute {
    if (this.normalized) y = this._normalize(y);
    this.data.array[index * this.data.stride + this.offset + 1] = y;
    return this;
  }
  /**
   * Sets the z component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param z - The value to set.
   * @return A reference to this instance.
   */
  setZ(index: number, z: number): InterleavedBufferAttribute {
    if (this.normalized) z = this._normalize(z);
    this.data.array[index * this.data.stride + this.offset + 2] = z;
    return this;
  }
  /**
   * Sets the w component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param w - The value to set.
   * @return A reference to this instance.
   */
  setW(index: number, w: number): InterleavedBufferAttribute {
    if (this.normalized) w = this._normalize(w);
    this.data.array[index * this.data.stride + this.offset + 3] = w;
    return this;
  }
  /**
   * Returns the x component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The x component.
   */
  getX(index: number): number {
    let x = this.data.array[index * this.data.stride + this.offset];
    if (this.normalized) x = this._denormalize(x);
    return x;
  }
  /**
   * Returns the y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The y component.
   */
  getY(index: number): number {
    let y = this.data.array[index * this.data.stride + this.offset + 1];
    if (this.normalized) y = this._denormalize(y);
    return y;
  }
  /**
   * Returns the z component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The z component.
   */
  getZ(index: number): number {
    let z = this.data.array[index * this.data.stride + this.offset + 2];
    if (this.normalized) z = this._denormalize(z);
    return z;
  }
  /**
   * Returns the w component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @return The w component.
   */
  getW(index: number): number {
    let w = this.data.array[index * this.data.stride + this.offset + 3];
    if (this.normalized) w = this._denormalize(w);
    return w;
  }
  /**
   * Sets the x and y component of the vector at the given index.
   *
   * @param index - The index into the buffer attribute.
   * @param x - The value for the x component to set.
   * @param y - The value for the y component to set.
   * @return A reference to this instance.
   */
  setXY(index: number, x: number, y: number): InterleavedBufferAttribute {
    index = index * this.data.stride + this.offset;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
    }
    this.data.array[index + 0] = x;
    this.data.array[index + 1] = y;
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
  setXYZ(index: number, x: number, y: number, z: number): InterleavedBufferAttribute {
    index = index * this.data.stride + this.offset;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
      z = this._normalize(z);
    }
    this.data.array[index + 0] = x;
    this.data.array[index + 1] = y;
    this.data.array[index + 2] = z;
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
  setXYZW(index: number, x: number, y: number, z: number, w: number): InterleavedBufferAttribute {
    index = index * this.data.stride + this.offset;
    if (this.normalized) {
      x = this._normalize(x);
      y = this._normalize(y);
      z = this._normalize(z);
      w = this._normalize(w);
    }
    this.data.array[index + 0] = x;
    this.data.array[index + 1] = y;
    this.data.array[index + 2] = z;
    this.data.array[index + 3] = w;
    return this;
  }
  /**
   * Returns a new buffer attribute with copied values from this instance.
   *
   * If no parameter is provided, cloning an interleaved buffer attribute will de-interleave buffer data.
   *
   * @param [data] - An object with interleaved buffers that allows to retain the interleaved property.
   * @return A clone of this instance.
   */
  clone(): BufferAttribute;
  clone(data: InterleavedBufferCloneData): InterleavedBufferAttribute;
  clone(data?: InterleavedBufferCloneData): BufferAttribute | InterleavedBufferAttribute {
    if (data === undefined) {
      log(
        "InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.",
      );
      const array: any[] = [];
      for (let i = 0; i < this.count; i++) {
        const index = i * this.data.stride + this.offset;
        for (let j = 0; j < this.itemSize; j++) {
          array.push(this.data.array[index + j]);
        }
      }
      return new BufferAttribute(new (this.array.constructor as any)(array), this.itemSize, this.normalized);
    } else {
      if (data.interleavedBuffers === undefined) {
        data.interleavedBuffers = {};
      }
      if (data.interleavedBuffers[this.data.uuid] === undefined) {
        data.interleavedBuffers[this.data.uuid] = this.data.clone(data);
      }
      return new InterleavedBufferAttribute(
        data.interleavedBuffers[this.data.uuid],
        this.itemSize,
        this.offset,
        this.normalized,
      );
    }
  }
  /**
   * Serializes the buffer attribute into JSON.
   *
   * If no parameter is provided, cloning an interleaved buffer attribute will de-interleave buffer data.
   *
   * @param [data] - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized buffer attribute.
   */
  toJSON(data?: InterleavedBufferSerializationData) {
    if (data === undefined) {
      log(
        "InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.",
      );
      const array: any[] = [];
      for (let i = 0; i < this.count; i++) {
        const index = i * this.data.stride + this.offset;
        for (let j = 0; j < this.itemSize; j++) {
          array.push(this.data.array[index + j]);
        }
      }
      // de-interleave data and save it as an ordinary buffer attribute for now
      return {
        itemSize: this.itemSize,
        type: this.array.constructor.name,
        array: array,
        normalized: this.normalized,
      };
    } else {
      // save as true interleaved attribute
      if (data.interleavedBuffers === undefined) {
        data.interleavedBuffers = {};
      }
      if (data.interleavedBuffers[this.data.uuid] === undefined) {
        data.interleavedBuffers[this.data.uuid] = this.data.toJSON(data);
      }
      return {
        isInterleavedBufferAttribute: true,
        itemSize: this.itemSize,
        data: this.data.uuid,
        offset: this.offset,
        normalized: this.normalized,
      };
    }
  }
  /**
   * Denormalizes the value using cached normalization factor.
   *
   * @private
   */
  _denormalize(value?: any) {
    const scale = this._normalizationScale;
    return scale !== undefined ? Math.max(value / scale, -1.0) : denormalize(value, this.data.array);
  }
  /**
   * Normalizes the value using cached normalization factor.
   *
   * @private
   */
  _normalize(value?: any) {
    const scale = this._normalizationScale;
    return scale !== undefined ? Math.round(value * scale) : normalize(value, this.data.array);
  }
}
