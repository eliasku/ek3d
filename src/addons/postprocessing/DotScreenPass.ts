import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { Vector2 } from "../../math/Vector2";
import { DotScreenShader } from "../shaders/DotScreenShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * Pass for creating a dot-screen effect.
 *
 * ```ts
 * const pass = new DotScreenPass( new Vector2( 0, 0 ), 0.5, 0.8 );
 * composer.addPass( pass );
 * ```
 *
 */
export class DotScreenPass extends Pass {
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  material: ShaderMaterial;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new dot screen pass.
   *
   * @param center - The center point.
   * @param angle - The rotation of the effect in radians.
   * @param scale - The scale of the effect. A higher value means smaller dots.
   */
  constructor(center?: Vector2, angle?: number, scale?: number) {
    super();
    /**
     * The pass uniforms. Use this object if you want to update the
     * `center`, `angle` or `scale` value at runtime.
     * ```ts
     * pass.uniforms.center.value.set( 0.25, 0.25 );
     * ```
     */
    this.uniforms = cloneUniforms(DotScreenShader.uniforms);

    if (center !== undefined) this.uniforms["center"].value.copy(center);
    if (angle !== undefined) this.uniforms["angle"].value = angle;
    if (scale !== undefined) this.uniforms["scale"].value = scale;

    /**
     * The pass material.
     */
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: DotScreenShader.vertexShader,
      fragmentShader: DotScreenShader.fragmentShader,
    });

    // internals

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Performs the dot screen pass.
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
    this.uniforms["tSize"].value.set(readBuffer.width, readBuffer.height);

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
