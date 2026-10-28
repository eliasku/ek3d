import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";

import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass can be used to create a post processing effect
 * with a raw GLSL shader object. Useful for implementing custom
 * effects.
 *
 * ```typescript
 * const fxaaPass = new ShaderPass( FXAAShader );
 * composer.addPass( fxaaPass );
 * ```
 *
 * @three_import import { ShaderPass } from 'ek3d/addons/postprocessing/ShaderPass';
 */
export class ShaderPass extends Pass {
  textureID: string;
  uniforms: Record<string, { value: any; needsUpdate?: boolean }> | null;
  material: ShaderMaterial | null;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new shader pass.
   *
   * @param shader - A shader object holding vertex and fragment shader as well as
   * defines and uniforms. It's also valid to pass a custom shader material.
   * @param textureID - The name of the texture uniform that should sample
   * the read buffer.
   */
  constructor(
    shader?:
      | ShaderMaterial
      | {
          name?: string;
          defines?: Record<string, string | number | boolean>;
          uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
          vertexShader: string;
          fragmentShader: string;
        },
    textureID: string = "tDiffuse",
  ) {
    super();
    /**
     * The name of the texture uniform that should sample the read buffer.
     *
     * @default 'tDiffuse'
     */
    this.textureID = textureID;
    /**
     * The pass uniforms.
     */
    this.uniforms = null;
    /**
     * The pass material.
     */
    this.material = null;

    if (shader instanceof ShaderMaterial) {
      this.uniforms = shader.uniforms;
      this.material = shader;
    } else if (shader) {
      this.uniforms = cloneUniforms(shader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>;
      this.material = new ShaderMaterial({
        name: shader.name !== undefined ? shader.name : "unspecified",
        defines: { ...shader.defines },
        uniforms: this.uniforms!,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
      });
    }

    // internals

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Performs the shader pass.
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
    if (this.uniforms![this.textureID]) {
      this.uniforms![this.textureID].value = readBuffer.texture;
    }

    this._fsQuad.material = this.material;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this._fsQuad.render(renderer);
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.material?.dispose();

    this._fsQuad.dispose();
  }
}
