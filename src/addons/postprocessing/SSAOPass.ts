import { Equation, Blending, PixelFormat, Factor, TextureType, TextureFilter, Wrapping } from "../../constants";
import { Color } from "../../math/Color";
import { lerp } from "../../math/MathUtils";
import { Vector3 } from "../../math/Vector3";
import { DataTexture } from "../../textures/DataTexture";
import { DepthTexture } from "../../textures/DepthTexture";
import { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import { SSAOBlurShader, SSAODepthShader, SSAOShader } from "../shaders/SSAOShader";
import { CopyShader } from "../shaders/CopyShader";
import { SimplexNoise } from "../math/SimplexNoise";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Object3D } from "../../core/Object3D";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";
import type { Line } from "../../objects/Line";
import type { Points } from "../../objects/Points";
import type { Material } from "../../materials/Material";

/**
 * A pass for a basic SSAO effect.
 *
 * {@link SAOPass} and {@link GTAOPass} produce a more advanced AO but are also
 * more expensive.
 *
 * ```ts
 * const ssaoPass = new SSAOPass( scene, camera, width, height );
 * composer.addPass( ssaoPass );
 * ```
 *
 */
export class SSAOPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  kernelRadius: number;
  kernel: Vector3[];
  noiseTexture: DataTexture | null;
  output: number;
  minDistance: number;
  maxDistance: number;
  normalRenderTarget: WebGLRenderTarget;
  ssaoRenderTarget: WebGLRenderTarget;
  blurRenderTarget: WebGLRenderTarget;
  ssaoMaterial: ShaderMaterial;
  normalMaterial: MeshNormalMaterial;
  blurMaterial: ShaderMaterial;
  depthRenderMaterial: ShaderMaterial;
  copyMaterial: ShaderMaterial;
  _visibilityCache: Object3D[];
  _fsQuad: FullScreenQuad;
  _originalClearColor: Color;

  /** Output modes. */
  static OUTPUT: { Default: number; SSAO: number; Blur: number; Depth: number; Normal: number } = {
    Default: 0,
    SSAO: 1,
    Blur: 2,
    Depth: 3,
    Normal: 4,
  };

  /**
   * Constructs a new SSAO pass.
   *
   * @param scene - The scene to compute the AO for.
   * @param camera - The camera.
   * @param width - The width of the effect.
   * @param height - The height of the effect.
   * @param kernelSize - The kernel size.
   */
  constructor(
    scene: Scene,
    camera: PerspectiveCamera,
    width: number = 512,
    height: number = 512,
    kernelSize: number = 32,
  ) {
    super();
    /**
     * The width of the effect.
     *
     * @default 512
     */
    this.width = width;

    /**
     * The height of the effect.
     *
     * @default 512
     */
    this.height = height;

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

    /**
     * The camera.
     */
    this.camera = camera;

    /**
     * The scene to render the AO for.
     */
    this.scene = scene;

    /**
     * The kernel radius controls how wide the
     * AO spreads.
     *
     * @default 8
     */
    this.kernelRadius = 8;
    this.kernel = [];
    this.noiseTexture = null;

    /**
     * The output configuration.
     *
     * @default 0
     */
    this.output = 0;

    /**
     * Defines the minimum distance that should be
     * affected by the AO.
     *
     * @default 0.005
     */
    this.minDistance = 0.005;

    /**
     * Defines the maximum distance that should be
     * affected by the AO.
     *
     * @default 0.1
     */
    this.maxDistance = 0.1;

    this._visibilityCache = [];

    //

    this._generateSampleKernel(kernelSize);
    this._generateRandomKernelRotations();

    // depth texture

    const depthTexture = new DepthTexture(
      this.width,
      this.height,
      TextureType.UnsignedInt248,
      undefined,
      undefined,
      undefined,
      TextureFilter.Nearest,
      TextureFilter.Nearest,
      undefined,
      PixelFormat.DepthStencil,
    );

    // normal render target with depth buffer

    this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
      depthTexture: depthTexture,
    });

    // ssao render target

    this.ssaoRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      type: TextureType.HalfFloat,
      depthBuffer: false,
    });

    this.blurRenderTarget = this.ssaoRenderTarget.clone();

    // ssao material

    this.ssaoMaterial = new ShaderMaterial({
      defines: { ...SSAOShader.defines },
      uniforms: cloneUniforms(SSAOShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSAOShader.vertexShader,
      fragmentShader: SSAOShader.fragmentShader,
      blending: Blending.No,
    } as never);

    this.ssaoMaterial.defines["KERNEL_SIZE"] = kernelSize;

    this.ssaoMaterial.uniforms!["tNormal"].value = this.normalRenderTarget.texture;
    this.ssaoMaterial.uniforms!["tDepth"].value = this.normalRenderTarget.depthTexture;
    this.ssaoMaterial.uniforms!["tNoise"].value = this.noiseTexture;
    this.ssaoMaterial.uniforms!["kernel"].value = this.kernel;
    this.ssaoMaterial.uniforms!["cameraNear"].value = this.camera.near;
    this.ssaoMaterial.uniforms!["cameraFar"].value = this.camera.far;
    this.ssaoMaterial.uniforms!["resolution"].value.set(this.width, this.height);
    this.ssaoMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms!["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);

    // normal material

    this.normalMaterial = new MeshNormalMaterial();
    this.normalMaterial.blending = Blending.No;

    // blur material

    this.blurMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(SSAOBlurShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSAOBlurShader.vertexShader,
      fragmentShader: SSAOBlurShader.fragmentShader,
    } as never);
    this.blurMaterial.uniforms["tDiffuse"].value = this.ssaoRenderTarget.texture;
    this.blurMaterial.uniforms["resolution"].value.set(this.width, this.height);

    // material for rendering the depth

    this.depthRenderMaterial = new ShaderMaterial({
      defines: { ...SSAODepthShader.defines },
      uniforms: cloneUniforms(SSAODepthShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSAODepthShader.vertexShader,
      fragmentShader: SSAODepthShader.fragmentShader,
      blending: Blending.No,
    } as never);
    this.depthRenderMaterial.uniforms["tDepth"].value = this.normalRenderTarget.depthTexture;
    this.depthRenderMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.depthRenderMaterial.uniforms["cameraFar"].value = this.camera.far;

    // material for rendering the content of a render target

    this.copyMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(CopyShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: Factor.DstColor,
      blendDst: Factor.Zero,
      blendEquation: Equation.Add,
      blendSrcAlpha: Factor.DstAlpha,
      blendDstAlpha: Factor.Zero,
      blendEquationAlpha: Equation.Add,
    } as never);

    // internals

    this._fsQuad = new FullScreenQuad(null);

    this._originalClearColor = new Color();
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    // dispose render targets

    this.normalRenderTarget.dispose();
    this.ssaoRenderTarget.dispose();
    this.blurRenderTarget.dispose();

    // dispose materials

    this.normalMaterial.dispose();
    this.blurMaterial.dispose();
    this.copyMaterial.dispose();
    this.depthRenderMaterial.dispose();

    // dispose full screen quad

    this._fsQuad.dispose();
  }

  /**
   * Performs the SSAO pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, _writeBuffer: RT, readBuffer: RT, _deltaTime: number, _maskActive: boolean): void {
    // render normals and depth (honor only meshes, points and lines do not contribute to SSAO)

    this._overrideVisibility();
    this._renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0x7777ff, 1.0);
    this._restoreVisibility();

    // render SSAO

    this.ssaoMaterial.uniforms!["kernelRadius"].value = this.kernelRadius;
    this.ssaoMaterial.uniforms!["minDistance"].value = this.minDistance;
    this.ssaoMaterial.uniforms!["maxDistance"].value = this.maxDistance;
    this._renderPass(renderer, this.ssaoMaterial, this.ssaoRenderTarget);

    // render blur

    this._renderPass(renderer, this.blurMaterial, this.blurRenderTarget);

    // output result to screen

    switch (this.output) {
      case SSAOPass.OUTPUT.SSAO:
        this.copyMaterial.uniforms["tDiffuse"].value = this.ssaoRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : readBuffer);
        break;

      case SSAOPass.OUTPUT.Blur:
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : readBuffer);
        break;

      case SSAOPass.OUTPUT.Depth:
        this._renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : readBuffer);
        break;

      case SSAOPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : readBuffer);
        break;

      case SSAOPass.OUTPUT.Default:
        this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
        this.copyMaterial.blending = Blending.Custom;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : readBuffer);
        break;

      default:
        console.warn("THREE.SSAOPass: Unknown output type.");
    }
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.ssaoRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.blurRenderTarget.setSize(width, height);

    this.ssaoMaterial.uniforms!["resolution"].value.set(width, height);
    this.ssaoMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssaoMaterial.uniforms!["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);

    this.blurMaterial.uniforms["resolution"].value.set(width, height);
  }

  // internals

  _renderPass(
    renderer: WebGLRenderer,
    passMaterial: Material | null,
    renderTarget: RT | null,
    clearColor?: number,
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

    this._fsQuad.material = passMaterial;
    this._fsQuad.render(renderer);

    // restore original state
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this._originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }

  _renderOverride(
    renderer: WebGLRenderer,
    overrideMaterial: Material,
    renderTarget: RT,
    clearColor: number,
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

  _generateSampleKernel(kernelSize: number): void {
    const kernel = this.kernel;

    for (let i = 0; i < kernelSize; i++) {
      const sample = new Vector3();
      sample.x = Math.random() * 2 - 1;
      sample.y = Math.random() * 2 - 1;
      sample.z = Math.random();

      sample.normalize();

      let scale = i / kernelSize;
      scale = lerp(0.1, 1, scale * scale);
      sample.multiplyScalar(scale);

      kernel.push(sample);
    }
  }

  _generateRandomKernelRotations(): void {
    const width = 4;
    const height = 4;

    const simplex = new SimplexNoise();

    const size = width * height;
    const data = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      const z = 0;

      data[i] = simplex.noise3d(x, y, z);
    }

    this.noiseTexture = new DataTexture(data, width, height, PixelFormat.Red, TextureType.Float);
    this.noiseTexture.wrapS = Wrapping.Repeat;
    this.noiseTexture.wrapT = Wrapping.Repeat;
    this.noiseTexture.needsUpdate = true;
  }

  _overrideVisibility(): void {
    const scene = this.scene;
    const cache = this._visibilityCache;

    scene.traverse(function (object: Object3D) {
      if ((object as Points).isPoints === true || (object as Line).isLine === true) {
        if (object.visible) {
          object.visible = false;
          cache.push(object);
        }
      }
    });
  }

  _restoreVisibility(): void {
    const cache = this._visibilityCache;

    for (let i = 0; i < cache.length; i++) {
      cache[i].visible = true;
    }

    cache.length = 0;
  }
}
