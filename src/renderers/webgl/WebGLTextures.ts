import { GL } from "../../GL";
import { TextureFilter, PixelFormat, TextureType, Wrapping, ColorSpace, Compare, Transfer } from "../../constants";
import { createElementNS, warn, error } from "../../utils";
import { ColorManagement } from "../../math/ColorManagement";
import { Vector2 } from "../../math/Vector2";
import { getByteLength } from "../../extras/TextureUtils";
export function WebGLTextures(
  this: any,
  _gl?: any,
  extensions?: any,
  state?: any,
  properties?: any,
  capabilities?: any,
  utils?: any,
  info?: any,
) {
  const multisampledRTTExt = extensions.has("WEBGL_multisampled_render_to_texture")
    ? extensions.get("WEBGL_multisampled_render_to_texture")
    : null;
  const supportsInvalidateFramebuffer =
    typeof navigator === "undefined" ? false : /OculusBrowser/g.test(navigator.userAgent);
  const _imageDimensions = new Vector2();
  const _videoTextures = new WeakMap<any, any>();
  const _htmlTextures = new Set<any>();
  let _canvas: any;
  const _sources = new WeakMap<any, any>(); // maps WebglTexture objects to instances of TextureSource
  const _tracked = new Set<any>();
  const _registry = new FinalizationRegistry((ref?: any) => _tracked.delete(ref));
  // cordova iOS (as of 5.0) still uses UIWebView, which provides OffscreenCanvas,
  // also OffscreenCanvas.getContext("webgl"), but not OffscreenCanvas.getContext("2d")!
  // Some implementations may only implement OffscreenCanvas partially (e.g. lacking 2d).
  let useOffscreenCanvas = false;
  try {
    useOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
  } catch {
    // Ignore any errors
  }
  function createCanvas(width?: any, height?: any) {
    // Use OffscreenCanvas when available. Specially needed in web workers
    return useOffscreenCanvas ? new OffscreenCanvas(width, height) : (createElementNS("canvas") as HTMLCanvasElement);
  }
  function resizeImage(image?: any, needsNewCanvas?: any, maxSize?: any) {
    let scale = 1;
    const dimensions = getDimensions(image);
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
        if (_canvas === undefined) _canvas = createCanvas(width, height);
        // cube textures can't reuse the same canvas
        const canvas = needsNewCanvas ? createCanvas(width, height) : _canvas;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
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
  function textureNeedsGenerateMipmaps(texture?: any) {
    return texture.generateMipmaps;
  }
  function generateMipmap(target?: any) {
    _gl.generateMipmap(target);
  }
  function getTargetType(texture?: any) {
    if (texture.isWebGLCubeRenderTarget) return GL.TEXTURE_CUBE_MAP;
    if (texture.isWebGL3DRenderTarget) return GL.TEXTURE_3D;
    if (texture.isWebGLArrayRenderTarget || texture.isCompressedArrayTexture) return GL.TEXTURE_2D_ARRAY;
    return GL.TEXTURE_2D;
  }
  function getInternalFormat(
    internalFormatName?: any,
    glFormat?: any,
    glType?: any,
    normalized?: any,
    colorSpace?: any,
    forceLinearTransfer: boolean = false,
  ) {
    if (internalFormatName !== null) {
      if (_gl[internalFormatName] !== undefined) return _gl[internalFormatName];
      warn("WebGLRenderer: Attempt to use non-existing WebGL internal format '" + internalFormatName + "'");
    }
    let ext_texture_norm16: any;
    if (normalized) {
      ext_texture_norm16 = extensions.get("EXT_texture_norm16");
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
      extensions.get("EXT_color_buffer_float");
    }
    return internalFormat;
  }
  function getInternalDepthFormat(useStencil?: any, depthType?: any) {
    let glInternalFormat: any;
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
    return glInternalFormat;
  }
  function getMipLevels(texture?: any, image?: any) {
    if (
      textureNeedsGenerateMipmaps(texture) === true ||
      (texture.isFramebufferTexture &&
        texture.minFilter !== TextureFilter.Nearest &&
        texture.minFilter !== TextureFilter.Linear)
    ) {
      return Math.log2(Math.max(image.width, image.height)) + 1;
    } else if (texture.mipmaps.length > 0) {
      // user-defined mipmaps
      return texture.mipmaps.length;
    } else if (texture.isCompressedTexture && Array.isArray(texture.image)) {
      return image.mipmaps.length;
    } else {
      // texture without mipmaps (only base level)
      return 1;
    }
  }
  //
  function track(object?: any) {
    const ref = new WeakRef<any>(object);
    properties.get(object).__ref = ref;
    _tracked.add(ref);
    _registry.register(object, ref, ref);
  }
  function untrack(object?: any) {
    const ref = properties.get(object).__ref;
    if (ref === undefined) return;
    _tracked.delete(ref);
    _registry.unregister(ref);
  }
  function onTextureDispose(event?: any) {
    destroyTexture(event.target);
  }
  function onRenderTargetDispose(event?: any) {
    destroyRenderTarget(event.target);
  }
  function destroyTexture(texture?: any) {
    texture.removeEventListener("dispose", onTextureDispose);
    untrack(texture);
    deallocateTexture(texture);
    if (texture.isVideoTexture) {
      _videoTextures.delete(texture);
    }
    if (texture.isHTMLTexture) {
      _htmlTextures.delete(texture);
    }
  }
  function destroyRenderTarget(renderTarget?: any) {
    renderTarget.removeEventListener("dispose", onRenderTargetDispose);
    untrack(renderTarget);
    deallocateRenderTarget(renderTarget);
  }
  function dispose() {
    for (const ref of _tracked) {
      const object = ref.deref();
      if (object === undefined) continue;
      if (object.isRenderTarget === true) {
        destroyRenderTarget(object);
      } else {
        destroyTexture(object);
      }
    }
    _tracked.clear();
    _htmlTextures.clear();
  }
  //
  function deallocateTexture(texture?: any) {
    const textureProperties = properties.get(texture);
    if (textureProperties.__webglInit === undefined) return;
    // check if it's necessary to remove the WebGLTexture object
    const source = texture.source;
    const webglTextures = _sources.get(source);
    if (webglTextures) {
      const webglTexture = webglTextures[textureProperties.__cacheKey];
      webglTexture.usedTimes--;
      // the WebGLTexture object is not used anymore, remove it
      if (webglTexture.usedTimes === 0) {
        deleteTexture(texture);
      }
      // remove the weak map entry if no WebGLTexture uses the source anymore
      if (Object.keys(webglTextures).length === 0) {
        _sources.delete(source);
      }
    }
    properties.remove(texture);
  }
  function deleteTexture(texture?: any) {
    const textureProperties = properties.get(texture);
    _gl.deleteTexture(textureProperties.__webglTexture);
    const source = texture.source;
    const webglTextures = _sources.get(source);
    delete webglTextures[textureProperties.__cacheKey];
    info.memory.textures--;
  }
  function deallocateRenderTarget(renderTarget?: any) {
    const renderTargetProperties = properties.get(renderTarget);
    if (renderTargetProperties.__depthDisposeCallback) renderTargetProperties.__depthDisposeCallback();
    const depthTexture = renderTarget.depthTexture;
    // only destroy depth texture the render target owns
    if (depthTexture && depthTexture.renderTarget === renderTarget) destroyTexture(depthTexture);
    if (renderTarget.isWebGLCubeRenderTarget) {
      for (let i = 0; i < 6; i++) {
        if (Array.isArray(renderTargetProperties.__webglFramebuffer[i])) {
          for (let level = 0; level < renderTargetProperties.__webglFramebuffer[i].length; level++)
            _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i][level]);
        } else {
          _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i]);
        }
        if (renderTargetProperties.__webglDepthbuffer)
          _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer[i]);
      }
    } else {
      if (Array.isArray(renderTargetProperties.__webglFramebuffer)) {
        for (let level = 0; level < renderTargetProperties.__webglFramebuffer.length; level++)
          _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[level]);
      } else {
        _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer);
      }
      if (renderTargetProperties.__webglDepthbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer);
      if (renderTargetProperties.__webglMultisampledFramebuffer)
        _gl.deleteFramebuffer(renderTargetProperties.__webglMultisampledFramebuffer);
      if (renderTargetProperties.__webglColorRenderbuffer) {
        for (let i = 0; i < renderTargetProperties.__webglColorRenderbuffer.length; i++) {
          if (renderTargetProperties.__webglColorRenderbuffer[i])
            _gl.deleteRenderbuffer(renderTargetProperties.__webglColorRenderbuffer[i]);
        }
      }
      if (renderTargetProperties.__webglDepthRenderbuffer)
        _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthRenderbuffer);
    }
    const textures = renderTarget.textures;
    for (let i = 0, il = textures.length; i < il; i++) {
      const attachmentProperties = properties.get(textures[i]);
      if (attachmentProperties.__webglTexture) {
        if (!renderTargetProperties.__hasExternalTextures) _gl.deleteTexture(attachmentProperties.__webglTexture);
        info.memory.textures--;
      }
      properties.remove(textures[i]);
    }
    properties.remove(renderTarget);
  }
  //
  let textureUnits = 0;
  function resetTextureUnits() {
    textureUnits = 0;
  }
  function getTextureUnits() {
    return textureUnits;
  }
  function setTextureUnits(value?: any) {
    textureUnits = value;
  }
  function allocateTextureUnit() {
    const textureUnit = textureUnits;
    if (textureUnit >= capabilities.maxTextures) {
      warn(
        "WebGLTextures: Trying to use " +
          (textureUnit + 1) +
          " texture units while this GPU supports only " +
          capabilities.maxTextures,
      );
    }
    textureUnits += 1;
    return textureUnit;
  }
  function getTextureCacheKey(texture?: any) {
    const array: any[] = [];
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
  //
  function setTexture2D(texture?: any, slot?: any) {
    const textureProperties = properties.get(texture);
    if (texture.isVideoTexture) updateVideoTexture(texture);
    if (
      texture.isRenderTargetTexture === false &&
      texture.isExternalTexture !== true &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      const image = texture.image;
      if (image === null) {
        warn("WebGLRenderer: Texture marked for update but no image data found.");
      } else if (image.complete === false) {
        warn("WebGLRenderer: Texture marked for update but image is incomplete");
      } else {
        uploadTexture(textureProperties, texture, slot);
        return;
      }
    } else if (texture.isExternalTexture) {
      textureProperties.__webglTexture = texture.sourceTexture ? texture.sourceTexture : null;
    }
    state.bindTexture(GL.TEXTURE_2D, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }
  function setTexture2DArray(texture?: any, slot?: any) {
    const textureProperties = properties.get(texture);
    if (
      texture.isRenderTargetTexture === false &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      uploadTexture(textureProperties, texture, slot);
      return;
    } else if (texture.isExternalTexture) {
      textureProperties.__webglTexture = texture.sourceTexture ? texture.sourceTexture : null;
    }
    state.bindTexture(GL.TEXTURE_2D_ARRAY, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }
  function setTexture3D(texture?: any, slot?: any) {
    const textureProperties = properties.get(texture);
    if (
      texture.isRenderTargetTexture === false &&
      texture.version > 0 &&
      textureProperties.__version !== texture.version
    ) {
      uploadTexture(textureProperties, texture, slot);
      return;
    }
    state.bindTexture(GL.TEXTURE_3D, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }
  function setTextureCube(texture?: any, slot?: any) {
    const textureProperties = properties.get(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      uploadCubeTexture(textureProperties, texture, slot);
      return;
    }
    state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
  }
  const wrappingToGL: any = {
    [Wrapping.Repeat]: GL.REPEAT,
    [Wrapping.ClampToEdge]: GL.CLAMP_TO_EDGE,
    [Wrapping.MirroredRepeat]: GL.MIRRORED_REPEAT,
  };
  const filterToGL: any = {
    [TextureFilter.Nearest]: GL.NEAREST,
    [TextureFilter.NearestMipmapNearest]: GL.NEAREST_MIPMAP_NEAREST,
    [TextureFilter.NearestMipmapLinear]: GL.NEAREST_MIPMAP_LINEAR,
    [TextureFilter.Linear]: GL.LINEAR,
    [TextureFilter.LinearMipmapNearest]: GL.LINEAR_MIPMAP_NEAREST,
    [TextureFilter.LinearMipmapLinear]: GL.LINEAR_MIPMAP_LINEAR,
  };
  const compareToGL: any = {
    [Compare.Never]: GL.NEVER,
    [Compare.Always]: GL.ALWAYS,
    [Compare.Less]: GL.LESS,
    [Compare.LessEqual]: GL.LEQUAL,
    [Compare.Equal]: GL.EQUAL,
    [Compare.GreaterEqual]: GL.GEQUAL,
    [Compare.Greater]: GL.GREATER,
    [Compare.NotEqual]: GL.NOTEQUAL,
  };
  function setTextureParameters(textureType?: any, texture?: any) {
    if (
      texture.type === TextureType.Float &&
      extensions.has("OES_texture_float_linear") === false &&
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
    _gl.texParameteri(textureType, GL.TEXTURE_WRAP_S, (wrappingToGL as any)[texture.wrapS]);
    _gl.texParameteri(textureType, GL.TEXTURE_WRAP_T, (wrappingToGL as any)[texture.wrapT]);
    if (textureType === GL.TEXTURE_3D || textureType === GL.TEXTURE_2D_ARRAY) {
      _gl.texParameteri(textureType, GL.TEXTURE_WRAP_R, (wrappingToGL as any)[texture.wrapR]);
    }
    _gl.texParameteri(textureType, GL.TEXTURE_MAG_FILTER, (filterToGL as any)[texture.magFilter]);
    _gl.texParameteri(textureType, GL.TEXTURE_MIN_FILTER, (filterToGL as any)[texture.minFilter]);
    if (texture.compareFunction) {
      _gl.texParameteri(textureType, GL.TEXTURE_COMPARE_MODE, GL.COMPARE_REF_TO_TEXTURE);
      _gl.texParameteri(textureType, GL.TEXTURE_COMPARE_FUNC, (compareToGL as any)[texture.compareFunction]);
    }
    if (extensions.has("EXT_texture_filter_anisotropic") === true) {
      if (texture.magFilter === TextureFilter.Nearest) return;
      if (
        texture.minFilter !== TextureFilter.NearestMipmapLinear &&
        texture.minFilter !== TextureFilter.LinearMipmapLinear
      )
        return;
      if (texture.type === TextureType.Float && extensions.has("OES_texture_float_linear") === false) return; // verify extension
      if (texture.anisotropy > 1 || properties.get(texture).__currentAnisotropy) {
        const extension = extensions.get("EXT_texture_filter_anisotropic");
        _gl.texParameterf(
          textureType,
          extension.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(texture.anisotropy, capabilities.getMaxAnisotropy()),
        );
        properties.get(texture).__currentAnisotropy = texture.anisotropy;
      }
    }
  }
  function initTexture(textureProperties?: any, texture?: any) {
    let forceUpload = false;
    if (textureProperties.__webglInit === undefined) {
      textureProperties.__webglInit = true;
      texture.addEventListener("dispose", onTextureDispose);
      track(texture);
    }
    // create TextureSource <-> WebGLTextures mapping if necessary
    const source = texture.source;
    let webglTextures = _sources.get(source);
    if (webglTextures === undefined) {
      webglTextures = {};
      _sources.set(source, webglTextures);
    }
    // check if there is already a WebGLTexture object for the given texture parameters
    const textureCacheKey = getTextureCacheKey(texture);
    if (textureCacheKey !== textureProperties.__cacheKey) {
      // if not, create a new instance of WebGLTexture
      if (webglTextures[textureCacheKey] === undefined) {
        // create new entry
        webglTextures[textureCacheKey] = {
          texture: _gl.createTexture(),
          usedTimes: 0,
        };
        info.memory.textures++;
        // when a new instance of WebGLTexture was created, a texture upload is required
        // even if the image contents are identical
        forceUpload = true;
      }
      webglTextures[textureCacheKey].usedTimes++;
      // every time the texture cache key changes, it's necessary to check if an instance of
      // WebGLTexture can be deleted in order to avoid a memory leak.
      const webglTexture = webglTextures[textureProperties.__cacheKey];
      if (webglTexture !== undefined) {
        webglTextures[textureProperties.__cacheKey].usedTimes--;
        if (webglTexture.usedTimes === 0) {
          deleteTexture(texture);
        }
      }
      // store references to cache key and WebGLTexture object
      textureProperties.__cacheKey = textureCacheKey;
      textureProperties.__webglTexture = webglTextures[textureCacheKey].texture;
    }
    return forceUpload;
  }
  function getRow(index?: any, rowLength?: any, componentStride?: any) {
    return Math.floor(Math.floor(index / componentStride) / rowLength);
  }
  function updateTexture(texture?: any, image?: any, glFormat?: any, glType?: any) {
    const componentStride = 4; // only RGBA supported
    const updateRanges = texture.updateRanges;
    if (updateRanges.length === 0) {
      state.texSubImage2D(GL.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
    } else {
      // Before applying update ranges, we merge any adjacent / overlapping
      // ranges to reduce load on `gl.texSubImage2D`. Empirically, this has led
      // to performance improvements for applications which make heavy use of
      // update ranges. Likely due to GPU command overhead.
      //
      // Note that to reduce garbage collection between frames, we merge the
      // update ranges in-place. This is safe because this method will clear the
      // update ranges once updated.
      updateRanges.sort((a?: any, b?: any) => a.start - b.start);
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
        const currentRow = getRow(range.start, image.width, componentStride);
        const previousRow = getRow(previousRange.start, image.width, componentStride);
        // We add one here to merge adjacent ranges. This is safe because ranges
        // operate over positive integers.
        if (
          range.start <= previousEnd + 1 &&
          currentRow === previousRow &&
          getRow(range.start + range.count - 1, image.width, componentStride) === currentRow // ensure range doesn't spill
        ) {
          previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
        } else {
          ++mergeIndex;
          updateRanges[mergeIndex] = range;
        }
      }
      // Trim the array to only contain the merged ranges.
      updateRanges.length = mergeIndex + 1;
      const currentUnpackRowLen = state.getParameter(GL.UNPACK_ROW_LENGTH);
      const currentUnpackSkipPixels = state.getParameter(GL.UNPACK_SKIP_PIXELS);
      const currentUnpackSkipRows = state.getParameter(GL.UNPACK_SKIP_ROWS);
      state.pixelStorei(GL.UNPACK_ROW_LENGTH, image.width);
      for (let i = 0, l = updateRanges.length; i < l; i++) {
        const range = updateRanges[i];
        const pixelStart = Math.floor(range.start / componentStride);
        const pixelCount = Math.ceil(range.count / componentStride);
        const x = pixelStart % image.width;
        const y = Math.floor(pixelStart / image.width);
        // Assumes update ranges refer to contiguous memory
        const width = pixelCount;
        const height = 1;
        state.pixelStorei(GL.UNPACK_SKIP_PIXELS, x);
        state.pixelStorei(GL.UNPACK_SKIP_ROWS, y);
        state.texSubImage2D(GL.TEXTURE_2D, 0, x, y, width, height, glFormat, glType, image.data);
      }
      texture.clearUpdateRanges();
      state.pixelStorei(GL.UNPACK_ROW_LENGTH, currentUnpackRowLen);
      state.pixelStorei(GL.UNPACK_SKIP_PIXELS, currentUnpackSkipPixels);
      state.pixelStorei(GL.UNPACK_SKIP_ROWS, currentUnpackSkipRows);
    }
  }
  function uploadTexture(textureProperties?: any, texture?: any, slot?: any) {
    let textureType = GL.TEXTURE_2D;
    if (texture.isDataArrayTexture || texture.isCompressedArrayTexture) textureType = GL.TEXTURE_2D_ARRAY;
    if (texture.isData3DTexture) textureType = GL.TEXTURE_3D;
    const forceUpload = initTexture(textureProperties, texture);
    const source = texture.source;
    state.bindTexture(textureType, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
    const sourceProperties = properties.get(source);
    if (source.version !== sourceProperties.__version || forceUpload === true) {
      state.activeTexture(GL.TEXTURE0 + slot);
      const isImageBitmap = typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap;
      if (isImageBitmap === false) {
        const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
        const texturePrimaries =
          texture.colorSpace === ColorSpace.No ? null : ColorManagement.getPrimaries(texture.colorSpace);
        const unpackConversion =
          texture.colorSpace === ColorSpace.No || workingPrimaries === texturePrimaries
            ? GL.NONE
            : GL.BROWSER_DEFAULT_WEBGL;
        state.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, texture.flipY);
        state.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
        state.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
      }
      state.pixelStorei(GL.UNPACK_ALIGNMENT, texture.unpackAlignment);
      let image = resizeImage(texture.image, false, capabilities.maxTextureSize);
      image = verifyColorSpace(texture, image);
      const glFormat = utils.convert(texture.format, texture.colorSpace);
      const glType = utils.convert(texture.type);
      let glInternalFormat = getInternalFormat(
        texture.internalFormat,
        glFormat,
        glType,
        texture.normalized,
        texture.colorSpace,
        texture.isVideoTexture,
      );
      setTextureParameters(textureType, texture);
      let mipmap: any;
      const mipmaps = texture.mipmaps;
      const useTexStorage = texture.isVideoTexture !== true;
      const allocateMemory = sourceProperties.__version === undefined || forceUpload === true;
      const dataReady = source.dataReady;
      const levels = getMipLevels(texture, image);
      if (texture.isDepthTexture) {
        glInternalFormat = getInternalDepthFormat(texture.format === PixelFormat.DepthStencil, texture.type);
        //
        if (allocateMemory) {
          if (useTexStorage) {
            state.texStorage2D(GL.TEXTURE_2D, 1, glInternalFormat, image.width, image.height);
          } else {
            state.texImage2D(GL.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, null);
          }
        }
      } else if (texture.isDataTexture) {
        // use manually created mipmaps if available
        // if there are no manual mipmaps
        // set 0 level mipmap and then use GL to generate other mipmap levels
        if (mipmaps.length > 0) {
          if (useTexStorage && allocateMemory) {
            state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (useTexStorage) {
              if (dataReady) {
                state.texSubImage2D(GL.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
              }
            } else {
              state.texImage2D(
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
              state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
            }
            if (dataReady) {
              updateTexture(texture, image, glFormat, glType);
            }
          } else {
            state.texImage2D(
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
      } else if (texture.isCompressedTexture) {
        if (texture.isCompressedArrayTexture) {
          if (useTexStorage && allocateMemory) {
            state.texStorage3D(
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
                    if (texture.layerUpdates.size > 0) {
                      const layerByteLength = getByteLength(mipmap.width, mipmap.height, texture.format, texture.type);
                      for (const layerIndex of texture.layerUpdates) {
                        const layerData = mipmap.data.subarray(
                          (layerIndex * layerByteLength) / mipmap.data.BYTES_PER_ELEMENT,
                          ((layerIndex + 1) * layerByteLength) / mipmap.data.BYTES_PER_ELEMENT,
                        );
                        state.compressedTexSubImage3D(
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
                      state.compressedTexSubImage3D(
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
                  state.compressedTexImage3D(
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
                  state.texSubImage3D(
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
                state.texImage3D(
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
          if (texture.layerUpdates.size > 0) texture.clearLayerUpdates();
        } else {
          if (useTexStorage && allocateMemory) {
            state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (texture.format !== PixelFormat.RGBA) {
              if (glFormat !== null) {
                if (useTexStorage) {
                  if (dataReady) {
                    state.compressedTexSubImage2D(
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
                  state.compressedTexImage2D(
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
                  state.texSubImage2D(
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
                state.texImage2D(
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
      } else if (texture.isDataArrayTexture) {
        if (useTexStorage) {
          if (allocateMemory) {
            state.texStorage3D(GL.TEXTURE_2D_ARRAY, levels, glInternalFormat, image.width, image.height, image.depth);
          }
          if (dataReady) {
            if (texture.layerUpdates.size > 0) {
              const layerByteLength = getByteLength(image.width, image.height, texture.format, texture.type);
              for (const layerIndex of texture.layerUpdates) {
                const layerData = image.data.subarray(
                  (layerIndex * layerByteLength) / image.data.BYTES_PER_ELEMENT,
                  ((layerIndex + 1) * layerByteLength) / image.data.BYTES_PER_ELEMENT,
                );
                state.texSubImage3D(
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
              texture.clearLayerUpdates();
            } else {
              state.texSubImage3D(
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
          state.texImage3D(
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
      } else if (texture.isData3DTexture) {
        if (useTexStorage) {
          if (allocateMemory) {
            state.texStorage3D(GL.TEXTURE_3D, levels, glInternalFormat, image.width, image.height, image.depth);
          }
          if (dataReady) {
            state.texSubImage3D(
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
          state.texImage3D(
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
      } else if (texture.isFramebufferTexture) {
        if (allocateMemory) {
          if (useTexStorage) {
            state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
          } else {
            let width = image.width,
              height = image.height;
            for (let i = 0; i < levels; i++) {
              state.texImage2D(GL.TEXTURE_2D, i, glInternalFormat, width, height, 0, glFormat, glType, null);
              width >>= 1;
              height >>= 1;
            }
          }
        }
      } else if (texture.isHTMLTexture) {
        if ("texElementImage2D" in _gl) {
          const canvas = _gl.canvas;
          // Ensure the canvas supports HTML-in-Canvas and the element is a child.
          if (!canvas.hasAttribute("layoutsubtree")) {
            canvas.setAttribute("layoutsubtree", "true");
          }
          if (image.parentNode !== canvas) {
            canvas.appendChild(image);
            // Register and set up a shared paint callback for all HTMLTextures.
            _htmlTextures.add(texture);
            canvas.onpaint = (event?: any) => {
              const changed = event.changedElements;
              for (const t of _htmlTextures) {
                if (changed.includes(t.image)) {
                  t.needsUpdate = true;
                }
              }
            };
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
            _gl.texElementImage2D(GL.TEXTURE_2D, GL.RGBA8, image);
          } catch (error) {
            if (error instanceof DOMException && /snapshot/i.test(error.message)) {
              return; // retry after the pending paint cycle
            }
            // Chrome 138 - 149 (and the polyfill's unsupported overloads)
            const level = 0;
            const internalFormat = GL.RGBA;
            const srcFormat = GL.RGBA;
            const srcType = GL.UNSIGNED_BYTE;
            _gl.texElementImage2D(GL.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
          }
          _gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
          _gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
          _gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        }
      } else {
        // regular Texture (image, video, canvas)
        // use manually created mipmaps if available
        // if there are no manual mipmaps
        // set 0 level mipmap and then use GL to generate other mipmap levels
        if (mipmaps.length > 0) {
          if (useTexStorage && allocateMemory) {
            const dimensions = getDimensions(mipmaps[0]);
            state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
          }
          for (let i = 0, il = mipmaps.length; i < il; i++) {
            mipmap = mipmaps[i];
            if (useTexStorage) {
              if (dataReady) {
                state.texSubImage2D(GL.TEXTURE_2D, i, 0, 0, glFormat, glType, mipmap);
              }
            } else {
              state.texImage2D(GL.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
            }
          }
          texture.generateMipmaps = false;
        } else {
          if (useTexStorage) {
            if (allocateMemory) {
              const dimensions = getDimensions(image);
              state.texStorage2D(GL.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
            }
            if (dataReady) {
              state.texSubImage2D(GL.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
            }
          } else {
            state.texImage2D(GL.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
          }
        }
      }
      if (textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        generateMipmap(textureType);
      }
      sourceProperties.__version = source.version;
      if (texture.onUpdate) texture.onUpdate(texture);
    }
    textureProperties.__version = texture.version;
  }
  function uploadCubeTexture(textureProperties?: any, texture?: any, slot?: any) {
    if (texture.image.length !== 6) return;
    const forceUpload = initTexture(textureProperties, texture);
    const source = texture.source;
    state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture, GL.TEXTURE0 + slot);
    const sourceProperties = properties.get(source);
    if (source.version !== sourceProperties.__version || forceUpload === true) {
      state.activeTexture(GL.TEXTURE0 + slot);
      const workingPrimaries = ColorManagement.getPrimaries(ColorManagement.workingColorSpace);
      const texturePrimaries =
        texture.colorSpace === ColorSpace.No ? null : ColorManagement.getPrimaries(texture.colorSpace);
      const unpackConversion =
        texture.colorSpace === ColorSpace.No || workingPrimaries === texturePrimaries
          ? GL.NONE
          : GL.BROWSER_DEFAULT_WEBGL;
      state.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, texture.flipY);
      state.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
      state.pixelStorei(GL.UNPACK_ALIGNMENT, texture.unpackAlignment);
      state.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, unpackConversion);
      const isCompressed = texture.isCompressedTexture || texture.image[0].isCompressedTexture;
      const isDataTexture = texture.image[0] && texture.image[0].isDataTexture;
      const cubeImage: any[] = [];
      for (let i = 0; i < 6; i++) {
        if (!isCompressed && !isDataTexture) {
          cubeImage[i] = resizeImage(texture.image[i], true, capabilities.maxCubemapSize);
        } else {
          cubeImage[i] = isDataTexture ? texture.image[i].image : texture.image[i];
        }
        cubeImage[i] = verifyColorSpace(texture, cubeImage[i]);
      }
      const image = cubeImage[0],
        glFormat = utils.convert(texture.format, texture.colorSpace),
        glType = utils.convert(texture.type);
      let glInternalFormat = getInternalFormat(
        texture.internalFormat,
        glFormat,
        glType,
        texture.normalized,
        texture.colorSpace,
      );
      const useTexStorage = texture.isVideoTexture !== true;
      const allocateMemory = sourceProperties.__version === undefined || forceUpload === true;
      const dataReady = source.dataReady;
      let levels = getMipLevels(texture, image);
      setTextureParameters(GL.TEXTURE_CUBE_MAP, texture);
      let mipmaps: any;
      if (texture.isDepthTexture) {
        glInternalFormat = getInternalDepthFormat(texture.format === PixelFormat.DepthStencil, texture.type);
        //
        if (allocateMemory) {
          if (useTexStorage) {
            state.texStorage2D(GL.TEXTURE_CUBE_MAP, 1, glInternalFormat, image.width, image.height);
          } else {
            for (let i = 0; i < 6; i++) {
              state.texImage2D(
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
          state.texStorage2D(GL.TEXTURE_CUBE_MAP, levels, glInternalFormat, image.width, image.height);
        }
        for (let i = 0; i < 6; i++) {
          mipmaps = cubeImage[i].mipmaps;
          for (let j = 0; j < mipmaps.length; j++) {
            const mipmap = mipmaps[j];
            if (texture.format !== PixelFormat.RGBA) {
              if (glFormat !== null) {
                if (useTexStorage) {
                  if (dataReady) {
                    state.compressedTexSubImage2D(
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
                  state.compressedTexImage2D(
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
                  state.texSubImage2D(
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
                state.texImage2D(
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
          const dimensions = getDimensions(cubeImage[0]);
          state.texStorage2D(GL.TEXTURE_CUBE_MAP, levels, glInternalFormat, dimensions.width, dimensions.height);
        }
        for (let i = 0; i < 6; i++) {
          if (isDataTexture) {
            if (useTexStorage) {
              if (dataReady) {
                state.texSubImage2D(
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
              state.texImage2D(
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
                  state.texSubImage2D(
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
                state.texImage2D(
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
                state.texSubImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, glFormat, glType, cubeImage[i]);
              }
            } else {
              state.texImage2D(GL.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, glFormat, glType, cubeImage[i]);
            }
            for (let j = 0; j < mipmaps.length; j++) {
              const mipmap = mipmaps[j];
              if (useTexStorage) {
                if (dataReady) {
                  state.texSubImage2D(
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
                state.texImage2D(
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
      if (textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        // We assume images for cube map have the same size.
        generateMipmap(GL.TEXTURE_CUBE_MAP);
      }
      sourceProperties.__version = source.version;
      if (texture.onUpdate) texture.onUpdate(texture);
    }
    textureProperties.__version = texture.version;
  }
  // Render targets
  // Setup storage for target texture and bind it to correct framebuffer
  function setupFrameBufferTexture(
    framebuffer?: any,
    renderTarget?: any,
    texture?: any,
    attachment?: any,
    textureTarget?: any,
    level?: any,
  ) {
    const glFormat = utils.convert(texture.format, texture.colorSpace);
    const glType = utils.convert(texture.type);
    const glInternalFormat = getInternalFormat(
      texture.internalFormat,
      glFormat,
      glType,
      texture.normalized,
      texture.colorSpace,
    );
    const renderTargetProperties = properties.get(renderTarget);
    const textureProperties = properties.get(texture);
    textureProperties.__renderTarget = renderTarget;
    if (!renderTargetProperties.__hasExternalTextures) {
      const width = Math.max(1, renderTarget.width >> level);
      const height = Math.max(1, renderTarget.height >> level);
      if (textureTarget === GL.TEXTURE_3D || textureTarget === GL.TEXTURE_2D_ARRAY) {
        state.texImage3D(
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
        state.texImage2D(textureTarget, level, glInternalFormat, width, height, 0, glFormat, glType, null);
      }
    }
    state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    if (useMultisampledRTT(renderTarget)) {
      multisampledRTTExt.framebufferTexture2DMultisampleEXT(
        GL.FRAMEBUFFER,
        attachment,
        textureTarget,
        textureProperties.__webglTexture,
        0,
        getRenderTargetSamples(renderTarget),
      );
    } else if (
      textureTarget === GL.TEXTURE_2D ||
      (textureTarget >= GL.TEXTURE_CUBE_MAP_POSITIVE_X && textureTarget <= GL.TEXTURE_CUBE_MAP_NEGATIVE_Z)
    ) {
      // see #24753
      _gl.framebufferTexture2D(GL.FRAMEBUFFER, attachment, textureTarget, textureProperties.__webglTexture, level);
    }
    state.bindFramebuffer(GL.FRAMEBUFFER, null);
  }
  // Setup storage for internal depth/stencil buffers and bind to correct framebuffer
  function setupRenderBufferStorage(renderbuffer?: any, renderTarget?: any, useMultisample?: any) {
    _gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
    if (renderTarget.depthBuffer) {
      // retrieve the depth attachment types
      const depthTexture = renderTarget.depthTexture;
      const depthType = depthTexture && depthTexture.isDepthTexture ? depthTexture.type : null;
      const glInternalFormat = getInternalDepthFormat(renderTarget.stencilBuffer, depthType);
      const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
      // set up the attachment
      if (useMultisampledRTT(renderTarget)) {
        multisampledRTTExt.renderbufferStorageMultisampleEXT(
          GL.RENDERBUFFER,
          getRenderTargetSamples(renderTarget),
          glInternalFormat,
          renderTarget.width,
          renderTarget.height,
        );
      } else if (useMultisample) {
        _gl.renderbufferStorageMultisample(
          GL.RENDERBUFFER,
          getRenderTargetSamples(renderTarget),
          glInternalFormat,
          renderTarget.width,
          renderTarget.height,
        );
      } else {
        _gl.renderbufferStorage(GL.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
      }
      _gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
    } else {
      const textures = renderTarget.textures;
      for (let i = 0; i < textures.length; i++) {
        const texture = textures[i];
        const glFormat = utils.convert(texture.format, texture.colorSpace);
        const glType = utils.convert(texture.type);
        const glInternalFormat = getInternalFormat(
          texture.internalFormat,
          glFormat,
          glType,
          texture.normalized,
          texture.colorSpace,
        );
        if (useMultisampledRTT(renderTarget)) {
          multisampledRTTExt.renderbufferStorageMultisampleEXT(
            GL.RENDERBUFFER,
            getRenderTargetSamples(renderTarget),
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
        } else if (useMultisample) {
          _gl.renderbufferStorageMultisample(
            GL.RENDERBUFFER,
            getRenderTargetSamples(renderTarget),
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
        } else {
          _gl.renderbufferStorage(GL.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);
        }
      }
    }
    _gl.bindRenderbuffer(GL.RENDERBUFFER, null);
  }
  // Setup resources for a Depth Texture for a FBO (needs an extension)
  function setupDepthTexture(framebuffer?: any, renderTarget?: any, cubeFace?: any) {
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    state.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    if (!(renderTarget.depthTexture && renderTarget.depthTexture.isDepthTexture)) {
      throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");
    }
    const textureProperties = properties.get(renderTarget.depthTexture);
    textureProperties.__renderTarget = renderTarget;
    // upload an empty depth texture with framebuffer size
    const image = isCube ? renderTarget.depthTexture.image[0] : renderTarget.depthTexture.image;
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
      setTextureCube(renderTarget.depthTexture, 0);
    } else {
      setTexture2D(renderTarget.depthTexture, 0);
    }
    const webglDepthTexture = textureProperties.__webglTexture;
    const samples = getRenderTargetSamples(renderTarget);
    const glTextureType = isCube ? GL.TEXTURE_CUBE_MAP_POSITIVE_X + cubeFace : GL.TEXTURE_2D;
    const glAttachmentType =
      renderTarget.depthTexture.format === PixelFormat.DepthStencil ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
    if (renderTarget.depthTexture.format === PixelFormat.Depth) {
      if (useMultisampledRTT(renderTarget)) {
        multisampledRTTExt.framebufferTexture2DMultisampleEXT(
          GL.FRAMEBUFFER,
          glAttachmentType,
          glTextureType,
          webglDepthTexture,
          0,
          samples,
        );
      } else {
        _gl.framebufferTexture2D(GL.FRAMEBUFFER, glAttachmentType, glTextureType, webglDepthTexture, 0);
      }
    } else if (renderTarget.depthTexture.format === PixelFormat.DepthStencil) {
      if (useMultisampledRTT(renderTarget)) {
        multisampledRTTExt.framebufferTexture2DMultisampleEXT(
          GL.FRAMEBUFFER,
          glAttachmentType,
          glTextureType,
          webglDepthTexture,
          0,
          samples,
        );
      } else {
        _gl.framebufferTexture2D(GL.FRAMEBUFFER, glAttachmentType, glTextureType, webglDepthTexture, 0);
      }
    } else {
      throw new Error("THREE.WebGLTextures: Unknown depthTexture format.");
    }
  }
  // Setup GL resources for a non-texture depth buffer
  function setupDepthRenderbuffer(renderTarget?: any) {
    const renderTargetProperties = properties.get(renderTarget);
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
          setupDepthTexture(renderTargetProperties.__webglFramebuffer[i], renderTarget, i);
        }
      } else {
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          setupDepthTexture(renderTargetProperties.__webglFramebuffer[0], renderTarget, 0);
        } else {
          setupDepthTexture(renderTargetProperties.__webglFramebuffer, renderTarget, 0);
        }
      }
    } else {
      if (isCube) {
        renderTargetProperties.__webglDepthbuffer = [];
        for (let i = 0; i < 6; i++) {
          state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[i]);
          if (renderTargetProperties.__webglDepthbuffer[i] === undefined) {
            renderTargetProperties.__webglDepthbuffer[i] = _gl.createRenderbuffer();
            setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer[i], renderTarget, false);
          } else {
            // attach buffer if it's been created already
            const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
            const renderbuffer = renderTargetProperties.__webglDepthbuffer[i];
            _gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
            _gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
          }
        }
      } else {
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[0]);
        } else {
          state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
        }
        if (renderTargetProperties.__webglDepthbuffer === undefined) {
          renderTargetProperties.__webglDepthbuffer = _gl.createRenderbuffer();
          setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer, renderTarget, false);
        } else {
          // attach buffer if it's been created already
          const glAttachmentType = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
          const renderbuffer = renderTargetProperties.__webglDepthbuffer;
          _gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
          _gl.framebufferRenderbuffer(GL.FRAMEBUFFER, glAttachmentType, GL.RENDERBUFFER, renderbuffer);
        }
      }
    }
    state.bindFramebuffer(GL.FRAMEBUFFER, null);
  }
  // rebind framebuffer with external textures
  function rebindTextures(renderTarget?: any, colorTexture?: any, depthTexture?: any) {
    const renderTargetProperties = properties.get(renderTarget);
    if (colorTexture !== undefined) {
      setupFrameBufferTexture(
        renderTargetProperties.__webglFramebuffer,
        renderTarget,
        renderTarget.texture,
        GL.COLOR_ATTACHMENT0,
        GL.TEXTURE_2D,
        0,
      );
    }
    if (depthTexture !== undefined) {
      setupDepthRenderbuffer(renderTarget);
    }
  }
  // Set up GL resources for the render target
  function setupRenderTarget(renderTarget?: any) {
    const texture = renderTarget.texture;
    const renderTargetProperties = properties.get(renderTarget);
    const textureProperties = properties.get(texture);
    renderTarget.addEventListener("dispose", onRenderTargetDispose);
    track(renderTarget);
    const textures = renderTarget.textures;
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    const isMultipleRenderTargets = textures.length > 1;
    if (!isMultipleRenderTargets) {
      if (textureProperties.__webglTexture === undefined) {
        textureProperties.__webglTexture = _gl.createTexture();
      }
      textureProperties.__version = texture.version;
      info.memory.textures++;
    }
    // Setup framebuffer
    if (isCube) {
      renderTargetProperties.__webglFramebuffer = [];
      for (let i = 0; i < 6; i++) {
        if (texture.mipmaps.length > 0) {
          renderTargetProperties.__webglFramebuffer[i] = [];
          for (let level = 0; level < texture.mipmaps.length; level++) {
            renderTargetProperties.__webglFramebuffer[i][level] = _gl.createFramebuffer();
          }
        } else {
          renderTargetProperties.__webglFramebuffer[i] = _gl.createFramebuffer();
        }
      }
    } else {
      if (texture.mipmaps.length > 0) {
        renderTargetProperties.__webglFramebuffer = [];
        for (let level = 0; level < texture.mipmaps.length; level++) {
          renderTargetProperties.__webglFramebuffer[level] = _gl.createFramebuffer();
        }
      } else {
        renderTargetProperties.__webglFramebuffer = _gl.createFramebuffer();
      }
      if (isMultipleRenderTargets) {
        for (let i = 0, il = textures.length; i < il; i++) {
          const attachmentProperties = properties.get(textures[i]);
          if (attachmentProperties.__webglTexture === undefined) {
            attachmentProperties.__webglTexture = _gl.createTexture();
            info.memory.textures++;
          }
        }
      }
      if (renderTarget.samples > 0 && useMultisampledRTT(renderTarget) === false) {
        renderTargetProperties.__webglMultisampledFramebuffer = _gl.createFramebuffer();
        renderTargetProperties.__webglColorRenderbuffer = [];
        state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
        for (let i = 0; i < textures.length; i++) {
          const texture = textures[i];
          renderTargetProperties.__webglColorRenderbuffer[i] = _gl.createRenderbuffer();
          _gl.bindRenderbuffer(GL.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer[i]);
          const glFormat = utils.convert(texture.format, texture.colorSpace);
          const glType = utils.convert(texture.type);
          const glInternalFormat = getInternalFormat(
            texture.internalFormat,
            glFormat,
            glType,
            texture.normalized,
            texture.colorSpace,
          );
          const samples = getRenderTargetSamples(renderTarget);
          _gl.renderbufferStorageMultisample(
            GL.RENDERBUFFER,
            samples,
            glInternalFormat,
            renderTarget.width,
            renderTarget.height,
          );
          _gl.framebufferRenderbuffer(
            GL.FRAMEBUFFER,
            GL.COLOR_ATTACHMENT0 + i,
            GL.RENDERBUFFER,
            renderTargetProperties.__webglColorRenderbuffer[i],
          );
        }
        _gl.bindRenderbuffer(GL.RENDERBUFFER, null);
        if (renderTarget.depthBuffer) {
          renderTargetProperties.__webglDepthRenderbuffer = _gl.createRenderbuffer();
          setupRenderBufferStorage(renderTargetProperties.__webglDepthRenderbuffer, renderTarget, true);
        }
        state.bindFramebuffer(GL.FRAMEBUFFER, null);
      }
    }
    // Setup color buffer
    if (isCube) {
      state.bindTexture(GL.TEXTURE_CUBE_MAP, textureProperties.__webglTexture);
      setTextureParameters(GL.TEXTURE_CUBE_MAP, texture);
      for (let i = 0; i < 6; i++) {
        if (texture.mipmaps.length > 0) {
          for (let level = 0; level < texture.mipmaps.length; level++) {
            setupFrameBufferTexture(
              renderTargetProperties.__webglFramebuffer[i][level],
              renderTarget,
              texture,
              GL.COLOR_ATTACHMENT0,
              GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
              level,
            );
          }
        } else {
          setupFrameBufferTexture(
            renderTargetProperties.__webglFramebuffer[i],
            renderTarget,
            texture,
            GL.COLOR_ATTACHMENT0,
            GL.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            0,
          );
        }
      }
      if (textureNeedsGenerateMipmaps(texture)) {
        generateMipmap(GL.TEXTURE_CUBE_MAP);
      } else if (texture.mipmaps.length > 0) {
        // Limit the max level to keep partial mip chains complete.
        _gl.texParameteri(GL.TEXTURE_CUBE_MAP, GL.TEXTURE_MAX_LEVEL, texture.mipmaps.length - 1);
      }
      state.unbindTexture();
    } else if (isMultipleRenderTargets) {
      for (let i = 0, il = textures.length; i < il; i++) {
        const attachment = textures[i];
        const attachmentProperties = properties.get(attachment);
        let glTextureType = GL.TEXTURE_2D;
        if (renderTarget.isWebGL3DRenderTarget || renderTarget.isWebGLArrayRenderTarget) {
          glTextureType = renderTarget.isWebGL3DRenderTarget ? GL.TEXTURE_3D : GL.TEXTURE_2D_ARRAY;
        }
        state.bindTexture(glTextureType, attachmentProperties.__webglTexture);
        setTextureParameters(glTextureType, attachment);
        setupFrameBufferTexture(
          renderTargetProperties.__webglFramebuffer,
          renderTarget,
          attachment,
          GL.COLOR_ATTACHMENT0 + i,
          glTextureType,
          0,
        );
        if (textureNeedsGenerateMipmaps(attachment)) {
          generateMipmap(glTextureType);
        }
      }
      state.unbindTexture();
    } else {
      let glTextureType = GL.TEXTURE_2D;
      if (renderTarget.isWebGL3DRenderTarget || renderTarget.isWebGLArrayRenderTarget) {
        glTextureType = renderTarget.isWebGL3DRenderTarget ? GL.TEXTURE_3D : GL.TEXTURE_2D_ARRAY;
      }
      state.bindTexture(glTextureType, textureProperties.__webglTexture);
      setTextureParameters(glTextureType, texture);
      if (texture.mipmaps.length > 0) {
        for (let level = 0; level < texture.mipmaps.length; level++) {
          setupFrameBufferTexture(
            renderTargetProperties.__webglFramebuffer[level],
            renderTarget,
            texture,
            GL.COLOR_ATTACHMENT0,
            glTextureType,
            level,
          );
        }
      } else {
        setupFrameBufferTexture(
          renderTargetProperties.__webglFramebuffer,
          renderTarget,
          texture,
          GL.COLOR_ATTACHMENT0,
          glTextureType,
          0,
        );
      }
      if (textureNeedsGenerateMipmaps(texture)) {
        generateMipmap(glTextureType);
      } else if (texture.mipmaps.length > 0) {
        // Limit the max level to keep partial mip chains complete.
        _gl.texParameteri(glTextureType, GL.TEXTURE_MAX_LEVEL, texture.mipmaps.length - 1);
      }
      state.unbindTexture();
    }
    // Setup depth and stencil buffers
    if (renderTarget.depthBuffer) {
      setupDepthRenderbuffer(renderTarget);
    }
  }
  function updateRenderTargetMipmap(renderTarget?: any) {
    const textures = renderTarget.textures;
    for (let i = 0, il = textures.length; i < il; i++) {
      const texture = textures[i];
      if (textureNeedsGenerateMipmaps(texture) && texture.mipmapsAutoUpdate === true) {
        const targetType = getTargetType(renderTarget);
        const webglTexture = properties.get(texture).__webglTexture;
        state.bindTexture(targetType, webglTexture);
        generateMipmap(targetType);
        state.unbindTexture();
      }
    }
  }
  const invalidationArrayRead: any[] = [];
  function updateMultisampleRenderTarget(renderTarget?: any) {
    if (renderTarget.samples > 0) {
      if (useMultisampledRTT(renderTarget) === false) {
        const textures = renderTarget.textures;
        const width = renderTarget.width;
        const height = renderTarget.height;
        let mask = GL.COLOR_BUFFER_BIT;
        const depthStyle = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
        const renderTargetProperties = properties.get(renderTarget);
        const isMultipleRenderTargets = textures.length > 1;
        // If MRT we need to remove FBO attachments
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            _gl.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i, GL.RENDERBUFFER, null);
            state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            _gl.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i, GL.TEXTURE_2D, null, 0);
          }
        }
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
        const mipmaps = renderTarget.texture.mipmaps;
        if (mipmaps.length > 0) {
          state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[0]);
        } else {
          state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
        }
        for (let i = 0; i < textures.length; i++) {
          if (renderTarget.resolveDepthBuffer) {
            if (renderTarget.depthBuffer) mask |= GL.DEPTH_BUFFER_BIT;
            // resolving stencil is slow with a D3D backend. disable it for all transmission render targets (see #27799)
            if (renderTarget.stencilBuffer && renderTarget.resolveStencilBuffer) mask |= GL.STENCIL_BUFFER_BIT;
          }
          if (isMultipleRenderTargets) {
            _gl.framebufferRenderbuffer(
              GL.READ_FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0,
              GL.RENDERBUFFER,
              renderTargetProperties.__webglColorRenderbuffer[i],
            );
            const webglTexture = properties.get(textures[i]).__webglTexture;
            _gl.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, webglTexture, 0);
          }
          _gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, GL.NEAREST);
          if (supportsInvalidateFramebuffer === true) {
            invalidationArrayRead.length = 0;
            invalidationArrayRead.push(GL.COLOR_ATTACHMENT0 + i);
            if (renderTarget.depthBuffer && renderTarget.storeMultisampledDepthBuffer === false) {
              invalidationArrayRead.push(depthStyle);
            }
            _gl.invalidateFramebuffer(GL.READ_FRAMEBUFFER, invalidationArrayRead);
          }
        }
        state.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
        // If MRT since pre-blit we removed the FBO we need to reconstruct the attachments
        if (isMultipleRenderTargets) {
          for (let i = 0; i < textures.length; i++) {
            state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
            _gl.framebufferRenderbuffer(
              GL.FRAMEBUFFER,
              GL.COLOR_ATTACHMENT0 + i,
              GL.RENDERBUFFER,
              renderTargetProperties.__webglColorRenderbuffer[i],
            );
            const webglTexture = properties.get(textures[i]).__webglTexture;
            state.bindFramebuffer(GL.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
            _gl.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0 + i, GL.TEXTURE_2D, webglTexture, 0);
          }
        }
        state.bindFramebuffer(GL.DRAW_FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
      } else {
        if (
          renderTarget.depthBuffer &&
          renderTarget.storeMultisampledDepthBuffer === false &&
          supportsInvalidateFramebuffer
        ) {
          const depthStyle = renderTarget.stencilBuffer ? GL.DEPTH_STENCIL_ATTACHMENT : GL.DEPTH_ATTACHMENT;
          _gl.invalidateFramebuffer(GL.DRAW_FRAMEBUFFER, [depthStyle]);
        }
      }
    }
  }
  function getRenderTargetSamples(renderTarget?: any) {
    return Math.min(capabilities.maxSamples, renderTarget.samples);
  }
  function useMultisampledRTT(renderTarget?: any) {
    const renderTargetProperties = properties.get(renderTarget);
    return (
      renderTarget.samples > 0 &&
      extensions.has("WEBGL_multisampled_render_to_texture") === true &&
      renderTargetProperties.__useRenderToTexture !== false
    );
  }
  function updateVideoTexture(texture?: any) {
    const frame = info.render.frame;
    // Check the last frame we updated the VideoTexture
    if (_videoTextures.get(texture) !== frame) {
      _videoTextures.set(texture, frame);
      texture.update();
    }
  }
  function verifyColorSpace(texture?: any, image?: any) {
    const colorSpace = texture.colorSpace;
    const format = texture.format;
    const type = texture.type;
    if (texture.isCompressedTexture === true || texture.isVideoTexture === true) return image;
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
  function getDimensions(image?: any) {
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
      // if intrinsic data are not available, fallback to width/height
      _imageDimensions.width = image.naturalWidth || image.width;
      _imageDimensions.height = image.naturalHeight || image.height;
    } else if (typeof VideoFrame !== "undefined" && image instanceof VideoFrame) {
      _imageDimensions.width = image.displayWidth;
      _imageDimensions.height = image.displayHeight;
    } else {
      _imageDimensions.width = image.width;
      _imageDimensions.height = image.height;
    }
    return _imageDimensions;
  }
  //
  this.allocateTextureUnit = allocateTextureUnit;
  this.resetTextureUnits = resetTextureUnits;
  this.getTextureUnits = getTextureUnits;
  this.setTextureUnits = setTextureUnits;
  this.setTexture2D = setTexture2D;
  this.setTexture2DArray = setTexture2DArray;
  this.setTexture3D = setTexture3D;
  this.setTextureCube = setTextureCube;
  this.rebindTextures = rebindTextures;
  this.setupRenderTarget = setupRenderTarget;
  this.updateRenderTargetMipmap = updateRenderTargetMipmap;
  this.updateMultisampleRenderTarget = updateMultisampleRenderTarget;
  this.setupDepthRenderbuffer = setupDepthRenderbuffer;
  this.setupFrameBufferTexture = setupFrameBufferTexture;
  this.useMultisampledRTT = useMultisampledRTT;
  this.dispose = dispose;
}
