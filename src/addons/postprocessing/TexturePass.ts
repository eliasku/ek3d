import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { CopyShader } from "../shaders/CopyShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * This pass can be used to render a texture over the entire screen.
 *
 * ```typescript
 * const texture = new TextureLoader().load( 'textures/2294472375_24a3b8ef46_o.jpg' );
 * texture.colorSpace = ColorSpace.SRGB;
 *
 * const texturePass = new TexturePass( texture );
 * composer.addPass( texturePass );
 * ```
 *
 * @three_import import { TexturePass } from 'ek3d/addons/postprocessing/TexturePass';
 */
export class TexturePass extends Pass {
  map: Texture;
  opacity: number;
  needsSwap: boolean;
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  material: ShaderMaterial;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new texture pass.
   *
   * @param map - The texture to render.
   * @param opacity - The opacity.
   */
  constructor(map: Texture, opacity: number = 1) {
    super();
    const shader = CopyShader;

    /**
     * The texture to render.
     */
    this.map = map;
    /**
     * The opacity.
     *
     * @default 1
     */
    this.opacity = opacity;
    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;
    /**
     * The pass uniforms.
     */
    this.uniforms = cloneUniforms(shader.uniforms);
    /**
     * The pass material.
     */
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true,
    });

    // internals

    this._fsQuad = new FullScreenQuad(null);
  }

  /**
   * Performs the texture pass.
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
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this._fsQuad.material = this.material;

    this.uniforms["opacity"].value = this.opacity;
    this.uniforms["tDiffuse"].value = this.map;
    this.material.transparent = this.opacity < 1.0;

    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    if (this.clear) renderer.clear();
    this._fsQuad.render(renderer);

    renderer.autoClear = oldAutoClear;
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
