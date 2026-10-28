import { Blending, TextureType } from "../../constants";
import { Color } from "../../math/Color";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { CopyShader } from "../shaders/CopyShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { Camera } from "../../cameras/Camera";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

type CameraWithViewOffset = Camera & {
  /** The view offset, present on perspective cameras. */
  view?: {
    enabled: boolean;
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null;
  setViewOffset?(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number): void;
  clearViewOffset?(): void;
};

/**
 * Supersample Anti-Aliasing Render Pass.
 *
 * This manual approach to SSAA re-renders the scene ones for each sample with camera jitter and accumulates the results.
 *
 * ```typescript
 * const ssaaRenderPass = new SSAARenderPass( scene, camera );
 * ssaaRenderPass.sampleLevel = 3;
 * composer.addPass( ssaaRenderPass );
 * ```
 *
 * @three_import import { SSAARenderPass } from 'ek3d/addons/postprocessing/SSAARenderPass';
 */
export class SSAARenderPass extends Pass {
  scene: Scene;
  camera: CameraWithViewOffset;
  sampleLevel: number;
  unbiased: boolean;
  stencilBuffer: boolean;
  clearColor: number | Color | string;
  clearAlpha: number;
  _sampleRenderTarget: WebGLRenderTarget | null;
  _oldClearColor: Color;
  _copyUniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  _copyMaterial: ShaderMaterial;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a new SSAA render pass.
   *
   * @param scene - The scene to render.
   * @param camera - The camera.
   * @param clearColor - The clear color of the render pass.
   * @param clearAlpha - The clear alpha of the render pass.
   */
  constructor(scene: Scene, camera: Camera, clearColor: number | Color | string = 0x000000, clearAlpha: number = 0) {
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
     * The sample level. Specified as n, where the number of
     * samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
     *
     * @default 4
     */
    this.sampleLevel = 4;

    /**
     * Whether the pass should be unbiased or not. This property has the most
     * visible effect when rendering to a RGBA8 buffer because it mitigates
     * rounding errors. By default RGBA16F is used.
     *
     * @default true
     */
    this.unbiased = true;

    /**
     * Whether to use a stencil buffer or not. This property can't
     * be changed after the first render.
     *
     * @default false
     */
    this.stencilBuffer = false;

    /**
     * The clear color of the render pass.
     *
     * @default 0x000000
     */
    this.clearColor = clearColor;

    /**
     * The clear alpha of the render pass.
     *
     * @default 0
     */
    this.clearAlpha = clearAlpha;

    // internals

    this._sampleRenderTarget = null;

    this._oldClearColor = new Color();

    this._copyUniforms = cloneUniforms(CopyShader.uniforms);

    this._copyMaterial = new ShaderMaterial({
      uniforms: this._copyUniforms,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: Blending.Additive,
    });

    this._fsQuad = new FullScreenQuad(this._copyMaterial);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    if (this._sampleRenderTarget) {
      this._sampleRenderTarget.dispose();
      this._sampleRenderTarget = null;
    }

    this._copyMaterial.dispose();

    this._fsQuad.dispose();
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    if (this._sampleRenderTarget) this._sampleRenderTarget.setSize(width, height);
  }

  /**
   * Performs the SSAA render pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, readBuffer: RT, _deltaTime: number, _maskActive: boolean): void {
    if (!this._sampleRenderTarget) {
      this._sampleRenderTarget = new WebGLRenderTarget(readBuffer.width, readBuffer.height, {
        type: TextureType.HalfFloat,
        stencilBuffer: this.stencilBuffer,
      });
      this._sampleRenderTarget.texture.name = "SSAARenderPass.sample";
    }

    const jitterOffsets = _JitterVectors[Math.max(0, Math.min(this.sampleLevel, 5))];

    const autoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();

    const baseSampleWeight = 1.0 / jitterOffsets.length;
    const roundingRange = 1 / 32;
    this._copyUniforms["tDiffuse"].value = this._sampleRenderTarget.texture;

    const viewOffset = {
      fullWidth: readBuffer.width,
      fullHeight: readBuffer.height,
      offsetX: 0,
      offsetY: 0,
      width: readBuffer.width,
      height: readBuffer.height,
    };

    const originalViewOffset = this.camera.view ? { ...this.camera.view } : null;

    if (originalViewOffset !== null && originalViewOffset.enabled) Object.assign(viewOffset, originalViewOffset);

    // render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
    for (let i = 0; i < jitterOffsets.length; i++) {
      const jitterOffset = jitterOffsets[i];

      if (this.camera.setViewOffset) {
        this.camera.setViewOffset(
          viewOffset.fullWidth,
          viewOffset.fullHeight,
          viewOffset.offsetX + jitterOffset[0] * 0.0625, // 0.0625 = 1 / 16
          viewOffset.offsetY + jitterOffset[1] * 0.0625,
          viewOffset.width,
          viewOffset.height,
        );
      }

      let sampleWeight = baseSampleWeight;

      if (this.unbiased) {
        // the theory is that equal weights for each sample lead to an accumulation of rounding errors.
        // The following equation varies the sampleWeight per sample so that it is uniformly distributed
        // across a range of values whose rounding errors cancel each other out.

        const uniformCenteredDistribution = -0.5 + (i + 0.5) / jitterOffsets.length;
        sampleWeight += roundingRange * uniformCenteredDistribution;
      }

      this._copyUniforms["opacity"].value = sampleWeight;
      renderer.setClearColor(this.clearColor, this.clearAlpha);
      renderer.setRenderTarget(this._sampleRenderTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);

      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);

      if (i === 0) {
        renderer.setClearColor(0x000000, 0.0);
        renderer.clear();
      }

      this._fsQuad.render(renderer);
    }

    if (this.camera.setViewOffset && originalViewOffset !== null && originalViewOffset.enabled) {
      this.camera.setViewOffset(
        originalViewOffset.fullWidth,
        originalViewOffset.fullHeight,
        originalViewOffset.offsetX,
        originalViewOffset.offsetY,
        originalViewOffset.width,
        originalViewOffset.height,
      );
    } else if (this.camera.clearViewOffset) {
      this.camera.clearViewOffset();
    }

    renderer.autoClear = autoClear;
    renderer.setClearColor(this._oldClearColor, oldClearAlpha);
  }
}

// These jitter vectors are specified in integers because it is easier.
// I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
// before being used, thus these integers need to be scaled by 1/16.
//
// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
export const _JitterVectors: number[][][] = [
  [[0, 0]],
  [
    [4, 4],
    [-4, -4],
  ],
  [
    [-2, -6],
    [6, -2],
    [-6, 2],
    [2, 6],
  ],
  [
    [1, -3],
    [-1, 3],
    [5, 1],
    [-3, -5],
    [-5, 5],
    [-7, -1],
    [3, 7],
    [7, -7],
  ],
  [
    [1, 1],
    [-1, -3],
    [-3, 2],
    [4, -1],
    [-5, -2],
    [2, 5],
    [5, 3],
    [3, -5],
    [-2, 6],
    [0, -7],
    [-4, -6],
    [-6, 4],
    [-8, 0],
    [7, -4],
    [6, 7],
    [-7, -8],
  ],
  [
    [-4, -7],
    [-7, -5],
    [-3, -5],
    [-5, -4],
    [-1, -4],
    [-2, -2],
    [-6, -1],
    [-4, 0],
    [-7, 1],
    [-1, 2],
    [-6, 3],
    [-3, 3],
    [-7, 6],
    [-3, 6],
    [-5, 7],
    [-1, 7],
    [5, -7],
    [1, -6],
    [6, -5],
    [4, -4],
    [2, -3],
    [7, -2],
    [1, -1],
    [4, -1],
    [2, 1],
    [6, 2],
    [0, 4],
    [4, 4],
    [2, 5],
    [7, 5],
    [5, 6],
    [3, 7],
  ],
];
