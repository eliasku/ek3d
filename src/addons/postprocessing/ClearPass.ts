import { Color } from "../../math/Color";
import { Pass } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass can be used to force a clear operation for the current read or
 * default framebuffer (when rendering to screen).
 *
 * ```ts
 * const clearPass = new ClearPass();
 * composer.addPass( clearPass );
 * ```
 *
 */
export class ClearPass extends Pass {
  needsSwap: boolean;
  clearColor: number | Color | string;
  clearAlpha: number;
  _oldClearColor: Color;

  /**
   * Constructs a new clear pass.
   *
   * @param clearColor - The clear color.
   * @param clearAlpha - The clear alpha.
   */
  constructor(clearColor: number | Color | string = 0x000000, clearAlpha: number = 0) {
    super();
    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;
    /**
     * The clear color.
     *
     * @default 0x000000
     */
    this.clearColor = clearColor;
    /**
     * The clear alpha.
     *
     * @default 0
     */
    this.clearAlpha = clearAlpha;

    // internals

    this._oldClearColor = new Color();
  }

  /**
   * Performs the clear operation. This affects the current read or the default framebuffer.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    _deltaTime: number,
    _maskActive: boolean,
  ): void {
    let oldClearAlpha: number | undefined;

    if (this.clearColor) {
      renderer.getClearColor(this._oldClearColor);
      oldClearAlpha = renderer.getClearAlpha();

      renderer.setClearColor(this.clearColor, this.clearAlpha);
    }

    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clear();

    if (this.clearColor) {
      renderer.setClearColor(this._oldClearColor, oldClearAlpha);
    }
  }
}
