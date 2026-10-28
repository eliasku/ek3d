import { DepthTexture } from "./DepthTexture";
import { CubeReflectionMapping, NearestFilter, UnsignedIntType, DepthFormat } from "../constants";
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
   * @param [type=UnsignedIntType] - The texture type.
   * @param [mapping=CubeReflectionMapping] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=NearestFilter] - The mag filter value.
   * @param [minFilter=NearestFilter] - The min filter value.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [format=DepthFormat] - The texture format.
   */
  constructor(
    size: number,
    type: number = UnsignedIntType,
    mapping: number = CubeReflectionMapping,
    wrapS?: number,
    wrapT?: number,
    magFilter: number = NearestFilter,
    minFilter: number = NearestFilter,
    anisotropy?: number,
    format: number = DepthFormat,
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
