import { HalfFloatType } from "../../constants";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { SSAARenderPass, _JitterVectors } from "./SSAARenderPass";
import type { Camera } from "../../cameras/Camera";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

/**
 * Temporal Anti-Aliasing Render Pass.
 *
 * When there is no motion in the scene, this pass produces
 * an accumulated anti-aliasing result over multiple frames.
 *
 * ```typescript
 * const taaRenderPass = new TAARenderPass( scene, camera );
 * taaRenderPass.sampleLevel = 2;
 * composer.addPass( taaRenderPass );
 * ```
 *
 * @three_import import { TAARenderPass } from 'ek3d/addons/postprocessing/TAARenderPass';
 */
export class TAARenderPass extends SSAARenderPass {
  accumulate: boolean;
  accumulateIndex: number;
  _holdRenderTarget: WebGLRenderTarget | null;

  /**
   * Constructs a new TAA render pass.
   *
   * @param scene - The scene to render.
   * @param camera - The camera.
   * @param clearColor - The clear color of the render pass.
   * @param clearAlpha - The clear alpha of the render pass.
   */
  constructor(scene: Scene, camera: Camera, clearColor?: number | string, clearAlpha?: number) {
    super(scene, camera, clearColor, clearAlpha);
    /**
     * Overwritten and set to 0 by default.
     *
     * @default 0
     */
    this.sampleLevel = 0;
    /**
     * Whether to accumulate frames or not. This enables
     * the TAA.
     *
     * @default false
     */
    this.accumulate = false;
    /**
     * The accumulation index.
     *
     * @default -1
     */
    this.accumulateIndex = -1;

    // internals

    this._sampleRenderTarget = null;
    this._holdRenderTarget = null;
  }

  /**
   * Performs the TAA render pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, readBuffer: RT, deltaTime: number, maskActive: boolean): void {
    if (this.accumulate === false) {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);

      this.accumulateIndex = -1;
      return;
    }

    const jitterOffsets = _JitterVectors[5];

    if (this._sampleRenderTarget === null) {
      this._sampleRenderTarget = new WebGLRenderTarget(readBuffer.width, readBuffer.height, { type: HalfFloatType });
      this._sampleRenderTarget.texture.name = "TAARenderPass.sample";
    }

    if (this._holdRenderTarget === null) {
      this._holdRenderTarget = new WebGLRenderTarget(readBuffer.width, readBuffer.height, {
        type: HalfFloatType,
        depthBuffer: false,
      });
      this._holdRenderTarget.texture.name = "TAARenderPass.hold";
    }

    if (this.accumulateIndex === -1) {
      super.render(renderer, this._holdRenderTarget, readBuffer, deltaTime, maskActive);

      this.accumulateIndex = 0;
    }

    const autoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();

    const sampleWeight = 1.0 / jitterOffsets.length;

    if (this.accumulateIndex >= 0 && this.accumulateIndex < jitterOffsets.length) {
      this._copyUniforms["opacity"].value = sampleWeight;
      this._copyUniforms["tDiffuse"].value = writeBuffer.texture;

      // render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
      const numSamplesPerFrame = Math.pow(2, this.sampleLevel);
      for (let i = 0; i < numSamplesPerFrame; i++) {
        const j = this.accumulateIndex;
        const jitterOffset = jitterOffsets[j];

        if (this.camera.setViewOffset) {
          this.camera.setViewOffset(
            readBuffer.width,
            readBuffer.height,
            jitterOffset[0] * 0.0625, // 0.0625 = 1 / 16
            jitterOffset[1] * 0.0625,
            readBuffer.width,
            readBuffer.height,
          );
        }

        renderer.setRenderTarget(writeBuffer);
        renderer.setClearColor(this.clearColor, this.clearAlpha);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        renderer.setRenderTarget(this._sampleRenderTarget);
        if (this.accumulateIndex === 0) {
          renderer.setClearColor(0x000000, 0.0);
          renderer.clear();
        }

        this._fsQuad.render(renderer);

        this.accumulateIndex++;

        if (this.accumulateIndex >= jitterOffsets.length) break;
      }

      if (this.camera.clearViewOffset) this.camera.clearViewOffset();
    }

    renderer.setClearColor(this.clearColor, this.clearAlpha);
    const accumulationWeight = this.accumulateIndex * sampleWeight;

    if (accumulationWeight > 0) {
      this._copyUniforms["opacity"].value = 1.0;
      this._copyUniforms["tDiffuse"].value = this._sampleRenderTarget!.texture;
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this._fsQuad.render(renderer);
    }

    if (accumulationWeight < 1.0) {
      this._copyUniforms["opacity"].value = 1.0 - accumulationWeight;
      this._copyUniforms["tDiffuse"].value = this._holdRenderTarget!.texture;
      renderer.setRenderTarget(writeBuffer);
      this._fsQuad.render(renderer);
    }

    renderer.autoClear = autoClear;
    renderer.setClearColor(this._oldClearColor, oldClearAlpha);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    super.dispose();

    if (this._holdRenderTarget) this._holdRenderTarget.dispose();
  }
}
