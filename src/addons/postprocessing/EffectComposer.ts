import { GL } from "../../GL";
import { TextureType, Blending } from "../../constants";
import { Timer } from "../../core/Timer";
import { Vector2 } from "../../math/Vector2";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { CopyShader } from "../shaders/CopyShader";
import { ShaderPass } from "./ShaderPass";
import { ClearMaskPass, MaskPass } from "./MaskPass";
import type { Pass } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/**
 * Used to implement post-processing effects in three.js.
 * The class manages a chain of post-processing passes to produce the final visual result.
 * Post-processing passes are executed in order of their addition/insertion.
 * The last pass is automatically rendered to screen.
 *
 * This module can only be used with {@link WebGLRenderer}.
 *
 * ```typescript
 * const composer = new EffectComposer( renderer );
 *
 * // adding some passes
 * const renderPass = new RenderPass( scene, camera );
 * composer.addPass( renderPass );
 *
 * const glitchPass = new GlitchPass();
 * composer.addPass( glitchPass );
 *
 * const outputPass = new OutputPass()
 * composer.addPass( outputPass );
 *
 * function animate() {
 *
 * 	composer.render(); // instead of renderer.render()
 *
 * }
 * ```
 *
 * @three_import import { EffectComposer } from 'ek3d/addons/postprocessing/EffectComposer';
 */
export class EffectComposer {
  renderer: WebGLRenderer;
  _pixelRatio: number;
  _width: number;
  _height: number;
  renderTarget1: WebGLRenderTarget;
  renderTarget2: WebGLRenderTarget;
  writeBuffer: WebGLRenderTarget;
  readBuffer: WebGLRenderTarget;
  renderToScreen: boolean;
  passes: Pass[];
  copyPass: ShaderPass;
  timer: Timer;

  /**
   * Constructs a new effect composer.
   *
   * @param renderer - The renderer.
   * @param renderTarget - This render target and a clone will
   * be used as the internal read and write buffers. If not given, the composer creates
   * the buffers automatically.
   */
  constructor(renderer: WebGLRenderer, renderTarget?: WebGLRenderTarget) {
    /**
     * The renderer.
     */
    this.renderer = renderer;

    this._pixelRatio = renderer.getPixelRatio();

    if (renderTarget === undefined) {
      const size = renderer.getSize(new Vector2());
      this._width = size.width;
      this._height = size.height;

      renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, {
        type: TextureType.HalfFloat,
      });
      renderTarget.texture.name = "EffectComposer.rt1";
    } else {
      this._width = renderTarget.width;
      this._height = renderTarget.height;
    }

    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();
    this.renderTarget2.texture.name = "EffectComposer.rt2";

    /**
     * A reference to the internal write buffer. Passes usually write
     * their result into this buffer.
     */
    this.writeBuffer = this.renderTarget1;

    /**
     * A reference to the internal read buffer. Passes usually read
     * the previous render result from this buffer.
     */
    this.readBuffer = this.renderTarget2;

    /**
     * Whether the final pass is rendered to the screen (default framebuffer) or not.
     *
     * @default true
     */
    this.renderToScreen = true;

    /**
     * An array representing the (ordered) chain of post-processing passes.
     */
    this.passes = [];

    /**
     * A copy pass used for internal swap operations.
     *
     * @private
     */
    this.copyPass = new ShaderPass(CopyShader);
    this.copyPass.material!.blending = Blending.No;

    /**
     * The internal timer for managing time data.
     *
     * @private
     */
    this.timer = new Timer();
  }

  /**
   * Swaps the internal read/write buffers.
   */
  swapBuffers(): void {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }

  /**
   * Adds the given pass to the pass chain.
   *
   * @param pass - The pass to add.
   */
  addPass(pass: Pass): void {
    this.passes.push(pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }

  /**
   * Inserts the given pass at a given index.
   *
   * @param pass - The pass to insert.
   * @param index - The index into the pass chain.
   */
  insertPass(pass: Pass, index: number): void {
    this.passes.splice(index, 0, pass);
    pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
  }

  /**
   * Removes the given pass from the pass chain.
   *
   * @param pass - The pass to remove.
   */
  removePass(pass: Pass): void {
    const index = this.passes.indexOf(pass);

    if (index !== -1) {
      this.passes.splice(index, 1);
    }
  }

  /**
   * Returns `true` if the pass for the given index is the last enabled pass in the pass chain.
   *
   * @param passIndex - The pass index.
   * @return Whether the pass for the given index is the last pass in the pass chain.
   */
  isLastEnabledPass(passIndex: number): boolean {
    for (let i = passIndex + 1; i < this.passes.length; i++) {
      if (this.passes[i].enabled) {
        return false;
      }
    }

    return true;
  }

  /**
   * Executes all enabled post-processing passes in order to produce the final frame.
   *
   * @param deltaTime - The delta time in seconds. If not given, the composer computes
   * its own time delta value.
   */
  render(deltaTime?: number): void {
    // deltaTime value is in seconds

    this.timer.update();

    if (deltaTime === undefined) {
      deltaTime = this.timer.getDelta();
    }

    const currentRenderTarget = this.renderer.getRenderTarget();

    let maskActive = false;

    for (let i = 0, il = this.passes.length; i < il; i++) {
      const pass = this.passes[i];

      if (pass.enabled === false) continue;

      pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass(i);
      pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);

      if (pass.needsSwap) {
        if (maskActive) {
          const stencil = this.renderer.state.buffers.stencil;

          stencil.setFunc(GL.NOTEQUAL, 1, 0xffffffff);

          this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);

          stencil.setFunc(GL.EQUAL, 1, 0xffffffff);
        }

        this.swapBuffers();
      }

      if (pass instanceof MaskPass) {
        maskActive = true;
      } else if (pass instanceof ClearMaskPass) {
        maskActive = false;
      }
    }

    this.renderer.setRenderTarget(currentRenderTarget);
  }

  /**
   * Resets the internal state of the EffectComposer.
   *
   * @param renderTarget - This render target has the same purpose like
   * the one from the constructor. If set, it is used to setup the read and write buffers.
   */
  reset(renderTarget?: WebGLRenderTarget): void {
    if (renderTarget === undefined) {
      const size = this.renderer.getSize(new Vector2());
      this._pixelRatio = this.renderer.getPixelRatio();
      this._width = size.width;
      this._height = size.height;

      renderTarget = this.renderTarget1.clone();
      renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }

    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.renderTarget1 = renderTarget;
    this.renderTarget2 = renderTarget.clone();

    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }

  /**
   * Resizes the internal read and write buffers as well as all passes. Similar to {@link WebGLRenderer#setSize},
   * this method honors the current pixel ration.
   *
   * @param width - The width in logical pixels.
   * @param height - The height in logical pixels.
   */
  setSize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    const effectiveWidth = this._width * this._pixelRatio;
    const effectiveHeight = this._height * this._pixelRatio;

    this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
    this.renderTarget2.setSize(effectiveWidth, effectiveHeight);

    for (let i = 0; i < this.passes.length; i++) {
      this.passes[i].setSize(effectiveWidth, effectiveHeight);
    }
  }

  /**
   * Sets device pixel ratio. This is usually used for HiDPI device to prevent blurring output.
   * Setting the pixel ratio will automatically resize the composer.
   *
   * @param pixelRatio - The pixel ratio to set.
   */
  setPixelRatio(pixelRatio: number): void {
    this._pixelRatio = pixelRatio;

    this.setSize(this._width, this._height);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the composer is no longer used in your app.
   */
  dispose(): void {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();

    this.copyPass.dispose();
  }
}
