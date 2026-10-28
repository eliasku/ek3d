import { generateUUID } from "../math/MathUtils";
import { BufferUsage } from "../constants";

export interface InterleavedBufferCloneData {
  arrayBuffers?: Record<string, ArrayBuffer>;
  interleavedBuffers?: Record<string, InterleavedBuffer>;
}
export interface InterleavedBufferSerializationData {
  arrayBuffers?: Record<string, number[]>;
  interleavedBuffers?: Record<
    string,
    {
      uuid: string;
      buffer: string;
      type: string;
      stride: number;
      usage: BufferUsage;
      isInstancedInterleavedBuffer?: boolean;
      meshPerAttribute?: number;
    }
  >;
}
/**
 * "Interleaved" means that multiple attributes, possibly of different types,
 * (e.g., position, normal, uv, color) are packed into a single array buffer.
 *
 * An introduction into interleaved arrays can be found here: [Interleaved array basics](https://blog.tojicode.com/2011/05/interleaved-array-basics.html)
 */
export class InterleavedBuffer {
  isInterleavedBuffer: boolean;
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
  stride: number;
  count: number;
  usage: BufferUsage;
  updateRanges: { start: number; count: number }[];
  version: number;
  uuid: string;

  /**
   * Constructs a new interleaved buffer.
   *
   * @param array - A typed array with a shared buffer storing attribute data.
   * @param stride - The number of typed-array elements per vertex.
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
  ) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInterleavedBuffer = true;
    /**
     * A typed array with a shared buffer storing attribute data.
     *
     */
    this.array = array;
    /**
     * The number of typed-array elements per vertex.
     *
     */
    this.stride = stride;
    /**
     * The total number of elements in the array
     *
     * @readonly
     */
    this.count = array !== undefined ? array.length / stride : 0;
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
     * A version number, incremented every time the `needsUpdate` is set to `true`.
     *
     */
    this.version = 0;
    /**
     * The UUID of the interleaved buffer.
     *
     * @readonly
     */
    this.uuid = generateUUID();
  }
  /**
   * A callback function that is executed after the renderer has transferred the attribute array
   * data to the GPU.
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
   * Sets the usage of this interleaved buffer.
   *
   * @param value - The usage to set.
   * @return A reference to this interleaved buffer.
   */
  setUsage(value: BufferUsage): InterleavedBuffer {
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
   * Copies the values of the given interleaved buffer to this instance.
   *
   * @param source - The interleaved buffer to copy.
   * @return A reference to this instance.
   */
  copy(source: InterleavedBuffer): this {
    this.array = new (source.array.constructor as any)(source.array);
    this.count = source.count;
    this.stride = source.stride;
    this.usage = source.usage;
    return this;
  }
  /**
   * Copies a vector from the given interleaved buffer to this one. The start
   * and destination position in the attribute buffers are represented by the
   * given indices.
   *
   * @param index1 - The destination index into this interleaved buffer.
   * @param interleavedBuffer - The interleaved buffer to copy from.
   * @param index2 - The source index into the given interleaved buffer.
   * @return A reference to this instance.
   */
  copyAt(index1: number, interleavedBuffer: InterleavedBuffer, index2: number): InterleavedBuffer {
    index1 *= this.stride;
    index2 *= interleavedBuffer.stride;
    for (let i = 0, l = this.stride; i < l; i++) {
      this.array[index1 + i] = interleavedBuffer.array[index2 + i];
    }
    return this;
  }
  /**
   * Sets the given array data in the interleaved buffer.
   *
   * @param value - The array data to set.
   * @param [offset=0] - The offset in this interleaved buffer's array.
   * @return A reference to this instance.
   */
  set(value: ArrayLike<number>, offset: number = 0): InterleavedBuffer {
    this.array.set(value, offset);
    return this;
  }
  /**
   * Returns a new interleaved buffer with copied values from this instance.
   *
   * @param [data] - An object with shared array buffers that allows to retain shared structures.
   * @return A clone of this instance.
   */
  clone(data: InterleavedBufferCloneData): this {
    if (data.arrayBuffers === undefined) {
      data.arrayBuffers = {};
    }
    const key = getArrayKey(this.array);
    if (data.arrayBuffers[key] === undefined) {
      data.arrayBuffers[key] = this.array.slice(0).buffer;
    }
    const array = new (this.array.constructor as any)(data.arrayBuffers[key]);
    const ib = new (this.constructor as any)(array, this.stride);
    ib.setUsage(this.usage);
    return ib;
  }
  /**
   * Sets the given callback function that is executed after the Renderer has transferred
   * the array data to the GPU. Can be used to perform clean-up operations after
   * the upload when data are not needed anymore on the CPU side.
   *
   * @param callback - The `onUpload()` callback.
   * @return A reference to this instance.
   */
  onUpload(callback: () => void): InterleavedBuffer {
    this.onUploadCallback = callback;
    return this;
  }
  /**
   * Serializes the interleaved buffer into JSON.
   *
   * @param [data] - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized interleaved buffer.
   */
  toJSON(data: InterleavedBufferSerializationData) {
    if (data.arrayBuffers === undefined) {
      data.arrayBuffers = {};
    }
    const key = getArrayKey(this.array);
    if (data.arrayBuffers[key] === undefined) {
      data.arrayBuffers[key] = Array.from(new Uint32Array(this.array.slice(0).buffer));
    }
    //
    const json: any = {
      uuid: this.uuid,
      buffer: key,
      type: this.array.constructor.name,
      stride: this.stride,
    };
    (json as any).usage = this.usage;
    return json;
  }
}
// Returns the key under which the data of the given typed array is shared when cloning or serializing.
// Interleaved buffers can be views at different offsets into the same array buffer (e.g. the interleaved
// accessors of a glTF buffer view), so only views over the same range share their data.
function getArrayKey(array?: any) {
  // generate UUID for array buffer if necessary
  if (array.buffer._uuid === undefined) {
    array.buffer._uuid = generateUUID();
  }
  if (array.byteOffset === 0 && array.byteLength === array.buffer.byteLength) return array.buffer._uuid;
  return array.buffer._uuid + ":" + array.byteOffset + ":" + array.byteLength;
}
