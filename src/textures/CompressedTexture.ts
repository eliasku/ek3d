import { Texture } from "./Texture";
export interface CompressedTextureMipmap {
  data:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;
  width: number;
  height: number;
}
export interface CompressedTextureFace {
  width: number;
  height: number;
  mipmaps: CompressedTextureMipmap[];
}
/**
 * Creates a texture based on data in compressed form.
 *
 * These texture are usually loaded with {@link CompressedTextureLoader}.
 *
 */
export class CompressedTexture extends Texture<CompressedTextureMipmap> {
  isCompressedTexture: boolean;

  /**
   * Constructs a new compressed texture.
   *
   * @param [mipmaps=[]] - This array holds for all mipmaps (including the bases mip)
   * the data and dimensions.
   * @param width - The width of the texture.
   * @param height - The height of the texture.
   * @param [format=RGBAFormat] - The texture format.
   * @param [type=UnsignedByteType] - The texture type.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=LinearFilter] - The mag filter value.
   * @param [minFilter=LinearMipmapLinearFilter] - The min filter value.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [colorSpace=NoColorSpace] - The color space.
   */
  constructor(
    mipmaps: CompressedTextureMipmap[] = [],
    width?: number,
    height?: number,
    format?: number,
    type?: number,
    mapping?: number,
    wrapS?: number,
    wrapT?: number,
    magFilter?: number,
    minFilter?: number,
    anisotropy?: number,
    colorSpace?: string,
  ) {
    super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCompressedTexture = true;
    /**
     * The image property of a compressed texture just defines its dimensions.
     *
     */
    this.image = { width: width, height: height };
    /**
     * This array holds for all mipmaps (including the bases mip) the data and dimensions.
     *
     */
    this.mipmaps = mipmaps;
    /**
     * If set to `true`, the texture is flipped along the vertical axis when
     * uploaded to the GPU.
     *
     * Overwritten and set to `false` by default since it is not possible to
     * flip compressed textures.
     *
     * @default false
     * @readonly
     */
    this.flipY = false;
    /**
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Overwritten and set to `false` by default since it is not
     * possible to generate mipmaps for compressed data. Mipmaps
     * must be embedded in the compressed texture file.
     *
     * @default false
     * @readonly
     */
    this.generateMipmaps = false;
  }

  get image(): { width: number | undefined; height: number | undefined } | CompressedTextureFace[] {
    return this.source.data;
  }

  set image(value: CompressedTexture["image"]) {
    this.source.data = value;
  }
}
