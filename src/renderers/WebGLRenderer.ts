import { GL } from "../GL";
import type { ArrayCamera } from "../cameras/ArrayCamera";
import type { Box2 } from "../math/Box2";
import type { Box3 } from "../math/Box3";
import type { Camera } from "../cameras/Camera";
import type { FramebufferTexture } from "../textures/FramebufferTexture";
import type { LTCTextures } from "./shaders/LTCTextures";
import type { Object3D } from "../core/Object3D";
import type { Plane } from "../math/Plane";
import type { Texture } from "../textures/Texture";
import type { Vector2 } from "../math/Vector2";
import type { WebGLBackground } from "./webgl/WebGLBackground";
import type { WebGLEnvironments } from "./webgl/WebGLEnvironments";
import type { WebGLOutput } from "./webgl/WebGLOutput";
import type { WebGLOutputEffect } from "./webgl/WebGLOutput";
import type { WebGLShadowMap } from "./webgl/WebGLShadowMap";
import type { WebGLShadowMapSystem } from "./webgl/WebGLShadowMap";
import type { Material } from "../materials/Material";
import type { WebGLCapabilitiesState } from "./webgl/WebGLCapabilities";
import type { WebGLInfoState } from "./webgl/WebGLInfo";
import { WebGLClearBackground } from "./webgl/WebGLClearBackground";
import { getEnvironment } from "./webgl/WebGLEnvironmentAccess";
import {
  REVISION,
  Side,
  TextureType,
  ToneMapping,
  TextureFilter,
  ColorSpace,
  PixelFormat,
  CoordinateSystem,
} from "../constants";
import { Color } from "../math/Color";
import { Frustum } from "../math/Frustum";
import { FrustumArray } from "../math/FrustumArray";
import { Matrix4 } from "../math/Matrix4";
import { Vector3 } from "../math/Vector3";
import { Vector4 } from "../math/Vector4";
import { WebGLAnimation } from "./webgl/WebGLAnimation";
import { WebGLAttributes } from "./webgl/WebGLAttributes";
import { WebGLBindingStates } from "./webgl/WebGLBindingStates";
import { WebGLBufferRenderer } from "./webgl/WebGLBufferRenderer";
import { WebGLCapabilities } from "./webgl/WebGLCapabilities";
import { WebGLClipping } from "./webgl/WebGLClipping";
import { WebGLExtensions } from "./webgl/WebGLExtensions";
import { WebGLGeometries } from "./webgl/WebGLGeometries";
import { WebGLIndexedBufferRenderer } from "./webgl/WebGLIndexedBufferRenderer";
import { WebGLInfo } from "./webgl/WebGLInfo";
import { WebGLMorphtargets } from "./webgl/WebGLMorphtargets";
import { WebGLObjects } from "./webgl/WebGLObjects";
import { WebGLPrograms } from "./webgl/WebGLPrograms";
import { WebGLProperties } from "./webgl/WebGLProperties";
import { WebGLRenderLists } from "./webgl/WebGLRenderLists";
import { WebGLRenderStates } from "./webgl/WebGLRenderStates";
import { WebGLRenderTarget } from "./WebGLRenderTarget";
import { WebGLState } from "./webgl/WebGLState";
import { WebGLTextures } from "./webgl/WebGLTextures";
import { WebGLUniforms } from "./webgl/WebGLUniforms";
import { WebGLUtils } from "./webgl/WebGLUtils";
import { WebGLMaterials } from "./webgl/WebGLMaterials";
import { WebGLUniformsGroups } from "./webgl/WebGLUniformsGroups";
import { createCanvasElement, probeAsync, error, warn, log } from "../utils";
import { ColorManagement } from "../math/ColorManagement";

export interface WebGLShaderDescriptor {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
}
/** Renderer context settings and explicitly installed rendering features. */
export interface WebGLRendererOptions {
  /** Drawing canvas; a new HTML canvas is created when omitted. */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** Existing WebGL 2 rendering context to use. */
  context?: WebGL2RenderingContext;
  /** Default shader precision; falls back to a supported precision. Defaults to highp. */
  precision?: "highp" | "mediump" | "lowp";
  /** Requests a depth buffer of at least 16 bits. Defaults to true. */
  depth?: boolean;
  /** Requests a stencil buffer of at least 8 bits. Defaults to false. */
  stencil?: boolean;
  /** Sets the default clear alpha to zero instead of one. Defaults to false. */
  alpha?: boolean;
  /** Enables default framebuffer MSAA. Defaults to false. */
  antialias?: boolean;
  /** Assumes premultiplied drawing-buffer colors. Defaults to true. */
  premultipliedAlpha?: boolean;
  /** Preserves drawing-buffer contents until cleared or overwritten. Defaults to false. */
  preserveDrawingBuffer?: boolean;
  /** GPU configuration hint. Defaults to default. */
  powerPreference?: WebGLPowerPreference;
  /** Rejects contexts with a major performance caveat. Defaults to false. */
  failIfMajorPerformanceCaveat?: boolean;
  /** Supports large scene scales using gl_FragDepth, at the cost of early fragment tests. */
  logarithmicDepthBuffer?: boolean;
  /** Enables reversed depth when EXT_clip_control is available. Defaults to false. */
  reversedDepthBuffer?: boolean;
  /** Output storage type; defaults to TextureType.UnsignedByte. HDR types require createOutput. */
  outputBufferType?: TextureType;
  /** Shader descriptors keyed by material type. No built-in material shaders are installed by default. */
  shaders?: Record<string, WebGLShaderDescriptor>;
  /** Additional shader include chunks, keyed by chunk name. */
  shaderChunks?: Record<string, string>;
  /** Installs environment-map processing. */
  createEnvironments?: typeof WebGLEnvironments;
  /** Installs textured backgrounds; the default background only clears the framebuffer. */
  createBackground?: typeof WebGLBackground;
  /** Installs shadow rendering; shadowMap is null when omitted. */
  createShadowMap?: typeof WebGLShadowMap;
  /** Installs HDR output and post-processing. */
  createOutput?: typeof WebGLOutput;
  /** Supplies the DFG lookup texture required by physical materials. */
  getDFGLUT?: () => Texture;
  /** Supplies LTC lookup textures for rectangular area lights. */
  ltcTextures?: LTCTextures;
}
/**
 * This renderer uses WebGL 2 to display scenes.
 *
 * WebGL 1 is not supported since `r163`.
 *
 * Install only the material shaders and rendering features the application uses:
 *
 * ```ts
 * import { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
 * import { basicShader } from 'ek3d/renderers/shaders/BasicShader';
 *
 * const canvas = document.createElement( 'canvas' );
 * const renderer = new WebGLRenderer( {
 *   canvas,
 *   shaders: { MeshBasicMaterial: basicShader },
 * } );
 * renderer.setSize( 800, 600 );
 * document.body.appendChild( canvas );
 * ```
 */
export class WebGLRenderer {
  isWebGLRenderer: boolean;
  shaders: NonNullable<WebGLRendererOptions["shaders"]>;
  shaderChunks: Record<string, string>;
  domElement: HTMLCanvasElement | OffscreenCanvas;
  debug: {
    checkShaderErrors: boolean;
    onShaderError:
      | ((
          gl: WebGL2RenderingContext,
          program: WebGLProgram,
          vertexShader: WebGLShader,
          fragmentShader: WebGLShader,
        ) => void)
      | null;
  };
  autoClear: boolean;
  autoClearColor: boolean;
  autoClearDepth: boolean;
  autoClearStencil: boolean;
  sortObjects: boolean;
  clippingPlanes: Plane[];
  localClippingEnabled: boolean;
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  transmissionResolutionScale: number;
  _outputColorSpace: string;
  getContext: () => WebGL2RenderingContext;
  getContextAttributes: () => WebGLContextAttributes | null;
  forceContextLoss: () => void;
  forceContextRestore: () => void;
  getPixelRatio: () => number;
  setPixelRatio: (value: number) => void;
  getSize: (target: Vector2) => Vector2;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  getDrawingBufferSize: (target: Vector2) => Vector2;
  setDrawingBufferSize: (width: number, height: number, pixelRatio: number) => void;
  setEffects: (effects: WebGLOutputEffect[] | null) => void;
  getCurrentViewport: (target: Vector4) => Vector4;
  getViewport: (target: Vector4) => Vector4;
  setViewport: (x: number | Vector4, y?: number, width?: number, height?: number) => void;
  getScissor: (target: Vector4) => Vector4;
  setScissor: (x: number | Vector4, y?: number, width?: number, height?: number) => void;
  getScissorTest: () => boolean;
  setScissorTest: (boolean: boolean) => void;
  setOpaqueSort: (method: any) => void;
  setTransparentSort: (method: any) => void;
  getClearColor: (target: Color) => Color;
  setClearColor: (color: Color | number | string, alpha?: number) => void;
  getClearAlpha: () => number;
  setClearAlpha: (alpha: number) => void;
  clear: (color?: boolean, depth?: boolean, stencil?: boolean) => void;
  clearColor: () => void;
  clearDepth: () => void;
  clearStencil: () => void;
  dispose: () => void;
  renderBufferDirect: (camera: any, scene: any, geometry: any, material: any, object: any, group: any) => void;
  compile: (scene: Object3D, camera: Camera, targetScene?: Object3D | null) => Set<Material>;
  compileAsync: (scene: Object3D, camera: Camera, targetScene?: Object3D | null) => Promise<Object3D>;
  setAnimationLoop: (callback: FrameRequestCallback | null) => void;
  render: (scene: Object3D, camera: Camera) => void;
  getActiveCubeFace: () => number;
  getActiveMipmapLevel: () => number;
  getRenderTarget: () => WebGLRenderTarget | null;
  setRenderTargetTextures: (renderTarget: any, colorTexture: any, depthTexture: any) => void;
  setRenderTargetFramebuffer: (renderTarget: any, defaultFramebuffer: any) => void;
  setRenderTarget: (
    renderTarget: WebGLRenderTarget | null,
    activeCubeFace?: number,
    activeMipmapLevel?: number,
  ) => void;
  readRenderTargetPixels: (
    renderTarget: WebGLRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: any,
    activeCubeFaceIndex?: number,
    textureIndex?: number,
  ) => void;
  readRenderTargetPixelsAsync: (
    renderTarget: WebGLRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: any,
    activeCubeFaceIndex?: number,
    textureIndex?: number,
  ) => Promise<any>;
  copyFramebufferToTexture: (texture: FramebufferTexture, position?: Vector2 | null, level?: number) => void;
  copyTextureToTexture: (
    srcTexture: Texture,
    dstTexture: Texture,
    srcRegion?: Box2 | Box3 | null,
    dstPosition?: Vector2 | Vector3 | null,
    srcLevel?: number,
    dstLevel?: number | null,
  ) => void;
  initRenderTarget: (target: WebGLRenderTarget) => void;
  initTexture: (texture: Texture) => void;
  resetState: () => void;
  /** Assigned synchronously by initGLContext, including after context restoration. */
  capabilities!: WebGLCapabilitiesState;
  extensions: any;
  properties: any;
  renderLists: any;
  /** Assigned synchronously by initGLContext, including after context restoration. */
  shadowMap!: WebGLShadowMapSystem | null;
  state: any;
  /** Assigned synchronously by initGLContext, including after context restoration. */
  info!: WebGLInfoState;

