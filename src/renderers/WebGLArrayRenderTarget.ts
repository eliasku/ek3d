import type { RenderTargetOptions } from "../core/RenderTarget";
import { WebGLRenderTarget } from "./WebGLRenderTarget";
import { DataArrayTexture } from "../textures/DataArrayTexture";
/**
 * An array render target used in context of {@link WebGLRenderer}.
 *
 */
export class WebGLArrayRenderTarget extends WebGLRenderTarget {
  isWebGLArrayRenderTarget: boolean;

  /**
   * Constructs a new array render target.
   *
   * @param [width=1] - The width of the render target.
   * @param [height=1] - The height of the render target.
   * @param [depth=1] - The height of the render target.
   * @param [options] - The configuration object.
   */
  constructor(width: number = 1, height: number = 1, depth: number = 1, options: RenderTargetOptions = {}) {
    super(width, height, options);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isWebGLArrayRenderTarget = true;
    this.depth = depth;
    /**
     * Overwritten with a different texture type.
     *
     */
    this.texture = new DataArrayTexture(null, width, height, depth);
    this._setTextureOptions(options);
    this.texture.isRenderTargetTexture = true;

    this.texture.renderTarget = this;
  }

  override get texture(): DataArrayTexture {
    return super.texture as DataArrayTexture;
  }

  override set texture(value: DataArrayTexture) {
    super.texture = value;
  }
}
