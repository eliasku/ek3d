import { Texture } from "./Texture";
import { Mapping, Wrapping, TextureFilter } from "../constants";
/**
 * Creates a cube texture made up of six images.
 *
 * ```typescript
 * import { CubeTextureLoader } from 'ek3d/loaders/CubeTextureLoader';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 *
 * const loader = new CubeTextureLoader();
 * loader.setPath( 'textures/cube/pisa/' );
 *
 * const textureCube = loader.load( [
 * 	'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
 * ] );
 *
 * const material = new MeshBasicMaterial( { color: 0xffffff, envMap: textureCube } );
 * ```
 *
 */
export class CubeTexture extends Texture {
  isCubeTexture: boolean;

  /**
   * Constructs a new cube texture.
   *
   * @param [images=[]] - An array holding a image for each side of a cube.
   * @param [mapping=Mapping.CubeReflection] - The texture mapping.
   * @param [wrapS=Wrapping.ClampToEdge] - The wrapS value.
   * @param [wrapT=Wrapping.ClampToEdge] - The wrapT value.
   * @param [magFilter=TextureFilter.Linear] - The mag filter value.
   * @param [minFilter=TextureFilter.LinearMipmapLinear] - The min filter value.
   * @param [format=PixelFormat.RGBA] - The texture format.
   * @param [type=TextureType.UnsignedByte] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [colorSpace=ColorSpace.No] - The color space value.
   */
  constructor(
    images: any[] = [],
    mapping: Mapping = Mapping.CubeReflection,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter?: TextureFilter,
    minFilter?: TextureFilter,
    format?: number,
    type?: number,
    anisotropy?: number,
    colorSpace?: string,
  ) {
    super(images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCubeTexture = true;
    /**
     * If set to `true`, the texture is flipped along the vertical axis when
     * uploaded to the GPU.
     *
     * Overwritten and set to `false` by default.
     *
     * @default false
     */
    this.flipY = false;
  }
  /**
   * Alias for {@link CubeTexture#image}.
   *
   */
  get images() {
    return this.image;
  }
  set images(value: any[]) {
    this.image = value;
  }

  get image(): any[] {
    return this.source.data;
  }

  set image(value: CubeTexture["image"]) {
    this.source.data = value;
  }
}
