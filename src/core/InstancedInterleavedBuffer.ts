import type { InterleavedBufferCloneData } from "./InterleavedBuffer";
import type { InterleavedBufferSerializationData } from "./InterleavedBuffer";
import { InterleavedBuffer } from "./InterleavedBuffer";
/**
 * An instanced version of an interleaved buffer.
 *
 */
export class InstancedInterleavedBuffer extends InterleavedBuffer {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isInstancedInterleavedBuffer: boolean = true;
  meshPerAttribute: number;

  /**
   * Constructs a new instanced interleaved buffer.
   *
   * @param array - A typed array with a shared buffer storing attribute data.
   * @param stride - The number of typed-array elements per vertex.
   * @param [meshPerAttribute=1] - Defines how often a value of this interleaved buffer should be repeated.
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
    stride: number,
    meshPerAttribute: number = 1,
  ) {
    super(array, stride);
    /**
     * Defines how often a value of this buffer attribute should be repeated,
     * see {@link InstancedBufferAttribute#meshPerAttribute}.
     *
     * @default 1
     */
    this.meshPerAttribute = meshPerAttribute;
  }
  copy(source: InstancedInterleavedBuffer) {
    super.copy(source);
    this.meshPerAttribute = source.meshPerAttribute;
    return this;
  }
  override clone(data: InterleavedBufferCloneData): InstancedInterleavedBuffer {
    const clone = new InstancedInterleavedBuffer(this._cloneArray(data), this.stride, this.meshPerAttribute);
    clone.setUsage(this.usage);
    return clone;
  }
  toJSON(data: InterleavedBufferSerializationData) {
    const json = super.toJSON(data);
    json.isInstancedInterleavedBuffer = true;
    json.meshPerAttribute = this.meshPerAttribute;
    return json;
  }
}
