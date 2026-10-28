import { Texture } from "./Texture";
import { TextureFilter, Mapping, Wrapping, PixelFormat, TextureType } from "../constants";

export type DataTextureImageData =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | null;

export interface DataTextureImage {
  data: DataTextureImageData;
  width: number;
  height: number;
}

/**
 * Creates a texture directly from raw buffer data.
 *
 * The interpretation of the data depends on type and format: If the type is
 * `TextureType.UnsignedByte`, a `Uint8Array` will be useful for addressing the
 * texel data. If the format is `PixelFormat.RGBA`, data needs four values for
 * one texel; Red, Green, Blue and Alpha (typically the opacity).
 *
 */
export class DataTexture extends Texture {
  isDataTexture: boolean;

  /**
   * Constructs a new data texture.
   *
   * @param [data=null] - The buffer data.
   * @param [width=1] - The width of the texture.
   * @param [height=1] - The height of the texture.
   * @param [format=PixelFormat.RGBA] - The texture format.
   * @param [type=TextureType.UnsignedByte] - The texture type.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=Wrapping.ClampToEdge] - The wrapS value.
   * @param [wrapT=Wrapping.ClampToEdge] - The wrapT value.
   * @param [magFilter=TextureFilter.Nearest] - The mag filter value.
   * @param [minFilter=TextureFilter.Nearest] - The min filter value.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [colorSpace=ColorSpace.No] - The color space.
   */
  constructor(
    data: DataTextureImageData = null,
    width: number = 1,
    height: number = 1,
    format?: PixelFormat,
    type?: TextureType,
    mapping?: Mapping,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter: TextureFilter = TextureFilter.Nearest,
    minFilter: TextureFilter = TextureFilter.Nearest,
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
    this.isDataTexture = true;
    /**
     * The image definition of a data texture.
     *
     */
    this.image = { data: data, width: width, height: height };
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

  get image(): DataTextureImage {
    return this.source.data;
  }

  set image(value: DataTextureImage) {
    this.source.data = value;
  }
}
