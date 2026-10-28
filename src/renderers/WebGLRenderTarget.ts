import type { RenderTargetOptions } from "../core/RenderTarget";
import { RenderTarget } from "../core/RenderTarget";
/**
 * A render target used in context of {@link WebGLRenderer}.
 *
 */
export class WebGLRenderTarget extends RenderTarget {
  isWebGLRenderTarget: boolean;

  /**
   * Constructs a new 3D render target.
   *
   * @param [width=1] - The width of the render target.
   * @param [height=1] - The height of the render target.
   * @param [options] - The configuration object.
   */
  constructor(width: number = 1, height: number = 1, options: RenderTargetOptions = {}) {
    super(width, height, options);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isWebGLRenderTarget = true;
  }
}
