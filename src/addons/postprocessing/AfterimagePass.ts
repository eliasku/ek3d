import { TextureType, TextureFilter, Blending } from "../../constants";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { CopyShader } from "../shaders/CopyShader";
import { AfterimageShader } from "../shaders/AfterimageShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/**
 * Pass for a basic after image effect.
 *
 * ```typescript
 * const afterimagePass = new AfterimagePass( 0.9 );
 * composer.addPass( afterimagePass );
 * ```
 *
 * @three_import import { AfterimagePass } from 'ek3d/addons/postprocessing/AfterimagePass';
 */
export class AfterimagePass extends Pass {
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  compFsMaterial: ShaderMaterial;
  copyFsMaterial: ShaderMaterial;
  _compFsQuad: FullScreenQuad;
  _copyFsQuad: FullScreenQuad;
  _textureComp: WebGLRenderTarget;
  _textureOld: WebGLRenderTarget;

  /**
   * Constructs a new after image pass.
   *
   * @param damp - The damping intensity. A higher value means a stronger after image effect.
   */
  constructor(damp: number = 0.96) {
    super();
    /**
     * The pass uniforms. Use this object if you want to update the
     * `damp` value at runtime.
     * ```typescript
     * pass.uniforms.damp.value = 0.9;
     * ```
     */
    this.uniforms = cloneUniforms(AfterimageShader.uniforms);

    this.damp = damp;

    /**
     * The composition material.
     */
    this.compFsMaterial = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: AfterimageShader.vertexShader,
      fragmentShader: AfterimageShader.fragmentShader,
    });

    /**
     * The copy material.
     */
    this.copyFsMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      blending: Blending.No,
      depthTest: false,
      depthWrite: false,
    });

    // internals

    this._textureComp = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
      depthBuffer: false,
    });

    this._textureOld = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
      depthBuffer: false,
    });

    this._compFsQuad = new FullScreenQuad(this.compFsMaterial);
    this._copyFsQuad = new FullScreenQuad(this.copyFsMaterial);
  }

  /**
   * The damping intensity, from 0.0 to 1.0. A higher value means a stronger after image effect.
   */
  get damp(): number {
    return this.uniforms["damp"].value;
  }

  set damp(value: number) {
    this.uniforms["damp"].value = value;
  }

  /**
   * Performs the after image pass.
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
    this.uniforms["tOld"].value = this._textureOld.texture;
    this.uniforms["tNew"].value = readBuffer.texture;

    renderer.setRenderTarget(this._textureComp);
    this._compFsQuad.render(renderer);

    this._copyFsQuad.material = this.copyFsMaterial;
    this.copyFsMaterial.uniforms.tDiffuse.value = this._textureComp.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._copyFsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);

      if (this.clear) renderer.clear();

      this._copyFsQuad.render(renderer);
    }

    // Swap buffers.
    const temp = this._textureOld;
    this._textureOld = this._textureComp;
    this._textureComp = temp;
    // Now textureOld contains the latest image, ready for the next frame.
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this._textureComp.setSize(width, height);
    this._textureOld.setSize(width, height);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this._textureComp.dispose();
    this._textureOld.dispose();

    this.compFsMaterial.dispose();
    this.copyFsMaterial.dispose();

    this._compFsQuad.dispose();
    this._copyFsQuad.dispose();
  }
}
