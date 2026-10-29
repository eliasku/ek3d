import { Equation, Blending, PixelFormat, Factor, TextureType, TextureFilter } from "../../constants";
import { Color } from "../../math/Color";
import { Vector2 } from "../../math/Vector2";
import { DepthTexture } from "../../textures/DepthTexture";
import { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import { SAOShader } from "../shaders/SAOShader";
import { BlurShaderUtils, DepthLimitedBlurShader } from "../shaders/DepthLimitedBlurShader";
import { CopyShader } from "../shaders/CopyShader";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Material } from "../../materials/Material";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

/**
 * A SAO implementation inspired from @bhouston previous SAO work.
 *
 * `SAOPass` provides better quality than {@link SSAOPass} but is also more expensive.
 *
 * ```ts
 * const saoPass = new SAOPass( scene, camera );
 * composer.addPass( saoPass );
 * ```
 *
 */
export class SAOPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  params: {
    output: number;
    saoBias: number;
    saoIntensity: number;
    saoScale: number;
    saoKernelRadius: number;
    saoMinResolution: number;
    saoBlur: boolean;
    saoBlurRadius: number;
    saoBlurStdDev: number;
    saoBlurDepthCutoff: number;
  };
  resolution: Vector2;
  saoRenderTarget: WebGLRenderTarget;
  blurIntermediateRenderTarget: WebGLRenderTarget;
  normalRenderTarget: WebGLRenderTarget;
  normalMaterial: MeshNormalMaterial;
  saoMaterial: ShaderMaterial;
  vBlurMaterial: ShaderMaterial;
  hBlurMaterial: ShaderMaterial;
  materialCopy: ShaderMaterial;
  fsQuad: FullScreenQuad;
  _originalClearColor: Color;
  _oldClearColor: Color;
  _oldClearAlpha: number;
  prevStdDev: number = NaN;
  prevNumSamples: number = NaN;

  /** Output modes. */
  static OUTPUT: { Default: number; SAO: number; Normal: number } = {
    Default: 0,
    SAO: 1,
    Normal: 2,
  };

  /**
   * Constructs a new SAO pass.
   *
   * @param scene - The scene to compute the AO for.
   * @param camera - The camera.
   * @param resolution - The effect's resolution.
   */
  constructor(scene: Scene, camera: PerspectiveCamera, resolution = new Vector2(256, 256)) {
    super();
    /**
     * The scene to render the AO for.
     */
    this.scene = scene;

    /**
     * The camera.
     */
    this.camera = camera;

    /**
     * Overwritten to perform a clear operation by default.
     *
     * @default true
     */
    this.clear = true;

    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;

    // internals

    this._originalClearColor = new Color();
    this._oldClearColor = new Color();
    this._oldClearAlpha = 1;

    /**
     * The SAO parameter.
     */
    this.params = {
      output: 0,
      saoBias: 0.5,
      saoIntensity: 0.18,
      saoScale: 1,
      saoKernelRadius: 100,
      saoMinResolution: 0,
      saoBlur: true,
      saoBlurRadius: 8,
      saoBlurStdDev: 4,
      saoBlurDepthCutoff: 0.01,
    };

    /**
     * The effect's resolution.
     *
     * @default (256,256)
     */
    this.resolution = new Vector2(resolution.x, resolution.y);

    this.saoRenderTarget = new WebGLRenderTarget(this.resolution.x, this.resolution.y, {
      type: TextureType.HalfFloat,
      depthBuffer: false,
    });
    this.blurIntermediateRenderTarget = this.saoRenderTarget.clone();

    const depthTexture = new DepthTexture(
      this.resolution.x,
      this.resolution.y,
      TextureType.UnsignedInt248,
      undefined,
      undefined,
      undefined,
      TextureFilter.Nearest,
      TextureFilter.Nearest,
      undefined,
      PixelFormat.DepthStencil,
    );
    depthTexture.format = PixelFormat.DepthStencil;
    depthTexture.type = TextureType.UnsignedInt248;

    this.normalRenderTarget = new WebGLRenderTarget(this.resolution.x, this.resolution.y, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
      depthTexture: depthTexture,
    });

    this.normalMaterial = new MeshNormalMaterial();
    this.normalMaterial.blending = Blending.No;

    this.saoMaterial = new ShaderMaterial({
      defines: { ...SAOShader.defines },
      fragmentShader: SAOShader.fragmentShader,
      vertexShader: SAOShader.vertexShader,
      uniforms: cloneUniforms(SAOShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
    });
    this.saoMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.saoMaterial.uniforms!["tDepth"].value = depthTexture;
    this.saoMaterial.uniforms!["tNormal"].value = this.normalRenderTarget.texture;
    this.saoMaterial.uniforms!["size"].value.set(this.resolution.x, this.resolution.y);
    this.saoMaterial.uniforms!["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.saoMaterial.uniforms!["cameraProjectionMatrix"].value = this.camera.projectionMatrix;
    this.saoMaterial.blending = Blending.No;

    this.vBlurMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(DepthLimitedBlurShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      defines: { ...DepthLimitedBlurShader.defines },
      vertexShader: DepthLimitedBlurShader.vertexShader,
      fragmentShader: DepthLimitedBlurShader.fragmentShader,
    });
    this.vBlurMaterial.defines["DEPTH_PACKING"] = 0;
    this.vBlurMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.vBlurMaterial.uniforms!["tDiffuse"].value = this.saoRenderTarget.texture;
    this.vBlurMaterial.uniforms!["tDepth"].value = depthTexture;
    this.vBlurMaterial.uniforms!["size"].value.set(this.resolution.x, this.resolution.y);
    this.vBlurMaterial.blending = Blending.No;

    this.hBlurMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(DepthLimitedBlurShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      defines: { ...DepthLimitedBlurShader.defines },
      vertexShader: DepthLimitedBlurShader.vertexShader,
      fragmentShader: DepthLimitedBlurShader.fragmentShader,
    });
    this.hBlurMaterial.defines["DEPTH_PACKING"] = 0;
    this.hBlurMaterial.defines["PERSPECTIVE_CAMERA"] = this.camera.isPerspectiveCamera ? 1 : 0;
    this.hBlurMaterial.uniforms!["tDiffuse"].value = this.blurIntermediateRenderTarget.texture;
    this.hBlurMaterial.uniforms!["tDepth"].value = depthTexture;
    this.hBlurMaterial.uniforms!["size"].value.set(this.resolution.x, this.resolution.y);
    this.hBlurMaterial.blending = Blending.No;

    this.materialCopy = new ShaderMaterial({
      uniforms: cloneUniforms(CopyShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      blending: Blending.No,
    });
    this.materialCopy.transparent = true;
    this.materialCopy.depthTest = false;
    this.materialCopy.depthWrite = false;
    this.materialCopy.blending = Blending.Custom;
    this.materialCopy.blendSrc = Factor.DstColor;
    this.materialCopy.blendDst = Factor.Zero;
    this.materialCopy.blendEquation = Equation.Add;
    this.materialCopy.blendSrcAlpha = Factor.DstAlpha;
    this.materialCopy.blendDstAlpha = Factor.Zero;
    this.materialCopy.blendEquationAlpha = Equation.Add;

    this.fsQuad = new FullScreenQuad(null);
  }

  /**
   * Performs the SAO pass.
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
    // Rendering readBuffer first when rendering to screen
    if (this.renderToScreen) {
      this.materialCopy.blending = Blending.No;
      this.materialCopy.uniforms["tDiffuse"].value = readBuffer.texture;
      this.materialCopy.needsUpdate = true;
      this._renderPass(renderer, this.materialCopy, null);
    }

    renderer.getClearColor(this._oldClearColor);
    this._oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.saoMaterial.uniforms["bias"].value = this.params.saoBias;
    this.saoMaterial.uniforms["intensity"].value = this.params.saoIntensity;
    this.saoMaterial.uniforms["scale"].value = this.params.saoScale;
    this.saoMaterial.uniforms["kernelRadius"].value = this.params.saoKernelRadius;
    this.saoMaterial.uniforms["minResolution"].value = this.params.saoMinResolution;
    this.saoMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.saoMaterial.uniforms["cameraFar"].value = this.camera.far;
    // this.saoMaterial.uniforms['randomSeed'].value = Math.random();

    const depthCutoff = this.params.saoBlurDepthCutoff * (this.camera.far - this.camera.near);
    this.vBlurMaterial.uniforms["depthCutoff"].value = depthCutoff;
    this.hBlurMaterial.uniforms["depthCutoff"].value = depthCutoff;

    this.vBlurMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.vBlurMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.hBlurMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.hBlurMaterial.uniforms["cameraFar"].value = this.camera.far;

    this.params.saoBlurRadius = Math.floor(this.params.saoBlurRadius);
    if (this.prevStdDev !== this.params.saoBlurStdDev || this.prevNumSamples !== this.params.saoBlurRadius) {
      BlurShaderUtils.configure(
        this.vBlurMaterial,
        this.params.saoBlurRadius,
        this.params.saoBlurStdDev,
        new Vector2(0, 1),
      );
      BlurShaderUtils.configure(
        this.hBlurMaterial,
        this.params.saoBlurRadius,
        this.params.saoBlurStdDev,
        new Vector2(1, 0),
      );
      this.prevStdDev = this.params.saoBlurStdDev;
      this.prevNumSamples = this.params.saoBlurRadius;
    }

    // render normal and depth
    this._renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0x7777ff, 1.0);

    // Rendering SAO texture
    this._renderPass(renderer, this.saoMaterial, this.saoRenderTarget, 0xffffff, 1.0);

    // Blurring SAO texture
    if (this.params.saoBlur) {
      this._renderPass(renderer, this.vBlurMaterial, this.blurIntermediateRenderTarget, 0xffffff, 1.0);
      this._renderPass(renderer, this.hBlurMaterial, this.saoRenderTarget, 0xffffff, 1.0);
    }

    const outputMaterial = this.materialCopy;

    // Setting up SAO rendering
    if (this.params.output === SAOPass.OUTPUT.Normal) {
      this.materialCopy.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
      this.materialCopy.needsUpdate = true;
    } else {
      this.materialCopy.uniforms["tDiffuse"].value = this.saoRenderTarget.texture;
      this.materialCopy.needsUpdate = true;
    }

    // Blending depends on output
    if (this.params.output === SAOPass.OUTPUT.Default) {
      outputMaterial.blending = Blending.Custom;
    } else {
      outputMaterial.blending = Blending.No;
    }

    // Rendering SAOPass result on top of previous pass
    this._renderPass(renderer, outputMaterial, this.renderToScreen ? null : readBuffer);

    renderer.setClearColor(this._oldClearColor, this._oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.saoRenderTarget.setSize(width, height);
    this.blurIntermediateRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);

    this.saoMaterial.uniforms["size"].value.set(width, height);
    this.saoMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.saoMaterial.uniforms["cameraProjectionMatrix"].value = this.camera.projectionMatrix;
    this.saoMaterial.needsUpdate = true;

    this.vBlurMaterial.uniforms["size"].value.set(width, height);
    this.vBlurMaterial.needsUpdate = true;

    this.hBlurMaterial.uniforms["size"].value.set(width, height);
    this.hBlurMaterial.needsUpdate = true;
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.saoRenderTarget.dispose();
    this.blurIntermediateRenderTarget.dispose();
    this.normalRenderTarget.dispose();

    this.normalMaterial.dispose();
    this.saoMaterial.dispose();
    this.vBlurMaterial.dispose();
    this.hBlurMaterial.dispose();
    this.materialCopy.dispose();

    this.fsQuad.dispose();
  }

  // internal

  _renderPass(
    renderer: WebGLRenderer,
    passMaterial: MaterialLike,
    renderTarget: RT | null,
    clearColor?: number | null,
    clearAlpha?: number,
  ): void {
    // save original state
    renderer.getClearColor(this._originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;

    renderer.setRenderTarget(renderTarget);

    // setup pass state
    renderer.autoClear = false;
    if (clearColor !== undefined && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0.0);
      renderer.clear();
    }

    this.fsQuad.material = passMaterial;
    this.fsQuad.render(renderer);

    // restore original state
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this._originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }

  _renderOverride(
    renderer: WebGLRenderer,
    overrideMaterial: MaterialLike,
    renderTarget: RT,
    clearColor: number | null,
    clearAlpha: number,
  ): void {
    renderer.getClearColor(this._originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;

    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;

    clearColor = (overrideMaterial as any).clearColor || clearColor;
    clearAlpha = (overrideMaterial as any).clearAlpha || clearAlpha;
    if (clearColor !== undefined && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0.0);
      renderer.clear();
    }

    this.scene.overrideMaterial = overrideMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;

    // restore original state
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this._originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
}

type MaterialLike = Material | null;

/* TS note: `FullScreenQuad` accepts `Material | null`; `Parameters<typeof>` gives exactly that union. */
