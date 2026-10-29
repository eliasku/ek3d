import { Color } from "../../math/Color";
import { Pass } from "./Pass";
import type { Camera } from "../../cameras/Camera";
import type { Material } from "../../materials/Material";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * Used to render a scene with the composer's render target setup. This is
 * usually the first pass of a post processing chain.
 *
 * ```ts
 * const renderPass = new RenderPass( scene, camera );
 * composer.addPass( renderPass );
 * ```
 *
 */
export class RenderPass extends Pass {
  scene: Scene;
  camera: Camera;
  overrideMaterial: Material | null;
  clearColor: number | Color | string | null;
  clearAlpha: number | null;
  clear: boolean;
  clearDepth: boolean;
  needsSwap: boolean;
  isRenderPass: boolean;
  _oldClearColor: Color;

  /**
   * Constructs a new render pass.
   *
   * @param scene - The scene to render.
   * @param camera - The camera.
   * @param overrideMaterial - The override material. If set, this material is used
   * for all objects in the scene.
   * @param clearColor - The clear color of the render pass.
   * @param clearAlpha - The clear alpha of the render pass.
   */
  constructor(
    scene: Scene,
    camera: Camera,
    overrideMaterial: Material | null = null,
    clearColor: number | Color | string | null = null,
    clearAlpha: number | null = null,
  ) {
    super();
    /**
     * The scene to render.
     */
    this.scene = scene;
    /**
     * The camera.
     */
    this.camera = camera;
    /**
     * The override material. If set, this material is used
     * for all objects in the scene.
     *
     * @default null
     */
    this.overrideMaterial = overrideMaterial;
    /**
     * The clear color of the render pass.
     *
     * @default null
     */
    this.clearColor = clearColor;
    /**
     * The clear alpha of the render pass.
     *
     * @default null
     */
    this.clearAlpha = clearAlpha;
    /**
     * Overwritten to perform a clear operation by default.
     *
     * @default true
     */
    this.clear = true;
    /**
     * If set to `true`, only the depth can be cleared when `clear` is to `false`.
     *
     * @default false
     */
    this.clearDepth = false;
    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;
    /**
     * This flag indicates that this pass renders the scene itself.
     *
     * @readonly
     * @default true
     */
    this.isRenderPass = true;

    this._oldClearColor = new Color();
  }

  /**
   * Performs a beauty pass with the configured scene and camera.
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

    let oldClearAlpha: number = 0,
      oldOverrideMaterial: Material | null = null;

    if (this.overrideMaterial !== null) {
      oldOverrideMaterial = this.scene.overrideMaterial;

      this.scene.overrideMaterial = this.overrideMaterial;
    }

    if (this.clearColor !== null) {
      renderer.getClearColor(this._oldClearColor);
      renderer.setClearColor(this.clearColor, renderer.getClearAlpha());
    }

    if (this.clearAlpha !== null) {
      oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearAlpha(this.clearAlpha);
    }

    if (this.clearDepth == true) {
      renderer.clearDepth();
    }

    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);

    if (this.clear === true) {
      // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }

    renderer.render(this.scene, this.camera);

    // restore

    if (this.clearColor !== null) {
      renderer.setClearColor(this._oldClearColor);
    }

    if (this.clearAlpha !== null) {
      renderer.setClearAlpha(oldClearAlpha);
    }

    if (this.overrideMaterial !== null) {
      this.scene.overrideMaterial = oldOverrideMaterial;
    }

    renderer.autoClear = oldAutoClear;
  }
}
