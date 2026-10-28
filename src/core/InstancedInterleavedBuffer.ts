import type { InterleavedBufferCloneData } from "./InterleavedBuffer";
import type { InterleavedBufferSerializationData } from "./InterleavedBuffer";
import { InterleavedBuffer } from "./InterleavedBuffer";
/**
 * An instanced version of an interleaved buffer.
 *
 */
export class InstancedInterleavedBuffer extends InterleavedBuffer {
  isInstancedInterleavedBuffer: boolean;
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
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInstancedInterleavedBuffer = true;
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
  clone(data: InterleavedBufferCloneData): this {
    const ib = super.clone(data);
    (ib as any).meshPerAttribute = this.meshPerAttribute;
    return ib;
  }
  toJSON(data: InterleavedBufferSerializationData) {
    const json = super.toJSON(data);
    json.isInstancedInterleavedBuffer = true;
    json.meshPerAttribute = this.meshPerAttribute;
    return json;
  }
}
