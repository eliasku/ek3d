import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { FilmShader } from "../shaders/FilmShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass can be used to create a film grain effect.
 *
 * ```ts
 * const filmPass = new FilmPass();
 * composer.addPass( filmPass );
 * ```
 *
 */
export class FilmPass extends Pass {
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  material: ShaderMaterial;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new film pass.
   *
   * @param intensity - The grain intensity in the range `[0,1]` (0 = no effect, 1 = full effect).
   * @param grayscale - Whether to apply a grayscale effect or not.
   */
  constructor(intensity: number = 0.5, grayscale: boolean = false) {
    super();
    const shader = FilmShader;

    /**
     * The pass uniforms. Use this object if you want to update the
     * `intensity` or `grayscale` value at runtime.
     * ```ts
     * pass.uniforms.intensity.value = 0.25;
     * pass.uniforms.grayscale.value = true;
     * ```
     */
    this.uniforms = cloneUniforms(shader.uniforms);

    /**
     * The pass material.
     */
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
    });

    this.uniforms.intensity.value = intensity;
    this.uniforms.grayscale.value = grayscale;

    // internals

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Performs the film pass.
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
    deltaTime: number,
    _maskActive: boolean,
  ): void {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["time"].value += deltaTime;

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
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.material.dispose();

    this._fsQuad.dispose();
  }
}
