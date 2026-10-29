import { Mapping, Wrapping, TextureFilter, PixelFormat, TextureType } from "../constants";
import { Texture } from "./Texture";

/**
 * Creates a texture from an HTML element.
 *
 * This is almost the same as the base texture class, except that it sets {@link Texture#needsUpdate}
 * to `true` immediately and listens for the parent canvas's paint events to trigger updates.
 *
 * @augments Texture
 *
 * ```ts
 * const element = new HTMLDivElement();
 * const texture = new HTMLTexture( element );
 * ```
 *
 * @demo examples/webgl_materials_texture_html.html
 */
export class HTMLTexture extends Texture {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isHTMLTexture: true;

  /**
   * Constructs a new texture.
   *
   * @param [element] - The HTML element.
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
    element?: HTMLElement,
    mapping?: Mapping,
    wrapS?: Wrapping,
    wrapT?: Wrapping,
    magFilter?: TextureFilter,
    minFilter?: TextureFilter,
    format?: PixelFormat,
    type?: TextureType,
    anisotropy?: number,
  ) {
    super(element, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);

    this.isHTMLTexture = true;
    this.generateMipmaps = false;

    this.needsUpdate = true;

    const parent = element ? element.parentNode : null;

    if (parent !== null && "requestPaint" in parent) {
      (parent as unknown as { onpaint: () => void }).onpaint = () => {
        this.needsUpdate = true;
      };

      (parent as unknown as { requestPaint(): void }).requestPaint();
    }
  }

  override dispose(): void {
    const parent = this.image ? (this.image as HTMLElement).parentNode : null;

    if (parent !== null && "onpaint" in parent) {
      (parent as unknown as { onpaint: (() => void) | null }).onpaint = null;
    }

    super.dispose();
  }
}
