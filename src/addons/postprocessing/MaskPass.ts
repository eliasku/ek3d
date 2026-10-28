import { Pass } from "./Pass";
import type { Camera } from "../../cameras/Camera";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass can be used to define a mask during post processing.
 * Meaning only areas of subsequent post processing are affected
 * which lie in the masking area of this pass. Internally, the masking
 * is implemented with the stencil buffer.
 *
 * ```typescript
 * const maskPass = new MaskPass( scene, camera );
 * composer.addPass( maskPass );
 * ```
 *
 * @three_import import { MaskPass } from 'ek3d/addons/postprocessing/MaskPass';
 */
export class MaskPass extends Pass {
  scene: Scene;
  camera: Camera;
  clear: boolean;
  needsSwap: boolean;
  inverse: boolean;

  /**
   * Constructs a new mask pass.
   *
   * @param scene - The scene that defines the mask.
   * @param camera - The camera.
   */
  constructor(scene: Scene, camera: Camera) {
    super();
    /**
     * The scene that defines the mask.
     */
    this.scene = scene;
    /**
     * The camera.
     */
    this.camera = camera;
    /**
     * Overwritten to perform a clear operation by default.
     *
     * @default true
     */
    this.clear = true;
    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;
    /**
     * Whether to inverse the mask or not.
     *
     * @default false
     */
    this.inverse = false;
  }

  /**
   * Performs a mask pass with the configured scene and camera.
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
    const context = renderer.getContext();
    const state = renderer.state;

    // don't update color or depth

    state.buffers.color.setMask(false);
    state.buffers.depth.setMask(false);

    // lock buffers

    state.buffers.color.setLocked(true);
    state.buffers.depth.setLocked(true);

    // set up stencil

    let writeValue: number, clearValue: number;

    if (this.inverse) {
      writeValue = 0;
      clearValue = 1;
    } else {
      writeValue = 1;
      clearValue = 0;
    }

    state.buffers.stencil.setTest(true);
    state.buffers.stencil.setOp(context.REPLACE, context.REPLACE, context.REPLACE);
    state.buffers.stencil.setFunc(context.ALWAYS, writeValue, 0xffffffff);
    state.buffers.stencil.setClear(clearValue);
    state.buffers.stencil.setLocked(true);

    // draw into the stencil buffer

    renderer.setRenderTarget(readBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);

    renderer.setRenderTarget(writeBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);

    // unlock color and depth buffer and make them writable for subsequent rendering/clearing

    state.buffers.color.setLocked(false);
    state.buffers.depth.setLocked(false);

    state.buffers.color.setMask(true);
    state.buffers.depth.setMask(true);

    // only render where stencil is set to 1

    state.buffers.stencil.setLocked(false);
    state.buffers.stencil.setFunc(context.EQUAL, 1, 0xffffffff); // draw if == 1
    state.buffers.stencil.setOp(context.KEEP, context.KEEP, context.KEEP);
    state.buffers.stencil.setLocked(true);
  }
}

/**
 * This pass can be used to clear a mask previously defined with {@link MaskPass}.
 *
 * ```typescript
 * const clearPass = new ClearMaskPass();
 * composer.addPass( clearPass );
 * ```
 *
 * @three_import import { ClearMaskPass } from 'ek3d/addons/postprocessing/MaskPass';
 */
export class ClearMaskPass extends Pass {
  needsSwap: boolean;

  /**
   * Constructs a new clear mask pass.
   */
  constructor() {
    super();
    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;
  }

  /**
   * Performs the clear of the currently defined mask.
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
    _writeBuffer: WebGLRenderTarget,
    _readBuffer: WebGLRenderTarget,
    _deltaTime: number,
    _maskActive: boolean,
  ): void {
    renderer.state.buffers.stencil.setLocked(false);
    renderer.state.buffers.stencil.setTest(false);
  }
}
