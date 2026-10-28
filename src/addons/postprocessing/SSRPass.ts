import { Equation, TextureType, TextureFilter, Blending, Factor } from "../../constants";
import { Color } from "../../math/Color";
import { DepthTexture } from "../../textures/DepthTexture";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import { SSRBlurShader, SSRDepthShader, SSRShader } from "../shaders/SSRShader";
import { CopyShader } from "../shaders/CopyShader";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Object3D } from "../../core/Object3D";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";
import type { Material } from "../../materials/Material";
import type { ReflectorForSSRPass } from "../objects/ReflectorForSSRPass";

/** SSR pass constructor options. */
export interface SSRPassOptions {
  /** The renderer. */
  renderer: WebGLRenderer;
  /** The scene to render. */
  scene: Scene;
  /** The camera. */
  camera: PerspectiveCamera;
  /** The width of the effect. */
  width?: number;
  /** The height of the effect. */
  height?: number;
  /** Which 3D objects should be affected by SSR. If not set, the entire scene is affected. */
  selects?: Object3D[] | null;
  /** Whether bouncing is enabled or not. */
  bouncing?: boolean;
  /** A ground reflector. */
  groundReflector?: ReflectorForSSRPass | null;
}

/**
 * A pass for a basic SSR effect.
 *
 * ```typescript
 * const ssrPass = new SSRPass( {
 * 	renderer,
 * 	scene,
 * 	camera,
 * 	width: innerWidth,
 * 	height: innerHeight
 * } );
 * composer.addPass( ssrPass );
 * ```
 *
 * @three_import import { SSRPass } from 'ek3d/addons/postprocessing/SSRPass';
 */
