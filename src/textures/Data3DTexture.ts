import { Texture } from "./Texture";
import { Wrapping, TextureFilter } from "../constants";
/**
 * Creates a three-dimensional texture from raw data, with parameters to
 * divide it into width, height, and depth.
 *
 */
export class Data3DTexture extends Texture {
  isData3DTexture: boolean;
  wrapR: Wrapping;

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
    // We're going to add .setXXX() methods for setting properties later.
    // Users can still set in Data3DTexture directly.
    //
    //	const texture = new THREE.Data3DTexture( data, width, height, depth );
    // 	texture.anisotropy = 16;
    //
    // See #14839
    super(null);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isData3DTexture = true;
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
  }
  /**
   * Copies the values of the given texture to this instance.
   *
   * @param source - The texture to copy.
   * @return A reference to this instance.
   */
  copy(source: Data3DTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.wrapR = source.wrapR;
    return this;
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

  set image(value: Data3DTexture["image"]) {
    this.source.data = value;
  }
}
