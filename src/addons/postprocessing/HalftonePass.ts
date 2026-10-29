import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { HalftoneShader } from "../shaders/HalftoneShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * Pass for creating a RGB halftone effect.
 *
 * ```ts
 * const params = {
 * 	shape: 1,
 * 	radius: 4,
 * 	rotateR: Math.PI / 12,
 * 	rotateB: Math.PI / 12 * 2,
 * 	rotateG: Math.PI / 12 * 3,
 * 	scatter: 0,
 * 	blending: 1,
 * 	blendingMode: 1,
 * 	greyscale: false,
 * 	disable: false
 * };
 * const halftonePass = new HalftonePass( params );
 * composer.addPass( halftonePass );
 * ```
 *
 */
export class HalftonePass extends Pass {
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  material: ShaderMaterial;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new halftone pass.
   *
   * @param params - The halftone shader parameters; keys matching uniform
   * names overwrite their default values.
   */
  constructor(params: Record<string, any> = {}) {
    super();
    /**
     * The pass uniforms.
     */
    this.uniforms = cloneUniforms(HalftoneShader.uniforms);

    /**
     * The pass material.
     */
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      fragmentShader: HalftoneShader.fragmentShader,
      vertexShader: HalftoneShader.vertexShader,
    });

    for (const key in params) {
      if (
        Object.prototype.hasOwnProperty.call(params, key) &&
        Object.prototype.hasOwnProperty.call(this.uniforms, key)
      ) {
        this.uniforms[key].value = params[key];
      }
    }

    // internals

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Performs the halftone pass.
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
    this.material.uniforms["tDiffuse"].value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this._fsQuad.render(renderer);
    }
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.uniforms["width"].value = width;
    this.uniforms["height"].value = height;
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
