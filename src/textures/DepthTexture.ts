import { TextureSource } from "./TextureSource";
import { Texture } from "./Texture";
import { NearestFilter, UnsignedIntType, DepthFormat, DepthStencilFormat } from "../constants";
/**
 * This class can be used to automatically save the depth information of a
 * rendering into a texture.
 *
 */
export class DepthTexture extends Texture {
  isDepthTexture: boolean;
  compareFunction: number | null;

  /**
   * Constructs a new depth texture.
   *
   * @param width - The width of the texture.
   * @param height - The height of the texture.
   * @param [type=UnsignedIntType] - The texture type.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=NearestFilter] - The mag filter value.
   * @param [minFilter=NearestFilter] - The min filter value.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [format=DepthFormat] - The texture format.
   * @param [depth=1] - The depth of the texture.
   */
  constructor(
    width: number,
    height: number,
    type: number = UnsignedIntType,
    mapping?: number,
    wrapS?: number,
    wrapT?: number,
    magFilter: number = NearestFilter,
    minFilter: number = NearestFilter,
    anisotropy?: number,
    format: number = DepthFormat,
    depth: number = 1,
  ) {
    if (format !== DepthFormat && format !== DepthStencilFormat) {
      throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");
    }
    const image: any = { width: width, height: height, depth: depth };
    super(image, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isDepthTexture = true;
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
     * Whether to generate mipmaps (if possible) for a texture.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.generateMipmaps = false;
    /**
     * Code corresponding to the depth compare function.
     *
     * @default null
     */
    this.compareFunction = null;
  }
  copy(source: DepthTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.source = new TextureSource(Object.assign({}, source.image)); // see #30540
    this.compareFunction = source.compareFunction;
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.compareFunction = this.compareFunction;
    return data;
  }

  get image(): { width: number; height: number; depth: number } | { width: number; height: number; depth: number }[] {
    return this.source.data;
  }

  set image(value: DepthTexture["image"]) {
    this.source.data = value;
  }
}
