import {
  AddEquation,
  CustomBlending,
  DepthStencilFormat,
  DstAlphaFactor,
  DstColorFactor,
  HalfFloatType,
  NearestFilter,
  NoBlending,
  UnsignedByteType,
  UnsignedInt248Type,
  ZeroFactor,
  RGBAFormat,
  RepeatWrapping,
} from "../../constants";
import { Color } from "../../math/Color";
import { DataTexture } from "../../textures/DataTexture";
import { DepthTexture } from "../../textures/DepthTexture";
import type { Texture } from "../../textures/Texture";
import { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import { GTAODepthShader, GTAOBlendShader, GTAOShader, generateMagicSquareNoise } from "../shaders/GTAOShader";
import { PoissonDenoiseShader, generatePdSamplePointInitializer } from "../shaders/PoissonDenoiseShader";
import { CopyShader } from "../shaders/CopyShader";
import { SimplexNoise } from "../math/SimplexNoise";
import type { Box3 } from "../../math/Box3";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Object3D } from "../../core/Object3D";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";
import type { Line } from "../../objects/Line";
import type { Points } from "../../objects/Points";
import type { Material } from "../../materials/Material";

/** GTAO material parameters. */
export interface GTAOMaterialParameters {
  radius?: number;
  distanceExponent?: number;
  thickness?: number;
  distanceFallOff?: number;
  scale?: number;
  samples?: number;
  screenSpaceRadius?: boolean;
}

/** Poisson denoise parameters. */
export interface GTAODenoiseParameters {
  lumaPhi?: number;
  depthPhi?: number;
  normalPhi?: number;
  radius?: number;
  radiusExponent?: number;
  rings?: number;
  samples?: number;
}

/** GTAO pass constructor parameters. */
export interface GTAOPassParameters {
  depthTexture?: DepthTexture;
  normalTexture?: Texture;
}

/**
 * A GTAO implementation of the Horizon Based Indirect Lighting (HBIL) algorithm.
 *
 * `GTAOPass` provides better quality than {@link SSAOPass} but is also more expensive.
 *
 * ```typescript
 * const gtaoPass = new GTAOPass( scene, camera, width, height );
 * gtaoPass.output = GTAOPass.OUTPUT.Denoise;
 * composer.addPass( gtaoPass );
 * ```
 *
 * @three_import import { GTAOPass } from 'ek3d/addons/postprocessing/GTAOPass';
 */
