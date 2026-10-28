/**
 * An alternative version of a buffer attribute with more control over the VBO.
 *
 * The renderer does not construct a VBO for this kind of attribute. Instead, it uses
 * whatever VBO is passed in constructor and can later be altered via the `buffer` property.
 *
 * The most common use case for this class is when some kind of GPGPU calculation interferes
 * or even produces the VBOs in question.
 *
 * Notice that this class can only be used with {@link WebGLRenderer}.
 */
export class GLBufferAttribute {
  isGLBufferAttribute: boolean;
  name: string;
  buffer: WebGLBuffer & object;
  type: number;
  itemSize: number;
  elementSize: number;
  count: number;
  normalized: boolean;
  version: number;

  /**
   * Constructs a new GL buffer attribute.
   *
   * @param buffer - The native WebGL buffer.
   * @param type - The native data type (e.g. `gl.FLOAT`).
   * @param itemSize - The item size.
   * @param elementSize - The corresponding size (in bytes) for the given `type` parameter.
   * @param count - The expected number of vertices in VBO.
   * @param [normalized=false] - Whether the data are normalized or not.
   */
  constructor(
    buffer: WebGLBuffer & object,
    type: number,
    itemSize: number,
    elementSize: number,
    count: number,
    normalized: boolean = false,
  ) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isGLBufferAttribute = true;
    /**
     * The name of the buffer attribute.
     *
     */
    this.name = "";
    /**
     * The native WebGL buffer.
     *
     */
    this.buffer = buffer;
    /**
     * The native data type.
     *
     */
    this.type = type;
    /**
     * The item size, see {@link BufferAttribute#itemSize}.
     *
     */
    this.itemSize = itemSize;
    /**
     * The corresponding size (in bytes) for the given `type` parameter.
     *
     */
    this.elementSize = elementSize;
    /**
     * The expected number of vertices in VBO.
     *
     */
    this.count = count;
    /**
     * Applies to integer data only. Indicates how the underlying data in the buffer maps to
     * the values in the GLSL code. For instance, if `buffer` contains data of `gl.UNSIGNED_SHORT`,
     * and `normalized` is `true`, the values `0 - +65535` in the buffer data will be mapped to
     * `0.0f - +1.0f` in the GLSL attribute. If `normalized` is `false`, the values will be converted
     * to floats unmodified, i.e. `65535` becomes `65535.0f`.
     *
     */
    this.normalized = normalized;
    /**
     * A version number, incremented every time the `needsUpdate` is set to `true`.
     *
     */
    this.version = 0;
  }
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
   * Sets the given native WebGL buffer.
   *
   * @param buffer - The buffer to set.
   * @return A reference to this instance.
   */
  setBuffer(buffer: WebGLBuffer & object): this {
    this.buffer = buffer;
    return this;
  }
  /**
   * Sets the given native data type and element size.
   *
   * @param type - The native data type (e.g. `gl.FLOAT`).
   * @param elementSize - The corresponding size (in bytes) for the given `type` parameter.
   * @return A reference to this instance.
   */
  setType(type: number, elementSize: number): this {
    this.type = type;
    this.elementSize = elementSize;
    return this;
  }
  /**
   * Sets the item size.
   *
   * @param itemSize - The item size.
   * @return A reference to this instance.
   */
  setItemSize(itemSize: number): this {
    this.itemSize = itemSize;
    return this;
  }
  /**
   * Sets the count (the expected number of vertices in VBO).
   *
   * @param count - The count.
   * @return A reference to this instance.
   */
  setCount(count: number): this {
    this.count = count;
    return this;
  }
}