  /**
   * Constructs a new WebGL renderer.
   *
   * @param [parameters] - The configuration parameter.
   */
  constructor(parameters: WebGLRendererOptions = {}) {
    const {
      canvas = createCanvasElement(),
      context = null,
      depth = true,
      stencil = false,
      alpha = false,
      antialias = false,
      premultipliedAlpha = true,
      preserveDrawingBuffer = false,
      powerPreference = "default",
      failIfMajorPerformanceCaveat = false,
      reversedDepthBuffer = false,
      outputBufferType = TextureType.UnsignedByte,
    } = parameters;
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isWebGLRenderer = true;
    this.shaders = parameters.shaders ?? {};
    this.shaderChunks = parameters.shaderChunks ?? {};
    let _alpha: any;
    if (context !== null) {
      if (typeof WebGLRenderingContext !== "undefined" && context instanceof WebGLRenderingContext) {
        throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");
      }
      _alpha = context.getContextAttributes()!.alpha;
    } else {
      _alpha = alpha;
    }
    const _outputBufferType = outputBufferType;
    if (_outputBufferType !== TextureType.UnsignedByte && !(parameters as any).createOutput)
      throw new Error("HDR output requires createOutput.");
    const INTEGER_FORMATS = new Set<any>([PixelFormat.RGBAInteger, PixelFormat.RGInteger, PixelFormat.RedInteger]);
    const UNSIGNED_TYPES = new Set<any>([
      TextureType.UnsignedByte,
      TextureType.UnsignedInt,
      TextureType.UnsignedShort,
      TextureType.UnsignedInt248,
      TextureType.UnsignedShort4444,
      TextureType.UnsignedShort5551,
    ]);
    const uintClearColor = new Uint32Array(4);
    const intClearColor = new Int32Array(4);
    const objectPosition = new Vector3();
    let currentRenderList: any = null;
    let currentRenderState: any = null;
    // render() can be called from within a callback triggered by another render.
    // We track this so that the nested render call gets its list and state isolated from the parent render call.
    const renderListStack: any[] = [];
    const renderStateStack: any[] = [];
    // internal render target for non-TextureType.UnsignedByte color buffer
    let output: any = null;
    // public properties
    /**
     * A canvas where the renderer draws its output. This is automatically created by the renderer
     * in the constructor (if not provided already); you just need to add it to your page like so:
     * ```ts
     * import { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
     *
     * const renderer = new WebGLRenderer();
     * if ( renderer.domElement instanceof HTMLCanvasElement ) {
     *   document.body.appendChild( renderer.domElement );
     * }
     * ```
     *
     */
    this.domElement = canvas;
    /**
     * A object with debug configuration settings.
     *
     * - `checkShaderErrors`: If it is `true`, defines whether material shader programs are
     * checked for errors during compilation and linkage process. It may be useful to disable
     * this check in production for performance gain. It is strongly recommended to keep these
     * checks enabled during development. If the shader does not compile and link, it will not
     * work and associated material will not render.
     * - `onShaderError(gl, program, glVertexShader,glFragmentShader)`: A callback function that
     * can be used for custom error reporting. The callback receives the WebGL context, an instance
     * of WebGLProgram as well two instances of WebGLShader representing the vertex and fragment shader.
     * Assigning a custom function disables the default error reporting.
     *
     */
    this.debug = {
      /**
       * Enables error checking and reporting when shader programs are being compiled.
       */
      checkShaderErrors: true,
      /**
       * Callback for custom error reporting.
       */
      onShaderError: null,
    };
    // clearing
    /**
     * Whether the renderer should automatically clear its output before rendering a frame or not.
     *
     * @default true
     */
    this.autoClear = true;
    /**
     * If {@link WebGLRenderer#autoClear} set to `true`, whether the renderer should clear
     * the color buffer or not.
     *
     * @default true
     */
    this.autoClearColor = true;
    /**
     * If {@link WebGLRenderer#autoClear} set to `true`, whether the renderer should clear
     * the depth buffer or not.
     *
     * @default true
     */
    this.autoClearDepth = true;
    /**
     * If {@link WebGLRenderer#autoClear} set to `true`, whether the renderer should clear
     * the stencil buffer or not.
     *
     * @default true
     */
    this.autoClearStencil = true;
    // scene graph
    /**
     * Whether the renderer should sort objects or not.
     *
     * Note: Sorting is used to attempt to properly render objects that have some
     * degree of transparency. By definition, sorting objects may not work in all
     * cases. Depending on the needs of application, it may be necessary to turn
     * off sorting and use other methods to deal with transparency rendering e.g.
     * manually determining each object's rendering order.
     *
     * @default true
     */
    this.sortObjects = true;
    // user-defined clipping
    /**
     * User-defined clipping planes specified in world space. These planes apply globally.
     * Points in space whose dot product with the plane is negative are cut away.
     *
     */
    this.clippingPlanes = [];
    /**
     * Whether the renderer respects object-level clipping planes or not.
     *
     * @default false
     */
    this.localClippingEnabled = false;
    // tone mapping
    /**
     * The tone mapping technique of the renderer.
     *
     * @default ToneMapping.No
     */
    this.toneMapping = ToneMapping.No;
    /**
     * Exposure level of tone mapping.
     *
     * @default 1
     */
    this.toneMappingExposure = 1.0;
    // transmission
    /**
     * The normalized resolution scale for the transmission render target, measured in percentage
     * of viewport dimensions. Lowering this value can result in significant performance improvements
     * when using {@link MeshPhysicalMaterial#transmission}.
     *
     * @default 1
     */
    this.transmissionResolutionScale = 1.0;
    // internal properties
    // oxlint-disable-next-line typescript/no-this-alias -- Hoisted renderer closures need the instance independently of callback receivers.
    const _this = this;
    let _isContextLost = false;
    let _scratchFramebuffer: any = null;
    let _srcFramebuffer: any = null;
    let _dstFramebuffer: any = null;
    // internal state cache
    this._outputColorSpace = ColorSpace.SRGB;
    let _currentActiveCubeFace = 0;
    let _currentActiveMipmapLevel = 0;
    let _currentRenderTarget: any = null;
    let _currentMaterialId = -1;
    let _currentCamera: any = null;
    const _currentViewport = new Vector4();
    const _currentScissor = new Vector4();
    let _currentScissorTest: any = null;
    const _currentClearColor = new Color(0x000000);
    let _currentClearAlpha = 0;
    //
    let _width = canvas.width;
    let _height = canvas.height;
    let _pixelRatio = 1;
    let _opaqueSort: any = null;
    let _transparentSort: any = null;
    const _viewport = new Vector4(0, 0, _width, _height);
    const _scissor = new Vector4(0, 0, _width, _height);
    let _scissorTest = false;
    // frustum
    const _frustum = new Frustum();
    const _frustumArray = new FrustumArray();
    // clipping
    let _clippingEnabled = false;
    let _localClippingEnabled = false;
    // camera matrices cache
    const _projScreenMatrix = new Matrix4();
    const _vector3 = new Vector3();
    const _vector4 = new Vector4();
    const _emptyScene: any = { background: null, fog: null, environment: null, overrideMaterial: null, isScene: true };
    function getTargetPixelRatio() {
      return _currentRenderTarget === null ? _pixelRatio : 1;
    }
    // initialize
    let _gl = context;
    function getContext(contextName: "webgl2", contextAttributes?: any) {
      return canvas.getContext(contextName, contextAttributes) as WebGL2RenderingContext | null;
    }
    let extensions: any, capabilities: any, state: any, info: any;
    let properties: any, textures: any, environments: any, attributes: any, geometries: any, objects: any;
    let programCache: any, materials: any, renderLists: any, renderStates: any, clipping: any, shadowMap: any;
    let background: any, morphtargets: any, bufferRenderer: any, indexedBufferRenderer: any;
    let utils: any, bindingStates: any, uniformsGroups: any;
    try {
      const contextAttributes: any = {
        alpha: true,
        depth,
        stencil,
        antialias,
        premultipliedAlpha,
        preserveDrawingBuffer,
        powerPreference,
        failIfMajorPerformanceCaveat,
      };
      // OffscreenCanvas does not have setAttribute, see #22811
      if ("setAttribute" in canvas) canvas.setAttribute("data-engine", `three.js r${REVISION}`);
      // event listeners must be registered before WebGL context is created, see #12753
      canvas.addEventListener("webglcontextlost", onContextLost, false);
      canvas.addEventListener("webglcontextrestored", onContextRestore, false);
      canvas.addEventListener("webglcontextcreationerror", onContextCreationError, false);
      if (_gl === null) {
        const contextName = "webgl2";
        _gl = getContext(contextName, contextAttributes);
        if (_gl === null) {
          if (getContext(contextName)) {
            throw new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.");
          } else {
            throw new Error("THREE.WebGLRenderer: Error creating WebGL context.");
          }
        }
      }
      initGLContext();
    } catch (e: any) {
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener("webglcontextrestored", onContextRestore, false);
      canvas.removeEventListener("webglcontextcreationerror", onContextCreationError, false);
      error("WebGLRenderer: " + e.message);
      throw e;
    }
    function initGLContext() {
      extensions = new (WebGLExtensions as any)(_gl);
      extensions.init();
      utils = new (WebGLUtils as any)(_gl, extensions);
      capabilities = new (WebGLCapabilities as any)(_gl, extensions, parameters, utils);
      state = new (WebGLState as any)(_gl, extensions);
      if (capabilities.reversedDepthBuffer && reversedDepthBuffer) {
        state.buffers.depth.setReversed(true);
      }
      _scratchFramebuffer = _gl!.createFramebuffer();
      _srcFramebuffer = _gl!.createFramebuffer();
      _dstFramebuffer = _gl!.createFramebuffer();
      info = WebGLInfo();
      properties = new (WebGLProperties as any)();
      textures = new (WebGLTextures as any)(_gl, extensions, state, properties, capabilities, utils, info);
      environments = (parameters as any).createEnvironments ? (parameters as any).createEnvironments(_this) : null;
      attributes = new (WebGLAttributes as any)(_gl);
      bindingStates = new (WebGLBindingStates as any)(_gl, attributes);
      geometries = new (WebGLGeometries as any)(_gl, attributes, info, bindingStates);
      objects = new (WebGLObjects as any)(_gl, geometries, attributes, bindingStates, info);
      morphtargets = new (WebGLMorphtargets as any)(_gl, capabilities, textures);
      clipping = new (WebGLClipping as any)(properties);
      programCache = new (WebGLPrograms as any)(_this, environments, extensions, capabilities, bindingStates, clipping);
      materials = new (WebGLMaterials as any)(_this, properties);
      renderLists = new (WebGLRenderLists as any)();
      renderStates = new (WebGLRenderStates as any)(extensions, (parameters as any).ltcTextures ?? null);
      background = (parameters as any).createBackground
        ? (parameters as any).createBackground(_this, environments, state, objects, _alpha, premultipliedAlpha)
        : new (WebGLClearBackground as any)(_this, state, _alpha, premultipliedAlpha);
      shadowMap = (parameters as any).createShadowMap
        ? (parameters as any).createShadowMap(_this, objects, capabilities)
        : null;
      uniformsGroups = new (WebGLUniformsGroups as any)(_gl, info, capabilities, state);
      bufferRenderer = new (WebGLBufferRenderer as any)(_gl, extensions, info);
      indexedBufferRenderer = new (WebGLIndexedBufferRenderer as any)(_gl, extensions, info);
      info.programs = programCache.programs;
      /**
       * Holds details about the capabilities of the current rendering context.
       *
       * @name WebGLRenderer#capabilities
       * ~Capabilities}
       */
      (_this as any).capabilities = capabilities;
      /**
       * Provides methods for retrieving and testing WebGL extensions.
       *
       * - `get(extensionName:string)`: Used to check whether a WebGL extension is supported
       * and return the extension object if available.
       * - `has(extensionName:string)`: returns `true` if the extension is supported.
       *
       * @name WebGLRenderer#extensions
       */
      (_this as any).extensions = extensions;
      /**
       * Used to track properties of other objects like native WebGL objects.
       *
       * @name WebGLRenderer#properties
       */
      (_this as any).properties = properties;
      /**
       * Manages the render lists of the renderer.
       *
       * @name WebGLRenderer#renderLists
       */
      (_this as any).renderLists = renderLists;
      /**
       * Interface for managing shadows.
       *
       * @name WebGLRenderer#shadowMap
       * ~ShadowMap}
       */
      (_this as any).shadowMap = shadowMap;
      /**
       * Interface for managing the WebGL state.
       *
       * @name WebGLRenderer#state
       */
      (_this as any).state = state;
      /**
       * Holds a series of statistical information about the GPU memory
       * and the rendering process. Useful for debugging and monitoring.
       *
       * By default these data are reset at each render call but when having
       * multiple render passes per frame (e.g. when using post processing) it can
       * be preferred to reset with a custom pattern. First, set `autoReset` to
       * `false`.
       * ```ts
       * import { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
       *
       * const renderer = new WebGLRenderer();
       * renderer.info.autoReset = false;
       * // Call reset() after rendering all passes for a frame.
       * renderer.info.reset();
       * ```
       *
       * @name WebGLRenderer#info
       * ~Info}
       */
      (_this as any).info = info;
    }
    // initialize internal render target for non-UnsignedByteType color buffer
    if (_outputBufferType !== TextureType.UnsignedByte) {
      output = (parameters as any).createOutput(
        _outputBufferType,
        canvas.width,
        canvas.height,
        antialias,
        depth,
        stencil,
      );
    }
    /**
     * Returns the rendering context.
     *
     * @return The rendering context.
     */
    this.getContext = function (): WebGL2RenderingContext {
      return _gl!;
    };
    /**
     * Returns the rendering context attributes.
     *
     * @return The rendering context attributes.
     */
    this.getContextAttributes = function (): WebGLContextAttributes {
      return _gl!.getContextAttributes()!;
    };
    /**
     * Simulates a loss of the WebGL context. This requires support for the `WEBGL_lose_context` extension.
     */
    this.forceContextLoss = function () {
      const extension = extensions.get("WEBGL_lose_context");
      if (extension) extension.loseContext();
    };
    /**
     * Simulates a restore of the WebGL context. This requires support for the `WEBGL_lose_context` extension.
     */
    this.forceContextRestore = function () {
      const extension = extensions.get("WEBGL_lose_context");
      if (extension) extension.restoreContext();
    };
    /**
     * Returns the pixel ratio.
     *
     * @return The pixel ratio.
     */
    this.getPixelRatio = function (): number {
      return _pixelRatio;
    };
    /**
     * Sets the given pixel ratio and resizes the canvas if necessary.
     *
     * @param value - The pixel ratio.
     */
    this.setPixelRatio = function (this: any, value: number) {
      if (value === undefined) return;
      _pixelRatio = value;
      this.setSize(_width, _height, false);
    };
    /**
     * Returns the renderer's size in logical pixels. This method does not honor the pixel ratio.
     *
     * @param target - The method writes the result in this target object.
     * @return The renderer's size in logical pixels.
     */
    this.getSize = function (target: Vector2): Vector2 {
      return target.set(_width, _height);
    };
    /**
     * Resizes the output canvas to (width, height) with device pixel ratio taken
     * into account, and also sets the viewport to fit that size, starting in (0,
     * 0). Setting `updateStyle` to false prevents any style changes to the output canvas.
     *
     * @param width - The width in logical pixels.
     * @param height - The height in logical pixels.
     * @param [updateStyle=true] - Whether to update the `style` attribute of the canvas or not.
     */
    this.setSize = function (this: any, width: number, height: number, updateStyle: boolean = true) {
      _width = width;
      _height = height;
      canvas.width = Math.floor(width * _pixelRatio);
      canvas.height = Math.floor(height * _pixelRatio);
      if (updateStyle === true) {
        (canvas as HTMLCanvasElement).style.width = width + "px";
        (canvas as HTMLCanvasElement).style.height = height + "px";
      }
      if (output !== null) {
        output.setSize(canvas.width, canvas.height);
      }
      this.setViewport(0, 0, width, height);
    };
    /**
     * Returns the drawing buffer size in physical pixels. This method honors the pixel ratio.
     *
     * @param target - The method writes the result in this target object.
     * @return The drawing buffer size.
     */
    this.getDrawingBufferSize = function (target: Vector2): Vector2 {
      return target.set(_width * _pixelRatio, _height * _pixelRatio).floor();
    };
    /**
     * This method allows to define the drawing buffer size by specifying
     * width, height and pixel ratio all at once. The size of the drawing
     * buffer is computed with this formula:
     * ```ts
     * import { Vector2 } from 'ek3d/math/Vector2';
     *
     * const width = 800;
     * const height = 600;
     * const pixelRatio = window.devicePixelRatio;
     * const size = new Vector2( width * pixelRatio, height * pixelRatio );
     * ```
     *
     * @param width - The width in logical pixels.
     * @param height - The height in logical pixels.
     * @param pixelRatio - The pixel ratio.
     */
    this.setDrawingBufferSize = function (this: any, width: number, height: number, pixelRatio: number) {
      _width = width;
      _height = height;
      _pixelRatio = pixelRatio;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      this.setViewport(0, 0, width, height);
      output?.setSize(canvas.width, canvas.height);
    };
    /**
     * Sets the post-processing effects to be applied after rendering.
     *
     * @param effects - An array of post-processing effects.
     */
    this.setEffects = function (effects?: any) {
      if (_outputBufferType === TextureType.UnsignedByte)
        throw new Error("Output effects require createOutput and an HDR outputBufferType.");
      if (effects) {
        for (let i = 0; i < effects.length; i++) {
          if (effects[i].isOutputPass === true) {
            warn(
              "WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.",
            );
            break;
          }
        }
      }
      if (output === null) throw new Error("Output effects require createOutput and an HDR outputBufferType.");
      output.setEffects(effects || []);
    };
    /**
     * Returns the current viewport definition.
     *
     * @param target - The method writes the result in this target object.
     * @return The current viewport definition.
     */
    this.getCurrentViewport = function (target: Vector4): Vector4 {
      return target.copy(_currentViewport);
    };
    /**
     * Returns the viewport definition.
     *
     * @param target - The method writes the result in this target object.
     * @return The viewport definition.
     */
    this.getViewport = function (target: Vector4): Vector4 {
      return target.copy(_viewport);
    };
    /**
     * Sets the viewport to render from `(x, y)` to `(x + width, y + height)`.
     *
     * @param x - The horizontal coordinate for the lower left corner of the viewport origin in logical pixel unit.
     * Or alternatively a four-component vector specifying all the parameters of the viewport.
     * @param y - The vertical coordinate for the lower left corner of the viewport origin  in logical pixel unit.
     * @param width - The width of the viewport in logical pixel unit.
     * @param height - The height of the viewport in logical pixel unit.
     */
    this.setViewport = function (x: any, y?: number, width?: number, height?: number) {
      if ((x as any).isVector4) {
        _viewport.set((x as any).x, (x as any).y, (x as any).z, (x as any).w);
      } else {
        _viewport.set(x, y!, width!, height!);
      }
      state.viewport(_currentViewport.copy(_viewport).multiplyScalar(getTargetPixelRatio()).round());
    };
    /**
     * Returns the scissor region.
     *
     * @param target - The method writes the result in this target object.
     * @return The scissor region.
     */
    this.getScissor = function (target: Vector4): Vector4 {
      return target.copy(_scissor);
    };
    /**
     * Sets the scissor region to render from `(x, y)` to `(x + width, y + height)`.
     *
     * @param x - The horizontal coordinate for the lower left corner of the scissor region origin in logical pixel unit.
     * Or alternatively a four-component vector specifying all the parameters of the scissor region.
     * @param y - The vertical coordinate for the lower left corner of the scissor region origin  in logical pixel unit.
     * @param width - The width of the scissor region in logical pixel unit.
     * @param height - The height of the scissor region in logical pixel unit.
     */
    this.setScissor = function (x: any, y?: number, width?: number, height?: number) {
      if ((x as any).isVector4) {
        _scissor.set((x as any).x, (x as any).y, (x as any).z, (x as any).w);
      } else {
        _scissor.set(x, y!, width!, height!);
      }
      state.scissor(_currentScissor.copy(_scissor).multiplyScalar(getTargetPixelRatio()).round());
    };
    /**
     * Returns `true` if the scissor test is enabled.
     *
     * @return Whether the scissor test is enabled or not.
     */
    this.getScissorTest = function (): boolean {
      return _scissorTest;
    };
    /**
     * Enable or disable the scissor test. When this is enabled, only the pixels
     * within the defined scissor area will be affected by further renderer
     * actions.
     *
     * @param boolean - Whether the scissor test is enabled or not.
     */
    this.setScissorTest = function (boolean: boolean) {
      state.setScissorTest((_scissorTest = boolean));
    };
    /**
     * Sets a custom opaque sort function for the render lists. Pass `null`
     * to use the default `painterSortStable` function.
     *
     * @param method - The opaque sort function.
     */
    this.setOpaqueSort = function (method?: any) {
      _opaqueSort = method;
    };
    /**
     * Sets a custom transparent sort function for the render lists. Pass `null`
     * to use the default `reversePainterSortStable` function.
     *
     * @param method - The opaque sort function.
     */
    this.setTransparentSort = function (method?: any) {
      _transparentSort = method;
    };
    // Clearing
    /**
     * Returns the clear color.
     *
     * @param target - The method writes the result in this target object.
     * @return The clear color.
     */
    this.getClearColor = function (target: Color): Color {
      return target.copy(background.getClearColor());
    };
    /**
     * Sets the clear color and alpha.
     *
     * @param color - The clear color.
     * @param [alpha=1] - The clear alpha.
     */
    this.setClearColor = function () {
      background.setClearColor(...arguments);
    };
    /**
     * Returns the clear alpha. Ranges within `[0,1]`.
     *
     * @return The clear alpha.
     */
    this.getClearAlpha = function (): number {
      return background.getClearAlpha();
    };
    /**
     * Sets the clear alpha.
     *
     * @param alpha - The clear alpha.
     */
    this.setClearAlpha = function () {
      background.setClearAlpha(...arguments);
    };
    /**
     * Tells the renderer to clear its color, depth or stencil drawing buffer(s).
     * This method initializes the buffers to the current clear color values.
     *
     * @param [color=true] - Whether the color buffer should be cleared or not.
     * @param [depth=true] - Whether the depth buffer should be cleared or not.
     * @param [stencil=true] - Whether the stencil buffer should be cleared or not.
     */
    this.clear = function (this: any, color: boolean = true, depth: boolean = true, stencil: boolean = true) {
      let bits = 0;
      if (color) {
        // check if we're trying to clear an integer target
        let isIntegerFormat = false;
        if (_currentRenderTarget !== null) {
          const targetFormat = _currentRenderTarget.texture.format;
          isIntegerFormat = INTEGER_FORMATS.has(targetFormat);
        }
        // use the appropriate clear functions to clear the target if it's a signed
        // or unsigned integer target
        if (isIntegerFormat) {
          const targetType = _currentRenderTarget.texture.type;
          const isUnsignedType = UNSIGNED_TYPES.has(targetType);
          const clearColor = background.getClearColor();
          const a = background.getClearAlpha();
          const r = clearColor.r;
          const g = clearColor.g;
          const b = clearColor.b;
          if (isUnsignedType) {
            (uintClearColor as any)[0] = r;
            (uintClearColor as any)[1] = g;
            (uintClearColor as any)[2] = b;
            (uintClearColor as any)[3] = a;
            _gl!.clearBufferuiv(GL.COLOR, 0, uintClearColor);
          } else {
            (intClearColor as any)[0] = r;
            (intClearColor as any)[1] = g;
            (intClearColor as any)[2] = b;
            (intClearColor as any)[3] = a;
            _gl!.clearBufferiv(GL.COLOR, 0, intClearColor);
          }
        } else {
          bits |= GL.COLOR_BUFFER_BIT;
        }
      }
      if (depth) {
        bits |= GL.DEPTH_BUFFER_BIT;
        (this as any).state.buffers.depth.setMask(true);
      }
      if (stencil) {
        bits |= GL.STENCIL_BUFFER_BIT;
        (this as any).state.buffers.stencil.setMask(0xffffffff);
      }
      if (bits !== 0) {
        _gl!.clear(bits);
      }
    };
    /**
     * Clears the color buffer. Equivalent to calling `renderer.clear( true, false, false )`.
     */
    this.clearColor = function (this: any) {
      this.clear(true, false, false);
    };
    /**
     * Clears the depth buffer. Equivalent to calling `renderer.clear( false, true, false )`.
     */
    this.clearDepth = function (this: any) {
      this.clear(false, true, false);
    };
    /**
     * Clears the stencil buffer. Equivalent to calling `renderer.clear( false, false, true )`.
     */
    this.clearStencil = function (this: any) {
      this.clear(false, false, true);
    };
    /**
     * Frees the GPU-related resources allocated by this instance. Call this
     * method whenever this instance is no longer used in your app.
     */
    this.dispose = function () {
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener("webglcontextrestored", onContextRestore, false);
      canvas.removeEventListener("webglcontextcreationerror", onContextCreationError, false);
      background.dispose?.();
      output?.dispose();
      renderLists.dispose();
      renderStates.dispose();
      textures.dispose();
      environments?.dispose();
      shadowMap?.dispose();
      properties.dispose();
      objects.dispose();
      geometries.dispose();
      bindingStates.dispose();
      uniformsGroups.dispose();
      programCache.dispose();
      state.dispose();
      _gl!.deleteFramebuffer(_scratchFramebuffer);
      _gl!.deleteFramebuffer(_srcFramebuffer);
      _gl!.deleteFramebuffer(_dstFramebuffer);
      animation.stop();
    };
    // Events
    function onContextLost(event?: any) {
      event.preventDefault();
      log("WebGLRenderer: Context Lost.");
      _isContextLost = true;
      uniformsGroups.dispose();
      background.dispose?.();
      output?.dispose();
      environments?.dispose();
      shadowMap?.dispose();
      textures.dispose();
      objects.dispose();
      geometries.dispose();
    }
    function onContextRestore(/* event */) {
      log("WebGLRenderer: Context Restored.");
      _isContextLost = false;
      const infoAutoReset = info.autoReset;
      const clearColor = background.getClearColor();
      const clearAlpha = background.getClearAlpha();
      const shadowMapEnabled = shadowMap?.enabled;
      const shadowMapAutoUpdate = shadowMap?.autoUpdate;
      const shadowMapNeedsUpdate = shadowMap?.needsUpdate;
      const shadowMapType = shadowMap?.type;
      initGLContext();
      info.autoReset = infoAutoReset;
      background.setClearColor(clearColor, clearAlpha);
      if (shadowMap !== null) shadowMap.enabled = shadowMapEnabled;
      if (shadowMap !== null) shadowMap.autoUpdate = shadowMapAutoUpdate;
      if (shadowMap !== null) shadowMap.needsUpdate = shadowMapNeedsUpdate;
      if (shadowMap !== null) shadowMap.type = shadowMapType;
    }
    function onContextCreationError(event?: any) {
      error("WebGLRenderer: A WebGL context could not be created. Reason: ", event.statusMessage);
    }
    function onMaterialDispose(event?: any) {
      const material = event.target;
      material.removeEventListener("dispose", onMaterialDispose);
      deallocateMaterial(material);
    }
    // Buffer deallocation
    function deallocateMaterial(material?: any) {
      releaseMaterialProgramReferences(material);
      properties.remove(material);
    }
    function releaseMaterialProgramReferences(material?: any) {
      const programs = properties.get(material).programs;
      if (programs !== undefined) {
        programs.forEach(function (program?: any) {
          programCache.releaseProgram(program);
        });
        if (material.isShaderMaterial) {
          programCache.releaseShaderCache(material);
        }
      }
    }
    // Buffer rendering
    this.renderBufferDirect = function (
      camera: any,
      scene: any,
      geometry: any,
      material: any,
      object: any,
      group?: any,
    ) {
      if (scene === null) scene = _emptyScene; // renderBufferDirect second parameter used to be fog (could be null)
      const frontFaceCW = object.isMesh && object.matrixWorld.determinantAffine() < 0;
      const program = setProgram(camera, scene, geometry, material, object);
      state.setMaterial(material, frontFaceCW);
      //
      let index = geometry.index;
      let rangeFactor = 1;
      if (material.wireframe === true) {
        index = geometries.getWireframeAttribute(geometry);
        if (index === undefined) return;
        rangeFactor = 2;
      }
      //
      const drawRange = geometry.drawRange;
      const position = geometry.attributes.position;
      let drawStart = drawRange.start * rangeFactor;
      let drawEnd = (drawRange.start + drawRange.count) * rangeFactor;
      if (group !== null) {
        drawStart = Math.max(drawStart, group.start * rangeFactor);
        drawEnd = Math.min(drawEnd, (group.start + group.count) * rangeFactor);
      }
      if (index !== null) {
        drawStart = Math.max(drawStart, 0);
        drawEnd = Math.min(drawEnd, index.count);
      } else if (position !== undefined && position !== null) {
        drawStart = Math.max(drawStart, 0);
        drawEnd = Math.min(drawEnd, position.count);
      }
      const drawCount = drawEnd - drawStart;
      if (drawCount < 0 || drawCount === Infinity) return;
      //
      bindingStates.setup(object, material, program, geometry, index);
      let attribute: any;
      let renderer = bufferRenderer;
      if (index !== null) {
        attribute = attributes.get(index);
        renderer = indexedBufferRenderer;
        renderer.setIndex(attribute);
      }
      //
      if (object.isMesh) {
        if (material.wireframe === true) {
          state.setLineWidth(material.wireframeLinewidth * getTargetPixelRatio());
          renderer.setMode(GL.LINES);
        } else {
          renderer.setMode(GL.TRIANGLES);
        }
      } else if (object.isLine) {
        let lineWidth = material.linewidth;
        if (lineWidth === undefined) lineWidth = 1; // Not using Line*Material
        state.setLineWidth(lineWidth * getTargetPixelRatio());
        if (object.isLineSegments) {
          renderer.setMode(GL.LINES);
        } else if (object.isLineLoop) {
          renderer.setMode(GL.LINE_LOOP);
        } else {
          renderer.setMode(GL.LINE_STRIP);
        }
      } else if (object.isPoints) {
        renderer.setMode(GL.POINTS);
      } else if (object.isSprite) {
        renderer.setMode(GL.TRIANGLES);
      }
      if (object.isBatchedMesh) {
        if (!extensions.get("WEBGL_multi_draw")) {
          const starts = object._multiDrawStarts;
          const counts = object._multiDrawCounts;
          const drawCount = object._multiDrawCount;
          const bytesPerElement = index ? attributes.get(index).bytesPerElement : 1;
          const uniforms = properties.get(material).currentProgram.getUniforms();
          for (let i = 0; i < drawCount; i++) {
            uniforms.setValue(_gl, "_gl_DrawID", i);
            renderer.render(starts[i] / bytesPerElement, counts[i]);
          }
        } else {
          renderer.renderMultiDraw(object._multiDrawStarts, object._multiDrawCounts, object._multiDrawCount);
        }
      } else if (object.isInstancedMesh) {
        renderer.renderInstances(drawStart, drawCount, object.count);
      } else if (geometry.isInstancedBufferGeometry) {
        const maxInstanceCount = geometry._maxInstanceCount !== undefined ? geometry._maxInstanceCount : Infinity;
        const instanceCount = Math.min(geometry.instanceCount, maxInstanceCount);
        renderer.renderInstances(drawStart, drawCount, instanceCount);
      } else {
        renderer.render(drawStart, drawCount);
      }
    };
    // Compile
    function prepareMaterial(material: any, scene: any, camera: any, object?: any) {
      if (_clippingEnabled === true) clipping.setState(material, camera, false);
      if (material.transparent === true && material.side === Side.Double && material.forceSinglePass === false) {
        material.side = Side.Back;
        material.needsUpdate = true;
        getProgram(material, scene, object);
        material.side = Side.Front;
        material.needsUpdate = true;
        getProgram(material, scene, object);
        material.side = Side.Double;
      } else {
        getProgram(material, scene, object);
      }
    }
    /**
     * Compiles all materials in the scene with the camera. This is useful to precompile shaders
     * before the first rendering. If you want to add a 3D object to an existing scene, use the third
     * optional parameter for applying the target scene.
     *
     * Note that the (target) scene's lighting and environment must be configured before calling this method.
     *
     * @param scene - The scene or another type of 3D object to precompile.
     * @param camera - The camera.
     * @param [targetScene=null] - The target scene.
     * @return The precompiled materials.
     */
    this.compile = function (this: any, scene: Object3D, camera: Camera, targetScene: any = null) {
      if (targetScene === null) targetScene = scene;
      currentRenderState = renderStates.get(targetScene);
      currentRenderState.init(camera);
      renderStateStack.push(currentRenderState);
      try {
        // gather lights from both the target scene and the new object that will be added to the scene.
        targetScene.traverseVisible(function (object?: any) {
          if (object.isLight && object.layers.test(camera.layers)) {
            currentRenderState.pushLight(object);
            if (object.castShadow) {
              if (shadowMap === null) throw new Error("Shadow-casting lights require createShadowMap.");
              currentRenderState.pushShadow(object);
            }
          }
        });
        if (scene !== targetScene) {
          scene.traverseVisible(function (object?: any) {
            if (object.isLight && object.layers.test(camera.layers)) {
              currentRenderState.pushLight(object);
              if (object.castShadow) {
                if (shadowMap === null) throw new Error("Shadow-casting lights require createShadowMap.");
                currentRenderState.pushShadow(object);
              }
            }
          });
        }
        currentRenderState.setupLights();
        _localClippingEnabled = this.localClippingEnabled;
        _clippingEnabled = clipping.init(this.clippingPlanes, _localClippingEnabled);
        if (_clippingEnabled === true) clipping.setGlobalState(this.clippingPlanes, camera);
        // Only initialize materials in the new scene, not the targetScene.
        const materials = new Set<Material>();
        scene.traverse(function (object?: any) {
          if (!(object.isMesh || object.isPoints || object.isLine || object.isSprite)) {
            return;
          }
          const material = object.material;
          if (material) {
            if (Array.isArray(material)) {
              for (let i = 0; i < material.length; i++) {
                const material2 = material[i];
                prepareMaterial(material2, targetScene, camera, object);
                materials.add(material2);
              }
            } else {
              prepareMaterial(material, targetScene, camera, object);
              materials.add(material);
            }
          }
        });
        return materials;
      } finally {
        currentRenderState = renderStateStack.pop();
      }
    };
    // compileAsync
    /**
     * Asynchronous version of {@link WebGLRenderer#compile}.
     *
     * This method makes use of the `KHR_parallel_shader_compile` WebGL extension. Hence,
     * it is recommended to use this version of `compile()` whenever possible.
     *
     * @async
     * @param scene - The scene or another type of 3D object to precompile.
     * @param camera - The camera.
     * @param [targetScene=null] - The target scene.
     * @return A Promise that resolves when the given scene can be rendered without unnecessary stalling due to shader compilation.
     */
    this.compileAsync = function (this: any, scene: Object3D, camera: Camera, targetScene: any = null) {
      const materials = this.compile(scene, camera, targetScene);
      // Wait for all the materials in the new object to indicate that they're
      // ready to be used before resolving the promise.
      return new Promise<Object3D>((resolve) => {
        function checkMaterialsReady() {
          materials.forEach(function (material?: any) {
            const materialProperties = properties.get(material);
            const program = materialProperties.currentProgram;
            if (program === undefined || program.isReady()) {
              // stop waiting for materials that are ready to use or have been disposed
              materials.delete(material);
            }
          });
          // once the list of compiling materials is empty, call the callback
          if (materials.size === 0) {
            resolve(scene);
            return;
          }
          // if some materials are still not ready, wait a bit and check again
          setTimeout(checkMaterialsReady, 10);
        }
        if (extensions.get("KHR_parallel_shader_compile") !== null) {
          // If we can check the compilation status of the materials without
          // blocking then do so right away.
          checkMaterialsReady();
        } else {
          // Otherwise start by waiting a bit to give the materials we just
          // initialized a chance to finish.
          setTimeout(checkMaterialsReady, 10);
        }
      });
    };
    // Animation Loop
    let onAnimationFrameCallback: any = null;
    function onAnimationFrame(time?: any) {
      if (onAnimationFrameCallback) onAnimationFrameCallback(time);
    }
    const animation = new (WebGLAnimation as any)();
    animation.setAnimationLoop(onAnimationFrame);
    if (typeof self !== "undefined") animation.setContext(self);
    /**
     * Applications are advised to always define the animation loop
     * with this method and not manually with `requestAnimationFrame()`
     * for best compatibility.
     *
     * @param callback - The application's animation loop.
     */
    this.setAnimationLoop = function (callback?: any) {
      onAnimationFrameCallback = callback;
      if (callback === null) animation.stop();
      else animation.start();
    };
    // Rendering
    /**
     * Renders the given scene (or other type of 3D object) using the given camera.
     *
     * The render is done to a previously specified render target set by calling {@link WebGLRenderer#setRenderTarget}
     * or to the canvas as usual.
     *
     * By default render buffers are cleared before rendering but you can prevent
     * this by setting the property `autoClear` to `false`. If you want to prevent
     * only certain buffers being cleared you can `autoClearColor`, `autoClearDepth`
     * or `autoClearStencil` to `false`. To force a clear, use {@link WebGLRenderer#clear}.
     *
     * @param scene - The scene to render.
     * @param camera - The camera.
     */
    this.render = function (this: any, scene: Object3D, camera: Camera) {
      if (camera !== undefined && camera.isCamera !== true) {
        error("WebGLRenderer.render: camera is not an instance of THREE.Camera.");
        return;
      }
      if (_isContextLost === true) return;
      // use internal render target for HalfFloatType color buffer (only when tone mapping is enabled)
      const useOutput = output !== null && _currentRenderTarget === null && output.begin(_this, _currentRenderTarget);
      try {
        // update scene graph
        if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
        // update camera matrices and frustum
        if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
        //
        if ((scene as any).isScene === true) scene.onBeforeRender(_this, scene, camera, _currentRenderTarget);
        currentRenderState = renderStates.get(scene, renderStateStack.length);
        currentRenderState.init(camera);
        currentRenderState.state.textureUnits = textures.getTextureUnits();
        renderStateStack.push(currentRenderState);
        _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        if ((camera as any).isArrayCamera) {
          _frustumArray.setFromArrayCamera(camera as ArrayCamera);
        } else {
          _frustum.setFromProjectionMatrix(_projScreenMatrix, CoordinateSystem.WebGL, camera.reversedDepth);
        }
        _localClippingEnabled = this.localClippingEnabled;
        _clippingEnabled = clipping.init(this.clippingPlanes, _localClippingEnabled);
        currentRenderList = renderLists.get(scene, renderListStack.length);
        currentRenderList.init();
        renderListStack.push(currentRenderList);
        try {
          (this as any).info.render.frame++;
          // increment before projectObject(), see #35099
          projectObject(scene, camera, 0, _this.sortObjects);
          currentRenderList.finish();
          if (_this.sortObjects === true) {
            currentRenderList.sort(_opaqueSort, _transparentSort);
          }
          background.addToRenderList?.(currentRenderList, scene);
          //
          if ((this as any).info.autoReset === true) (this as any).info.reset();
          if (_clippingEnabled === true) clipping.beginShadows();
          const shadowsArray = currentRenderState.state.shadowsArray;
          try {
            shadowMap?.render(shadowsArray, scene, camera);
          } finally {
            if (_clippingEnabled === true) clipping.endShadows();
          }
          //
          // render scene (skip if first effect is a render pass - it will render the scene itself)
          const skipSceneRender = useOutput && output.hasRenderPass();
          if (skipSceneRender === false) {
            const opaqueObjects = currentRenderList.opaque;
            const transmissiveObjects = currentRenderList.transmissive;
            currentRenderState.setupLights();
            if ((camera as any).isArrayCamera) {
              const cameras = (camera as any).cameras;
              if (transmissiveObjects.length > 0) {
                for (let i = 0, l = cameras.length; i < l; i++) {
                  const camera2 = cameras[i];
                  renderTransmissionPass(opaqueObjects, transmissiveObjects, scene, camera2);
                }
              }
              background.render(scene);
              for (let i = 0, l = cameras.length; i < l; i++) {
                const camera2 = cameras[i];
                renderScene(currentRenderList, scene, camera2, camera2.viewport);
              }
            } else {
              if (transmissiveObjects.length > 0)
                renderTransmissionPass(opaqueObjects, transmissiveObjects, scene, camera);
              background.render(scene);
              renderScene(currentRenderList, scene, camera);
            }
          }
          //
          if (_currentRenderTarget !== null && _currentActiveMipmapLevel === 0) {
            // resolve multisample renderbuffers to a single-sample texture if necessary
            textures.updateMultisampleRenderTarget(_currentRenderTarget);
            // Generate mipmap if we're using any kind of mipmap filtering
            textures.updateRenderTargetMipmap(_currentRenderTarget);
          }
          // copy from internal render target to canvas using fullscreen quad
          if (useOutput) {
            output.end(_this);
          }
          //
          if ((scene as any).isScene === true) scene.onAfterRender(_this, scene, camera);
        } finally {
          // _gl.finish();
          bindingStates.resetDefaultState();
          _currentMaterialId = -1;
          _currentCamera = null;
          renderStateStack.pop();
          if (renderStateStack.length > 0) {
            currentRenderState = renderStateStack[renderStateStack.length - 1];
            textures.setTextureUnits(currentRenderState.state.textureUnits);
            if (_clippingEnabled === true)
              clipping.setGlobalState(_this.clippingPlanes, currentRenderState.state.camera);
          } else {
            currentRenderState = null;
          }
          renderListStack.pop();
          if (renderListStack.length > 0) {
            currentRenderList = renderListStack[renderListStack.length - 1];
          } else {
            currentRenderList = null;
          }
        }
      } finally {
        if (useOutput) output.restore(_this);
      }
    };
    function projectObject(object: any, camera: any, groupOrder: any, sortObjects?: any) {
      if (object.visible === false) return;
      const visible = object.layers.test(camera.layers);
      if (visible) {
        if (object.isGroup) {
          groupOrder = object.renderOrder;
        } else if (object.isLOD) {
          if (object.autoUpdate === true) object.update(camera);
        } else if (object.isLight) {
          currentRenderState.pushLight(object);
          if (object.castShadow) {
            if (shadowMap === null) throw new Error("Shadow-casting lights require createShadowMap.");
            currentRenderState.pushShadow(object);
          }
        } else if (object.isSprite) {
          const frustum = camera.isArrayCamera ? _frustumArray : _frustum;
          if (!object.frustumCulled || object.intersectsFrustum(frustum)) {
            if (sortObjects) {
              _vector4.setFromMatrixPosition(object.matrixWorld).applyMatrix4(_projScreenMatrix);
            }
            const geometry = objects.update(object);
            const material = object.material;
            if (material.visible) {
              currentRenderList.push(object, geometry, material, groupOrder, _vector4.z, null, camera);
            }
          }
        } else if (object.isMesh || object.isLine || object.isPoints) {
          const frustum = camera.isArrayCamera ? _frustumArray : _frustum;
          if (!object.frustumCulled || object.intersectsFrustum(frustum)) {
            const geometry = objects.update(object);
            const material = object.material;
            if (sortObjects) {
              if (object.boundingSphere !== undefined) {
                if (object.boundingSphere === null) object.computeBoundingSphere();
                _vector4.copy(object.boundingSphere.center);
              } else {
                if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
                _vector4.copy(geometry.boundingSphere.center);
              }
              _vector4.applyMatrix4(object.matrixWorld).applyMatrix4(_projScreenMatrix);
            }
            if (Array.isArray(material)) {
              const groups = geometry.groups;
              for (let i = 0, l = groups.length; i < l; i++) {
                const group = groups[i];
                const groupMaterial = material[group.materialIndex];
                if (groupMaterial && groupMaterial.visible) {
                  currentRenderList.push(object, geometry, groupMaterial, groupOrder, _vector4.z, group, camera);
                }
              }
            } else if (material.visible) {
              currentRenderList.push(object, geometry, material, groupOrder, _vector4.z, null, camera);
            }
          }
        }
      }
      const children = object.children;
      for (let i = 0, l = children.length; i < l; i++) {
        projectObject(children[i], camera, groupOrder, sortObjects);
      }
    }
    function renderScene(currentRenderList: any, scene: any, camera: any, viewport?: any) {
      const {
        opaque: opaqueObjects,
        transmissive: transmissiveObjects,
        transparent: transparentObjects,
      } = currentRenderList;
      currentRenderState.setupLightsView(camera);
      if (_clippingEnabled === true) clipping.setGlobalState(_this.clippingPlanes, camera);
      if (viewport) state.viewport(_currentViewport.copy(viewport));
      if (opaqueObjects.length > 0) renderObjects(opaqueObjects, scene, camera);
      if (transmissiveObjects.length > 0) renderObjects(transmissiveObjects, scene, camera);
      if (transparentObjects.length > 0) renderObjects(transparentObjects, scene, camera);
      // Ensure depth buffer writing is enabled so it can be cleared on next render
      state.buffers.depth.setTest(true);
      state.buffers.depth.setMask(true);
      state.buffers.color.setMask(true);
      state.setPolygonOffset(false);
    }
    function renderTransmissionPass(opaqueObjects: any, transmissiveObjects: any, scene: any, camera?: any) {
      const overrideMaterial = scene.isScene === true ? scene.overrideMaterial : null;
      if (overrideMaterial !== null) {
        return;
      }
      if (currentRenderState.state.transmissionRenderTarget[camera.id] === undefined) {
        const hasHalfFloatSupport =
          extensions.has("EXT_color_buffer_half_float") || extensions.has("EXT_color_buffer_float");
        currentRenderState.state.transmissionRenderTarget[camera.id] = new WebGLRenderTarget(1, 1, {
          generateMipmaps: true,
          type: hasHalfFloatSupport ? TextureType.HalfFloat : TextureType.UnsignedByte,
          minFilter: TextureFilter.LinearMipmapLinear,
          samples: Math.max(4, capabilities.samples), // to avoid feedback loops, the transmission render target requires a resolve, see #26177
          stencilBuffer: stencil,
          resolveDepthBuffer: false,
          resolveStencilBuffer: false,
          storeMultisampledDepthBuffer: false,
          storeMultisampledStencilBuffer: false,
          colorSpace: ColorManagement.workingColorSpace,
        });
        // debug
        /*
                const geometry = new PlaneGeometry();
                const material = new MeshBasicMaterial( { map: _transmissionRenderTarget.texture } );

                const mesh = new Mesh( geometry, material );
                scene.add( mesh );
                */
      }
      const transmissionRenderTarget = currentRenderState.state.transmissionRenderTarget[camera.id];
      const activeViewport = camera.viewport || _currentViewport;
      transmissionRenderTarget.setSize(
        activeViewport.z * _this.transmissionResolutionScale,
        activeViewport.w * _this.transmissionResolutionScale,
      );
      //
      const currentRenderTarget = _this.getRenderTarget();
      const currentActiveCubeFace = _this.getActiveCubeFace();
      const currentActiveMipmapLevel = _this.getActiveMipmapLevel();
      _this.setRenderTarget(transmissionRenderTarget);
      _this.getClearColor(_currentClearColor);
      _currentClearAlpha = _this.getClearAlpha();
      if (_currentClearAlpha < 1) _this.setClearColor(0xffffff, 0.5);
      _this.clear();
      background.render(scene);
      // Turn off the features which can affect the frag color for opaque objects pass.
      // Otherwise they are applied twice in opaque objects pass and transmission objects pass.
      const currentToneMapping = _this.toneMapping;
      _this.toneMapping = ToneMapping.No;
      // Remove viewport from camera to avoid nested render calls resetting viewport to it (e.g Reflector).
      // Transmission render pass requires viewport to match the transmissionRenderTarget.
      const currentCameraViewport = camera.viewport;
      if (camera.viewport !== undefined) camera.viewport = undefined;
      currentRenderState.setupLightsView(camera);
      if (_clippingEnabled === true) clipping.setGlobalState(_this.clippingPlanes, camera);
      renderObjects(opaqueObjects, scene, camera);
      textures.updateMultisampleRenderTarget(transmissionRenderTarget);
      textures.updateRenderTargetMipmap(transmissionRenderTarget);
      if (extensions.has("WEBGL_multisampled_render_to_texture") === false) {
        // see #28131
        let renderTargetNeedsUpdate = false;
        for (let i = 0, l = transmissiveObjects.length; i < l; i++) {
          const renderItem = transmissiveObjects[i];
          const { object, geometry, material, group } = renderItem;
          if (material.side === Side.Double && object.layers.test(camera.layers)) {
            const currentSide = material.side;
            material.side = Side.Back;
            material.needsUpdate = true;
            renderObject(object, scene, camera, geometry, material, group);
            material.side = currentSide;
            material.needsUpdate = true;
            renderTargetNeedsUpdate = true;
          }
        }
        if (renderTargetNeedsUpdate === true) {
          textures.updateMultisampleRenderTarget(transmissionRenderTarget);
          textures.updateRenderTargetMipmap(transmissionRenderTarget);
        }
      }
      _this.setRenderTarget(currentRenderTarget, currentActiveCubeFace, currentActiveMipmapLevel);
      _this.setClearColor(_currentClearColor, _currentClearAlpha);
      if (currentCameraViewport !== undefined) camera.viewport = currentCameraViewport;
      _this.toneMapping = currentToneMapping;
    }
    function renderObjects(renderList: any, scene: any, camera?: any) {
      const overrideMaterial = scene.isScene === true ? scene.overrideMaterial : null;
      for (let i = 0, l = renderList.length; i < l; i++) {
        const renderItem = renderList[i];
        const { object, geometry, group } = renderItem;
        let material = renderItem.material;
        if (material.allowOverride === true && overrideMaterial !== null) {
          material = overrideMaterial;
        }
        if (object.layers.test(camera.layers)) {
          renderObject(object, scene, camera, geometry, material, group);
        }
      }
    }
    function renderObject(object: any, scene: any, camera: any, geometry: any, material: any, group?: any) {
      object.onBeforeRender(_this, scene, camera, geometry, material, group);
      object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
      object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
      material.onBeforeRender(_this, scene, camera, geometry, object, group);
      if (material.transparent === true && material.side === Side.Double && material.forceSinglePass === false) {
        material.side = Side.Back;
        material.needsUpdate = true;
        _this.renderBufferDirect(camera, scene, geometry, material, object, group);
        material.side = Side.Front;
        material.needsUpdate = true;
        _this.renderBufferDirect(camera, scene, geometry, material, object, group);
        material.side = Side.Double;
      } else {
        _this.renderBufferDirect(camera, scene, geometry, material, object, group);
      }
      object.onAfterRender(_this, scene, camera, geometry, material, group);
    }
    function getProgram(material: any, scene: any, object?: any) {
      if (scene.isScene !== true) scene = _emptyScene; // scene could be a Mesh, Line, Points, ...
      const materialProperties = properties.get(material);
      const lights = currentRenderState.state.lights;
      const shadowsArray = currentRenderState.state.shadowsArray;
      const lightsStateVersion = lights.state.version;
      const parameters = programCache.getParameters(
        material,
        lights.state,
        shadowsArray,
        scene,
        object,
        currentRenderState.state.lightProbeGridArray,
      );
      const programCacheKey = programCache.getProgramCacheKey(parameters);
      let programs = materialProperties.programs;
      // always update environment and fog - changing these trigger an getProgram call, but it's possible that the program doesn't change
      materialProperties.environment =
        material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial
          ? scene.environment
          : null;
      materialProperties.fog = scene.fog;
      const usePMREM =
        material.isMeshStandardMaterial ||
        (material.isMeshLambertMaterial && !material.envMap) ||
        (material.isMeshPhongMaterial && !material.envMap);
      materialProperties.envMap = getEnvironment(
        environments,
        material.envMap || materialProperties.environment,
        usePMREM,
      );
      materialProperties.envMapRotation =
        materialProperties.environment !== null && material.envMap === null
          ? scene.environmentRotation
          : material.envMapRotation;
      if (programs === undefined) {
        // new material
        material.addEventListener("dispose", onMaterialDispose);
        programs = new Map();
        materialProperties.programs = programs;
        materialProperties.programVariants = new Map();
      }
      let program = programs.get(programCacheKey);
      if (program !== undefined) {
        // early out if program and light state is identical
        if (
          materialProperties.currentProgram === program &&
          materialProperties.lightsStateVersion === lightsStateVersion
        ) {
          updateCommonMaterialProperties(material, parameters);
          return program;
        }
      } else {
        parameters.uniforms = programCache.getUniforms(material);
        material.onBeforeCompile(parameters, _this);
        program = programCache.acquireProgram(parameters, programCacheKey);
        programs.set(programCacheKey, program);
        materialProperties.uniforms = parameters.uniforms;
      }
      const uniforms = materialProperties.uniforms;
      if ((!material.isShaderMaterial && !material.isRawShaderMaterial) || material.clipping === true) {
        uniforms.clippingPlanes = clipping.uniform;
      }
      updateCommonMaterialProperties(material, parameters);
      // store the light setup it was created for
      materialProperties.needsLights = materialNeedsLights(material);
      materialProperties.lightsStateVersion = lightsStateVersion;
      if (materialProperties.needsLights) {
        // wire up the material to this renderer's lighting state
        uniforms.ambientLightColor.value = lights.state.ambient;
        uniforms.lightProbe.value = lights.state.probe;
        uniforms.sunLights.value = lights.state.sun;
        uniforms.sunLightShadows.value = lights.state.sunShadow;
        uniforms.directionalLights.value = lights.state.directional;
        uniforms.directionalLightShadows.value = lights.state.directionalShadow;
        uniforms.spotLights.value = lights.state.spot;
        uniforms.spotLightShadows.value = lights.state.spotShadow;
        uniforms.rectAreaLights.value = lights.state.rectArea;
        uniforms.ltc_1.value = lights.state.rectAreaLTC1;
        uniforms.ltc_2.value = lights.state.rectAreaLTC2;
        uniforms.pointLights.value = lights.state.point;
        uniforms.pointLightShadows.value = lights.state.pointShadow;
        uniforms.hemisphereLights.value = lights.state.hemi;
        uniforms.sunShadowMatrix.value = lights.state.sunShadowMatrix;
        uniforms.sunShadowCascade.value = lights.state.sunShadowCascade;
        uniforms.directionalShadowMatrix.value = lights.state.directionalShadowMatrix;
        uniforms.spotLightMatrix.value = lights.state.spotLightMatrix;
        uniforms.spotLightMap.value = lights.state.spotLightMap;
        uniforms.pointShadowMatrix.value = lights.state.pointShadowMatrix;
        // TODO (abelnation): add area lights shadow info to uniforms
      }
      materialProperties.lightProbeGrid = currentRenderState.state.lightProbeGridArray.length > 0;
      materialProperties.currentProgram = program;
      materialProperties.uniformsList = null;
      return program;
    }
    function getProgramVariant(material: any, scene: any, object: any, colorSpace: any, toneMapping?: any) {
      const materialProperties = properties.get(material);
      const programVariantKey = materialProperties.currentProgram.id + "," + colorSpace + "," + toneMapping;
      let program = materialProperties.programVariants.get(programVariantKey);
      if (program === undefined) {
        program = getProgram(material, scene, object);
        materialProperties.programVariants.set(programVariantKey, program);
      } else {
        materialProperties.currentProgram = program;
        materialProperties.uniformsList = null;
        materialProperties.outputColorSpace = colorSpace;
        materialProperties.toneMapping = toneMapping;
      }
      return program;
    }
    function getUniformList(materialProperties?: any) {
      if (materialProperties.uniformsList === null) {
        const progUniforms = materialProperties.currentProgram.getUniforms();
        materialProperties.uniformsList = WebGLUniforms.seqWithValue(progUniforms.seq, materialProperties.uniforms);
      }
      return materialProperties.uniformsList;
    }
    function updateCommonMaterialProperties(material: any, parameters?: any) {
      const materialProperties = properties.get(material);
      materialProperties.outputColorSpace = parameters.outputColorSpace;
      materialProperties.batching = parameters.batching;
      materialProperties.batchingColor = parameters.batchingColor;
      materialProperties.instancing = parameters.instancing;
      materialProperties.instancingColor = parameters.instancingColor;
      materialProperties.instancingMorph = parameters.instancingMorph;
      materialProperties.skinning = parameters.skinning;
      materialProperties.morphTargets = parameters.morphTargets;
      materialProperties.morphNormals = parameters.morphNormals;
      materialProperties.morphColors = parameters.morphColors;
      materialProperties.morphTargetsCount = parameters.morphTargetsCount;
      materialProperties.numClippingPlanes = parameters.numClippingPlanes;
      materialProperties.numIntersection = parameters.numClipIntersection;
      materialProperties.vertexAlphas = parameters.vertexAlphas;
      materialProperties.vertexTangents = parameters.vertexTangents;
      materialProperties.toneMapping = parameters.toneMapping;
    }
    function findLightProbeGrid(volumes: any, object?: any) {
      if (volumes.length === 0) return null;
      if (volumes.length === 1) {
        return volumes[0].texture !== null ? volumes[0] : null;
      }
      objectPosition.setFromMatrixPosition(object.matrixWorld);
      for (let i = 0, l = volumes.length; i < l; i++) {
        const v = volumes[i];
        if (v.texture !== null && v.boundingBox.containsPoint(objectPosition)) return v;
      }
      return null;
    }
    function setProgram(camera: any, scene: any, geometry: any, material: any, object?: any) {
      if (scene.isScene !== true) scene = _emptyScene; // scene could be a Mesh, Line, Points, ...
      textures.resetTextureUnits();
      const fog = scene.fog;
      const environment =
        material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial
          ? scene.environment
          : null;
      const colorSpace = _currentRenderTarget === null ? _this.outputColorSpace : ColorManagement.workingColorSpace;
      const usePMREM =
        material.isMeshStandardMaterial ||
        (material.isMeshLambertMaterial && !material.envMap) ||
        (material.isMeshPhongMaterial && !material.envMap);
      const envMap = getEnvironment(environments, material.envMap || environment, usePMREM);
      const vertexAlphas =
        material.vertexColors === true && !!geometry.attributes.color && geometry.attributes.color.itemSize === 4;
      const vertexTangents = !!geometry.attributes.tangent && (!!material.normalMap || material.anisotropy > 0);
      const morphTargets = !!geometry.morphAttributes.position;
      const morphNormals = !!geometry.morphAttributes.normal;
      const morphColors = !!geometry.morphAttributes.color;
      let toneMapping: ToneMapping = ToneMapping.No;
      if (material.toneMapped) {
        if (_currentRenderTarget === null) {
          toneMapping = _this.toneMapping;
        }
      }
      const morphAttribute =
        geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
      const morphTargetsCount = morphAttribute !== undefined ? morphAttribute.length : 0;
      const materialProperties = properties.get(material);
      const lights = currentRenderState.state.lights;
      if (_clippingEnabled === true) {
        if (_localClippingEnabled === true || camera !== _currentCamera) {
          const useCache = camera === _currentCamera && material.id === _currentMaterialId;
          // we might want to call this function with some ClippingGroup
          // object instead of the material, once it becomes feasible
          // (#8465, #8379)
          clipping.setState(material, camera, useCache);
        }
      }
      //
      let needsProgramChange = false;
      let needsProgramVariant = false;
      if (material.version === materialProperties.__version) {
        if (materialProperties.needsLights && materialProperties.lightsStateVersion !== lights.state.version) {
          needsProgramChange = true;
        } else if (object.isBatchedMesh && materialProperties.batching === false) {
          needsProgramChange = true;
        } else if (!object.isBatchedMesh && materialProperties.batching === true) {
          needsProgramChange = true;
        } else if (
          object.isBatchedMesh &&
          materialProperties.batchingColor === true &&
          object._colorsTexture === null
        ) {
          needsProgramChange = true;
        } else if (
          object.isBatchedMesh &&
          materialProperties.batchingColor === false &&
          object._colorsTexture !== null
        ) {
          needsProgramChange = true;
        } else if (object.isInstancedMesh && materialProperties.instancing === false) {
          needsProgramChange = true;
        } else if (!object.isInstancedMesh && materialProperties.instancing === true) {
          needsProgramChange = true;
        } else if (object.isSkinnedMesh && materialProperties.skinning === false) {
          needsProgramChange = true;
        } else if (!object.isSkinnedMesh && materialProperties.skinning === true) {
          needsProgramChange = true;
        } else if (
          object.isInstancedMesh &&
          materialProperties.instancingColor === true &&
          object.instanceColor === null
        ) {
          needsProgramChange = true;
        } else if (
          object.isInstancedMesh &&
          materialProperties.instancingColor === false &&
          object.instanceColor !== null
        ) {
          needsProgramChange = true;
        } else if (
          object.isInstancedMesh &&
          materialProperties.instancingMorph === true &&
          object.morphTexture === null
        ) {
          needsProgramChange = true;
        } else if (
          object.isInstancedMesh &&
          materialProperties.instancingMorph === false &&
          object.morphTexture !== null
        ) {
          needsProgramChange = true;
        } else if (materialProperties.envMap !== envMap) {
          needsProgramChange = true;
        } else if (material.fog === true && materialProperties.fog !== fog) {
          needsProgramChange = true;
        } else if (
          materialProperties.numClippingPlanes !== undefined &&
          (materialProperties.numClippingPlanes !== clipping.numPlanes ||
            materialProperties.numIntersection !== clipping.numIntersection)
        ) {
          needsProgramChange = true;
        } else if (materialProperties.vertexAlphas !== vertexAlphas) {
          needsProgramChange = true;
        } else if (materialProperties.vertexTangents !== vertexTangents) {
          needsProgramChange = true;
        } else if (materialProperties.morphTargets !== morphTargets) {
          needsProgramChange = true;
        } else if (materialProperties.morphNormals !== morphNormals) {
          needsProgramChange = true;
        } else if (materialProperties.morphColors !== morphColors) {
          needsProgramChange = true;
        } else if (materialProperties.morphTargetsCount !== morphTargetsCount) {
          needsProgramChange = true;
        } else if (!!materialProperties.lightProbeGrid !== currentRenderState.state.lightProbeGridArray.length > 0) {
          needsProgramChange = true;
        } else if (
          materialProperties.outputColorSpace !== colorSpace ||
          materialProperties.toneMapping !== toneMapping
        ) {
          needsProgramVariant = true;
        }
      } else {
        needsProgramChange = true;
        materialProperties.__version = material.version;
      }
      //
      let program = materialProperties.currentProgram;
      if (needsProgramChange === true || needsProgramVariant === true) {
        program =
          needsProgramVariant === true
            ? getProgramVariant(material, scene, object, colorSpace, toneMapping)
            : getProgram(material, scene, object);
      }
      let refreshProgram = false;
      let refreshMaterial = false;
      let refreshLights = false;
      const p_uniforms = program.getUniforms(),
        m_uniforms = materialProperties.uniforms;
      if (state.useProgram(program.program)) {
        refreshProgram = true;
        refreshMaterial = true;
        refreshLights = true;
      }
      if (material.id !== _currentMaterialId) {
        _currentMaterialId = material.id;
        refreshMaterial = true;
      }
      if (materialProperties.needsLights) {
        const objectVolume = findLightProbeGrid(currentRenderState.state.lightProbeGridArray, object);
        if (materialProperties.lightProbeGrid !== objectVolume) {
          materialProperties.lightProbeGrid = objectVolume;
          refreshMaterial = true;
        }
      }
      if (refreshProgram || _currentCamera !== camera) {
        // common camera uniforms
        const reversedDepthBuffer = state.buffers.depth.getReversed();
        if (reversedDepthBuffer && camera.reversedDepth !== true) {
          camera._reversedDepth = true;
          camera.updateProjectionMatrix();
        }
        p_uniforms.setValue(_gl, "projectionMatrix", camera.projectionMatrix);
        p_uniforms.setValue(_gl, "viewMatrix", camera.matrixWorldInverse);
        const uCamPos = p_uniforms.map.cameraPosition;
        if (uCamPos !== undefined) {
          uCamPos.setValue(_gl, _vector3.setFromMatrixPosition(camera.matrixWorld));
        }
        if (capabilities.logarithmicDepthBuffer) {
          p_uniforms.setValue(_gl, "logDepthBufFC", 2.0 / (Math.log(camera.far + 1.0) / Math.LN2));
        }
        // consider moving isOrthographic to UniformLib and WebGLMaterials, see https://github.com/mrdoob/three.js/pull/26467#issuecomment-1645185067
        if (
          material.isMeshPhongMaterial ||
          material.isMeshToonMaterial ||
          material.isMeshLambertMaterial ||
          material.isMeshBasicMaterial ||
          material.isMeshStandardMaterial ||
          material.isShaderMaterial
        ) {
          p_uniforms.setValue(_gl, "isOrthographic", camera.isOrthographicCamera === true);
        }
        if (_currentCamera !== camera) {
          _currentCamera = camera;
          // lighting uniforms depend on the camera so enforce an update
          // now, in case this material supports lights - or later, when
          // the next material that does gets activated:
          refreshMaterial = true; // set to true on material change
          refreshLights = true; // remains set until update done
        }
      }
      // Pre-allocate texture units for shadow samplers before setting data textures
      if (materialProperties.needsLights) {
        // Set shadow map uniforms first to ensure they get the first texture units
        if (lights.state.sunShadowMap.length > 0) {
          p_uniforms.setValue(_gl, "sunShadowMap", lights.state.sunShadowMap, textures);
        }
        if (lights.state.directionalShadowMap.length > 0) {
          p_uniforms.setValue(_gl, "directionalShadowMap", lights.state.directionalShadowMap, textures);
        }
        if (lights.state.spotShadowMap.length > 0) {
          p_uniforms.setValue(_gl, "spotShadowMap", lights.state.spotShadowMap, textures);
        }
        if (lights.state.pointShadowMap.length > 0) {
          p_uniforms.setValue(_gl, "pointShadowMap", lights.state.pointShadowMap, textures);
        }
      }
      // skinning and morph target uniforms must be set even if material didn't change
      // auto-setting of texture unit for bone and morph texture must go before other textures
      // otherwise textures used for skinning and morphing can take over texture units reserved for other material textures
      if (object.isSkinnedMesh) {
        p_uniforms.setOptional(_gl, object, "bindMatrix");
        p_uniforms.setOptional(_gl, object, "bindMatrixInverse");
        const skeleton = object.skeleton;
        if (skeleton) {
          if (skeleton.boneTexture === null) skeleton.computeBoneTexture();
          p_uniforms.setValue(_gl, "boneTexture", skeleton.boneTexture, textures);
        }
      }
      if (object.isBatchedMesh) {
        p_uniforms.setOptional(_gl, object, "batchingTexture");
        p_uniforms.setValue(_gl, "batchingTexture", object._matricesTexture, textures);
        p_uniforms.setOptional(_gl, object, "batchingIdTexture");
        p_uniforms.setValue(_gl, "batchingIdTexture", object._indirectTexture, textures);
        p_uniforms.setOptional(_gl, object, "batchingColorTexture");
        if (object._colorsTexture !== null) {
          p_uniforms.setValue(_gl, "batchingColorTexture", object._colorsTexture, textures);
        }
      }
      const morphAttributes = geometry.morphAttributes;
      if (
        morphAttributes.position !== undefined ||
        morphAttributes.normal !== undefined ||
        morphAttributes.color !== undefined
      ) {
        morphtargets.update(object, geometry, program);
      }
      if (refreshMaterial || materialProperties.receiveShadow !== object.receiveShadow) {
        materialProperties.receiveShadow = object.receiveShadow;
        p_uniforms.setValue(_gl, "receiveShadow", object.receiveShadow);
      }
      if (
        (material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial) &&
        material.envMap === null &&
        scene.environment !== null
      ) {
        m_uniforms.envMapIntensity.value = scene.environmentIntensity;
      }
      // Set DFG LUT for physically-based materials
      if (
        m_uniforms.dfgLUT !== undefined &&
        (material.isMeshStandardMaterial || materialProperties.envMap?.isPMREMTexture)
      ) {
        if (!(parameters as any).getDFGLUT)
          throw new Error("Physically based environment lighting requires getDFGLUT.");
        m_uniforms.dfgLUT.value = (parameters as any).getDFGLUT();
      }
      if (refreshMaterial) {
        p_uniforms.setValue(_gl, "toneMappingExposure", _this.toneMappingExposure);
        if (materialProperties.needsLights) {
          // the current material requires lighting info
          // note: all lighting uniforms are always set correctly
          // they simply reference the renderer's state for their
          // values
          //
          // use the current material's .needsUpdate flags to set
          // the GL state when required
          markUniformsLightsNeedsUpdate(m_uniforms, refreshLights);
        }
        // refresh uniforms common to several materials
        if (fog && material.fog === true) {
          materials.refreshFogUniforms(m_uniforms, fog);
        }
        materials.refreshMaterialUniforms(
          m_uniforms,
          material,
          _pixelRatio,
          _height,
          currentRenderState.state.transmissionRenderTarget[camera.id],
        );
        // light probe volume
        if (materialProperties.needsLights && materialProperties.lightProbeGrid) {
          const volume = materialProperties.lightProbeGrid;
          m_uniforms.probesSH.value = volume.texture;
          m_uniforms.probesMin.value.copy(volume.boundingBox.min);
          m_uniforms.probesMax.value.copy(volume.boundingBox.max);
          m_uniforms.probesResolution.value.copy(volume.resolution);
        }
        WebGLUniforms.upload(_gl, getUniformList(materialProperties), m_uniforms, textures);
      }
      if (material.isShaderMaterial && material.uniformsNeedUpdate === true) {
        WebGLUniforms.upload(_gl, getUniformList(materialProperties), m_uniforms, textures);
        material.uniformsNeedUpdate = false;
      }
      if (material.isSpriteMaterial) {
        p_uniforms.setValue(_gl, "center", object.center);
      }
      // common matrices
      p_uniforms.setValue(_gl, "modelViewMatrix", object.modelViewMatrix);
      p_uniforms.setValue(_gl, "normalMatrix", object.normalMatrix);
      p_uniforms.setValue(_gl, "modelMatrix", object.matrixWorld);
      // UBOs
      if (material.uniformsGroups !== undefined) {
        const groups = material.uniformsGroups;
        for (let i = 0, l = groups.length; i < l; i++) {
          const group = groups[i];
          uniformsGroups.update(group, program);
          uniformsGroups.bind(group, program);
        }
      }
      return program;
    }
    // If uniforms are marked as clean, they don't need to be loaded to the GPU.
    function markUniformsLightsNeedsUpdate(uniforms: any, value?: any) {
      uniforms.ambientLightColor.needsUpdate = value;
      uniforms.lightProbe.needsUpdate = value;
      uniforms.sunLights.needsUpdate = value;
      uniforms.sunLightShadows.needsUpdate = value;
      uniforms.directionalLights.needsUpdate = value;
      uniforms.directionalLightShadows.needsUpdate = value;
      uniforms.pointLights.needsUpdate = value;
      uniforms.pointLightShadows.needsUpdate = value;
      uniforms.spotLights.needsUpdate = value;
      uniforms.spotLightShadows.needsUpdate = value;
      uniforms.rectAreaLights.needsUpdate = value;
      uniforms.hemisphereLights.needsUpdate = value;
    }
    function materialNeedsLights(material?: any) {
      return (
        material.isMeshLambertMaterial ||
        material.isMeshToonMaterial ||
        material.isMeshPhongMaterial ||
        material.isMeshStandardMaterial ||
        material.isShadowMaterial ||
        (material.isShaderMaterial && material.lights === true)
      );
    }
    /**
     * Returns the active cube face.
     *
     * @return The active cube face.
     */
    this.getActiveCubeFace = function (): number {
      return _currentActiveCubeFace;
    };
    /**
     * Returns the active mipmap level.
     *
     * @return The active mipmap level.
     */
    this.getActiveMipmapLevel = function (): number {
      return _currentActiveMipmapLevel;
    };
    /**
     * Returns the active render target.
     *
     * @return The active render target. Returns `null` if no render target
     * is currently set.
     */
    this.getRenderTarget = function (): WebGLRenderTarget | null {
      return _currentRenderTarget;
    };
    this.setRenderTargetTextures = function (renderTarget: any, colorTexture: any, depthTexture?: any) {
      const renderTargetProperties = properties.get(renderTarget);
      renderTargetProperties.__autoAllocateDepthBuffer = renderTarget.resolveDepthBuffer === false;
      if (renderTargetProperties.__autoAllocateDepthBuffer === false) {
        // The multisample_render_to_texture extension doesn't work properly if there
        // are midframe flushes and an external depth buffer. Disable use of the extension.
        renderTargetProperties.__useRenderToTexture = false;
      }
      properties.get(renderTarget.texture).__webglTexture = colorTexture;
      properties.get(renderTarget.depthTexture).__webglTexture = renderTargetProperties.__autoAllocateDepthBuffer
        ? undefined
        : depthTexture;
      renderTargetProperties.__hasExternalTextures = true;
    };
    this.setRenderTargetFramebuffer = function (renderTarget: any, defaultFramebuffer?: any) {
      const renderTargetProperties = properties.get(renderTarget);
      renderTargetProperties.__webglFramebuffer = defaultFramebuffer;
      renderTargetProperties.__useDefaultFramebuffer = defaultFramebuffer === undefined;
    };
    /**
     * Sets the active rendertarget.
     *
     * @param renderTarget - The render target to set. When `null` is given,
     * the canvas is set as the active render target instead.
     * @param [activeCubeFace=0] - The active cube face when using a cube render target.
     * Indicates the z layer to render in to when using 3D or array render targets.
     * @param [activeMipmapLevel=0] - The active mipmap level.
     */
    this.setRenderTarget = function (renderTarget?: any, activeCubeFace: number = 0, activeMipmapLevel: number = 0) {
      _currentRenderTarget = renderTarget;
      _currentActiveCubeFace = activeCubeFace;
      _currentActiveMipmapLevel = activeMipmapLevel;
      let framebuffer: any = null;
      let isCube = false;
      let isRenderTarget3D = false;
      if (renderTarget) {
        const renderTargetProperties = properties.get(renderTarget);
        if (renderTargetProperties.__useDefaultFramebuffer !== undefined) {
          // Externally-managed framebuffer
          // Bind to the stored framebuffer (may be null for default, or a WebGLFramebuffer)
          state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
          _currentViewport.copy(renderTarget.viewport);
          _currentScissor.copy(renderTarget.scissor);
          _currentScissorTest = renderTarget.scissorTest;
          state.viewport(_currentViewport);
          state.scissor(_currentScissor);
          state.setScissorTest(_currentScissorTest);
          _currentMaterialId = -1;
          return;
        } else if (renderTargetProperties.__webglFramebuffer === undefined) {
          textures.setupRenderTarget(renderTarget);
        } else if (renderTargetProperties.__hasExternalTextures) {
          // Color and depth texture must be rebound in order for the swapchain to update.
          textures.rebindTextures(
            renderTarget,
            properties.get(renderTarget.texture).__webglTexture,
            properties.get(renderTarget.depthTexture).__webglTexture,
          );
        } else if (renderTarget.depthBuffer) {
          // check if the depth texture is already bound to the frame buffer and that it's been initialized
          const depthTexture = renderTarget.depthTexture;
          if (renderTargetProperties.__boundDepthTexture !== depthTexture) {
            // check if the depth texture is compatible
            if (
              depthTexture !== null &&
              properties.has(depthTexture) &&
              (renderTarget.width !== depthTexture.image.width || renderTarget.height !== depthTexture.image.height)
            ) {
              throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");
            }
            // Swap the depth buffer to the currently attached one
            textures.setupDepthRenderbuffer(renderTarget);
          }
        }
        const texture = renderTarget.texture;
        if (
          (texture as any).isData3DTexture ||
          (texture as any).isDataArrayTexture ||
          (texture as any).isCompressedArrayTexture
        ) {
          isRenderTarget3D = true;
        }
        const __webglFramebuffer = properties.get(renderTarget).__webglFramebuffer;
        if ((renderTarget as any).isWebGLCubeRenderTarget) {
          if (Array.isArray(__webglFramebuffer[activeCubeFace])) {
            framebuffer = __webglFramebuffer[activeCubeFace][activeMipmapLevel];
          } else {
            framebuffer = __webglFramebuffer[activeCubeFace];
          }
          isCube = true;
        } else if (renderTarget.samples > 0 && textures.useMultisampledRTT(renderTarget) === false) {
          framebuffer = properties.get(renderTarget).__webglMultisampledFramebuffer;
        } else {
          if (Array.isArray(__webglFramebuffer)) {
            framebuffer = __webglFramebuffer[activeMipmapLevel];
          } else {
            framebuffer = __webglFramebuffer;
          }
        }
        _currentViewport.copy(renderTarget.viewport);
        _currentScissor.copy(renderTarget.scissor);
        _currentScissorTest = renderTarget.scissorTest;
      } else {
        _currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor();
        _currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor();
        _currentScissorTest = _scissorTest;
      }
      // Use a scratch frame buffer if rendering to a mip level to avoid depth buffers
      // being bound that are different sizes.
      if (activeMipmapLevel !== 0) {
        framebuffer = _scratchFramebuffer;
      }
      const framebufferBound = state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
      if (framebufferBound) {
        state.drawBuffers(renderTarget, framebuffer);
      }
      state.viewport(_currentViewport);
      state.scissor(_currentScissor);
      state.setScissorTest(_currentScissorTest);
      if (isCube) {
        const textureProperties = properties.get(renderTarget.texture);
        _gl!.framebufferTexture2D(
          GL.FRAMEBUFFER,
          GL.COLOR_ATTACHMENT0,
          GL.TEXTURE_CUBE_MAP_POSITIVE_X + activeCubeFace,
          textureProperties.__webglTexture,
          activeMipmapLevel,
        );
      } else if (isRenderTarget3D) {
        const layer = activeCubeFace;
        for (let i = 0; i < renderTarget.textures.length; i++) {
          const textureProperties = properties.get(renderTarget.textures[i]);
          _gl!.framebufferTextureLayer(
            GL.FRAMEBUFFER,
            GL.COLOR_ATTACHMENT0 + i,
            textureProperties.__webglTexture,
            activeMipmapLevel,
            layer,
          );
        }
      } else if (renderTarget !== null && activeMipmapLevel !== 0) {
        // Only bind the frame buffer if we are using a scratch frame buffer to render to a mipmap.
        // If we rebind the texture when using a multi sample buffer then an error about inconsistent samples will be thrown.
        const textureProperties = properties.get(renderTarget.texture);
        _gl!.framebufferTexture2D(
          GL.FRAMEBUFFER,
          GL.COLOR_ATTACHMENT0,
          GL.TEXTURE_2D,
          textureProperties.__webglTexture,
          activeMipmapLevel,
        );
      }
      _currentMaterialId = -1; // reset current material to ensure correct uniform bindings
    };
    function getReadableState(texture?: any) {
      const textureProperties = properties.get(texture);
      if (textureProperties.__readFormat !== texture.format || textureProperties.__readType !== texture.type) {
        textureProperties.__readFormat = texture.format;
        textureProperties.__readType = texture.type;
        textureProperties.__formatReadable = capabilities.textureFormatReadable(texture.format);
        textureProperties.__typeReadable = capabilities.textureTypeReadable(texture.type);
      }
      return textureProperties;
    }
    /**
     * Reads the pixel data from the given render target into the given buffer.
     *
     * @param renderTarget - The render target to read from.
     * @param x - The `x` coordinate of the copy region's origin.
     * @param y - The `y` coordinate of the copy region's origin.
     * @param width - The width of the copy region.
     * @param height - The height of the copy region.
     * @param buffer - The result buffer.
     * @param [activeCubeFaceIndex] - The active cube face index.
     * @param [textureIndex=0] - The texture index of an MRT render target.
     */
    this.readRenderTargetPixels = function (
      renderTarget: WebGLRenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
      buffer?: any,
      activeCubeFaceIndex?: number,
      textureIndex: number = 0,
    ) {
      if (!(renderTarget && renderTarget.isWebGLRenderTarget)) {
        error("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
        return;
      }

      const readTexture = renderTarget.textures[textureIndex];
      if (
        activeCubeFaceIndex !== undefined &&
        (("isDataArrayTexture" in readTexture && readTexture.isDataArrayTexture) ||
          ("isData3DTexture" in readTexture && readTexture.isData3DTexture)) &&
        (!Number.isInteger(activeCubeFaceIndex) || activeCubeFaceIndex < 0 || activeCubeFaceIndex >= renderTarget.depth)
      )
        throw new RangeError("Render target layer is out of range.");
      let framebuffer = properties.get(renderTarget).__webglFramebuffer;
      if ((renderTarget as any).isWebGLCubeRenderTarget && activeCubeFaceIndex !== undefined) {
        framebuffer = framebuffer[activeCubeFaceIndex];
        // Custom mip chains store one framebuffer per level; read level 0.
        if (Array.isArray(framebuffer)) framebuffer = framebuffer[0];
      }
      if (framebuffer) {
        state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
        try {
          const texture = renderTarget.textures[textureIndex];
          if (
            activeCubeFaceIndex !== undefined &&
            (("isDataArrayTexture" in texture && texture.isDataArrayTexture) ||
              ("isData3DTexture" in texture && texture.isData3DTexture))
          ) {
            _gl!.framebufferTextureLayer(
              GL.FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0 + textureIndex,
              properties.get(texture).__webglTexture,
              0,
              activeCubeFaceIndex,
            );
          }

          const textureFormat = texture.format;
          const textureType = texture.type;
          // when using MRT, select the correct color buffer for the subsequent read command
          if (renderTarget.textures.length > 1) _gl!.readBuffer(GL.COLOR_ATTACHMENT0 + textureIndex);
          const readableState = getReadableState(texture);
          if (readableState.__formatReadable === false) {
            error(
              "WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.",
            );
            return;
          }
          if (readableState.__typeReadable === false) {
            error(
              "WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.",
            );
            return;
          }
          // the following if statement ensures valid read requests (no out-of-bounds pixels, see #8604)
          if (x >= 0 && x <= renderTarget.width - width && y >= 0 && y <= renderTarget.height - height) {
            _gl!.readPixels(x, y, width, height, utils.convert(textureFormat), utils.convert(textureType), buffer);
          }
        } finally {
          // restore framebuffer of current render target if necessary

          this.setRenderTarget(_currentRenderTarget, _currentActiveCubeFace, _currentActiveMipmapLevel);
        }
      }
    };
    /**
     * Asynchronous, non-blocking version of {@link WebGLRenderer#readRenderTargetPixels}.
     *
     * It is recommended to use this version of `readRenderTargetPixels()` whenever possible.
     *
     * @async
     * @param renderTarget - The render target to read from.
     * @param x - The `x` coordinate of the copy region's origin.
     * @param y - The `y` coordinate of the copy region's origin.
     * @param width - The width of the copy region.
     * @param height - The height of the copy region.
     * @param buffer - The result buffer.
     * @param [activeCubeFaceIndex] - The active cube face index.
     * @param [textureIndex=0] - The texture index of an MRT render target.
     * @return A Promise that resolves when the read has been finished. The resolve provides the read data as a typed array.
     */
    this.readRenderTargetPixelsAsync = async function (
      renderTarget: WebGLRenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
      buffer?: any,
      activeCubeFaceIndex?: number,
      textureIndex: number = 0,
    ) {
      if (!(renderTarget && renderTarget.isWebGLRenderTarget)) {
        throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
      }

      const readTexture = renderTarget.textures[textureIndex];
      if (
        activeCubeFaceIndex !== undefined &&
        (("isDataArrayTexture" in readTexture && readTexture.isDataArrayTexture) ||
          ("isData3DTexture" in readTexture && readTexture.isData3DTexture)) &&
        (!Number.isInteger(activeCubeFaceIndex) || activeCubeFaceIndex < 0 || activeCubeFaceIndex >= renderTarget.depth)
      )
        throw new RangeError("Render target layer is out of range.");
      let framebuffer = properties.get(renderTarget).__webglFramebuffer;
      if ((renderTarget as any).isWebGLCubeRenderTarget && activeCubeFaceIndex !== undefined) {
        framebuffer = framebuffer[activeCubeFaceIndex];
        // Custom mip chains store one framebuffer per level; read level 0.
        if (Array.isArray(framebuffer)) framebuffer = framebuffer[0];
      }
      if (framebuffer) {
        // the following if statement ensures valid read requests (no out-of-bounds pixels, see #8604)
        if (x >= 0 && x <= renderTarget.width - width && y >= 0 && y <= renderTarget.height - height) {
          // set the active frame buffer to the one we want to read
          state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
          const texture = renderTarget.textures[textureIndex];
          if (
            activeCubeFaceIndex !== undefined &&
            (("isDataArrayTexture" in texture && texture.isDataArrayTexture) ||
              ("isData3DTexture" in texture && texture.isData3DTexture))
          ) {
            _gl!.framebufferTextureLayer(
              GL.FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0 + textureIndex,
              properties.get(texture).__webglTexture,
              0,
              activeCubeFaceIndex,
            );
          }

          const textureFormat = texture.format;
          const textureType = texture.type;
          // when using MRT, select the correct color buffer for the subsequent read command
          if (renderTarget.textures.length > 1) _gl!.readBuffer(GL.COLOR_ATTACHMENT0 + textureIndex);
          const readableState = getReadableState(texture);
          if (readableState.__formatReadable === false) {
            {
              this.setRenderTarget(_currentRenderTarget, _currentActiveCubeFace, _currentActiveMipmapLevel);
              throw new Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.",
              );
            }
          }
          if (readableState.__typeReadable === false) {
            {
              this.setRenderTarget(_currentRenderTarget, _currentActiveCubeFace, _currentActiveMipmapLevel);
              throw new Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.",
              );
            }
          }
          const glBuffer = _gl!.createBuffer();
          _gl!.bindBuffer(GL.PIXEL_PACK_BUFFER, glBuffer);
          _gl!.bufferData(GL.PIXEL_PACK_BUFFER, buffer.byteLength, GL.STREAM_READ);
          _gl!.readPixels(x, y, width, height, utils.convert(textureFormat), utils.convert(textureType), 0);
          _gl!.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
          // reset the frame buffer to the currently set buffer before waiting

          this.setRenderTarget(_currentRenderTarget, _currentActiveCubeFace, _currentActiveMipmapLevel);
          // check if the commands have finished every 8 ms
          const sync = _gl!.fenceSync(GL.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
          _gl!.flush();
          await probeAsync(_gl, sync, 4);
          // read the data and delete the buffer
          _gl!.bindBuffer(GL.PIXEL_PACK_BUFFER, glBuffer);
          _gl!.getBufferSubData(GL.PIXEL_PACK_BUFFER, 0, buffer);
          _gl!.bindBuffer(GL.PIXEL_PACK_BUFFER, null);
          _gl!.deleteBuffer(glBuffer);
          _gl!.deleteSync(sync);
          return buffer;
        } else {
          throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.");
        }
      }
    };
    /**
     * Copies pixels from the current bound framebuffer into the given texture.
     *
     * @param texture - The texture.
     * @param [position=null] - The start position of the copy operation.
     * @param [level=0] - The mip level. The default represents the base mip.
     */
    this.copyFramebufferToTexture = function (texture: FramebufferTexture, position: any = null, level: number = 0) {
      const levelScale = Math.pow(2, -level);
      const width = Math.floor(texture.image.width * levelScale);
      const height = Math.floor(texture.image.height * levelScale);
      const x = position !== null ? position.x : 0;
      const y = position !== null ? position.y : 0;
      textures.setTexture2D(texture, 0);
      _gl!.copyTexSubImage2D(GL.TEXTURE_2D, level, 0, 0, x, y, width, height);
      state.unbindTexture();
    };
    /**
     * Copies data of the given source texture into a destination texture.
     *
     * When using render target textures as `srcTexture` and `dstTexture`, you must make sure both render targets are initialized
     * {@link WebGLRenderer#initRenderTarget}.
     *
     * @param srcTexture - The source texture.
     * @param dstTexture - The destination texture.
     * @param [srcRegion=null] - A bounding box which describes the source region. Can be two or three-dimensional.
     * @param [dstPosition=null] - A vector that represents the origin of the destination region. Can be two or three-dimensional.
     * @param [srcLevel=0] - The source mipmap level to copy.
     * @param [dstLevel=0] - The destination mipmap level.
     */
    this.copyTextureToTexture = function (
      srcTexture: Texture,
      dstTexture: Texture,
      srcRegion: any = null,
      dstPosition: any = null,
      srcLevel: number = 0,
      dstLevel: any = 0,
    ) {
      // gather the necessary dimensions to copy
      let width: any, height: any, depth: any, minX: any, minY: any, minZ: any;
      let dstX: any, dstY: any, dstZ: any;
      const image = (srcTexture as any).isCompressedTexture ? srcTexture.mipmaps[dstLevel] : srcTexture.image;
      if (srcRegion !== null) {
        width = srcRegion.max.x - srcRegion.min.x;
        height = srcRegion.max.y - srcRegion.min.y;
        depth = srcRegion.isBox3 ? srcRegion.max.z - srcRegion.min.z : 1;
        minX = srcRegion.min.x;
        minY = srcRegion.min.y;
        minZ = srcRegion.isBox3 ? srcRegion.min.z : 0;
      } else {
        const levelScale = Math.pow(2, -srcLevel);
        width = Math.floor(image.width * levelScale);
        height = Math.floor(image.height * levelScale);
        if ((srcTexture as any).isDataArrayTexture) {
          depth = image.depth;
        } else if ((srcTexture as any).isData3DTexture) {
          depth = Math.floor(image.depth * levelScale);
        } else {
          depth = 1;
        }
        minX = 0;
        minY = 0;
        minZ = 0;
      }
      if (dstPosition !== null) {
        dstX = dstPosition.x;
        dstY = dstPosition.y;
        dstZ = dstPosition.z;
      } else {
        dstX = 0;
        dstY = 0;
        dstZ = 0;
      }
      // Set up the destination target
      const glFormat = utils.convert(dstTexture.format);
      const glType = utils.convert(dstTexture.type);
      let glTarget: any;
      if ((dstTexture as any).isData3DTexture) {
        textures.setTexture3D(dstTexture, 0);
        glTarget = GL.TEXTURE_3D;
      } else if ((dstTexture as any).isDataArrayTexture || (dstTexture as any).isCompressedArrayTexture) {
        textures.setTexture2DArray(dstTexture, 0);
        glTarget = GL.TEXTURE_2D_ARRAY;
      } else {
        textures.setTexture2D(dstTexture, 0);
        glTarget = GL.TEXTURE_2D;
      }
      state.activeTexture(GL.TEXTURE0); // see #33153
      state.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, dstTexture.flipY);
      state.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, dstTexture.premultiplyAlpha);
      state.pixelStorei(GL.UNPACK_ALIGNMENT, dstTexture.unpackAlignment);
      // used for copying data from cpu
      const currentUnpackRowLen = state.getParameter(GL.UNPACK_ROW_LENGTH);
      const currentUnpackImageHeight = state.getParameter(GL.UNPACK_IMAGE_HEIGHT);
      const currentUnpackSkipPixels = state.getParameter(GL.UNPACK_SKIP_PIXELS);
      const currentUnpackSkipRows = state.getParameter(GL.UNPACK_SKIP_ROWS);
      const currentUnpackSkipImages = state.getParameter(GL.UNPACK_SKIP_IMAGES);
      state.pixelStorei(GL.UNPACK_ROW_LENGTH, image.width);
      state.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, image.height);
      state.pixelStorei(GL.UNPACK_SKIP_PIXELS, minX);
      state.pixelStorei(GL.UNPACK_SKIP_ROWS, minY);
      state.pixelStorei(GL.UNPACK_SKIP_IMAGES, minZ);
      // set up the src texture
      const isSrc3D = (srcTexture as any).isDataArrayTexture || (srcTexture as any).isData3DTexture;
      const isDst3D = (dstTexture as any).isDataArrayTexture || (dstTexture as any).isData3DTexture;
      if ((srcTexture as any).isDepthTexture) {
        const srcTextureProperties = properties.get(srcTexture);
        const dstTextureProperties = properties.get(dstTexture);
        const srcRenderTargetProperties = properties.get(srcTextureProperties.__renderTarget);
        const dstRenderTargetProperties = properties.get(dstTextureProperties.__renderTarget);
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, srcRenderTargetProperties.__webglFramebuffer);
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, dstRenderTargetProperties.__webglFramebuffer);
        for (let i = 0; i < depth; i++) {
          // if the source or destination are a 3d target then a layer needs to be bound
          if (isSrc3D) {
            _gl!.framebufferTextureLayer(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              properties.get(srcTexture).__webglTexture,
              srcLevel,
              minZ + i,
            );
            _gl!.framebufferTextureLayer(
              GL.DRAW_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              properties.get(dstTexture).__webglTexture,
              dstLevel,
              dstZ + i,
            );
          }
          _gl!.blitFramebuffer(
            minX,
            minY,
            minX + width,
            minY + height,
            dstX,
            dstY,
            dstX + width,
            dstY + height,
            GL.DEPTH_BUFFER_BIT,
            GL.NEAREST,
          );
        }
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
      } else if (srcLevel !== 0 || srcTexture.isRenderTargetTexture || properties.has(srcTexture)) {
        // get the appropriate frame buffers
        const srcTextureProperties = properties.get(srcTexture);
        const dstTextureProperties = properties.get(dstTexture);
        // bind the frame buffer targets
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, _srcFramebuffer);
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, _dstFramebuffer);
        for (let i = 0; i < depth; i++) {
          // assign the correct layers and mip maps to the frame buffers
          if (isSrc3D) {
            _gl!.framebufferTextureLayer(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              srcTextureProperties.__webglTexture,
              srcLevel,
              minZ + i,
            );
          } else {
            _gl!.framebufferTexture2D(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              GL.TEXTURE_2D,
              srcTextureProperties.__webglTexture,
              srcLevel,
            );
          }
          if (isDst3D) {
            _gl!.framebufferTextureLayer(
              GL.DRAW_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              dstTextureProperties.__webglTexture,
              dstLevel,
              dstZ + i,
            );
          } else {
            _gl!.framebufferTexture2D(
              GL.DRAW_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              GL.TEXTURE_2D,
              dstTextureProperties.__webglTexture,
              dstLevel,
            );
          }
          // copy the data using the fastest function that can achieve the copy
          if (srcLevel !== 0) {
            _gl!.blitFramebuffer(
              minX,
              minY,
              minX + width,
              minY + height,
              dstX,
              dstY,
              dstX + width,
              dstY + height,
              GL.COLOR_BUFFER_BIT,
              GL.NEAREST,
            );
          } else if (isDst3D) {
            _gl!.copyTexSubImage3D(glTarget, dstLevel, dstX, dstY, dstZ + i, minX, minY, width, height);
          } else {
            _gl!.copyTexSubImage2D(glTarget, dstLevel, dstX, dstY, minX, minY, width, height);
          }
        }
        // unbind read, draw buffers
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
      } else {
        if (isDst3D) {
          // copy data into the 3d texture
          if ((srcTexture as any).isDataTexture || (srcTexture as any).isData3DTexture) {
            _gl!.texSubImage3D(
              glTarget,
              dstLevel,
              dstX,
              dstY,
              dstZ,
              width,
              height,
              depth,
              glFormat,
              glType,
              image.data,
            );
          } else if ((dstTexture as any).isCompressedArrayTexture) {
            _gl!.compressedTexSubImage3D(
              glTarget,
              dstLevel,
              dstX,
              dstY,
              dstZ,
              width,
              height,
              depth,
              glFormat,
              image.data,
            );
          } else {
            _gl!.texSubImage3D(glTarget, dstLevel, dstX, dstY, dstZ, width, height, depth, glFormat, glType, image);
          }
        } else {
          // copy data into the 2d texture
          if ((srcTexture as any).isDataTexture) {
            _gl!.texSubImage2D(GL.TEXTURE_2D, dstLevel, dstX, dstY, width, height, glFormat, glType, image.data);
          } else if ((srcTexture as any).isCompressedTexture) {
            _gl!.compressedTexSubImage2D(
              GL.TEXTURE_2D,
              dstLevel,
              dstX,
              dstY,
              image.width,
              image.height,
              glFormat,
              image.data,
            );
          } else {
            _gl!.texSubImage2D(GL.TEXTURE_2D, dstLevel, dstX, dstY, width, height, glFormat, glType, image);
          }
        }
      }
      // reset values
      state.pixelStorei(GL.UNPACK_ROW_LENGTH, currentUnpackRowLen);
      state.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, currentUnpackImageHeight);
      state.pixelStorei(GL.UNPACK_SKIP_PIXELS, currentUnpackSkipPixels);
      state.pixelStorei(GL.UNPACK_SKIP_ROWS, currentUnpackSkipRows);
      state.pixelStorei(GL.UNPACK_SKIP_IMAGES, currentUnpackSkipImages);
      // Generate mipmaps only when copying level 0
      if (dstLevel === 0 && dstTexture.generateMipmaps === true && dstTexture.mipmapsAutoUpdate === true) {
        _gl!.generateMipmap(glTarget);
      }
      state.unbindTexture();
    };
    /**
     * Initializes the given WebGLRenderTarget memory. Useful for initializing a render target so data
     * can be copied into it using {@link WebGLRenderer#copyTextureToTexture} before it has been
     * rendered to.
     *
     * @param target - The render target.
     */
    this.initRenderTarget = function (target: WebGLRenderTarget) {
      if (properties.get(target).__webglFramebuffer === undefined) {
        textures.setupRenderTarget(target);
      }
    };
    /**
     * Initializes the given texture. Useful for preloading a texture rather than waiting until first
     * render (which can cause noticeable lags due to decode and GPU upload overhead).
     *
     * @param texture - The texture.
     */
    this.initTexture = function (texture: Texture) {
      if ((texture as any).isCubeTexture) {
        textures.setTextureCube(texture, 0);
      } else if ((texture as any).isData3DTexture) {
        textures.setTexture3D(texture, 0);
      } else if ((texture as any).isDataArrayTexture || (texture as any).isCompressedArrayTexture) {
        textures.setTexture2DArray(texture, 0);
      } else {
        textures.setTexture2D(texture, 0);
      }
      state.unbindTexture();
    };
    /**
     * Can be used to reset the internal WebGL state. This method is mostly
     * relevant for applications which share a single WebGL context across
     * multiple WebGL libraries.
     */
    this.resetState = function () {
      _currentActiveCubeFace = 0;
      _currentActiveMipmapLevel = 0;
      _currentRenderTarget = null;
      state.reset();
      bindingStates.reset();
    };
  }
  /**
   * Defines the coordinate system of the renderer.
   *
   * In `WebGLRenderer`, the value is always `WebGLCoordinateSystem`.
   *
   * @default WebGLCoordinateSystem
   * @readonly
   */
  get coordinateSystem() {
    return CoordinateSystem.WebGL;
  }
  /**
   * Defines the output color space of the renderer.
   *
   * @default SRGBColorSpace
   */
  get outputColorSpace() {
    return this._outputColorSpace;
  }
  set outputColorSpace(colorSpace: any) {
    this._outputColorSpace = colorSpace;
    const gl = this.getContext();
    gl.drawingBufferColorSpace = ColorManagement._getDrawingBufferColorSpace(colorSpace);
    gl.unpackColorSpace = ColorManagement._getUnpackColorSpace();
  }
}
