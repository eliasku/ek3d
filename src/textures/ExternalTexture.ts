import { Texture } from "./Texture";
/**
 * Represents a texture created externally with the same renderer context.
 *
 * This may be a texture from a protected media stream, device camera feed,
 * or other data feeds like a depth sensor.
 *
 */
export class ExternalTexture extends Texture {
  sourceTexture: (WebGLTexture & object) | null;
  isExternalTexture: boolean;

  /**
   * Creates a new raw texture.
   *
   * @param [sourceTexture=null] - The external texture.
   */
  constructor(sourceTexture: (WebGLTexture & object) | null = null) {
    super();
    /**
     * The external source texture.
     *
     * @default null
     */
    this.sourceTexture = sourceTexture;
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isExternalTexture = true;
  }
  copy(source: ExternalTexture & Pick<this, "image" | "mipmaps">): this {
    super.copy(source);
    this.sourceTexture = source.sourceTexture;
    return this;
  }
}
