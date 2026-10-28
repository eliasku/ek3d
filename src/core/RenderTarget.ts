import type { DepthTexture } from "../textures/DepthTexture";
import { EventDispatcher } from "./EventDispatcher";
import { Texture } from "../textures/Texture";
import { TextureFilter, Wrapping, Mapping } from "../constants";
import { Vector4 } from "../math/Vector4";
import { TextureSource } from "../textures/TextureSource";

/**
 * Render target options.
 * - `generateMipmaps=false`: Whether to generate mipmaps or not.
 * - `mipmapsAutoUpdate=true`: Whether to regenerate mipmaps automatically after rendering or not.
 * - `magFilter=TextureFilter.Linear`: The mag filter.
 * - `minFilter=TextureFilter.Linear`: The min filter.
 * - `format=PixelFormat.RGBA`: The texture format.
 * - `type=TextureType.UnsignedByte`: The texture type.
 * - `internalFormat=null`: The texture's internal format.
 * - `wrapS=Wrapping.ClampToEdge`: The texture's uv wrapping mode.
 * - `wrapT=Wrapping.ClampToEdge`: The texture's uv wrapping mode.
 * - `anisotropy=1`: The texture's anisotropy value.
 * - `colorSpace=ColorSpace.No`: The texture's color space.
 * - `depthBuffer=true`: Whether to allocate a depth buffer or not.
 * - `stencilBuffer=false`: Whether to allocate a stencil buffer or not.
 * - `resolveColorBuffer=true`: Whether to resolve the color buffer or not. Only relevant for multisampled render targets.
 * - `resolveDepthBuffer=true`: Whether to resolve the depth buffer or not. Only relevant for multisampled render targets.
 * - `resolveStencilBuffer=true`: Whether to resolve the stencil buffer or not. Only relevant for multisampled render targets.
 * - `storeMultisampledColorBuffer=true`: Whether to store the multisampled color buffer or not. Setting to `false` saves memory bandwidth when the multisampled data are not needed after a render pass.
 * - `storeMultisampledDepthBuffer=true`: Whether to store the multisampled depth buffer or not. Setting to `false` saves memory bandwidth when the multisampled data are not needed after a render pass.
 * - `storeMultisampledStencilBuffer=true`: Whether to store the multisampled stencil buffer or not. Setting to `false` saves memory bandwidth when the multisampled data are not needed after a render pass.
 * - `depthTexture=null`: Reference to a depth texture.
 * - `samples=0`: The MSAA samples count.
 * - `count=1`: Defines the number of color attachments.
 * - `depth=1`: The texture depth.
 * - `multiview=false`: Whether this target is used for multiview rendering (WebGL OVR_multiview2 extension).
 * - `useArrayDepthTexture=false`: Whether to create the depth texture as an array texture for per-layer depth testing. This is separate from multiview so layered render targets can use array depth without the multiview extension.
 */
export type RenderTargetOptions = { wrapR?: Wrapping; mapping?: Mapping; flipY?: boolean } & Pick<
  Partial<Texture>,
  | "generateMipmaps"
  | "mipmapsAutoUpdate"
  | "magFilter"
  | "minFilter"
  | "format"
  | "type"
  | "internalFormat"
  | "wrapS"
  | "wrapT"
  | "anisotropy"
  | "colorSpace"
> & {
    depthBuffer?: boolean;
    stencilBuffer?: boolean;
    resolveColorBuffer?: boolean;
    resolveDepthBuffer?: boolean;
    resolveStencilBuffer?: boolean;
    storeMultisampledColorBuffer?: boolean;
    storeMultisampledDepthBuffer?: boolean;
    storeMultisampledStencilBuffer?: boolean;
    depthTexture?: DepthTexture | null;
    samples?: number;
    count?: number;
    depth?: number;
    multiview?: boolean;
    useArrayDepthTexture?: boolean;
  };
/**
 * A render target is a buffer where the video card draws pixels for a scene
 * that is being rendered in the background. It is used in different effects,
 * such as applying postprocessing to a rendered image before displaying it
 * on the screen.
 *
 */
