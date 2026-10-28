import { Texture } from "./Texture";
import { CubeReflectionMapping } from "../constants";
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
   * @param [mapping=CubeReflectionMapping] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=LinearFilter] - The mag filter value.
   * @param [minFilter=LinearMipmapLinearFilter] - The min filter value.
   * @param [format=RGBAFormat] - The texture format.
   * @param [type=UnsignedByteType] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param [colorSpace=NoColorSpace] - The color space value.
   */
  constructor(
    images: any[] = [],
    mapping: number = CubeReflectionMapping,
    wrapS?: number,
    wrapT?: number,
    magFilter?: number,
    minFilter?: number,
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
