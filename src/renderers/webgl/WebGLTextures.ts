import { GL } from "../../GL";
import { TextureFilter, PixelFormat, TextureType, Wrapping, ColorSpace, Compare, Transfer } from "../../constants";
import { createElementNS, warn, error } from "../../utils";
import { ColorManagement } from "../../math/ColorManagement";
import { Vector2 } from "../../math/Vector2";
import { getByteLength } from "../../extras/TextureUtils";
import type { RenderTarget } from "../../core/RenderTarget";
import type { Texture } from "../../textures/Texture";
import type { TextureSource } from "../../textures/TextureSource";
import type { VideoTexture } from "../../textures/VideoTexture";
import type { HTMLTexture } from "../../textures/HTMLTexture";
import type { ExternalTexture } from "../../textures/ExternalTexture";
import type { DepthTexture } from "../../textures/DepthTexture";
import type { CubeDepthTexture } from "../../textures/CubeDepthTexture";
import type { DataTexture, DataTextureImage } from "../../textures/DataTexture";
import type { DataArrayTexture } from "../../textures/DataArrayTexture";
import type { Data3DTexture } from "../../textures/Data3DTexture";
import type { CompressedTexture } from "../../textures/CompressedTexture";
import type { CompressedArrayTexture } from "../../textures/CompressedArrayTexture";
import type { FramebufferTexture } from "../../textures/FramebufferTexture";
import type { WebGLExtensions, WebGLMultisampledRenderToTexture } from "./WebGLExtensions";
import type { WebGLState } from "./WebGLState";
import type { WebGLProperties } from "./WebGLProperties";
import type { WebGLCapabilitiesState } from "./WebGLCapabilities";
import type { WebGLUtils } from "./WebGLUtils";
import type { WebGLInfoState } from "./WebGLInfo";

type TextureRenderTarget = RenderTarget & {
  isWebGLCubeRenderTarget?: boolean;
  isWebGL3DRenderTarget?: boolean;
  isWebGLArrayRenderTarget?: boolean;
};

interface TextureProperties {
  __webglInit?: boolean;
  __cacheKey?: string;
  __webglTexture?: WebGLTexture | null;
  __version?: number;
}

interface HTMLTexturePaintEvent {
  changedElements: Element[];
}

interface HTMLTextureContext extends WebGL2RenderingContext {
  canvas: HTMLCanvasElement & {
    onpaint: ((event: HTMLTexturePaintEvent) => void) | null;
    requestPaint(): void;
  };
  texElementImage2D(target: number, internalFormat: number, element: HTMLElement): void;
  texElementImage2D(
    target: number,
    level: number,
    internalFormat: number,
    format: number,
    type: number,
    element: HTMLElement,
  ): void;
}

export class WebGLTextures {
  private multisampledRTTExt: WebGLMultisampledRenderToTexture | null;
  private supportsInvalidateFramebuffer: boolean;
  private _imageDimensions: Vector2;
  private _videoTextures: WeakMap<Texture, number>;
  private _htmlTextures: Set<HTMLTexture>;
  private _canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
  private _sources: WeakMap<TextureSource, Record<string, { texture: WebGLTexture | null; usedTimes: number }>>;
  private _tracked: Set<WeakRef<Texture | TextureRenderTarget>>;
  private _registry: FinalizationRegistry<WeakRef<Texture | TextureRenderTarget>>;
  private useOffscreenCanvas: boolean;
  private textureUnits: number;
  private wrappingToGL: Record<Wrapping, number>;
  private filterToGL: Record<TextureFilter, number>;
  private compareToGL: Record<Compare, number>;
  private invalidationArrayRead: number[];