export class RenderTarget extends EventDispatcher {
  isRenderTarget: boolean;
  width: number;
  height: number;
  depth: number;
  scissor: Vector4;
  scissorTest: boolean;
  viewport: Vector4;
  textures: Texture[];
  depthBuffer: boolean;
  stencilBuffer: boolean;
  resolveColorBuffer: boolean;
  resolveDepthBuffer: boolean;
  resolveStencilBuffer: boolean;
  storeMultisampledColorBuffer: boolean;
  storeMultisampledDepthBuffer: boolean;
  storeMultisampledStencilBuffer: boolean;
  _depthTexture: DepthTexture | null;
  samples: number;
  multiview: boolean;
  useArrayDepthTexture: boolean;

  /**
   * Constructs a new render target.
   *
   * @param [width=1] - The width of the render target.
   * @param [height=1] - The height of the render target.
   * @param [options] - The configuration object.
   */
  constructor(width: number = 1, height: number = 1, options: RenderTargetOptions = {}) {
    super();
    options = Object.assign(
      {
        generateMipmaps: false,
        internalFormat: null,
        minFilter: TextureFilter.Linear,
        depthBuffer: true,
        stencilBuffer: false,
        resolveColorBuffer: true,
        resolveDepthBuffer: true,
        resolveStencilBuffer: true,
        storeMultisampledColorBuffer: true,
        storeMultisampledDepthBuffer: true,
        storeMultisampledStencilBuffer: true,
        depthTexture: null,
        samples: 0,
        count: 1,
        depth: 1,
        multiview: false,
        useArrayDepthTexture: false,
      },
      options,
    );
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isRenderTarget = true;
    /**
     * The width of the render target.
     *
     * @default 1
     */
    this.width = width;
    /**
     * The height of the render target.
     *
     * @default 1
     */
    this.height = height;
    /**
     * The depth of the render target.
     *
     * @default 1
     */
    this.depth = (options as any).depth;
    /**
     * A rectangular area inside the render target's viewport. Fragments that are
     * outside the area will be discarded.
     *
     * @default (0,0,width,height)
     */
    this.scissor = new Vector4(0, 0, width, height);
    /**
     * Indicates whether the scissor test should be enabled when rendering into
     * this render target or not.
     *
     * @default false
     */
    this.scissorTest = false;
    /**
     * A rectangular area representing the render target's viewport.
     *
     * @default (0,0,width,height)
     */
    this.viewport = new Vector4(0, 0, width, height);
    /**
     * An array of textures. Each color attachment is represented as a separate texture.
     * Has at least a single entry for the default color attachment.
     *
     */
    this.textures = [];
    const count = (options as any).count;
    for (let i = 0; i < count; i++) {
      this.textures[i] = new Texture({ width: width, height: height, depth: this.depth });
      this.textures[i].isRenderTargetTexture = true;
      this.textures[i].renderTarget = this;
    }
    this._setTextureOptions(options);
    /**
     * Whether to allocate a depth buffer or not.
     *
     * @default true
     */
    this.depthBuffer = (options as any).depthBuffer;
    /**
     * Whether to allocate a stencil buffer or not.
     *
     * @default false
     */
    this.stencilBuffer = (options as any).stencilBuffer;
    /**
     * Whether to resolve the color buffer or not. When set to `false`, the color
     * attachments do not receive the resolved (single-sampled) output of a render
     * pass and the render target's textures are left untouched. The rendered
     * content is then only accessible within the render pass itself.
     *
     * Only relevant for multisampled render targets.
     *
     * @default true
     */
    this.resolveColorBuffer = (options as any).resolveColorBuffer;
    /**
     * Whether to resolve the depth buffer or not. When set to `false`, the depth
     * texture does not receive the resolved depth output of a render pass which
     * saves memory bandwidth. Use this setting when the depth data of a render
     * pass are not required afterwards.
     *
     * Only relevant for multisampled render targets.
     *
     * @default true
     */
    this.resolveDepthBuffer = (options as any).resolveDepthBuffer;
    /**
     * Whether to resolve the stencil buffer or not. Analogous to
     * {@link RenderTarget#resolveDepthBuffer} but for the stencil aspect.
     *
     * @default true
     */
    this.resolveStencilBuffer = (options as any).resolveStencilBuffer;
    /**
     * Whether to store the multisampled color buffer or not. When set to `false`,
     * the multisampled data are discarded at the end of a render pass, right after
     * they have been resolved. This saves memory bandwidth, especially on tile-based
     * GPUs, and is the recommended setting for render targets that are fully redrawn
     * each frame and whose output is only accessed via the resolved textures (e.g.
     * scene passes in post-processing chains).
     *
     * Must be kept `true` when the multisampled data are needed after the render
     * pass ends, e.g. when rendering into the target without clearing or when the
     * scene contains transmissive objects which require a mid-pass framebuffer copy.
     *
     * @default true
     */
    this.storeMultisampledColorBuffer = (options as any).storeMultisampledColorBuffer;
    /**
     * Whether to store the multisampled depth buffer or not. When set to `false`,
     * the multisampled depth data are discarded at the end of a render pass which
     * saves memory bandwidth.
     *
     * @default true
     */
    this.storeMultisampledDepthBuffer = (options as any).storeMultisampledDepthBuffer;
    /**
     * Whether to store the multisampled stencil buffer or not. Analogous to
     * {@link RenderTarget#storeMultisampledDepthBuffer} but for the stencil aspect.
     *
     * @default true
     */
    this.storeMultisampledStencilBuffer = (options as any).storeMultisampledStencilBuffer;
    this._depthTexture = null;
    this.depthTexture = (options as any).depthTexture;
    /**
     * The number of MSAA samples.
     *
     * A value of `0` disables MSAA.
     *
     * @default 0
     */
    this.samples = (options as any).samples;
    /**
     * Whether to this target is used in multiview rendering.
     *
     * @default false
     */
    this.multiview = (options as any).multiview;
    /**
     * Whether to create the depth texture as an array texture for per-layer depth testing.
     * This is separate from multiview so layered render targets can use array depth without
     * the multiview extension.
     *
     * @default false
     */
    this.useArrayDepthTexture = (options as any).useArrayDepthTexture;
  }
  _setTextureOptions(options: any = {}) {
    const values: any = {
      minFilter: TextureFilter.Linear,
      generateMipmaps: false,
      flipY: false,
      internalFormat: null,
    };
    if ((options as any).mapping !== undefined) (values as any).mapping = (options as any).mapping;
    if ((options as any).wrapS !== undefined) (values as any).wrapS = (options as any).wrapS;
    if ((options as any).wrapT !== undefined) (values as any).wrapT = (options as any).wrapT;
    if ((options as any).wrapR !== undefined) (values as any).wrapR = (options as any).wrapR;
    if ((options as any).magFilter !== undefined) (values as any).magFilter = (options as any).magFilter;
    if ((options as any).minFilter !== undefined) values.minFilter = (options as any).minFilter;
    if ((options as any).format !== undefined) (values as any).format = (options as any).format;
    if ((options as any).type !== undefined) (values as any).type = (options as any).type;
    if ((options as any).anisotropy !== undefined) (values as any).anisotropy = (options as any).anisotropy;
    if ((options as any).colorSpace !== undefined) (values as any).colorSpace = (options as any).colorSpace;
    if ((options as any).flipY !== undefined) values.flipY = (options as any).flipY;
    if ((options as any).generateMipmaps !== undefined) values.generateMipmaps = (options as any).generateMipmaps;
    if ((options as any).mipmapsAutoUpdate !== undefined)
      (values as any).mipmapsAutoUpdate = (options as any).mipmapsAutoUpdate;
    if ((options as any).internalFormat !== undefined) values.internalFormat = (options as any).internalFormat;
    for (let i = 0; i < this.textures.length; i++) {
      const texture = this.textures[i];
      texture.setValues(values);
    }
  }
  /**
   * The texture representing the default color attachment.
   *
   */
  get texture(): Texture {
    return this.textures[0];
  }
  set texture(value: Texture) {
    this.textures[0] = value;
  }
  set depthTexture(current: DepthTexture | null) {
    if (this._depthTexture !== null && this._depthTexture.renderTarget === this) this._depthTexture.renderTarget = null;
    if (current !== null && current.renderTarget === null) current.renderTarget = this;
    this._depthTexture = current;
  }
  /**
   * Instead of saving the depth in a renderbuffer, a texture
   * can be used instead which is useful for further processing
   * e.g. in context of post-processing.
   *
   * @default null
   */
  get depthTexture() {
    return this._depthTexture;
  }
  /**
   * Sets the size of this render target.
   *
   * @param width - The width.
   * @param height - The height.
   * @param [depth=1] - The depth.
   */
  setSize(width: number, height: number, depth: number = 1) {
    if (this.width !== width || this.height !== height || this.depth !== depth) {
      this.width = width;
      this.height = height;
      this.depth = depth;
      for (let i = 0, il = this.textures.length; i < il; i++) {
        this.textures[i].image.width = width;
        this.textures[i].image.height = height;
        this.textures[i].image.depth = depth;
        if ((this.textures[i] as any).isData3DTexture !== true) {
          // Fix for #31693
          // TODO: Reconsider setting isArrayTexture flag here and in the ctor of Texture.
          // Maybe a method `isArrayTexture()` or just a getter could replace a flag since
          // both are evaluated on each call?
          this.textures[i].isArrayTexture = this.textures[i].image.depth > 1;
        }
      }
      this.dispose();
    }
    this.viewport.set(0, 0, width, height);
    this.scissor.set(0, 0, width, height);
  }
  /**
   * Returns a new render target with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the settings of the given render target. This is a structural copy so
   * no resources are shared between render targets after the copy. That includes
   * all MRT textures and the depth texture.
   *
   * @param source - The render target to copy.
   * @return A reference to this instance.
   */
  copy(source: RenderTarget): this {
    this.width = source.width;
    this.height = source.height;
    this.depth = source.depth;
    this.scissor.copy(source.scissor);
    this.scissorTest = source.scissorTest;
    this.viewport.copy(source.viewport);
    this.textures.length = 0;
    for (let i = 0, il = source.textures.length; i < il; i++) {
      this.textures[i] = source.textures[i].clone();
      this.textures[i].isRenderTargetTexture = true;
      this.textures[i].renderTarget = this;
      // ensure image object is not shared, see #20328
      const image = Object.assign({}, source.textures[i].image);
      this.textures[i].source = new TextureSource(image);
    }
    this.depthBuffer = source.depthBuffer;
    this.stencilBuffer = source.stencilBuffer;
    this.resolveColorBuffer = source.resolveColorBuffer;
    this.resolveDepthBuffer = source.resolveDepthBuffer;
    this.resolveStencilBuffer = source.resolveStencilBuffer;
    this.storeMultisampledColorBuffer = source.storeMultisampledColorBuffer;
    this.storeMultisampledDepthBuffer = source.storeMultisampledDepthBuffer;
    this.storeMultisampledStencilBuffer = source.storeMultisampledStencilBuffer;
    if (source.depthTexture !== null) {
      if (source.depthTexture.renderTarget === source) {
        const depthTexture = source.depthTexture.clone();
        depthTexture.renderTarget = null;
        this.depthTexture = depthTexture;
      } else {
        this.depthTexture = source.depthTexture;
      }
    } else {
      this.depthTexture = null;
    }
    this.samples = source.samples;
    this.multiview = source.multiview;
    this.useArrayDepthTexture = source.useArrayDepthTexture;
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * This also frees the resources of the render target's textures. There is
   * no need to dispose them separately.
   *
   * @fires RenderTarget#dispose
   */
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