export class GTAOPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  output: number;
  blendIntensity: number;
  pdRings: number;
  pdRadiusExponent: number;
  pdSamples: number;
  radius: number | undefined;
  gtaoNoiseTexture: DataTexture;
  pdNoiseTexture: DataTexture;
  gtaoRenderTarget: WebGLRenderTarget;
  pdRenderTarget: WebGLRenderTarget;
  normalRenderTarget: WebGLRenderTarget | undefined;
  normalTexture: Texture | null | undefined;
  depthTexture: DepthTexture | null | undefined;
  gtaoMaterial: ShaderMaterial;
  normalMaterial: MeshNormalMaterial;
  pdMaterial: ShaderMaterial;
  depthRenderMaterial: ShaderMaterial;
  copyMaterial: ShaderMaterial;
  blendMaterial: ShaderMaterial;
  _fsQuad: FullScreenQuad;
  _originalClearColor: Color;
  _renderGBuffer: boolean;
  _visibilityCache: Object3D[];

  /** Output modes. */
  static OUTPUT: {
    Off: number;
    Default: number;
    Diffuse: number;
    Depth: number;
    Normal: number;
    AO: number;
    Denoise: number;
  } = {
    Off: -1,
    Default: 0,
    Diffuse: 1,
    Depth: 2,
    Normal: 3,
    AO: 4,
    Denoise: 5,
  };

  /**
   * Constructs a new GTAO pass.
   *
   * @param scene - The scene to compute the AO for.
   * @param camera - The camera.
   * @param width - The width of the effect.
   * @param height - The height of the effect.
   * @param parameters - The pass parameters.
   * @param aoParameters - The AO parameters.
   * @param pdParameters - The denoise parameters.
   */
  constructor(
    scene: Scene,
    camera: PerspectiveCamera,
    width: number = 512,
    height: number = 512,
    parameters?: GTAOPassParameters,
    aoParameters?: GTAOMaterialParameters,
    pdParameters?: GTAODenoiseParameters,
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
     * The camera.
     */
    this.camera = camera;

    /**
     * The scene to render the AO for.
     */
    this.scene = scene;

    /**
     * The output configuration.
     *
     * @default 0
     */
    this.output = 0;
    this._renderGBuffer = true;
    this._visibilityCache = [];

    /**
     * The AO blend intensity.
     *
     * @default 1
     */
    this.blendIntensity = 1.0;

    /**
     * The number of Poisson Denoise rings.
     *
     * @default 2
     */
    this.pdRings = 2.0;

    /**
     * The Poisson Denoise radius exponent.
     *
     * @default 2
     */
    this.pdRadiusExponent = 2.0;

    /**
     * The Poisson Denoise sample count.
     *
     * @default 16
     */
    this.pdSamples = 16;
    this.radius = undefined;

    this.gtaoNoiseTexture = generateMagicSquareNoise();
    this.pdNoiseTexture = this._generateNoise();

    this.gtaoRenderTarget = new WebGLRenderTarget(this.width, this.height, { type: HalfFloatType, depthBuffer: false });
    this.pdRenderTarget = this.gtaoRenderTarget.clone();

    this.gtaoMaterial = new ShaderMaterial({
      defines: { ...GTAOShader.defines },
      uniforms: cloneUniforms(GTAOShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: GTAOShader.vertexShader,
      fragmentShader: GTAOShader.fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    } as never);
    this.gtaoMaterial.defines.PERSPECTIVE_CAMERA = this.camera.isPerspectiveCamera ? 1 : 0;
    this.gtaoMaterial.uniforms!["tNoise"].value = this.gtaoNoiseTexture;
    this.gtaoMaterial.uniforms!["resolution"].value.set(this.width, this.height);
    this.gtaoMaterial.uniforms!["cameraNear"].value = this.camera.near;
    this.gtaoMaterial.uniforms!["cameraFar"].value = this.camera.far;

    this.normalMaterial = new MeshNormalMaterial();
    this.normalMaterial.blending = NoBlending;

    this.pdMaterial = new ShaderMaterial({
      defines: { ...PoissonDenoiseShader.defines },
      uniforms: cloneUniforms(PoissonDenoiseShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: PoissonDenoiseShader.vertexShader,
      fragmentShader: PoissonDenoiseShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    } as never);
    this.pdMaterial.uniforms!["tDiffuse"].value = this.gtaoRenderTarget.texture;
    this.pdMaterial.uniforms!["tNoise"].value = this.pdNoiseTexture;
    this.pdMaterial.uniforms!["resolution"].value.set(this.width, this.height);
    this.pdMaterial.uniforms!["lumaPhi"].value = 10;
    this.pdMaterial.uniforms!["depthPhi"].value = 2;
    this.pdMaterial.uniforms!["normalPhi"].value = 3;
    this.pdMaterial.uniforms!["radius"].value = 8;

    this.depthRenderMaterial = new ShaderMaterial({
      defines: { ...GTAODepthShader.defines },
      uniforms: cloneUniforms(GTAODepthShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: GTAODepthShader.vertexShader,
      fragmentShader: GTAODepthShader.fragmentShader,
      blending: NoBlending,
    } as never);
    this.depthRenderMaterial.uniforms!["cameraNear"].value = this.camera.near;
    this.depthRenderMaterial.uniforms!["cameraFar"].value = this.camera.far;

    this.copyMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(CopyShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation,
    } as never);

    this.blendMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(GTAOBlendShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: GTAOBlendShader.vertexShader,
      fragmentShader: GTAOBlendShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation,
    } as never);

    this._fsQuad = new FullScreenQuad(null);

    this._originalClearColor = new Color();

    this.setGBuffer(
      parameters ? parameters.depthTexture : undefined,
      parameters ? parameters.normalTexture : undefined,
    );

    if (aoParameters !== undefined) {
      this.updateGtaoMaterial(aoParameters);
    }

    if (pdParameters !== undefined) {
      this.updatePdMaterial(pdParameters);
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

    this.gtaoRenderTarget.setSize(width, height);
    if (this.normalRenderTarget) this.normalRenderTarget.setSize(width, height);
    this.pdRenderTarget.setSize(width, height);

    this.gtaoMaterial.uniforms!["resolution"].value.set(width, height);
    this.gtaoMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.gtaoMaterial.uniforms!["cameraProjectionMatrixInverse"].value.copy(this.camera.projectionMatrixInverse);

    this.pdMaterial.uniforms!["resolution"].value.set(width, height);
    this.pdMaterial.uniforms!["cameraProjectionMatrixInverse"].value.copy(this.camera.projectionMatrixInverse);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.gtaoNoiseTexture.dispose();
    this.pdNoiseTexture.dispose();
    if (this.normalRenderTarget) this.normalRenderTarget.dispose();
    this.gtaoRenderTarget.dispose();
    this.pdRenderTarget.dispose();
    this.normalMaterial.dispose();
    this.pdMaterial.dispose();
    this.copyMaterial.dispose();
    this.depthRenderMaterial.dispose();
    this._fsQuad.dispose();
  }

  /**
   * A texture holding the computed AO.
   */
  get gtaoMap(): Texture {
    return this.pdRenderTarget.texture;
  }

  /**
   * Configures the GBuffer of this pass. If no arguments are passed,
   * the pass creates an internal render target for holding depth
   * and normal data. External depth and normal data must use separate
   * textures and remain owned by the caller.
   * If no normal texture is supplied, normals are reconstructed from depth
   * for AO and denoising, and the normal output displays black.
   *
   * @param depthTexture - The depth texture.
   * @param normalTexture - The normal texture.
   */
  setGBuffer(depthTexture?: DepthTexture, normalTexture?: Texture): void {
    if (depthTexture !== undefined) {
      this.depthTexture = depthTexture;
      this.normalTexture = normalTexture;
      this._renderGBuffer = false;
    } else {
      if (this.normalRenderTarget === undefined) {
        const depthTextureInternal = new DepthTexture(
          this.width,
          this.height,
          UnsignedInt248Type,
          undefined,
          undefined,
          undefined,
          NearestFilter,
          NearestFilter,
          undefined,
          DepthStencilFormat,
        );
        this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
          minFilter: NearestFilter,
          magFilter: NearestFilter,
          type: HalfFloatType,
          depthTexture: depthTextureInternal,
        });
      }

      this.depthTexture = this.normalRenderTarget.depthTexture;
      this.normalTexture = this.normalRenderTarget.texture;
      this._renderGBuffer = true;
    }

    const normalVectorType = this.normalTexture ? 1 : 0;

    this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE = normalVectorType;
    this.gtaoMaterial.needsUpdate = true;
    this.gtaoMaterial.uniforms!["tNormal"].value = this.normalTexture;
    this.gtaoMaterial.uniforms!["tDepth"].value = this.depthTexture;

    this.pdMaterial.defines.NORMAL_VECTOR_TYPE = normalVectorType;
    this.pdMaterial.needsUpdate = true;
    this.pdMaterial.uniforms!["tNormal"].value = this.normalTexture;
    this.pdMaterial.uniforms!["tDepth"].value = this.depthTexture;

    this.depthRenderMaterial.uniforms!["tDepth"].value = this.depthTexture;
  }

  /**
   * Configures the clip box of the GTAO shader with the given AABB.
   *
   * @param box - The AABB enclosing the scene that should receive AO. When passing
   * `null`, to clip box is used.
   */
  setSceneClipBox(box: Box3 | null): void {
    if (box) {
      this.gtaoMaterial.needsUpdate = this.gtaoMaterial.defines.SCENE_CLIP_BOX !== 1;
      this.gtaoMaterial.defines.SCENE_CLIP_BOX = 1;
      this.gtaoMaterial.uniforms!["sceneBoxMin"].value.copy(box.min);
      this.gtaoMaterial.uniforms!["sceneBoxMax"].value.copy(box.max);
    } else {
      this.gtaoMaterial.needsUpdate = this.gtaoMaterial.defines.SCENE_CLIP_BOX === 0;
      this.gtaoMaterial.defines.SCENE_CLIP_BOX = 0;
    }
  }

  /**
   * Updates the GTAO material from the given parameter object.
   *
   * @param parameters - The GTAO material parameters.
   */
  updateGtaoMaterial(parameters: GTAOMaterialParameters): void {
    if (parameters.radius !== undefined) {
      this.gtaoMaterial.uniforms!["radius"].value = parameters.radius;
    }

    if (parameters.distanceExponent !== undefined) {
      this.gtaoMaterial.uniforms!["distanceExponent"].value = parameters.distanceExponent;
    }

    if (parameters.thickness !== undefined) {
      this.gtaoMaterial.uniforms!["thickness"].value = parameters.thickness;
    }

    if (parameters.distanceFallOff !== undefined) {
      this.gtaoMaterial.uniforms!["distanceFallOff"].value = parameters.distanceFallOff;
      this.gtaoMaterial.needsUpdate = true;
    }

    if (parameters.scale !== undefined) {
      this.gtaoMaterial.uniforms!["scale"].value = parameters.scale;
    }

    if (parameters.samples !== undefined && parameters.samples !== this.gtaoMaterial.defines.SAMPLES) {
      this.gtaoMaterial.defines.SAMPLES = parameters.samples;
      this.gtaoMaterial.needsUpdate = true;
    }

    if (
      parameters.screenSpaceRadius !== undefined &&
      (parameters.screenSpaceRadius ? 1 : 0) !== this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS
    ) {
      this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS = parameters.screenSpaceRadius ? 1 : 0;
      this.gtaoMaterial.needsUpdate = true;
    }
  }

  /**
   * Updates the Denoise material from the given parameter object.
   *
   * @param parameters - The denoise parameters.
   */
  updatePdMaterial(parameters: GTAODenoiseParameters): void {
    let updateShader = false;

    if (parameters.lumaPhi !== undefined) {
      this.pdMaterial.uniforms!["lumaPhi"].value = parameters.lumaPhi;
    }

    if (parameters.depthPhi !== undefined) {
      this.pdMaterial.uniforms!["depthPhi"].value = parameters.depthPhi;
    }

    if (parameters.normalPhi !== undefined) {
      this.pdMaterial.uniforms!["normalPhi"].value = parameters.normalPhi;
    }

    if (parameters.radius !== undefined && parameters.radius !== this.radius) {
      this.pdMaterial.uniforms!["radius"].value = parameters.radius;
    }

    if (parameters.radiusExponent !== undefined && parameters.radiusExponent !== this.pdRadiusExponent) {
      this.pdRadiusExponent = parameters.radiusExponent;
      updateShader = true;
    }

    if (parameters.rings !== undefined && parameters.rings !== this.pdRings) {
      this.pdRings = parameters.rings;
      updateShader = true;
    }

    if (parameters.samples !== undefined && parameters.samples !== this.pdSamples) {
      this.pdSamples = parameters.samples;
      updateShader = true;
    }

    if (updateShader) {
      this.pdMaterial.defines.SAMPLES = this.pdSamples;
      this.pdMaterial.defines.SAMPLE_VECTORS = generatePdSamplePointInitializer(
        this.pdSamples,
        this.pdRings,
        this.pdRadiusExponent,
      );
      this.pdMaterial.needsUpdate = true;
    }
  }

  /**
   * Performs the GTAO pass.
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
    // render normals and depth (honor only meshes, points and lines do not contribute to AO)

    if (this._renderGBuffer) {
      this._overrideVisibility();
      this._renderOverride(renderer, this.normalMaterial, this.normalRenderTarget!, 0x7777ff, 1.0);
      this._restoreVisibility();
    }

    // render AO

    this.gtaoMaterial.uniforms!["cameraNear"].value = this.camera.near;
    this.gtaoMaterial.uniforms!["cameraFar"].value = this.camera.far;
    this.gtaoMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.gtaoMaterial.uniforms!["cameraProjectionMatrixInverse"].value.copy(this.camera.projectionMatrixInverse);
    this.gtaoMaterial.uniforms!["cameraWorldMatrix"].value.copy(this.camera.matrixWorld);
    this._renderPass(renderer, this.gtaoMaterial, this.gtaoRenderTarget, 0xffffff, 1.0);

    // render poisson denoise

    this.pdMaterial.uniforms!["cameraProjectionMatrixInverse"].value.copy(this.camera.projectionMatrixInverse);
    this._renderPass(renderer, this.pdMaterial, this.pdRenderTarget, 0xffffff, 1.0);

    // output result to screen

    switch (this.output) {
      case GTAOPass.OUTPUT.Off:
        break;

      case GTAOPass.OUTPUT.Diffuse:
        this.copyMaterial.uniforms["tDiffuse"].value = readBuffer.texture;
        this.copyMaterial.blending = NoBlending;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case GTAOPass.OUTPUT.AO:
        this.copyMaterial.uniforms["tDiffuse"].value = this.gtaoRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case GTAOPass.OUTPUT.Denoise:
        this.copyMaterial.uniforms["tDiffuse"].value = this.pdRenderTarget.texture;
        this.copyMaterial.blending = NoBlending;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case GTAOPass.OUTPUT.Depth:
        this.depthRenderMaterial.uniforms["cameraNear"].value = this.camera.near;
        this.depthRenderMaterial.uniforms["cameraFar"].value = this.camera.far;
        this._renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case GTAOPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalTexture || null;
        this.copyMaterial.blending = NoBlending;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case GTAOPass.OUTPUT.Default:
        this.copyMaterial.uniforms["tDiffuse"].value = readBuffer.texture;
        this.copyMaterial.blending = NoBlending;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

        this.blendMaterial.uniforms["intensity"].value = this.blendIntensity;
        this.blendMaterial.uniforms["tDiffuse"].value = this.pdRenderTarget.texture;
        this._renderPass(renderer, this.blendMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      default:
        console.warn("THREE.GTAOPass: Unknown output type.");
    }
  }

  // internals

  _renderPass(
    renderer: WebGLRenderer,
    passMaterial: Material | null,
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
    clearColor?: number | null,
    clearAlpha?: number,
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

    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this._originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
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

  _generateNoise(size: number = 64): DataTexture {
    const simplex = new SimplexNoise();

    const arraySize = size * size * 4;
    const data = new Uint8Array(arraySize);

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const x = i;
        const y = j;

        data[(i * size + j) * 4] = (simplex.noise(x, y) * 0.5 + 0.5) * 255;
        data[(i * size + j) * 4 + 1] = (simplex.noise(x + size, y) * 0.5 + 0.5) * 255;
        data[(i * size + j) * 4 + 2] = (simplex.noise(x, y + size) * 0.5 + 0.5) * 255;
        data[(i * size + j) * 4 + 3] = (simplex.noise(x + size, y + size) * 0.5 + 0.5) * 255;
      }
    }

    const noiseTexture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    noiseTexture.wrapS = RepeatWrapping;
    noiseTexture.wrapT = RepeatWrapping;
    noiseTexture.needsUpdate = true;

    return noiseTexture;
  }
}
