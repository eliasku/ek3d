import { Mapping, Wrapping, TextureFilter, PixelFormat, TextureType } from "../constants";
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
   * @param [wrapS=Wrapping.ClampToEdge] - The wrapS value.
   * @param [wrapT=Wrapping.ClampToEdge] - The wrapT value.
   * @param [magFilter=TextureFilter.Linear] - The mag filter value.
   * @param [minFilter=TextureFilter.LinearMipmapLinear] - The min filter value.
   * @param [format=PixelFormat.RGBA] - The texture format.
   * @param [type=TextureType.UnsignedByte] - The texture type.
   * @param [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   */
  constructor(
    canvas?: HTMLCanvasElement | OffscreenCanvas,
    mapping?: Mapping,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter?: TextureFilter,
    minFilter?: TextureFilter,
    format?: PixelFormat,
    type?: TextureType,
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
