import { BufferAttribute } from "./BufferAttribute";
/**
 * An instanced version of a buffer attribute.
 *
 */
export class InstancedBufferAttribute extends BufferAttribute {
  isInstancedBufferAttribute: boolean;
  meshPerAttribute: number;

  /**
   * Constructs a new instanced buffer attribute.
   *
   * @param array - The array holding the attribute data.
   * @param itemSize - The item size.
   * @param [normalized=false] - Whether the data are normalized or not.
   * @param [meshPerAttribute=1] - How often a value of this buffer attribute should be repeated.
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
    normalized?: boolean,
    meshPerAttribute: number = 1,
  ) {
    super(array, itemSize, normalized);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInstancedBufferAttribute = true;
    /**
     * Defines how often a value of this buffer attribute should be repeated. A
     * value of one means that each value of the instanced attribute is used for
     * a single instance. A value of two means that each value is used for two
     * consecutive instances (and so on).
     *
     * @default 1
     */
    this.meshPerAttribute = meshPerAttribute;
  }
  copy(source: InstancedBufferAttribute) {
    super.copy(source);
    this.meshPerAttribute = source.meshPerAttribute;
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.meshPerAttribute = this.meshPerAttribute;
    data.isInstancedBufferAttribute = true;
    return data;
  }
}
