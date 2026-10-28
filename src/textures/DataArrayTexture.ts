import { Texture } from "./Texture";
import { Wrapping, TextureFilter } from "../constants";
/**
 * Creates an array of textures directly from raw buffer data.
 *
 */
export class DataArrayTexture extends Texture {
  isDataArrayTexture: boolean;
  wrapR: Wrapping;
  layerUpdates: Set<number>;

  /**
   * Constructs a new data array texture.
   *
   * @param [data=null] - The buffer data.
   * @param [width=1] - The width of the texture.
   * @param [height=1] - The height of the texture.
   * @param [depth=1] - The depth of the texture.
   */
  constructor(
    data:
      | (
          | Int8Array
          | Uint8Array
          | Uint8ClampedArray
          | Int16Array
          | Uint16Array
          | Int32Array
          | Uint32Array
          | Float32Array
          | Float64Array
        )
      | null = null,
    width: number = 1,
    height: number = 1,
    depth: number = 1,
  ) {
    super(null);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isDataArrayTexture = true;
    /**
     * The image definition of a data texture.
     *
     */
    this.image = { data, width, height, depth };
    /**
     * How the texture is sampled when a texel covers more than one pixel.
     *
     * Overwritten and set to `TextureFilter.Nearest` by default.
     *
     * @default TextureFilter.Nearest
     */
    this.magFilter = TextureFilter.Nearest;
    /**
     * How the texture is sampled when a texel covers less than one pixel.
     *
     * Overwritten and set to `TextureFilter.Nearest` by default.
     *
     * @default TextureFilter.Nearest
     */
    this.minFilter = TextureFilter.Nearest;
    /**
     * This defines how the texture is wrapped in the depth and corresponds to
     * *W* in UVW mapping.
     *
     * @default Wrapping.ClampToEdge
     */
    this.wrapR = Wrapping.ClampToEdge;
    /**
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.generateMipmaps = false;
    /**
     * If set to `true`, the texture is flipped along the vertical axis when
     * uploaded to the GPU.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.flipY = false;
    /**
     * Specifies the alignment requirements for the start of each pixel row in memory.
     *
     * Overwritten and set to `1` by default.
     *
     * @default 1
     */
    this.unpackAlignment = 1;
    /**
     * A set of all layers which need to be updated in the texture.
     *
     */
    this.layerUpdates = new Set();
  }
  /**
   * Copies the values of the given texture to this instance.
   *
   * @param source - The texture to copy.
   * @return A reference to this instance.
   */
  copy(source: DataArrayTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.wrapR = source.wrapR;
    return this;
  }
  /**
   * Describes that a specific layer of the texture needs to be updated.
   * Normally when {@link Texture#needsUpdate} is set to `true`, the
   * entire data texture array is sent to the GPU. Marking specific
   * layers will only transmit subsets of all mipmaps associated with a
   * specific depth in the array which is often much more performant.
   *
   * @param layerIndex - The layer index that should be updated.
   */
  addLayerUpdate(layerIndex: number) {
    this.layerUpdates.add(layerIndex);
  }
  /**
   * Resets the layer updates registry.
   */
  clearLayerUpdates() {
    this.layerUpdates.clear();
  }

  get image(): {
    data:
      | (
          | Int8Array
          | Uint8Array
          | Uint8ClampedArray
          | Int16Array
          | Uint16Array
          | Int32Array
          | Uint32Array
          | Float32Array
          | Float64Array
        )
      | null;
    width: number;
    height: number;
    depth: number;
  } {
    return this.source.data;
  }

  set image(value: DataArrayTexture["image"]) {
    this.source.data = value;
  }
}
