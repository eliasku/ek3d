import { DepthTexture } from "./DepthTexture";
import { Mapping, TextureFilter, TextureType, PixelFormat, Wrapping } from "../constants";
/**
 * This class can be used to automatically save the depth information of a
 * cube rendering into a cube texture with depth format. Used for PointLight shadows.
 *
 */
export class CubeDepthTexture extends DepthTexture {
  isCubeDepthTexture: boolean;
  isCubeTexture: boolean;

  /**
   * Constructs a new cube depth texture.
   *
   * @param size - The size (width and height) of each cube face.
   * @param [type=TextureType.UnsignedInt] - The texture type.
   * @param [mapping=Mapping.CubeReflection] - The texture mapping.
   * @param [wrapS=Wrapping.ClampToEdge] - The wrapS value.
   * @param [wrapT=Wrapping.ClampToEdge] - The wrapT value.
   * @param [magFilter=TextureFilter.Nearest] - The mag filter value.
   * @param [minFilter=TextureFilter.Nearest] - The min filter value.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [format=PixelFormat.Depth] - The texture format.
   */
  constructor(
    size: number,
    type: TextureType = TextureType.UnsignedInt,
    mapping: Mapping = Mapping.CubeReflection,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter: TextureFilter = TextureFilter.Nearest,
    minFilter: TextureFilter = TextureFilter.Nearest,
    anisotropy?: number,
    format: PixelFormat = PixelFormat.Depth,
  ) {
    // Create 6 identical image descriptors for the cube faces
    const image: any = { width: size, height: size, depth: 1 };
    const images = [image, image, image, image, image, image];
    // Call DepthTexture constructor with width, height
    super(size, size, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, format);
    // Replace the single image with the array of 6 images
    this.image = images;
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCubeDepthTexture = true;
    /**
     * Set to true for cube texture handling in WebGLTextures.
     *
     * @readonly
     * @default true
     */
    this.isCubeTexture = true;
  }
  /**
   * Alias for {@link CubeDepthTexture#image}.
   *
   */
  get images(): CubeDepthTexture["image"] {
    return this.image;
  }
  set images(value: CubeDepthTexture["image"]) {
    this.image = value;
  }

  get image(): { width: number; height: number; depth: number }[] {
    return this.source.data;
  }

  set image(value: CubeDepthTexture["image"]) {
    this.source.data = value;
  }
}
