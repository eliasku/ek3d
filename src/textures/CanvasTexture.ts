import { Texture } from "./Texture";
/**
 * Creates a texture from a canvas element.
 *
 * This is almost the same as the base texture class, except that it sets {@link Texture#needsUpdate}
 * to `true` immediately since a canvas can directly be used for rendering.
 *
 */
export class CanvasTexture extends Texture {
  isCanvasTexture: boolean;

  /**
   * Constructs a new texture.
   *
   * @param [canvas] - The HTML canvas element.
   * @param [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param [magFilter=LinearFilter] - The mag filter value.
   * @param [minFilter=LinearMipmapLinearFilter] - The min filter value.
   * @param [format=RGBAFormat] - The texture format.
   * @param [type=UnsignedByteType] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   */
  constructor(
    canvas?: HTMLCanvasElement | OffscreenCanvas,
    mapping?: number,
    wrapS?: number,
    wrapT?: number,
    magFilter?: number,
    minFilter?: number,
    format?: number,
    type?: number,
    anisotropy?: number,
  ) {
    super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCanvasTexture = true;
    this.needsUpdate = true;
  }

  get image(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.source.data;
  }

  set image(value: CanvasTexture["image"]) {
    this.source.data = value;
  }
}
