import type { RenderTargetOptions } from "../core/RenderTarget";
import { WebGLRenderTarget } from "./WebGLRenderTarget";
import { Data3DTexture } from "../textures/Data3DTexture";
/**
 * A 3D render target used in context of {@link WebGLRenderer}.
 *
 */
export class WebGL3DRenderTarget extends WebGLRenderTarget {
  isWebGL3DRenderTarget: boolean;

  /**
   * Constructs a new 3D render target.
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
    this.isWebGL3DRenderTarget = true;
    this.depth = depth;
    /**
     * Overwritten with a different texture type.
     *
     */
    this.texture = new Data3DTexture(null, width, height, depth);
    this._setTextureOptions(options);
    this.texture.isRenderTargetTexture = true;

    this.texture.renderTarget = this;
  }

  override get texture(): Data3DTexture {
    return super.texture as Data3DTexture;
  }

  override set texture(value: Data3DTexture) {
    super.texture = value;
  }
}
