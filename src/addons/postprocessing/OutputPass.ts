import { ToneMapping, Transfer, ColorSpace } from "../../constants";
import { ColorManagement } from "../../math/ColorManagement";
import { RawShaderMaterial } from "../../materials/RawShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { OutputShader } from "../shaders/OutputShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass is responsible for including tone mapping and color space conversion
 * into your pass chain. In most cases, this pass should be included at the end
 * of each pass chain. If a pass requires sRGB input (e.g. like FXAA), the pass
 * must follow `OutputPass` in the pass chain.
 *
 * The tone mapping and color space settings are extracted from the renderer.
 *
 * ```typescript
 * const outputPass = new OutputPass();
 * composer.addPass( outputPass );
 * ```
 *
 */
export class OutputPass extends Pass {
  isOutputPass: boolean;
  uniforms: typeof OutputShader.uniforms;
  material: RawShaderMaterial;
  _fsQuad: FullScreenQuad;
  _outputColorSpace: ColorSpace | null;
  _toneMapping: number | null;

  /**
   * Constructs a new output pass.
   */
  constructor() {
    super();
    /**
     * This flag indicates that this is an output pass.
     *
     * @readonly
     * @default true
     */
    this.isOutputPass = true;
    /**
     * The pass uniforms.
     */
    this.uniforms = cloneUniforms(OutputShader.uniforms);
    /**
     * The pass material.
     */
    this.material = new RawShaderMaterial({
      name: OutputShader.name,
      uniforms: this.uniforms,
      vertexShader: OutputShader.vertexShader,
      fragmentShader: OutputShader.fragmentShader,
    });

    // internals

    this._fsQuad = new FullScreenQuad(this.material);

    this._outputColorSpace = null;
    this._toneMapping = null;
  }

  /**
   * Performs the output pass.
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
    this.uniforms["toneMappingExposure"].value = renderer.toneMappingExposure;

    // rebuild defines if required

    if (this._outputColorSpace !== renderer.outputColorSpace || this._toneMapping !== renderer.toneMapping) {
      this._outputColorSpace = renderer.outputColorSpace;
      this._toneMapping = renderer.toneMapping;

      this.material.defines = {};

      if (ColorManagement.getTransfer(this._outputColorSpace) === Transfer.SRGB)
        this.material.defines.SRGB_TRANSFER = "";

      if (this._toneMapping === ToneMapping.Linear) this.material.defines.LINEAR_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.Reinhard) this.material.defines.REINHARD_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.Cineon) this.material.defines.CINEON_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.ACESFilmic) this.material.defines.ACES_FILMIC_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.AgX) this.material.defines.AGX_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.Neutral) this.material.defines.NEUTRAL_TONE_MAPPING = "";
      else if (this._toneMapping === ToneMapping.Custom) this.material.defines.CUSTOM_TONE_MAPPING = "";

      this.material.needsUpdate = true;
    }

    //

    if (this.renderToScreen === true) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this._fsQuad.render(renderer);
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.material.dispose();
    this._fsQuad.dispose();
  }
}