  constructor(
    private _gl: WebGL2RenderingContext,
    private extensions: WebGLExtensions,
    private state: WebGLState,
    private properties: WebGLProperties,
    private capabilities: WebGLCapabilitiesState,
    private utils: WebGLUtils,
    private info: WebGLInfoState,
  ) {
    this.multisampledRTTExt = extensions.has("WEBGL_multisampled_render_to_texture")
      ? extensions.get("WEBGL_multisampled_render_to_texture")
      : null;
    this.supportsInvalidateFramebuffer =
      typeof navigator === "undefined" ? false : /OculusBrowser/g.test(navigator.userAgent);
    this._imageDimensions = new Vector2();
    this._videoTextures = new WeakMap();
    this._htmlTextures = new Set();
    this._canvas = undefined;
    this._sources = new WeakMap(); // maps WebglTexture objects to instances of TextureSource
    this._tracked = new Set();
    // The registry callback must retain only the tracked set, not this texture manager.
    this._registry = new FinalizationRegistry(this._tracked.delete.bind(this._tracked));
    // cordova iOS (as of 5.0) still uses UIWebView, which provides OffscreenCanvas,
    // also OffscreenCanvas.getContext("webgl"), but not OffscreenCanvas.getContext("2d")!
    // Some implementations may only implement OffscreenCanvas partially (e.g. lacking 2d).
    this.useOffscreenCanvas = false;
    try {
      this.useOffscreenCanvas =
        typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
    } catch {
      // Ignore any errors
    }
    this.textureUnits = 0;
    this.wrappingToGL = {
      [Wrapping.Repeat]: GL.REPEAT,
      [Wrapping.ClampToEdge]: GL.CLAMP_TO_EDGE,
      [Wrapping.MirroredRepeat]: GL.MIRRORED_REPEAT,
    };
    this.filterToGL = {
      [TextureFilter.Nearest]: GL.NEAREST,
      [TextureFilter.NearestMipmapNearest]: GL.NEAREST_MIPMAP_NEAREST,
      [TextureFilter.NearestMipmapLinear]: GL.NEAREST_MIPMAP_LINEAR,
      [TextureFilter.Linear]: GL.LINEAR,
      [TextureFilter.LinearMipmapNearest]: GL.LINEAR_MIPMAP_NEAREST,
      [TextureFilter.LinearMipmapLinear]: GL.LINEAR_MIPMAP_LINEAR,
    };
    this.compareToGL = {
      [Compare.Never]: GL.NEVER,
      [Compare.Always]: GL.ALWAYS,
      [Compare.Less]: GL.LESS,
      [Compare.LessEqual]: GL.LEQUAL,
      [Compare.Equal]: GL.EQUAL,
      [Compare.GreaterEqual]: GL.GEQUAL,
      [Compare.Greater]: GL.GREATER,
      [Compare.NotEqual]: GL.NOTEQUAL,
    };
    this.invalidationArrayRead = [];
    this.onTextureDispose = this.onTextureDispose.bind(this);
    this.onRenderTargetDispose = this.onRenderTargetDispose.bind(this);
    this.allocateTextureUnit = this.allocateTextureUnit.bind(this);
    this.resetTextureUnits = this.resetTextureUnits.bind(this);
    this.getTextureUnits = this.getTextureUnits.bind(this);
    this.setTextureUnits = this.setTextureUnits.bind(this);
    this.setTexture2D = this.setTexture2D.bind(this);
    this.setTexture2DArray = this.setTexture2DArray.bind(this);
    this.setTexture3D = this.setTexture3D.bind(this);
    this.setTextureCube = this.setTextureCube.bind(this);
    this.rebindTextures = this.rebindTextures.bind(this);
    this.setupRenderTarget = this.setupRenderTarget.bind(this);
    this.updateRenderTargetMipmap = this.updateRenderTargetMipmap.bind(this);
    this.updateMultisampleRenderTarget = this.updateMultisampleRenderTarget.bind(this);
    this.setupDepthRenderbuffer = this.setupDepthRenderbuffer.bind(this);
    this.setupFrameBufferTexture = this.setupFrameBufferTexture.bind(this);
    this.useMultisampledRTT = this.useMultisampledRTT.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  private createCanvas(width: number, height: number) {
    // Use OffscreenCanvas when available. Specially needed in web workers
    return this.useOffscreenCanvas
      ? new OffscreenCanvas(width, height)
      : (createElementNS("canvas") as HTMLCanvasElement);
  }

  private resizeImage(image: Texture["image"], needsNewCanvas: boolean, maxSize: number) {
    let scale = 1;
    const dimensions = this.getDimensions(image);
    // handle case if texture exceeds max size
    if (dimensions.width > maxSize || dimensions.height > maxSize) {
      scale = maxSize / Math.max(dimensions.width, dimensions.height);
    }
    // only perform resize if necessary
    if (scale < 1) {
      // only perform resize for certain image types
      if (
        (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) ||
        (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) ||
        (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) ||
        (typeof VideoFrame !== "undefined" && image instanceof VideoFrame)
      ) {
        const width = Math.floor(scale * dimensions.width);
        const height = Math.floor(scale * dimensions.height);
        if (this._canvas === undefined) this._canvas = this.createCanvas(width, height);
        // cube textures can't reuse the same canvas
        const canvas = needsNewCanvas ? this.createCanvas(width, height) : this._canvas;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        context!.drawImage(image, 0, 0, width, height);
        warn(
          "WebGLRenderer: Texture has been resized from (" +
            dimensions.width +
            "x" +
            dimensions.height +
            ") to (" +
            width +
            "x" +
            height +
            ").",
        );
        return canvas;
      } else {
        if ("data" in image) {
          warn("WebGLRenderer: Image in DataTexture is too big (" + dimensions.width + "x" + dimensions.height + ").");
        }
        return image;
      }
    }
    return image;
  }

  private textureNeedsGenerateMipmaps(texture: Texture) {
    return texture.generateMipmaps;
  }

  private generateMipmap(target: number) {
    this._gl.generateMipmap(target);
  }

  private getTargetType(texture: TextureRenderTarget & { isCompressedArrayTexture?: boolean }) {
    if (texture.isWebGLCubeRenderTarget) return GL.TEXTURE_CUBE_MAP;
    if (texture.isWebGL3DRenderTarget) return GL.TEXTURE_3D;
    if (texture.isWebGLArrayRenderTarget || texture.isCompressedArrayTexture) return GL.TEXTURE_2D_ARRAY;
    return GL.TEXTURE_2D;
  }

  private getInternalFormat(
    internalFormatName: string | null,
    glFormat: number | null,
    glType: number | null,
    normalized: boolean,
    colorSpace: string,
    forceLinearTransfer: boolean = false,
  ) {
    if (internalFormatName !== null) {
      if (this._gl[internalFormatName as keyof WebGL2RenderingContext] !== undefined)
        return this._gl[internalFormatName as keyof WebGL2RenderingContext] as number;
      warn("WebGLRenderer: Attempt to use non-existing WebGL internal format '" + internalFormatName + "'");
    }
    let ext_texture_norm16: EXT_texture_norm16 | null | undefined;
    if (normalized) {
      ext_texture_norm16 = this.extensions.get("EXT_texture_norm16");
      if (!ext_texture_norm16) {
        warn("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension");
      }
    }
    let internalFormat = glFormat;
    if (glFormat === GL.RED) {
      if (glType === GL.FLOAT) internalFormat = GL.R32F;
      if (glType === GL.HALF_FLOAT) internalFormat = GL.R16F;
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.R8;
      if (glType === GL.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.R16_EXT;
      if (glType === GL.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.R16_SNORM_EXT;
    }
    if (glFormat === GL.RED_INTEGER) {
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.R8UI;
      if (glType === GL.UNSIGNED_SHORT) internalFormat = GL.R16UI;
      if (glType === GL.UNSIGNED_INT) internalFormat = GL.R32UI;
      if (glType === GL.BYTE) internalFormat = GL.R8I;
      if (glType === GL.SHORT) internalFormat = GL.R16I;
      if (glType === GL.INT) internalFormat = GL.R32I;
    }
    if (glFormat === GL.RG) {
      if (glType === GL.FLOAT) internalFormat = GL.RG32F;
      if (glType === GL.HALF_FLOAT) internalFormat = GL.RG16F;
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.RG8;
      if (glType === GL.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RG16_EXT;
      if (glType === GL.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RG16_SNORM_EXT;
    }
    if (glFormat === GL.RG_INTEGER) {
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.RG8UI;
      if (glType === GL.UNSIGNED_SHORT) internalFormat = GL.RG16UI;
      if (glType === GL.UNSIGNED_INT) internalFormat = GL.RG32UI;
      if (glType === GL.BYTE) internalFormat = GL.RG8I;
      if (glType === GL.SHORT) internalFormat = GL.RG16I;
      if (glType === GL.INT) internalFormat = GL.RG32I;
    }
    if (glFormat === GL.RGB_INTEGER) {
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.RGB8UI;
      if (glType === GL.UNSIGNED_SHORT) internalFormat = GL.RGB16UI;
      if (glType === GL.UNSIGNED_INT) internalFormat = GL.RGB32UI;
      if (glType === GL.BYTE) internalFormat = GL.RGB8I;
      if (glType === GL.SHORT) internalFormat = GL.RGB16I;
      if (glType === GL.INT) internalFormat = GL.RGB32I;
    }
    if (glFormat === GL.RGBA_INTEGER) {
      if (glType === GL.UNSIGNED_BYTE) internalFormat = GL.RGBA8UI;
      if (glType === GL.UNSIGNED_SHORT) internalFormat = GL.RGBA16UI;
      if (glType === GL.UNSIGNED_INT) internalFormat = GL.RGBA32UI;
      if (glType === GL.BYTE) internalFormat = GL.RGBA8I;
      if (glType === GL.SHORT) internalFormat = GL.RGBA16I;
      if (glType === GL.INT) internalFormat = GL.RGBA32I;
    }
    if (glFormat === GL.RGB) {
      if (glType === GL.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGB16_EXT;
      if (glType === GL.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGB16_SNORM_EXT;
      if (glType === GL.UNSIGNED_INT_5_9_9_9_REV) internalFormat = GL.RGB9_E5;
      if (glType === GL.UNSIGNED_INT_10F_11F_11F_REV) internalFormat = GL.R11F_G11F_B10F;
    }
    if (glFormat === GL.RGBA) {
      const transfer = forceLinearTransfer ? Transfer.Linear : ColorManagement.getTransfer(colorSpace);
      if (glType === GL.FLOAT) internalFormat = GL.RGBA32F;
      if (glType === GL.HALF_FLOAT) internalFormat = GL.RGBA16F;
      if (glType === GL.UNSIGNED_BYTE) internalFormat = transfer === Transfer.SRGB ? GL.SRGB8_ALPHA8 : GL.RGBA8;
      if (glType === GL.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGBA16_EXT;
      if (glType === GL.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGBA16_SNORM_EXT;
      if (glType === GL.UNSIGNED_SHORT_4_4_4_4) internalFormat = GL.RGBA4;
      if (glType === GL.UNSIGNED_SHORT_5_5_5_1) internalFormat = GL.RGB5_A1;
    }
    if (
      internalFormat === GL.R16F ||
      internalFormat === GL.R32F ||
      internalFormat === GL.RG16F ||
      internalFormat === GL.RG32F ||
      internalFormat === GL.RGBA16F ||
      internalFormat === GL.RGBA32F
    ) {
      this.extensions.get("EXT_color_buffer_float");
    }
    return internalFormat!;
  }

  private getInternalDepthFormat(useStencil: boolean, depthType: TextureType | null) {
    let glInternalFormat: number | undefined;
    if (useStencil) {
      if (depthType === null || depthType === TextureType.UnsignedInt || depthType === TextureType.UnsignedInt248) {
        glInternalFormat = GL.DEPTH24_STENCIL8;
      } else if (depthType === TextureType.Float) {
        glInternalFormat = GL.DEPTH32F_STENCIL8;
      } else if (depthType === TextureType.UnsignedShort) {
        glInternalFormat = GL.DEPTH24_STENCIL8;
        warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.");
      }
    } else {
      if (depthType === null || depthType === TextureType.UnsignedInt || depthType === TextureType.UnsignedInt248) {
        glInternalFormat = GL.DEPTH_COMPONENT24;
      } else if (depthType === TextureType.Float) {
        glInternalFormat = GL.DEPTH_COMPONENT32F;
      } else if (depthType === TextureType.UnsignedShort) {
        glInternalFormat = GL.DEPTH_COMPONENT16;
      }
    }
    return glInternalFormat!;
  }

  private getMipLevels(texture: Texture, image: Texture["image"]) {
    if (
      this.textureNeedsGenerateMipmaps(texture) === true ||
      ((texture as FramebufferTexture).isFramebufferTexture &&
        texture.minFilter !== TextureFilter.Nearest &&
        texture.minFilter !== TextureFilter.Linear)
    ) {
      return Math.log2(Math.max(image.width, image.height)) + 1;
    } else if (texture.mipmaps.length > 0) {
      // user-defined mipmaps
      return texture.mipmaps.length;
    } else if ((texture as CompressedTexture).isCompressedTexture && Array.isArray(texture.image)) {
      return image.mipmaps.length;
    } else {
      // texture without mipmaps (only base level)
      return 1;
    }
  }

  private track(object: Texture | TextureRenderTarget) {
    const ref = new WeakRef(object);
    this.properties.get(object).__ref = ref;
    this._tracked.add(ref);
    this._registry.register(object, ref, ref);
  }

  private untrack(object: Texture | TextureRenderTarget) {
    const ref = this.properties.get(object).__ref;
    if (ref === undefined) return;
    this._tracked.delete(ref);
    this._registry.unregister(ref);
  }

  private onTextureDispose(event: { target: Texture }) {
    this.destroyTexture(event.target);
  }

  private onRenderTargetDispose(event: { target: TextureRenderTarget }) {
    this.destroyRenderTarget(event.target);
  }

  private destroyTexture(texture: Texture) {
    texture.removeEventListener("dispose", this.onTextureDispose);
    this.untrack(texture);
    this.deallocateTexture(texture);
    if ((texture as VideoTexture).isVideoTexture) {
      this._videoTextures.delete(texture);
    }
    if ((texture as HTMLTexture).isHTMLTexture) {
      this._htmlTextures.delete(texture as HTMLTexture);
    }
  }

  private destroyRenderTarget(renderTarget: TextureRenderTarget) {
    renderTarget.removeEventListener("dispose", this.onRenderTargetDispose);
    this.untrack(renderTarget);
    this.deallocateRenderTarget(renderTarget);
  }

  dispose() {
    for (const ref of this._tracked) {
      const object = ref.deref();
      if (object === undefined) continue;
      if ((object as RenderTarget).isRenderTarget === true) {
        this.destroyRenderTarget(object as TextureRenderTarget);
      } else {
        this.destroyTexture(object as Texture);
      }
    }
    this._tracked.clear();
    this._htmlTextures.clear();
  }

  private deallocateTexture(texture: Texture) {
    const textureProperties = this.properties.get(texture);
    if (textureProperties.__webglInit === undefined) return;
    // check if it's necessary to remove the WebGLTexture object
    const source = texture.source;
    const webglTextures = this._sources.get(source);
    if (webglTextures) {
      const webglTexture = webglTextures[textureProperties.__cacheKey];
      webglTexture.usedTimes--;
      // the WebGLTexture object is not used anymore, remove it
      if (webglTexture.usedTimes === 0) {
        this.deleteTexture(texture);
      }
      // remove the weak map entry if no WebGLTexture uses the source anymore
      if (Object.keys(webglTextures).length === 0) {
        this._sources.delete(source);
      }
    }
    this.properties.remove(texture);
  }

  private deleteTexture(texture: Texture) {
    const textureProperties = this.properties.get(texture);
    this._gl.deleteTexture(textureProperties.__webglTexture);
    const source = texture.source;
    const webglTextures = this._sources.get(source)!;
    delete webglTextures[textureProperties.__cacheKey];
    this.info.memory.textures--;
  }

  private deallocateRenderTarget(renderTarget: TextureRenderTarget) {
    const renderTargetProperties = this.properties.get(renderTarget);
    if (renderTargetProperties.__depthDisposeCallback) renderTargetProperties.__depthDisposeCallback();
    const depthTexture = renderTarget.depthTexture;
    // only destroy depth texture the render target owns
    if (depthTexture && depthTexture.renderTarget === renderTarget) this.destroyTexture(depthTexture);
    if (renderTarget.isWebGLCubeRenderTarget) {
      for (let i = 0; i < 6; i++) {
        if (Array.isArray(renderTargetProperties.__webglFramebuffer[i])) {
          for (let level = 0; level < renderTargetProperties.__webglFramebuffer[i].length; level++)
            this._gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i][level]);
        } else {
          this._gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i]);
        }
        if (renderTargetProperties.__webglDepthbuffer)
          this._gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer[i]);
      }
    } else {
      if (Array.isArray(renderTargetProperties.__webglFramebuffer)) {
        for (let level = 0; level < renderTargetProperties.__webglFramebuffer.length; level++)
          this._gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[level]);
      } else {
        this._gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer);
      }
      if (renderTargetProperties.__webglDepthbuffer)
        this._gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer);
      if (renderTargetProperties.__webglMultisampledFramebuffer)
        this._gl.deleteFramebuffer(renderTargetProperties.__webglMultisampledFramebuffer);
      if (renderTargetProperties.__webglColorRenderbuffer) {
        for (let i = 0; i < renderTargetProperties.__webglColorRenderbuffer.length; i++) {
          if (renderTargetProperties.__webglColorRenderbuffer[i])
            this._gl.deleteRenderbuffer(renderTargetProperties.__webglColorRenderbuffer[i]);
        }
      }
      if (renderTargetProperties.__webglDepthRenderbuffer)
        this._gl.deleteRenderbuffer(renderTargetProperties.__webglDepthRenderbuffer);
    }
    const textures = renderTarget.textures;
    for (let i = 0, il = textures.length; i < il; i++) {
      const attachmentProperties = this.properties.get(textures[i]);
      if (attachmentProperties.__webglTexture) {
        if (!renderTargetProperties.__hasExternalTextures) this._gl.deleteTexture(attachmentProperties.__webglTexture);
        this.info.memory.textures--;
      }
      this.properties.remove(textures[i]);
    }
    this.properties.remove(renderTarget);
  }

  resetTextureUnits() {
    this.textureUnits = 0;
  }

  getTextureUnits() {
    return this.textureUnits;
  }

  setTextureUnits(value: number) {
    this.textureUnits = value;
  }

  allocateTextureUnit() {
    const textureUnit = this.textureUnits;
    if (textureUnit >= this.capabilities.maxTextures) {
      warn(
        "WebGLTextures: Trying to use " +
          (textureUnit + 1) +
          " texture units while this GPU supports only " +
          this.capabilities.maxTextures,
      );
    }
    this.textureUnits += 1;
    return textureUnit;
  }

  private getTextureCacheKey(texture: Texture & { wrapR?: Wrapping }) {
    const array: (string | number | boolean | null)[] = [];
    array.push(texture.wrapS);
    array.push(texture.wrapT);
    array.push(texture.wrapR || 0);
    array.push(texture.magFilter);
    array.push(texture.minFilter);
    array.push(texture.anisotropy);
    array.push(texture.internalFormat);
    array.push(texture.format);
    array.push(texture.type);
    array.push(texture.generateMipmaps);
    array.push(texture.mipmapsAutoUpdate);
    array.push(texture.premultiplyAlpha);
    array.push(texture.flipY);
    array.push(texture.unpackAlignment);
    array.push(texture.colorSpace);
    return array.join();
  }

  setTexture2D(texture: Texture, slot: number) {
    const textureProperties = this.properties.get(texture);
    if ((texture as VideoTexture).isVideoTexture) this.updateVideoTexture(texture as VideoTexture);
    if (
      texture.isRenderTargetTexture === false &&
      (texture as ExternalTexture).isExternalTexture !== true &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      const image = texture.image;
      if (image === null) {
        warn("WebGLRenderer: Texture marked for update but no image data found.");
      } else if (image.complete === false) {
        warn("WebGLRenderer: Texture marked for update but image is incomplete");
      } else {
        this.uploadTexture(textureProperties, texture, slot);
        return;
      }
    } else if ((texture as ExternalTexture).isExternalTexture) {
      textureProperties.__webglTexture = (texture as ExternalTexture).sourceTexture
        ? (texture as ExternalTexture).sourceTexture
        : null;
    }
    this.state.bindTexture(GL.TEXTURE_2D, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }

  setTexture2DArray(texture: Texture, slot: number) {
    const textureProperties = this.properties.get(texture);
    if (
      texture.isRenderTargetTexture === false &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      this.uploadTexture(textureProperties, texture, slot);
      return;
    } else if ((texture as ExternalTexture).isExternalTexture) {
      textureProperties.__webglTexture = (texture as ExternalTexture).sourceTexture
        ? (texture as ExternalTexture).sourceTexture
        : null;
    }
    this.state.bindTexture(GL.TEXTURE_2D_ARRAY, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }

  setTexture3D(texture: Texture, slot: number) {
    const textureProperties = this.properties.get(texture);
    if (
      texture.isRenderTargetTexture === false &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      this.uploadTexture(textureProperties, texture, slot);
      return;
    }
    this.state.bindTexture(GL.TEXTURE_3D, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }

  setTextureCube(texture: Texture, slot: number) {
    const textureProperties = this.properties.get(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      this.uploadCubeTexture(textureProperties, texture, slot);
      return;
    }
    this.state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }

  private setTextureParameters(
    textureType: number,
    texture: Texture & { wrapR?: Wrapping; compareFunction?: Compare | null },
  ) {
    if (
      texture.type === TextureType.Float &&
      this.extensions.has("OES_texture_float_linear") === false &&
      (texture.magFilter === TextureFilter.Linear ||
        texture.magFilter === TextureFilter.LinearMipmapNearest ||
        texture.magFilter === TextureFilter.NearestMipmapLinear ||
        texture.magFilter === TextureFilter.LinearMipmapLinear ||
        texture.minFilter === TextureFilter.Linear ||
        texture.minFilter === TextureFilter.LinearMipmapNearest ||
        texture.minFilter === TextureFilter.NearestMipmapLinear ||
        texture.minFilter === TextureFilter.LinearMipmapLinear)
    ) {
      warn(
        "WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.",
      );
    }
    this._gl.texParameteri(textureType, GL.TEXTURE_WRAP_S, this.wrappingToGL[texture.wrapS]);
    this._gl.texParameteri(textureType, GL.TEXTURE_WRAP_T, this.wrappingToGL[texture.wrapT]);
    if (textureType === GL.TEXTURE_3D || textureType === GL.TEXTURE_2D_ARRAY) {
      this._gl.texParameteri(textureType, GL.TEXTURE_WRAP_R, this.wrappingToGL[texture.wrapR!]);
    }
    this._gl.texParameteri(textureType, GL.TEXTURE_MAG_FILTER, this.filterToGL[texture.magFilter]);
    this._gl.texParameteri(textureType, GL.TEXTURE_MIN_FILTER, this.filterToGL[texture.minFilter]);
    if (texture.compareFunction) {
      this._gl.texParameteri(textureType, GL.TEXTURE_COMPARE_MODE, GL.COMPARE_REF_TO_TEXTURE);
      this._gl.texParameteri(textureType, GL.TEXTURE_COMPARE_FUNC, this.compareToGL[texture.compareFunction]);
    }
    if (this.extensions.has("EXT_texture_filter_anisotropic") === true) {
      if (texture.magFilter === TextureFilter.Nearest) return;
      if (
        texture.minFilter !== TextureFilter.NearestMipmapLinear &&
        texture.minFilter !== TextureFilter.LinearMipmapLinear
      )
        return;
      if (texture.type === TextureType.Float && this.extensions.has("OES_texture_float_linear") === false) return; // verify extension
      if (texture.anisotropy > 1 || this.properties.get(texture).__currentAnisotropy) {
        const extension = this.extensions.get("EXT_texture_filter_anisotropic");
        this._gl.texParameterf(
          textureType,
          extension!.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(texture.anisotropy, this.capabilities.getMaxAnisotropy()),
        );
        this.properties.get(texture).__currentAnisotropy = texture.anisotropy;
      }
    }
  }

  private initTexture(textureProperties: TextureProperties, texture: Texture) {
    let forceUpload = false;
    if (textureProperties.__webglInit === undefined) {
      textureProperties.__webglInit = true;
      texture.addEventListener("dispose", this.onTextureDispose);
      this.track(texture);
    }
    // create TextureSource <-> WebGLTextures mapping if necessary
    const source = texture.source;
    let webglTextures = this._sources.get(source);
    if (webglTextures === undefined) {
      webglTextures = {};
      this._sources.set(source, webglTextures);
    }
    // check if there is already a WebGLTexture object for the given texture parameters
    const textureCacheKey = this.getTextureCacheKey(texture);
    if (textureCacheKey !== textureProperties.__cacheKey) {
      // if not, create a new instance of WebGLTexture
      if (webglTextures[textureCacheKey] === undefined) {
        // create new entry
        webglTextures[textureCacheKey] = {
          texture: this._gl.createTexture(),
          usedTimes: 0,
        };
        this.info.memory.textures++;
        // when a new instance of WebGLTexture was created, a texture upload is required
        // even if the image contents are identical
        forceUpload = true;
      }
      webglTextures[textureCacheKey].usedTimes++;
      // every time the texture cache key changes, it's necessary to check if an instance of
      // WebGLTexture can be deleted in order to avoid a memory leak.
      const webglTexture = webglTextures[textureProperties.__cacheKey!];
      if (webglTexture !== undefined) {
        webglTextures[textureProperties.__cacheKey!].usedTimes--;
        if (webglTexture.usedTimes === 0) {
          this.deleteTexture(texture);
        }
      }
      // store references to cache key and WebGLTexture object
      textureProperties.__cacheKey = textureCacheKey;
      textureProperties.__webglTexture = webglTextures[textureCacheKey].texture;
    }
    return forceUpload;
  }

  private getRow(index: number, rowLength: number, componentStride: number) {
    return Math.floor(Math.floor(index / componentStride) / rowLength);
  }

  private updateTexture(texture: Texture, image: DataTextureImage, glFormat: number, glType: number) {
    const componentStride = 4; // only RGBA supported
    const updateRanges = texture.updateRanges;
    if (updateRanges.length === 0) {
      this.state.texSubImage2D(GL.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
    } else {
      // Before applying update ranges, we merge any adjacent / overlapping
      // ranges to reduce load on `gl.texSubImage2D`. Empirically, this has led
      // to performance improvements for applications which make heavy use of
      // update ranges. Likely due to GPU command overhead.
      //
      // Note that to reduce garbage collection between frames, we merge the
      // update ranges in-place. This is safe because this method will clear the
      // update ranges once updated.
      updateRanges.sort((a, b) => a.start - b.start);
      // To merge the update ranges in-place, we work from left to right in the
      // existing updateRanges array, merging ranges. This may result in a final
      // array which is smaller than the original. This index tracks the last
      // index representing a merged range, any data after this index can be
      // trimmed once the merge algorithm is completed.
      let mergeIndex = 0;
      for (let i = 1; i < updateRanges.length; i++) {
        const previousRange = updateRanges[mergeIndex];
        const range = updateRanges[i];
        // Only merge if in the same row and overlapping/adjacent
        const previousEnd = previousRange.start + previousRange.count;
        const currentRow = this.getRow(range.start, image.width, componentStride);
        const previousRow = this.getRow(previousRange.start, image.width, componentStride);
        // We add one here to merge adjacent ranges. This is safe because ranges
        // operate over positive integers.
        if (
          range.start <= previousEnd + 1 &&
          currentRow === previousRow &&
          this.getRow(range.start + range.count - 1, image.width, componentStride) === currentRow // ensure range doesn't spill
        ) {
          previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
        } else {
          ++mergeIndex;
          updateRanges[mergeIndex] = range;
        }
      }
      // Trim the array to only contain the merged ranges.
      updateRanges.length = mergeIndex + 1;
      const currentUnpackRowLen = this.state.getParameter(GL.UNPACK_ROW_LENGTH);
      const currentUnpackSkipPixels = this.state.getParameter(GL.UNPACK_SKIP_PIXELS);
      const currentUnpackSkipRows = this.state.getParameter(GL.UNPACK_SKIP_ROWS);
      this.state.pixelStorei(GL.UNPACK_ROW_LENGTH, image.width);
      for (let i = 0, l = updateRanges.length; i < l; i++) {
        const range = updateRanges[i];
        const pixelStart = Math.floor(range.start / componentStride);
        const pixelCount = Math.ceil(range.count / componentStride);
        const x = pixelStart % image.width;
        const y = Math.floor(pixelStart / image.width);
        // Assumes update ranges refer to contiguous memory
        const width = pixelCount;
        const height = 1;
        this.state.pixelStorei(GL.UNPACK_SKIP_PIXELS, x);
        this.state.pixelStorei(GL.UNPACK_SKIP_ROWS, y);
        this.state.texSubImage2D(GL.TEXTURE_2D, 0, x, y, width, height, glFormat, glType, image.data);
      }
      texture.clearUpdateRanges();
      this.state.pixelStorei(GL.UNPACK_ROW_LENGTH, currentUnpackRowLen);
      this.state.pixelStorei(GL.UNPACK_SKIP_PIXELS, currentUnpackSkipPixels);
      this.state.pixelStorei(GL.UNPACK_SKIP_ROWS, currentUnpackSkipRows);
    }
  }

  private uploadTexture(textureProperties: TextureProperties, texture: Texture, slot: number) {
    let textureType: GL = GL.TEXTURE_2D;
    if (
      (texture as DataArrayTexture).isDataArrayTexture ||
      (texture as CompressedArrayTexture).isCompressedArrayTexture
    )
      textureType = GL.TEXTURE_2D_ARRAY;
    if ((texture as Data3DTexture).isData3DTexture) textureType = GL.TEXTURE_3D;
    const forceUpload = this.initTexture(textureProperties, texture);
    const source = texture.source;
    this.state.bindTexture(textureType, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
    const sourceProperties = this.properties.get(source);
    if (source.version !== sourceProperties.__version || forceUpload === true) {
      this.state.activeTexture(GL.TEXTURE0 + slot);
      const isImageBitmap = typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap;
      if (isImageBitmap === false) {
        const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
        const texturePrimaries =
          texture.colorSpace === ColorSpace.No ? null : ColorManagement.getPrimaries(texture.colorSpace);
        const unpackConversion =
          texture.colorSpace === ColorSpace.No || workingPrimaries === texturePrimaries
            ? GL.NONE
            : GL.BROWSER_DEFAULT_WEBGL;
        this.state.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, texture.flipY);
        this.state.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
        this.state.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
      }
      this.state.pixelStorei(GL.UNPACK_ALIGNMENT, texture.unpackAlignment);
      let image = this.resizeImage(texture.image, false, this.capabilities.maxTextureSize);
      image = this.verifyColorSpace(texture, image);
      const glFormat = this.utils.convert(texture.format, texture.colorSpace)!;
      const glType = this.utils.convert(texture.type)!;
      let glInternalFormat = this.getInternalFormat(
        texture.internalFormat,
        glFormat,
        glType,
        texture.normalized,
        texture.colorSpace,
        (texture as VideoTexture).isVideoTexture,
      );
      this.setTextureParameters(textureType, texture);
      let mipmap: any;
      const mipmaps = texture.mipmaps;
      const useTexStorage = (texture as VideoTexture).isVideoTexture !== true;
      const allocateMemory = sourceProperties.__version === undefined || forceUpload === true;
      const dataReady = source.dataReady;
      const levels = this.getMipLevels(texture, image);
      if ((texture as DepthTexture).isDepthTexture) {
        glInternalFormat = this.getInternalDepthFormat(texture.format === PixelFormat.DepthStencil, texture.type);
        //
        if (allocateMemory) {
          if (useTexStorage) {
            this.state.texStorage2D(GL.TEXTURE_2D, 1, glInternalFormat, image.width, image.height);
          } else {
            this.state.texImage2D(
              GL.TEXTURE_2D,
              0,
              glInternalFormat,
              image.width,
              image.height,
              0,
              glFormat,
              glType,
              null,
            );
          }
        }
      } else if ((texture as DataTexture).isDataTexture) {
        // use manually created mipmaps if available
        // if there are no manual mipmaps
        // set 0 level mipmap and then use GL to generate other mipmap levels
        if (mipmaps.length > 0) {
          if (useTexStorage && allocateMemory) {
            this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (useTexStorage) {
              if (dataReady) {
                this.state.texSubImage2D(
                  GL.TEXTURE_2D,
                  i,
                  0,
                  0,
                  mipmap.width,
                  mipmap.height,
                  glFormat,
                  glType,
                  mipmap.data,
                );
              }
            } else {
              this.state.texImage2D(
                GL.TEXTURE_2D,
                i,
                glInternalFormat,
                mipmap.width,
                mipmap.height,
                0,
                glFormat,
                glType,
                mipmap.data,
              );
            }
          }
          texture.generateMipmaps = false;
        } else {
          if (useTexStorage) {
            if (allocateMemory) {
              this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
            }
            if (dataReady) {
              this.updateTexture(texture, image, glFormat, glType);
            }
          } else {
            this.state.texImage2D(
              GL.TEXTURE_2D,
              0,
              glInternalFormat,
              image.width,
              image.height,
              0,
              glFormat,
              glType,
              image.data,
            );
          }
        }
      } else if ((texture as CompressedTexture).isCompressedTexture) {
        if ((texture as CompressedArrayTexture).isCompressedArrayTexture) {
          if (useTexStorage && allocateMemory) {
            this.state.texStorage3D(
              GL.TEXTURE_2D_ARRAY,
              levels,
              glInternalFormat,
              mipmaps[0].width,
              mipmaps[0].height,
              image.depth,
            );
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (texture.format !== PixelFormat.RGBA) {
              if (glFormat !== null) {
                if (useTexStorage) {
                  if (dataReady) {
                    if ((texture as CompressedArrayTexture).layerUpdates.size > 0) {
                      const layerByteLength = getByteLength(mipmap.width, mipmap.height, texture.format, texture.type);
                      for (const layerIndex of (texture as CompressedArrayTexture).layerUpdates) {
                        const layerData = mipmap.data.subarray(
                          (layerIndex * layerByteLength) / mipmap.data.BYTES_PER_ELEMENT,
                          ((layerIndex + 1) * layerByteLength) / mipmap.data.BYTES_PER_ELEMENT,
                        );
                        this.state.compressedTexSubImage3D(
                          GL.TEXTURE_2D_ARRAY,
                          i,
                          0,
                          0,
                          layerIndex,
                          mipmap.width,
                          mipmap.height,
                          1,
                          glFormat,
                          layerData,
                        );
                      }
                    } else {
                      this.state.compressedTexSubImage3D(
                        GL.TEXTURE_2D_ARRAY,
                        i,
                        0,
                        0,
                        0,
                        mipmap.width,
                        mipmap.height,
                        image.depth,
                        glFormat,
                        mipmap.data,
                      );
                    }
                  }
                } else {
                  this.state.compressedTexImage3D(
                    GL.TEXTURE_2D_ARRAY,
                    i,
                    glInternalFormat,
                    mipmap.width,
                    mipmap.height,
                    image.depth,
                    0,
                    mipmap.data,
                    0,
                    0,
                  );
                }
              } else {
                warn("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
              }
            } else {
              if (useTexStorage) {
                if (dataReady) {
                  this.state.texSubImage3D(
                    GL.TEXTURE_2D_ARRAY,
                    i,
                    0,
                    0,
                    0,
                    mipmap.width,
                    mipmap.height,
                    image.depth,
                    glFormat,
                    glType,
                    mipmap.data,
                  );
                }
              } else {
                this.state.texImage3D(
                  GL.TEXTURE_2D_ARRAY,
                  i,
                  glInternalFormat,
                  mipmap.width,
                  mipmap.height,
                  image.depth,
                  0,
                  glFormat,
                  glType,
                  mipmap.data,
                );
              }
            }
          }
          if ((texture as CompressedArrayTexture).layerUpdates.size > 0)
            (texture as CompressedArrayTexture).clearLayerUpdates();
        } else {
          if (useTexStorage && allocateMemory) {
            this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (texture.format !== PixelFormat.RGBA) {
              if (glFormat !== null) {
                if (useTexStorage) {
                  if (dataReady) {
                    this.state.compressedTexSubImage2D(
                      GL.TEXTURE_2D,
                      i,
                      0,
                      0,
                      mipmap.width,
                      mipmap.height,
                      glFormat,
                      mipmap.data,
                    );
                  }
                } else {
                  this.state.compressedTexImage2D(
                    GL.TEXTURE_2D,
                    i,
                    glInternalFormat,
                    mipmap.width,
                    mipmap.height,
                    0,
                    mipmap.data,
                  );
                }
              } else {
                warn("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
              }
            } else {
              if (useTexStorage) {
                if (dataReady) {
                  this.state.texSubImage2D(
                    GL.TEXTURE_2D,
                    i,
                    0,
                    0,
                    mipmap.width,
                    mipmap.height,
                    glFormat,
                    glType,
                    mipmap.data,
                  );
                }
              } else {
                this.state.texImage2D(
                  GL.TEXTURE_2D,
                  i,
                  glInternalFormat,
                  mipmap.width,
                  mipmap.height,
                  0,
                  glFormat,
                  glType,
                  mipmap.data,
                );
              }
            }
          }
        }
      } else if ((texture as DataArrayTexture).isDataArrayTexture) {
        if (useTexStorage) {
          if (allocateMemory) {
            this.state.texStorage3D(
              GL.TEXTURE_2D_ARRAY,
              levels,
              glInternalFormat,
              image.width,
              image.height,
              image.depth,
            );
          }
          if (dataReady) {
            if ((texture as DataArrayTexture).layerUpdates.size > 0) {
              const layerByteLength = getByteLength(image.width, image.height, texture.format, texture.type);
              for (const layerIndex of (texture as DataArrayTexture).layerUpdates) {
                const layerData = image.data.subarray(
                  (layerIndex * layerByteLength) / image.data.BYTES_PER_ELEMENT,
                  ((layerIndex + 1) * layerByteLength) / image.data.BYTES_PER_ELEMENT,
                );
                this.state.texSubImage3D(
                  GL.TEXTURE_2D_ARRAY,
                  0,
                  0,
                  0,
                  layerIndex,
                  image.width,
                  image.height,
                  1,
                  glFormat,
                  glType,
                  layerData,
                );
              }
              (texture as DataArrayTexture).clearLayerUpdates();
            } else {
              this.state.texSubImage3D(
                GL.TEXTURE_2D_ARRAY,
                0,
                0,
                0,
                0,
                image.width,
                image.height,
                image.depth,
                glFormat,
                glType,
                image.data,
              );
            }
          }
        } else {
          this.state.texImage3D(
            GL.TEXTURE_2D_ARRAY,
            0,
            glInternalFormat,
            image.width,
            image.height,
            image.depth,
            0,
            glFormat,
            glType,
            image.data,
          );
        }
      } else if ((texture as Data3DTexture).isData3DTexture) {
        if (useTexStorage) {
          if (allocateMemory) {
            this.state.texStorage3D(GL.TEXTURE_3D, levels, glInternalFormat, image.width, image.height, image.depth);
          }
          if (dataReady) {
            this.state.texSubImage3D(
              GL.TEXTURE_3D,
              0,
              0,
              0,
              0,
              image.width,
              image.height,
              image.depth,
              glFormat,
              glType,
              image.data,
            );
          }
        } else {
          this.state.texImage3D(
            GL.TEXTURE_3D,
            0,
            glInternalFormat,
            image.width,
            image.height,
            image.depth,
            0,
            glFormat,
            glType,
            image.data,
          );
        }
      } else if ((texture as FramebufferTexture).isFramebufferTexture) {
        if (allocateMemory) {
          if (useTexStorage) {
            this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
          } else {
            let width = image.width,
              height = image.height;
            for (let i = 0; i < levels; i++) {
              this.state.texImage2D(GL.TEXTURE_2D, i, glInternalFormat, width, height, 0, glFormat, glType, null);
              width >>= 1;
              height >>= 1;
            }
          }
        }
      } else if ((texture as HTMLTexture).isHTMLTexture) {
        if ("texElementImage2D" in this._gl) {
          const canvas = (this._gl as HTMLTextureContext).canvas;
          // Ensure the canvas supports HTML-in-Canvas and the element is a child.
          if (!canvas.hasAttribute("layoutsubtree")) {
            canvas.setAttribute("layoutsubtree", "true");
          }
          if (image.parentNode !== canvas) {
            canvas.appendChild(image);
            // Register and set up a shared paint callback for all HTMLTextures.
            this._htmlTextures.add(texture as HTMLTexture);
            canvas.onpaint = this.onHTMLTexturePaint.bind(this);
            canvas.requestPaint();
            return;
          }
          // The polyfill (three-html-render) exposes the same method name but implements only the
          // 6-argument Chrome-138 form, requires one full requestPaint()+rAF cycle before a
          // snapshot exists, and its function length is still 3 (so the length check upstream
          // uses can't tell it apart). Try the 3-argument Chrome-150 form first, fall back to
          // 6-argument; when the polyfill reports "no snapshot yet" leave the version gap in
          // place — the shared onpaint handler marks needsUpdate and the next upload succeeds.
          try {
            (this._gl as HTMLTextureContext).texElementImage2D(GL.TEXTURE_2D, GL.RGBA8, image);
          } catch (error) {
            if (error instanceof DOMException && /snapshot/i.test(error.message)) {
              return; // retry after the pending paint cycle
            }
            // Chrome 138 - 149 (and the polyfill's unsupported overloads)
            const level = 0;
            const internalFormat = GL.RGBA;
            const srcFormat = GL.RGBA;
            const srcType = GL.UNSIGNED_BYTE;
            (this._gl as HTMLTextureContext).texElementImage2D(
              GL.TEXTURE_2D,
              level,
              internalFormat,
              srcFormat,
              srcType,
              image,
            );
          }
          this._gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
          this._gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
          this._gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        }
      } else {
        // regular Texture (image, video, canvas)
        // use manually created mipmaps if available
        // if there are no manual mipmaps
        // set 0 level mipmap and then use GL to generate other mipmap levels
        if (mipmaps.length > 0) {
          if (useTexStorage && allocateMemory) {
            const dimensions = this.getDimensions(mipmaps[0]);
            this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (useTexStorage) {
              if (dataReady) {
                this.state.texSubImage2D(GL.TEXTURE_2D, i, 0, 0, glFormat, glType, mipmap);
              }
            } else {
              this.state.texImage2D(GL.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
            }
          }
          texture.generateMipmaps = false;
        } else {
          if (useTexStorage) {
            if (allocateMemory) {
              const dimensions = this.getDimensions(image);
              this.state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
            }
            if (dataReady) {
              this.state.texSubImage2D(GL.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
            }
          } else {
            this.state.texImage2D(GL.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
          }
        }
      }
      if (this.textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        this.generateMipmap(textureType);
      }
      sourceProperties.__version = source.version;
      if (texture.onUpdate) texture.onUpdate(texture);
    }
    textureProperties.__version = texture.version;
  }

  private onHTMLTexturePaint(event: HTMLTexturePaintEvent) {
    const changed = event.changedElements;
    for (const t of this._htmlTextures) {
      if (changed.includes(t.image)) {
        t.needsUpdate = true;
      }
    }
  }

  private uploadCubeTexture(textureProperties: TextureProperties, texture: Texture, slot: number) {
    if (texture.image.length !== 6) return;
    const forceUpload = this.initTexture(textureProperties, texture);
    const source = texture.source;
    this.state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
    const sourceProperties = this.properties.get(source);
    if (source.version !== sourceProperties.__version || forceUpload === true) {
      this.state.activeTexture(GL.TEXTURE0 + slot);
      const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
      const texturePrimaries =
        texture.colorSpace === ColorSpace.No ? null : ColorManagement.getPrimaries(texture.colorSpace);
      const unpackConversion =
        texture.colorSpace === ColorSpace.No || workingPrimaries === texturePrimaries
          ? GL.NONE
          : GL.BROWSER_DEFAULT_WEBGL;
      this.state.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, texture.flipY);
      this.state.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
      this.state.pixelStorei(GL.UNPACK_ALIGNMENT, texture.unpackAlignment);
      this.state.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
      const isCompressed = (texture as CompressedTexture).isCompressedTexture || texture.image[0].isCompressedTexture;
      const isDataTexture = texture.image[0] && texture.image[0].isDataTexture;
      const cubeImage: any[] = [];
      for (let i = 0; i < 6; i++) {
        if (!isCompressed && !isDataTexture) {
          cubeImage[i] = this.resizeImage(texture.image[i], true, this.capabilities.maxCubemapSize);
        } else {
          cubeImage[i] = isDataTexture ? texture.image[i].image : texture.image[i];
        }
        cubeImage[i] = this.verifyColorSpace(texture, cubeImage[i]);
      }
      const image = cubeImage[0],
        glFormat = this.utils.convert(texture.format, texture.colorSpace)!,
        glType = this.utils.convert(texture.type)!;
      let glInternalFormat = this.getInternalFormat(
        texture.internalFormat,
        glFormat,
        glType,
        texture.normalized,
        texture.colorSpace,
      );
      const useTexStorage = (texture as VideoTexture).isVideoTexture !== true;
      const allocateMemory = sourceProperties.__version === undefined || forceUpload === true;
      const dataReady = source.dataReady;
      let levels = this.getMipLevels(texture, image);
      this.setTextureParameters(GL.TEXTURE_CUBE_MAP, texture);
      let mipmaps: any;
      if ((texture as DepthTexture).isDepthTexture) {
        glInternalFormat = this.getInternalDepthFormat(texture.format === PixelFormat.DepthStencil, texture.type);
        //
        if (allocateMemory) {
          if (useTexStorage) {
            this.state.texStorage2D(GL.TEXTURE_CUBE_MAP, 1, glInternalFormat, image.width, image.height);
          } else {
            for (let i = 0; i < 6; i++) {
              this.state.texImage2D(
                GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                0,
                glInternalFormat,
                image.width,
                image.height,
                0,
                glFormat,
                glType,
                null,
              );
            }
          }
        }
      } else if (isCompressed) {
        if (useTexStorage && allocateMemory) {
          this.state.texStorage2D(GL.TEXTURE_CUBE_MAP, levels, glInternalFormat, image.width, image.height);
        }
        for (let i = 0; i < 6; i++) {
          mipmaps = cubeImage[i].mipmaps;
          for (let j = 0; j < mipmaps.length; j++) {
            const mipmap = mipmaps[j];
            if (texture.format !== PixelFormat.RGBA) {
              if (glFormat !== null) {
                if (useTexStorage) {
                  if (dataReady) {
                    this.state.compressedTexSubImage2D(
                      GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                      j,
                      0,
                      0,
                      mipmap.width,
                      mipmap.height,
                      glFormat,
                      mipmap.data,
                    );
                  }
                } else {
                  this.state.compressedTexImage2D(
                    GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    j,
                    glInternalFormat,
                    mipmap.width,
                    mipmap.height,
                    0,
                    mipmap.data,
                  );
                }
              } else {
                warn("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");
              }
            } else {
              if (useTexStorage) {
                if (dataReady) {
                  this.state.texSubImage2D(
                    GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    j,
                    0,
                    0,
                    mipmap.width,
                    mipmap.height,
                    glFormat,
                    glType,
                    mipmap.data,
                  );
                }
              } else {
                this.state.texImage2D(
                  GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                  j,
                  glInternalFormat,
                  mipmap.width,
                  mipmap.height,
                  0,
                  glFormat,
                  glType,
                  mipmap.data,
                );
              }
            }
          }
        }
      } else {
        mipmaps = texture.mipmaps;
        if (useTexStorage && allocateMemory) {
          // TODO: Uniformly handle mipmap definitions
          // Normal textures and compressed cube textures define base level + mips with their mipmap array
          // Uncompressed cube textures use their mipmap array only for mips (no base level)
          if (mipmaps.length > 0) levels++;
          const dimensions = this.getDimensions(cubeImage[0]);
          this.state.texStorage2D(GL.TEXTURE_CUBE_MAP, levels, glInternalFormat, dimensions.width, dimensions.height);
        }
        for (let i = 0; i < 6; i++) {
          if (isDataTexture) {
            if (useTexStorage) {
              if (dataReady) {
                this.state.texSubImage2D(
                  GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                  0,
                  0,
                  0,
                  cubeImage[i].width,
                  cubeImage[i].height,
                  glFormat,
                  glType,
                  cubeImage[i].data,
                );
              }
            } else {
              this.state.texImage2D(
                GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                0,
                glInternalFormat,
                cubeImage[i].width,
                cubeImage[i].height,
                0,
                glFormat,
                glType,
                cubeImage[i].data,
              );
            }
            for (let j = 0; j < mipmaps.length; j++) {
              const mipmap = mipmaps[j];
              const mipmapImage = mipmap.image[i].image;
              if (useTexStorage) {
                if (dataReady) {
                  this.state.texSubImage2D(
                    GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    j + 1,
                    0,
                    0,
                    mipmapImage.width,
                    mipmapImage.height,
                    glFormat,
                    glType,
                    mipmapImage.data,
                  );
                }
              } else {
                this.state.texImage2D(
                  GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                  j + 1,
                  glInternalFormat,
                  mipmapImage.width,
                  mipmapImage.height,
                  0,
                  glFormat,
                  glType,
                  mipmapImage.data,
                );
              }
            }
          } else {
            if (useTexStorage) {
              if (dataReady) {
                this.state.texSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, glFormat, glType, cubeImage[i]);
              }
            } else {
              this.state.texImage2D(
                GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                0,
                glInternalFormat,
                glFormat,
                glType,
                cubeImage[i],
              );
            }
            for (let j = 0; j < mipmaps.length; j++) {
              const mipmap = mipmaps[j];
              if (useTexStorage) {
                if (dataReady) {
                  this.state.texSubImage2D(
                    GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                    j + 1,
                    0,
                    0,
                    glFormat,
                    glType,
                    mipmap.image[i],
                  );
                }
              } else {
                this.state.texImage2D(
                  GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                  j + 1,
                  glInternalFormat,
                  glFormat,
                  glType,
                  mipmap.image[i],
                );
              }
            }
          }
        }
      }
      if (this.textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        // We assume images for cube map have the same size.
        this.generateMipmap(GL.TEXTURE_CUBE_MAP);
      }
      sourceProperties.__version = source.version;
      if (texture.onUpdate) texture.onUpdate(texture);
    }
    textureProperties.__version = texture.version;
  }

  // Render targets
  // Setup storage for target texture and bind it to correct framebuffer
  setupFrameBufferTexture(
    framebuffer: WebGLFramebuffer | null,
    renderTarget: TextureRenderTarget,
    texture: Texture,
    attachment: number,
    textureTarget: number,
    level: number,
  ) {
    const glFormat = this.utils.convert(texture.format, texture.colorSpace)!;
    const glType = this.utils.convert(texture.type)!;
    const glInternalFormat = this.getInternalFormat(
      texture.internalFormat,
      glFormat,
      glType,
      texture.normalized,
      texture.colorSpace,
    );
    const renderTargetProperties = this.properties.get(renderTarget);
    const textureProperties = this.properties.get(texture);
    textureProperties.__renderTarget = renderTarget;
    if (!renderTargetProperties.__hasExternalTextures) {
      const width = Math.max(1, renderTarget.width >> level);
      const height = Math.max(1, renderTarget.height >> level);
      if (textureTarget === GL.TEXTURE_3D || textureTarget === GL.TEXTURE_2D_ARRAY) {
        this.state.texImage3D(
          textureTarget,
          level,
          glInternalFormat,
          width,
          height,
          renderTarget.depth,
          0,
          glFormat,
          glType,
          null,
        );
      } else {
        this.state.texImage2D(textureTarget, level, glInternalFormat, width, height, 0, glFormat, glType, null);
      }
    }
    this.state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    if (this.useMultisampledRTT(renderTarget)) {
      this.multisampledRTTExt!.framebufferTexture2DMultisampleEXT(
        GL.FRAMEBUFFER,
        attachment,
        textureTarget,
        textureProperties.__webglTexture,
        0,
        this.getRenderTargetSamples(renderTarget),
      );
    } else if (
      textureTarget === GL.TEXTURE_2D ||
      (textureTarget >= GL.TEXTURE_CUBE_MAP_POSITIVE_X && textureTarget <= GL.TEXTURE_CUBE_MAP_NEGATIVE_Z)
    ) {
      // see #24753
      this._gl.framebufferTexture2D(GL.FRAMEBUFFER, attachment, textureTarget, textureProperties.__webglTexture, level);
    }
    this.state.bindFramebuffer(GL.FRAMEBUFFER, null);
  }

  // Setup storage for internal depth/stencil buffers and bind to correct framebuffer
  private setupRenderBufferStorage(
    renderbuffer: WebGLRenderbuffer | null,
    renderTarget: TextureRenderTarget,
    useMultisample: boolean,
  ) {
    this._gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
    if (renderTarget.depthBuffer) {
      // retrieve the depth attachment types
      const depthTexture = renderTarget.depthTexture;
      const depthType = depthTexture && depthTexture.isDepthTexture ? depthTexture.type : null;
      const glInternalFormat = this.getInternalDepthFormat(renderTarget.stencilBuffer, depthType);
      const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
      // set up the attachment
      if (this.useMultisampledRTT(renderTarget)) {
        this.multisampledRTTExt!.renderbufferStorageMultisampleEXT(
          GL.RENDERBUFFER,
          this.getRenderTargetSamples(renderTarget),
          glInternalFormat,
          renderTarget.width,
          renderTarget.height,
        );
      } else if (useMultisample) {
        this._gl.renderbufferStorageMultisample(
          GL.RENDERBUFFER,
          this.getRenderTargetSamples(renderTarget),
          glInternalFormat,
          renderTarget.width,
          renderTarget.height,
        );
      } else {
        this._gl.renderbufferStorage(GL.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
      }
      this._gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
    } else {
      const textures = renderTarget.textures;
      for (let i = 0; i < textures.length; i++) {
        const texture = textures[i];
        const glFormat = this.utils.convert(texture.format, texture.colorSpace)!;
        const glType = this.utils.convert(texture.type)!;
        const glInternalFormat = this.getInternalFormat(
          texture.internalFormat,
          glFormat,
          glType,
          texture.normalized,
          texture.colorSpace,
        );
        if (this.useMultisampledRTT(renderTarget)) {
          this.multisampledRTTExt!.renderbufferStorageMultisampleEXT(
            GL.RENDERBUFFER,
            this.getRenderTargetSamples(renderTarget),
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
        } else if (useMultisample) {
          this._gl.renderbufferStorageMultisample(
            GL.RENDERBUFFER,
            this.getRenderTargetSamples(renderTarget),
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
        } else {
          this._gl.renderbufferStorage(GL.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
        }
      }
    }
    this._gl.bindRenderbuffer(GL.RENDERBUFFER, null);
  }

  // Setup resources for a Depth Texture for a FBO (needs an extension)
  private setupDepthTexture(framebuffer: WebGLFramebuffer | null, renderTarget: TextureRenderTarget, cubeFace: number) {
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    this.state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    if (!(renderTarget.depthTexture && renderTarget.depthTexture.isDepthTexture)) {
      throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");
    }
    const textureProperties = this.properties.get(renderTarget.depthTexture);
    textureProperties.__renderTarget = renderTarget;
    // upload an empty depth texture with framebuffer size
    const image = isCube
      ? (renderTarget.depthTexture as CubeDepthTexture).image[0]
      : (renderTarget.depthTexture.image as Exclude<DepthTexture["image"], unknown[]>);
    if (
      !textureProperties.__webglTexture ||
      image.width !== renderTarget.width ||
      image.height !== renderTarget.height
    ) {
      image.width = renderTarget.width;
      image.height = renderTarget.height;
      renderTarget.depthTexture.needsUpdate = true;
    }
    if (isCube) {
      this.setTextureCube(renderTarget.depthTexture, 0);
    } else {
      this.setTexture2D(renderTarget.depthTexture, 0);
    }
    const webglDepthTexture = textureProperties.__webglTexture;
    const samples = this.getRenderTargetSamples(renderTarget);
    const glTextureType: GL = isCube ? GL.TEXTURE_CUBE_MAP_POSITIVE_X + cubeFace : GL.TEXTURE_2D;
    const glAttachmentType =
      renderTarget.depthTexture.format === PixelFormat.DepthStencil ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
    if (renderTarget.depthTexture.format === PixelFormat.Depth) {
      if (this.useMultisampledRTT(renderTarget)) {
        this.multisampledRTTExt!.framebufferTexture2DMultisampleEXT(
          GL.FRAMEBUFFER,
          glAttachmentType,
          glTextureType,
          webglDepthTexture,
          0,
          samples,
        );
      } else {
        this._gl.framebufferTexture2D(GL.FRAMEBUFFER, glAttachmentType, glTextureType, webglDepthTexture, 0);
      }
    } else if (renderTarget.depthTexture.format === PixelFormat.DepthStencil) {
      if (this.useMultisampledRTT(renderTarget)) {
        this.multisampledRTTExt!.framebufferTexture2DMultisampleEXT(
          GL.FRAMEBUFFER,
          glAttachmentType,
          glTextureType,
          webglDepthTexture,
          0,
          samples,
        );
      } else {
        this._gl.framebufferTexture2D(GL.FRAMEBUFFER, glAttachmentType, glTextureType, webglDepthTexture, 0);
      }
    } else {
      throw new Error("THREE.WebGLTextures: Unknown depthTexture format.");
    }
  }

  // Setup GL resources for a non-texture depth buffer
  setupDepthRenderbuffer(renderTarget: TextureRenderTarget) {
    const renderTargetProperties = this.properties.get(renderTarget);
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    // if the bound depth texture has changed
    if (renderTargetProperties.__boundDepthTexture !== renderTarget.depthTexture) {
      // fire the dispose event to get rid of stored state associated with the previously bound depth buffer
      const depthTexture = renderTarget.depthTexture;
      if (renderTargetProperties.__depthDisposeCallback) {
        renderTargetProperties.__depthDisposeCallback();
      }
      // set up dispose listeners to track when the currently attached buffer is implicitly unbound
      if (depthTexture) {
        const disposeEvent = () => {
          delete renderTargetProperties.__boundDepthTexture;
          delete renderTargetProperties.__depthDisposeCallback;
          depthTexture.removeEventListener("dispose", disposeEvent);
        };
        depthTexture.addEventListener("dispose", disposeEvent);
        renderTargetProperties.__depthDisposeCallback = disposeEvent;
      }
      renderTargetProperties.__boundDepthTexture = depthTexture;
    }
    if (renderTarget.depthTexture && !renderTargetProperties.__autoAllocateDepthBuffer) {
      if (isCube) {
        // For cube render targets with depth texture, setup each face
        for (let i = 0; i < 6; i++) {
          this.setupDepthTexture(renderTargetProperties.__webglFramebuffer[i], renderTarget, i);
        }
      } else {
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          this.setupDepthTexture(renderTargetProperties.__webglFramebuffer[0], renderTarget, 0);
        } else {
          this.setupDepthTexture(renderTargetProperties.__webglFramebuffer, renderTarget, 0);
        }
      }
    } else {
      if (isCube) {
        renderTargetProperties.__webglDepthbuffer = [];
        for (let i = 0; i < 6; i++) {
          this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[i]);
          if (renderTargetProperties.__webglDepthbuffer[i] === undefined) {
            renderTargetProperties.__webglDepthbuffer[i] = this._gl.createRenderbuffer();
            this.setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer[i], renderTarget, false);
          } else {
            // attach buffer if it's been created already
            const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
            const renderbuffer = renderTargetProperties.__webglDepthbuffer[i];
            this._gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
            this._gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
          }
        }
      } else {
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[0]);
        } else {
          this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
        }
        if (renderTargetProperties.__webglDepthbuffer === undefined) {
          renderTargetProperties.__webglDepthbuffer = this._gl.createRenderbuffer();
          this.setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer, renderTarget, false);
        } else {
          // attach buffer if it's been created already
          const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
          const renderbuffer = renderTargetProperties.__webglDepthbuffer;
          this._gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
          this._gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
        }
      }
    }
    this.state.bindFramebuffer(GL.FRAMEBUFFER, null);
  }

  // rebind framebuffer with external textures
  rebindTextures(
    renderTarget: TextureRenderTarget,
    colorTexture?: WebGLTexture | null,
    depthTexture?: WebGLTexture | null,
  ) {
    const renderTargetProperties = this.properties.get(renderTarget);
    if (colorTexture !== undefined) {
      this.setupFrameBufferTexture(
        renderTargetProperties.__webglFramebuffer,
        renderTarget,
        renderTarget.texture,
        GL.COLOR_ATTACHMENT0,
        GL.TEXTURE_2D,
        0,
      );
    }
    if (depthTexture !== undefined) {
      this.setupDepthRenderbuffer(renderTarget);
    }
  }

  // Set up GL resources for the render target
  setupRenderTarget(renderTarget: TextureRenderTarget) {
    const texture = renderTarget.texture;
    const renderTargetProperties = this.properties.get(renderTarget);
    const textureProperties = this.properties.get(texture);
    renderTarget.addEventListener("dispose", this.onRenderTargetDispose);
    this.track(renderTarget);
    const textures = renderTarget.textures;
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    const isMultipleRenderTargets = textures.length > 1;
    if (!isMultipleRenderTargets) {
      if (textureProperties.__webglTexture === undefined) {
        textureProperties.__webglTexture = this._gl.createTexture();
      }
      textureProperties.__version = texture.version;
      this.info.memory.textures++;
    }
    // Setup framebuffer
    if (isCube) {
      renderTargetProperties.__webglFramebuffer = [];
      for (let i = 0; i < 6; i++) {
        if (texture.mipmaps.length > 0) {
          renderTargetProperties.__webglFramebuffer[i] = [];
          for (let level = 0; level < texture.mipmaps.length; level++) {
            renderTargetProperties.__webglFramebuffer[i][level] = this._gl.createFramebuffer();
          }
        } else {
          renderTargetProperties.__webglFramebuffer[i] = this._gl.createFramebuffer();
        }
      }
    } else {
      if (texture.mipmaps.length > 0) {
        renderTargetProperties.__webglFramebuffer = [];
        for (let level = 0; level < texture.mipmaps.length; level++) {
          renderTargetProperties.__webglFramebuffer[level] = this._gl.createFramebuffer();
        }
      } else {
        renderTargetProperties.__webglFramebuffer = this._gl.createFramebuffer();
      }
      if (isMultipleRenderTargets) {
        for (let i = 0, il = textures.length; i < il; i++) {
          const attachmentProperties = this.properties.get(textures[i]);
          if (attachmentProperties.__webglTexture === undefined) {
            attachmentProperties.__webglTexture = this._gl.createTexture();
            this.info.memory.textures++;
          }
        }
      }
      if (renderTarget.samples > 0 && this.useMultisampledRTT(renderTarget) === false) {
        renderTargetProperties.__webglMultisampledFramebuffer = this._gl.createFramebuffer();
        renderTargetProperties.__webglColorRenderbuffer = [];
        this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
        for (let i = 0; i < textures.length; i++) {
          const texture = textures[i];
          renderTargetProperties.__webglColorRenderbuffer[i] = this._gl.createRenderbuffer();
          this._gl.bindRenderbuffer(GL.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
          const glFormat = this.utils.convert(texture.format, texture.colorSpace);
          const glType = this.utils.convert(texture.type);
          const glInternalFormat = this.getInternalFormat(
            texture.internalFormat,
            glFormat,
            glType,
            texture.normalized,
            texture.colorSpace,
          );
          const samples = this.getRenderTargetSamples(renderTarget);
          this._gl.renderbufferStorageMultisample(
            GL.RENDERBUFFER,
            samples,
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
          this._gl.framebufferRenderbuffer(
            GL.FRAMEBUFFER,
            GL.COLOR_ATTACHMENT0 + i,
            GL.RENDERBUFFER,
            renderTargetProperties.__webglColorRenderbuffer[i],
          );
        }
        this._gl.bindRenderbuffer(GL.RENDERBUFFER, null);
        if (renderTarget.depthBuffer) {
          renderTargetProperties.__webglDepthRenderbuffer = this._gl.createRenderbuffer();
          this.setupRenderBufferStorage(renderTargetProperties.__webglDepthRenderbuffer, renderTarget, true);
        }
        this.state.bindFramebuffer(GL.FRAMEBUFFER, null);
      }
    }
    // Setup color buffer
    if (isCube) {
      this.state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture);
      this.setTextureParameters(GL.TEXTURE_CUBE_MAP, texture);
      for (let i = 0; i < 6; i++) {
        if (texture.mipmaps.length > 0) {
          for (let level = 0; level < texture.mipmaps.length; level++) {
            this.setupFrameBufferTexture(
              renderTargetProperties.__webglFramebuffer[i][level],
              renderTarget,
              texture,
              GL.COLOR_ATTACHMENT0,
              GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
              level,
            );
          }
        } else {
          this.setupFrameBufferTexture(
            renderTargetProperties.__webglFramebuffer[i],
            renderTarget,
            texture,
            GL.COLOR_ATTACHMENT0,
            GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            0,
          );
        }
      }
      if (this.textureNeedsGenerateMipmaps(texture)) {
        this.generateMipmap(GL.TEXTURE_CUBE_MAP);
      } else if (texture.mipmaps.length > 0) {
        // Limit the max level to keep partial mip chains complete.
        this._gl.texParameteri(GL.TEXTURE_CUBE_MAP, GL.TEXTURE_MAX_LEVEL, texture.mipmaps.length - 1);
      }
      this.state.unbindTexture();
    } else if (isMultipleRenderTargets) {
      for (let i = 0, il = textures.length; i < il; i++) {
        const attachment = textures[i];
        const attachmentProperties = this.properties.get(attachment);
        let glTextureType: GL = GL.TEXTURE_2D;
        if (renderTarget.isWebGL3DRenderTarget || renderTarget.isWebGLArrayRenderTarget) {
          glTextureType = renderTarget.isWebGL3DRenderTarget ? GL.TEXTURE_3D : GL.TEXTURE_2D_ARRAY;
        }
        this.state.bindTexture(glTextureType, attachmentProperties.__webglTexture);
        this.setTextureParameters(glTextureType, attachment);
        this.setupFrameBufferTexture(
          renderTargetProperties.__webglFramebuffer,
          renderTarget,
          attachment,
          GL.COLOR_ATTACHMENT0 + i,
          glTextureType,
          0,
        );
        if (this.textureNeedsGenerateMipmaps(attachment)) {
          this.generateMipmap(glTextureType);
        }
      }
      this.state.unbindTexture();
    } else {
      let glTextureType: GL = GL.TEXTURE_2D;
      if (renderTarget.isWebGL3DRenderTarget || renderTarget.isWebGLArrayRenderTarget) {
        glTextureType = renderTarget.isWebGL3DRenderTarget ? GL.TEXTURE_3D : GL.TEXTURE_2D_ARRAY;
      }
      this.state.bindTexture(glTextureType, textureProperties.__webglTexture);
      this.setTextureParameters(glTextureType, texture);
      if (texture.mipmaps.length > 0) {
        for (let level = 0; level < texture.mipmaps.length; level++) {
          this.setupFrameBufferTexture(
            renderTargetProperties.__webglFramebuffer[level],
            renderTarget,
            texture,
            GL.COLOR_ATTACHMENT0,
            glTextureType,
            level,
          );
        }
      } else {
        this.setupFrameBufferTexture(
          renderTargetProperties.__webglFramebuffer,
          renderTarget,
          texture,
          GL.COLOR_ATTACHMENT0,
          glTextureType,
          0,
        );
      }
      if (this.textureNeedsGenerateMipmaps(texture)) {
        this.generateMipmap(glTextureType);
      } else if (texture.mipmaps.length > 0) {
        // Limit the max level to keep partial mip chains complete.
        this._gl.texParameteri(glTextureType, GL.TEXTURE_MAX_LEVEL, texture.mipmaps.length - 1);
      }
      this.state.unbindTexture();
    }
    // Setup depth and stencil buffers
    if (renderTarget.depthBuffer) {
      this.setupDepthRenderbuffer(renderTarget);
    }
  }

  updateRenderTargetMipmap(renderTarget: TextureRenderTarget) {
    const textures = renderTarget.textures;
    for (let i = 0, il = textures.length; i < il; i++) {
      const texture = textures[i];
      if (this.textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        const targetType = this.getTargetType(renderTarget);
        const webglTexture = this.properties.get(texture).__webglTexture;
        this.state.bindTexture(targetType, webglTexture);
        this.generateMipmap(targetType);
        this.state.unbindTexture();
      }
    }
  }

  updateMultisampleRenderTarget(renderTarget: TextureRenderTarget) {
    if (renderTarget.samples > 0) {
      if (this.useMultisampledRTT(renderTarget) === false) {
        const textures = renderTarget.textures;
        const width = renderTarget.width;
        const height = renderTarget.height;
        let mask = GL.COLOR_BUFFER_BIT;
        const depthStyle = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
        const renderTargetProperties = this.properties.get(renderTarget);
        const isMultipleRenderTargets = textures.length > 1;
        // If MRT we need to remove FBO attachments
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            this._gl.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i, GL.RENDERBUFFER, null);
            this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            this._gl.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i, GL.TEXTURE_2D, null, 0);
          }
        }
        this.state.bindFramebuffer(GL.READ_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          this.state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[0]);
        } else {
          this.state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
        }
        for (let i = 0; i < textures.length; i++) {
          if (renderTarget.resolveDepthBuffer) {
            if (renderTarget.depthBuffer) mask |= GL.DEPTH_BUFFER_BIT;
            // resolving stencil is slow with a D3D backend. disable it for all transmission render targets (see #27799)
            if (renderTarget.stencilBuffer && renderTarget.resolveStencilBuffer) mask |= GL.STENCIL_BUFFER_BIT;
          }
          if (isMultipleRenderTargets) {
            this._gl.framebufferRenderbuffer(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              GL.RENDERBUFFER,
              renderTargetProperties.__webglColorRenderbuffer[i],
            );
            const webglTexture = this.properties.get(textures[i]).__webglTexture;
            this._gl.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, webglTexture, 0);
          }
          this._gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, GL.NEAREST);
          if (this.supportsInvalidateFramebuffer === true) {
            this.invalidationArrayRead.length = 0;
            this.invalidationArrayRead.push(GL.COLOR_ATTACHMENT0 + i);
            if (renderTarget.depthBuffer && renderTarget.storeMultisampledDepthBuffer === false) {
              this.invalidationArrayRead.push(depthStyle);
            }
            this._gl.invalidateFramebuffer(GL.READ_FRAMEBUFFER, this.invalidationArrayRead);
          }
        }
        this.state.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
        this.state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
        // If MRT since pre-blit we removed the FBO we need to reconstruct the attachments
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            this._gl.framebufferRenderbuffer(
              GL.FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0 + i,
              GL.RENDERBUFFER,
              renderTargetProperties.__webglColorRenderbuffer[i],
            );
            const webglTexture = this.properties.get(textures[i]).__webglTexture;
            this.state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            this._gl.framebufferTexture2D(
              GL.DRAW_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0 + i,
              GL.TEXTURE_2D,
              webglTexture,
              0,
            );
          }
        }
        this.state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
      } else {
        if (
          renderTarget.depthBuffer &&
          renderTarget.storeMultisampledDepthBuffer === false &&
          this.supportsInvalidateFramebuffer
        ) {
          const depthStyle = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
          this._gl.invalidateFramebuffer(GL.DRAW_FRAMEBUFFER, [depthStyle]);
        }
      }
    }
  }

  private getRenderTargetSamples(renderTarget: TextureRenderTarget) {
    return Math.min(this.capabilities.maxSamples, renderTarget.samples);
  }

  useMultisampledRTT(renderTarget: TextureRenderTarget) {
    const renderTargetProperties = this.properties.get(renderTarget);
    return (
      renderTarget.samples > 0 &&
      this.extensions.has("WEBGL_multisampled_render_to_texture") === true &&
      renderTargetProperties.__useRenderToTexture !== false
    );
  }

  private updateVideoTexture(texture: VideoTexture) {
    const frame = this.info.render.frame;
    // Check the last frame we updated the VideoTexture
    if (this._videoTextures.get(texture) !== frame) {
      this._videoTextures.set(texture, frame);
      texture.update();
    }
  }

  private verifyColorSpace<TImage>(texture: Texture, image: TImage): TImage {
    const colorSpace = texture.colorSpace;
    const format = texture.format;
    const type = texture.type;
    if (
      (texture as CompressedTexture).isCompressedTexture === true ||
      (texture as VideoTexture).isVideoTexture === true
    )
      return image;
    if (colorSpace !== ColorSpace.LinearSRGB && colorSpace !== ColorSpace.No) {
      // sRGB
      if (ColorManagement.getTransfer(colorSpace) === Transfer.SRGB) {
        // in WebGL 2 uncompressed textures can only be sRGB encoded if they have the RGBA8 format
        if (format !== PixelFormat.RGBA || type !== TextureType.UnsignedByte) {
          warn("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.");
        }
      } else {
        error("WebGLTextures: Unsupported texture color space:", colorSpace);
      }
    }
    return image;
  }

  private getDimensions(image: Texture["image"]) {
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
      // if intrinsic data are not available, fallback to width/height
      this._imageDimensions.width = image.naturalWidth || image.width;
      this._imageDimensions.height = image.naturalHeight || image.height;
    } else if (typeof VideoFrame !== "undefined" && image instanceof VideoFrame) {
      this._imageDimensions.width = image.displayWidth;
      this._imageDimensions.height = image.displayHeight;
    } else {
      this._imageDimensions.width = image.width;
      this._imageDimensions.height = image.height;
    }
    return this._imageDimensions;
  }
}