export class SSRPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  clear: boolean;
  renderer: WebGLRenderer;
  groundReflector: ReflectorForSSRPass | null;
  opacity: number;
  output: number;
  maxDistance: number;
  thickness: number;
  tempColor: Color;
  selective: boolean;
  blur: boolean;
  beautyRenderTarget: WebGLRenderTarget;
  prevRenderTarget: WebGLRenderTarget;
  normalRenderTarget: WebGLRenderTarget;
  metalnessRenderTarget: WebGLRenderTarget;
  ssrRenderTarget: WebGLRenderTarget;
  blurRenderTarget: WebGLRenderTarget;
  blurRenderTarget2: WebGLRenderTarget;
  ssrMaterial: ShaderMaterial;
  normalMaterial: MeshNormalMaterial;
  metalnessOnMaterial: MeshBasicMaterial;
  metalnessOffMaterial: MeshBasicMaterial;
  blurMaterial: ShaderMaterial;
  blurMaterial2: ShaderMaterial;
  depthRenderMaterial: ShaderMaterial;
  copyMaterial: ShaderMaterial;
  fsQuad: FullScreenQuad;
  originalClearColor: Color;
  _selects: Object3D[] | null;
  _resolutionScale: number;
  _bouncing: boolean = false;
  _distanceAttenuation: boolean;
  _fresnel: boolean;
  _infiniteThick: boolean;

  /** Output modes. */
  static OUTPUT: { Default: number; SSR: number; Beauty: number; Depth: number; Normal: number; Metalness: number } = {
    Default: 0,
    SSR: 1,
    Beauty: 3,
    Depth: 4,
    Normal: 5,
    Metalness: 7,
  };

  /**
   * Constructs a new SSR pass.
   *
   * @param options - The pass options.
   */
  constructor({
    renderer,
    scene,
    camera,
    width = 512,
    height = 512,
    selects = null,
    bouncing = false,
    groundReflector = null,
  }: SSRPassOptions) {
    super();
    this._bouncing = bouncing;
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
     * The renderer.
     */
    this.renderer = renderer;

    /**
     * The scene to render.
     */
    this.scene = scene;

    /**
     * The camera.
     */
    this.camera = camera;

    /**
     * The ground reflector.
     *
     * @default 0
     */
    this.groundReflector = groundReflector;

    /**
     * The opacity.
     *
     * @default 0.5
     */
    this.opacity = SSRShader.uniforms.opacity.value;

    /**
     * The output configuration.
     *
     * @default 0
     */
    this.output = 0;

    /**
     * Controls how far a fragment can reflect.
     *
     * @default 180
     */
    this.maxDistance = SSRShader.uniforms.maxDistance.value;

    /**
     * Controls the cutoff between what counts as a
     * possible reflection hit and what does not.
     *
     * @default .018
     */
    this.thickness = SSRShader.uniforms.thickness.value;

    this.tempColor = new Color();

    this._selects = selects;

    this._resolutionScale = 1;

    /**
     * Whether the pass is selective or not.
     *
     * @default false
     */
    this.selective = Array.isArray(this._selects);

    this._selects = selects;

    // internals

    /**
     * Whether to blur reflections or not.
     *
     * @default true
     */
    this.blur = true;

    this._distanceAttenuation = SSRShader.defines.DISTANCE_ATTENUATION;
    this._fresnel = SSRShader.defines.FRESNEL;
    this._infiniteThick = SSRShader.defines.INFINITE_THICK;

    // beauty render target with depth buffer

    const depthTexture = new DepthTexture(
      this.width,
      this.height,
      TextureType.UnsignedShort,
      undefined,
      undefined,
      undefined,
      TextureFilter.Nearest,
      TextureFilter.Nearest,
    );

    this.beautyRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
      depthTexture: depthTexture,
      depthBuffer: true,
    });

    // for bouncing

    this.prevRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      depthBuffer: false,
    });

    // normal render target

    this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
    });

    // metalness render target

    this.metalnessRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
    });

    // ssr render target

    this.ssrRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      depthBuffer: false,
    });

    this.blurRenderTarget = this.ssrRenderTarget.clone();
    this.blurRenderTarget2 = this.ssrRenderTarget.clone();
    // this.blurRenderTarget3 = this.ssrRenderTarget.clone();

    // ssr material

    this.ssrMaterial = new ShaderMaterial({
      defines: {
        ...SSRShader.defines,
        MAX_STEP: Math.sqrt(this.width * this.width + this.height * this.height),
      } as Record<string, any>,
      uniforms: cloneUniforms(SSRShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSRShader.vertexShader,
      fragmentShader: SSRShader.fragmentShader,
      blending: Blending.No,
    } as never);

    this.ssrMaterial.uniforms!["tDiffuse"].value = this.beautyRenderTarget.texture;
    this.ssrMaterial.uniforms!["tNormal"].value = this.normalRenderTarget.texture;
    this.ssrMaterial.defines.SELECTIVE = this.selective;
    this.ssrMaterial.needsUpdate = true;
    this.ssrMaterial.uniforms!["tMetalness"].value = this.metalnessRenderTarget.texture;
    this.ssrMaterial.uniforms!["tDepth"].value = this.beautyRenderTarget.depthTexture;
    this.ssrMaterial.uniforms!["cameraNear"].value = this.camera.near;
    this.ssrMaterial.uniforms!["cameraFar"].value = this.camera.far;
    this.ssrMaterial.uniforms!["thickness"].value = this.thickness;
    this.ssrMaterial.uniforms!["resolution"].value.set(this.width, this.height);
    this.ssrMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssrMaterial.uniforms!["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);

    // normal material

    this.normalMaterial = new MeshNormalMaterial();
    this.normalMaterial.blending = Blending.No;

    // metalnessOn material

    this.metalnessOnMaterial = new MeshBasicMaterial({ color: "white" });

    // metalnessOff material

    this.metalnessOffMaterial = new MeshBasicMaterial({ color: "black" });

    // blur material

    this.blurMaterial = new ShaderMaterial({
      uniforms: cloneUniforms(SSRBlurShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSRBlurShader.vertexShader,
      fragmentShader: SSRBlurShader.fragmentShader,
    } as never);
    this.blurMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
    this.blurMaterial.uniforms["resolution"].value.set(this.width, this.height);

    // blur material 2

    this.blurMaterial2 = new ShaderMaterial({
      uniforms: cloneUniforms(SSRBlurShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSRBlurShader.vertexShader,
      fragmentShader: SSRBlurShader.fragmentShader,
    } as never);
    this.blurMaterial2.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
    this.blurMaterial2.uniforms["resolution"].value.set(this.width, this.height);

    // material for rendering the depth

    this.depthRenderMaterial = new ShaderMaterial({
      defines: { ...SSRDepthShader["defines"] } as Record<string, any>,
      uniforms: cloneUniforms(SSRDepthShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>,
      vertexShader: SSRDepthShader.vertexShader,
      fragmentShader: SSRDepthShader.fragmentShader,
      blending: Blending.No,
    } as never);
    this.depthRenderMaterial.uniforms["tDepth"].value = this.beautyRenderTarget.depthTexture;
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
      blendSrc: Factor.SrcAlpha,
      blendDst: Factor.OneMinusSrcAlpha,
      blendEquation: Equation.Add,
      blendSrcAlpha: Factor.SrcAlpha,
      blendDstAlpha: Factor.OneMinusSrcAlpha,
      blendEquationAlpha: Equation.Add,
    } as never);

    this.fsQuad = new FullScreenQuad(null);

    this.originalClearColor = new Color();
  }

  /**
   * The resolution scale. Valid values are in the range
   * `[0,1]`. `1` means best quality but also results in
   * more computational overhead. Setting to `0.5` means
   * the effect is computed in half-resolution.
   *
   * @default 1
   */
  get distanceAttenuation(): boolean {
    return this._distanceAttenuation;
  }

  set distanceAttenuation(val: boolean) {
    if (this._distanceAttenuation === val) return;
    this._distanceAttenuation = val;
    this.ssrMaterial.defines.DISTANCE_ATTENUATION = val;
    this.ssrMaterial.needsUpdate = true;
  }

  get fresnel(): boolean {
    return this._fresnel;
  }

  set fresnel(val: boolean) {
    if (this._fresnel === val) return;
    this._fresnel = val;
    this.ssrMaterial.defines.FRESNEL = val;
    this.ssrMaterial.needsUpdate = true;
  }

  get infiniteThick(): boolean {
    return this._infiniteThick;
  }

  set infiniteThick(val: boolean) {
    if (this._infiniteThick === val) return;
    this._infiniteThick = val;
    this.ssrMaterial.defines.INFINITE_THICK = val;
    this.ssrMaterial.needsUpdate = true;
  }

  get selects(): Object3D[] | null {
    return this._selects;
  }

  set selects(val: Object3D[] | null) {
    if (this._selects === val) return;
    this._selects = val;
    if (Array.isArray(val)) {
      this.selective = true;
      this.ssrMaterial.defines.SELECTIVE = true;
      this.ssrMaterial.needsUpdate = true;
    } else {
      this.selective = false;
      this.ssrMaterial.defines.SELECTIVE = false;
      this.ssrMaterial.needsUpdate = true;
    }
  }

  get bouncing(): boolean {
    return this._bouncing;
  }

  set bouncing(val: boolean) {
    if (this._bouncing === val) return;
    this._bouncing = val;
    if (val) {
      this.ssrMaterial.uniforms!["tDiffuse"].value = this.prevRenderTarget.texture;
    } else {
      this.ssrMaterial.uniforms!["tDiffuse"].value = this.beautyRenderTarget.texture;
    }
  }

  get resolutionScale(): number {
    return this._resolutionScale;
  }

  set resolutionScale(value: number) {
    this._resolutionScale = value;
    this.setSize(this.width, this.height); // force a resize when resolution scaling changes
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    // dispose render targets

    this.beautyRenderTarget.dispose();
    this.prevRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.metalnessRenderTarget.dispose();
    this.ssrRenderTarget.dispose();
    this.blurRenderTarget.dispose();
    this.blurRenderTarget2.dispose();
    // this.blurRenderTarget3.dispose();

    // dispose materials

    this.normalMaterial.dispose();
    this.metalnessOnMaterial.dispose();
    this.metalnessOffMaterial.dispose();
    this.blurMaterial.dispose();
    this.blurMaterial2.dispose();
    this.copyMaterial.dispose();
    this.depthRenderMaterial.dispose();

    // dispose full screen quad

    this.fsQuad.dispose();
  }

  /**
   * Performs the SSR pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param deltaTime - The delta time in seconds (unused).
   * @param maskActive - Whether masking is active or not (unused).
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, _readBuffer: RT, _deltaTime: number, _maskActive: boolean): void {
    // render beauty and depth

    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    if (this.groundReflector) {
      this.groundReflector.visible = false;
      this.groundReflector.doRender(this.renderer, this.scene, this.camera);
      this.groundReflector.visible = true;
    }

    renderer.render(this.scene, this.camera);
    if (this.groundReflector) this.groundReflector.visible = false;

    // render normals

    this._renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0, 0);

    // render metalnesses

    if (this.selective) {
      this._renderMetalness(renderer, this.metalnessOnMaterial, this.metalnessRenderTarget, 0, 0);
    }

    // render SSR

    this.ssrMaterial.uniforms!["opacity"].value = this.opacity;
    this.ssrMaterial.uniforms!["maxDistance"].value = this.maxDistance;
    this.ssrMaterial.uniforms!["thickness"].value = this.thickness;
    this._renderPass(renderer, this.ssrMaterial, this.ssrRenderTarget);

    // render blur

    if (this.blur) {
      this._renderPass(renderer, this.blurMaterial, this.blurRenderTarget);
      this._renderPass(renderer, this.blurMaterial2, this.blurRenderTarget2);
      // this._renderPass(renderer, this.blurMaterial3, this.blurRenderTarget3);
    }

    // output result to screen

    switch (this.output) {
      case SSRPass.OUTPUT.Default:
        if (this.bouncing) {
          this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = Blending.No;
          this._renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

          this.copyMaterial.uniforms["tDiffuse"].value = this.blur
            ? this.blurRenderTarget2.texture
            : this.ssrRenderTarget.texture;
          this.copyMaterial.blending = Blending.Normal;
          this._renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

          this.copyMaterial.uniforms["tDiffuse"].value = this.prevRenderTarget.texture;
          this.copyMaterial.blending = Blending.No;
          this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        } else {
          this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = Blending.No;
          this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

          this.copyMaterial.uniforms["tDiffuse"].value = this.blur
            ? this.blurRenderTarget2.texture
            : this.ssrRenderTarget.texture;
          this.copyMaterial.blending = Blending.Normal;
          this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        }

        break;

      case SSRPass.OUTPUT.SSR:
        this.copyMaterial.uniforms["tDiffuse"].value = this.blur
          ? this.blurRenderTarget2.texture
          : this.ssrRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);

        if (this.bouncing) {
          this.copyMaterial.uniforms["tDiffuse"].value = this.blur
            ? this.blurRenderTarget2.texture
            : this.beautyRenderTarget.texture;
          this.copyMaterial.blending = Blending.No;
          this._renderPass(renderer, this.copyMaterial, this.prevRenderTarget);

          this.copyMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = Blending.Normal;
          this._renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
        }

        break;

      case SSRPass.OUTPUT.Beauty:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case SSRPass.OUTPUT.Depth:
        this._renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case SSRPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      case SSRPass.OUTPUT.Metalness:
        this.copyMaterial.uniforms["tDiffuse"].value = this.metalnessRenderTarget.texture;
        this.copyMaterial.blending = Blending.No;
        this._renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;

      default:
        console.warn("THREE.SSRPass: Unknown output type.");
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

    const effectiveWidth = Math.round(this.resolutionScale * width);
    const effectiveHeight = Math.round(this.resolutionScale * height);

    this.ssrMaterial.defines.MAX_STEP = Math.sqrt(effectiveWidth * effectiveWidth + effectiveHeight * effectiveHeight);
    this.ssrMaterial.needsUpdate = true;

    this.beautyRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.metalnessRenderTarget.setSize(width, height);
    this.ssrRenderTarget.setSize(effectiveWidth, effectiveHeight);
    this.prevRenderTarget.setSize(effectiveWidth, effectiveHeight);
    this.blurRenderTarget.setSize(effectiveWidth, effectiveHeight);
    this.blurRenderTarget2.setSize(effectiveWidth, effectiveHeight);
    // this.blurRenderTarget3.setSize(width, height);

    this.ssrMaterial.uniforms!["resolution"].value.set(effectiveWidth, effectiveHeight);
    this.ssrMaterial.uniforms!["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssrMaterial.uniforms!["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);

    this.blurMaterial.uniforms["resolution"].value.set(effectiveWidth, effectiveHeight);
    this.blurMaterial2.uniforms["resolution"].value.set(effectiveWidth, effectiveHeight);
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
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
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
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }

  _renderOverride(
    renderer: WebGLRenderer,
    overrideMaterial: Material,
    renderTarget: RT,
    clearColor?: number | null,
    clearAlpha?: number,
  ): void {
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
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
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }

  _renderMetalness(
    renderer: WebGLRenderer,
    overrideMaterial: Material,
    renderTarget: RT,
    clearColor?: number | null,
    clearAlpha?: number,
  ): void {
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;
    const originalBackground = this.scene.background;
    const originalFog = this.scene.fog;

    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    this.scene.background = null;
    this.scene.fog = null;

    clearColor = (overrideMaterial as any).clearColor || clearColor;
    clearAlpha = (overrideMaterial as any).clearAlpha || clearAlpha;

    if (clearColor !== undefined && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0.0);
      renderer.clear();
    }

    this.scene.traverseVisible((child) => {
      (child as any)._SSRPassBackupMaterial = child.material;
      if (this._selects!.includes(child)) {
        (child as any).material = this.metalnessOnMaterial;
      } else {
        (child as any).material = this.metalnessOffMaterial;
      }
    });
    renderer.render(this.scene, this.camera);
    this.scene.traverseVisible((child) => {
      (child as any).material = (child as any)._SSRPassBackupMaterial;
    });

    // restore original state

    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
    this.scene.background = originalBackground;
    this.scene.fog = originalFog;
  }
}
