import { TextureType, Blending } from "../../constants";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { CopyShader } from "../shaders/CopyShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/**
 * A pass that saves the contents of the current read buffer in a render target.
 *
 * ```typescript
 * import { SavePass } from 'ek3d/addons/postprocessing/SavePass';
 * import type { EffectComposer } from 'ek3d/addons/postprocessing/EffectComposer';
 * import type { WebGLRenderTarget } from 'ek3d/renderers/WebGLRenderTarget';
 *
 * function addFrameCapture( composer: EffectComposer, customRenderTarget: WebGLRenderTarget ): SavePass {
 *   const savePass = new SavePass( customRenderTarget );
 *   composer.addPass( savePass );
 *   return savePass;
 * }
 * ```
 *
 */
export class SavePass extends Pass {
  /**
   * The pass uniforms.
   */
  uniforms: typeof CopyShader.uniforms = cloneUniforms(CopyShader.uniforms);
  /**
   * The pass material.
   */
  material: ShaderMaterial = new ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader,
    blending: Blending.No,
  });
  renderTarget: WebGLRenderTarget;
  /**
   * Overwritten to disable the swap.
   *
   * @default false
   */
  needsSwap: boolean = false;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new save pass.
   *
   * @param renderTarget - The render target for saving the read buffer.
   * If not provided, the pass automatically creates a render target.
   */
  constructor(renderTarget?: WebGLRenderTarget) {
    super();
    /**
     * The render target which is used to save the read buffer.
     */
    this.renderTarget =
      renderTarget ?? new WebGLRenderTarget(1, 1, { type: TextureType.HalfFloat, depthBuffer: false });
    if (renderTarget === undefined) {
      // will be resized later
      this.renderTarget.texture.name = "SavePass.rt";
    }

    // internals

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Performs the save pass.
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
    this.uniforms["tDiffuse"].value = readBuffer.texture;

    renderer.setRenderTarget(this.renderTarget);
    if (this.clear) renderer.clear();
    this._fsQuad.render(renderer);
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.renderTarget.dispose();

    this.material.dispose();

    this._fsQuad.dispose();
  }
}
