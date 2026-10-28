import { GL } from "../../GL";
import { DepthFunc, CullFace, Side, Blending, Equation, Factor } from "../../constants";
import { Color } from "../../math/Color";
import { Vector4 } from "../../math/Vector4";
import { error, ReversedDepthFuncs } from "../../utils";
export function WebGLState(gl?: any, extensions?: any) {
  function ColorBuffer() {
    let locked = false;
    const color = new Vector4();
    let currentColorMask: any = null;
    const currentColorClear = new Vector4(0, 0, 0, 0);
    return {
      setMask: function (colorMask?: any) {
        if (currentColorMask !== colorMask && !locked) {
          gl.colorMask(colorMask, colorMask, colorMask, colorMask);
          currentColorMask = colorMask;
        }
      },
      setLocked: function (lock?: any) {
        locked = lock;
      },
      setClear: function (r?: any, g?: any, b?: any, a?: any, premultipliedAlpha?: any) {
        if (premultipliedAlpha === true) {
          r *= a;
          g *= a;
          b *= a;
        }
        color.set(r, g, b, a);
        if (currentColorClear.equals(color) === false) {
          gl.clearColor(r, g, b, a);
          currentColorClear.copy(color);
        }
      },
      reset: function () {
        locked = false;
        currentColorMask = null;
        currentColorClear.set(-1, 0, 0, 0); // set to invalid state
      },
    };
  }
  function DepthBuffer() {
    let locked = false;
    let currentReversed = false;
    let currentDepthMask: any = null;
    let currentDepthFunc: any = null;
    let currentDepthClear: any = null;
    return {
      setReversed: function (this: any, reversed?: any) {
        if (currentReversed !== reversed) {
          const ext = extensions.get("EXT_clip_control");
          if (reversed) {
            ext.clipControlEXT(ext.LOWER_LEFT_EXT, ext.ZERO_TO_ONE_EXT);
          } else {
            ext.clipControlEXT(ext.LOWER_LEFT_EXT, ext.NEGATIVE_ONE_TO_ONE_EXT);
          }
          currentReversed = reversed;
          const oldDepth = currentDepthClear;
          currentDepthClear = null;
          this.setClear(oldDepth);
        }
      },
      getReversed: function () {
        return currentReversed;
      },
      setTest: function (depthTest?: any) {
        if (depthTest) {
          enable(GL.DEPTH_TEST);
        } else {
          disable(GL.DEPTH_TEST);
        }
      },
      setMask: function (depthMask?: any) {
        if (currentDepthMask !== depthMask && !locked) {
          gl.depthMask(depthMask);
          currentDepthMask = depthMask;
        }
      },
      setFunc: function (depthFunc?: any) {
        if (currentReversed) depthFunc = (ReversedDepthFuncs as any)[depthFunc];
        if (currentDepthFunc !== depthFunc) {
          switch (depthFunc) {
            case DepthFunc.Never:
              gl.depthFunc(GL.NEVER);
              break;
            case DepthFunc.Always:
              gl.depthFunc(GL.ALWAYS);
              break;
            case DepthFunc.Less:
              gl.depthFunc(GL.LESS);
              break;
            case DepthFunc.LessEqual:
              gl.depthFunc(GL.LEQUAL);
              break;
            case DepthFunc.Equal:
              gl.depthFunc(GL.EQUAL);
              break;
            case DepthFunc.GreaterEqual:
              gl.depthFunc(GL.GEQUAL);
              break;
            case DepthFunc.Greater:
              gl.depthFunc(GL.GREATER);
              break;
            case DepthFunc.NotEqual:
              gl.depthFunc(GL.NOTEQUAL);
              break;
            default:
              gl.depthFunc(GL.LEQUAL);
          }
          currentDepthFunc = depthFunc;
        }
      },
      setLocked: function (lock?: any) {
        locked = lock;
      },
      setClear: function (depth?: any) {
        if (currentDepthClear !== depth) {
          currentDepthClear = depth;
          if (currentReversed) {
            depth = 1 - depth;
          }
          gl.clearDepth(depth);
        }
      },
      reset: function () {
        locked = false;
        currentDepthMask = null;
        currentDepthFunc = null;
        currentDepthClear = null;
        currentReversed = false;
      },
    };
  }
  function StencilBuffer() {
    let locked = false;
    let currentStencilMask: any = null;
    let currentStencilFunc: any = null;
    let currentStencilRef: any = null;
    let currentStencilFuncMask: any = null;
    let currentStencilFail: any = null;
    let currentStencilZFail: any = null;
    let currentStencilZPass: any = null;
    let currentStencilClear: any = null;
    return {
      setTest: function (stencilTest?: any) {
        if (!locked) {
          if (stencilTest) {
            enable(GL.STENCIL_TEST);
          } else {
            disable(GL.STENCIL_TEST);
          }
        }
      },
      setMask: function (stencilMask?: any) {
        if (currentStencilMask !== stencilMask && !locked) {
          gl.stencilMask(stencilMask);
          currentStencilMask = stencilMask;
        }
      },
      setFunc: function (stencilFunc?: any, stencilRef?: any, stencilMask?: any) {
        if (
          currentStencilFunc !== stencilFunc ||
          currentStencilRef !== stencilRef ||
          currentStencilFuncMask !== stencilMask
        ) {
          gl.stencilFunc(stencilFunc, stencilRef, stencilMask);
          currentStencilFunc = stencilFunc;
          currentStencilRef = stencilRef;
          currentStencilFuncMask = stencilMask;
        }
      },
      setOp: function (stencilFail?: any, stencilZFail?: any, stencilZPass?: any) {
        if (
          currentStencilFail !== stencilFail ||
          currentStencilZFail !== stencilZFail ||
          currentStencilZPass !== stencilZPass
        ) {
          gl.stencilOp(stencilFail, stencilZFail, stencilZPass);
          currentStencilFail = stencilFail;
          currentStencilZFail = stencilZFail;
          currentStencilZPass = stencilZPass;
        }
      },
      setLocked: function (lock?: any) {
        locked = lock;
      },
      setClear: function (stencil?: any) {
        if (currentStencilClear !== stencil) {
          gl.clearStencil(stencil);
          currentStencilClear = stencil;
        }
      },
      reset: function () {
        locked = false;
        currentStencilMask = null;
        currentStencilFunc = null;
        currentStencilRef = null;
        currentStencilFuncMask = null;
        currentStencilFail = null;
        currentStencilZFail = null;
        currentStencilZPass = null;
        currentStencilClear = null;
      },
    };
  }
  //
  const colorBuffer = new (ColorBuffer as any)();
  const depthBuffer = new (DepthBuffer as any)();
  const stencilBuffer = new (StencilBuffer as any)();
  let uboBindings: any = {};
  const uboProgramMap = new WeakMap<any, any>();
  let enabledCapabilities: any = {};
  let parameters: any = {};
  let currentBoundFramebuffers: any = {};
  let currentDrawbuffers = new WeakMap<any, any>();
  let defaultDrawbuffers: any[] = [];
  let currentProgram: any = null;
  let currentBlendingEnabled = false;
  let currentBlending: any = null;
  let currentBlendEquation: any = null;
  let currentBlendSrc: any = null;
  let currentBlendDst: any = null;
  let currentBlendEquationAlpha: any = null;
  let currentBlendSrcAlpha: any = null;
  let currentBlendDstAlpha: any = null;
  let currentBlendColor = new Color(0, 0, 0);
  let currentBlendAlpha = 0;
  let currentPremultipledAlpha = false;
  let currentFlipSided: any = null;
  let currentCullFace: CullFace | null | undefined = null;
  let currentLineWidth: any = null;
  let currentPolygonOffsetFactor: any = null;
  let currentPolygonOffsetUnits: any = null;
  const maxTextures = gl.getParameter(GL.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  let lineWidthAvailable = false;
  let version = 0;
  const glVersion = gl.getParameter(GL.VERSION);
  if (glVersion.indexOf("WebGL") !== -1) {
    version = parseFloat((/^WebGL (\d)/.exec(glVersion) as any)[1]);
    lineWidthAvailable = version >= 1.0;
  } else if (glVersion.indexOf("OpenGL ES") !== -1) {
    version = parseFloat((/^OpenGL ES (\d)/.exec(glVersion) as any)[1]);
    lineWidthAvailable = version >= 2.0;
  }
  let currentTextureSlot: any = null;
  let currentBoundTextures: any = {};
  const scissorParam = gl.getParameter(GL.SCISSOR_BOX);
  const viewportParam = gl.getParameter(GL.VIEWPORT);
  const currentScissor = new Vector4().fromArray(scissorParam);
  const currentViewport = new Vector4().fromArray(viewportParam);
  function createTexture(type?: any, target?: any, count?: any, dimensions?: any) {
    const data = new Uint8Array(4); // 4 is required to match default unpack alignment of 4.
    const texture = gl.createTexture();
    gl.bindTexture(type, texture);
    gl.texParameteri(type, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texParameteri(type, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    for (let i = 0; i < count; i++) {
      if (type === GL.TEXTURE_3D || type === GL.TEXTURE_2D_ARRAY) {
        gl.texImage3D(target, 0, GL.RGBA, 1, 1, dimensions, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
      } else {
        gl.texImage2D(target + i, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
      }
    }
    return texture;
  }
  const emptyTextures: any = {};
  (emptyTextures as any)[GL.TEXTURE_2D] = createTexture(GL.TEXTURE_2D, GL.TEXTURE_2D, 1);
  (emptyTextures as any)[GL.TEXTURE_CUBE_MAP] = createTexture(GL.TEXTURE_CUBE_MAP, GL.TEXTURE_CUBE_MAP_POSITIVE_X, 6);
  (emptyTextures as any)[GL.TEXTURE_2D_ARRAY] = createTexture(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_2D_ARRAY, 1, 1);
  (emptyTextures as any)[GL.TEXTURE_3D] = createTexture(GL.TEXTURE_3D, GL.TEXTURE_3D, 1, 1);
  // init
  colorBuffer.setClear(0, 0, 0, 1);
  depthBuffer.setClear(1);
  stencilBuffer.setClear(0);
  enable(GL.DEPTH_TEST);
  depthBuffer.setFunc(DepthFunc.LessEqual);
  setFlipSided(false);
  setCullFace(CullFace.Back);
  enable(GL.CULL_FACE);
  setBlending(Blending.No);
  //
  function enable(id?: any) {
    if ((enabledCapabilities as any)[id] !== true) {
      gl.enable(id);
      (enabledCapabilities as any)[id] = true;
    }
  }
  function disable(id?: any) {
    if ((enabledCapabilities as any)[id] !== false) {
      gl.disable(id);
      (enabledCapabilities as any)[id] = false;
    }
  }
  function bindFramebuffer(target?: any, framebuffer?: any) {
    if ((currentBoundFramebuffers as any)[target] !== framebuffer) {
      gl.bindFramebuffer(target, framebuffer);
      (currentBoundFramebuffers as any)[target] = framebuffer;
      // GL.DRAW_FRAMEBUFFER is equivalent to GL.FRAMEBUFFER
      if (target === GL.DRAW_FRAMEBUFFER) {
        (currentBoundFramebuffers as any)[GL.FRAMEBUFFER] = framebuffer;
      }
      if (target === GL.FRAMEBUFFER) {
        (currentBoundFramebuffers as any)[GL.DRAW_FRAMEBUFFER] = framebuffer;
      }
      return true;
    }
    return false;
  }
  function drawBuffers(renderTarget?: any, framebuffer?: any) {
    let drawBuffers = defaultDrawbuffers;
    let needsUpdate = false;
    if (renderTarget) {
      drawBuffers = currentDrawbuffers.get(framebuffer);
      if (drawBuffers === undefined) {
        drawBuffers = [];
        currentDrawbuffers.set(framebuffer, drawBuffers);
      }
      const textures = renderTarget.textures;
      if (drawBuffers.length !== textures.length || drawBuffers[0] !== GL.COLOR_ATTACHMENT0) {
        for (let i = 0, il = textures.length; i < il; i++) {
          drawBuffers[i] = GL.COLOR_ATTACHMENT0 + i;
        }
        drawBuffers.length = textures.length;
        needsUpdate = true;
      }
    } else {
      if (drawBuffers[0] !== GL.BACK) {
        drawBuffers[0] = GL.BACK;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      gl.drawBuffers(drawBuffers);
    }
  }
  function useProgram(program?: any) {
    if (currentProgram !== program) {
      gl.useProgram(program);
      currentProgram = program;
      return true;
    }
    return false;
  }
  const equationToGL: any = {
    [Equation.Add]: GL.FUNC_ADD,
    [Equation.Subtract]: GL.FUNC_SUBTRACT,
    [Equation.ReverseSubtract]: GL.FUNC_REVERSE_SUBTRACT,
  };
  (equationToGL as any)[Equation.Min] = GL.MIN;
  (equationToGL as any)[Equation.Max] = GL.MAX;
  const factorToGL: any = {
    [Factor.Zero]: GL.ZERO,
    [Factor.One]: GL.ONE,
    [Factor.SrcColor]: GL.SRC_COLOR,
    [Factor.SrcAlpha]: GL.SRC_ALPHA,
    [Factor.SrcAlphaSaturate]: GL.SRC_ALPHA_SATURATE,
    [Factor.DstColor]: GL.DST_COLOR,
    [Factor.DstAlpha]: GL.DST_ALPHA,
    [Factor.OneMinusSrcColor]: GL.ONE_MINUS_SRC_COLOR,
    [Factor.OneMinusSrcAlpha]: GL.ONE_MINUS_SRC_ALPHA,
    [Factor.OneMinusDstColor]: GL.ONE_MINUS_DST_COLOR,
    [Factor.OneMinusDstAlpha]: GL.ONE_MINUS_DST_ALPHA,
    [Factor.ConstantColor]: GL.CONSTANT_COLOR,
    [Factor.OneMinusConstantColor]: GL.ONE_MINUS_CONSTANT_COLOR,
    [Factor.ConstantAlpha]: GL.CONSTANT_ALPHA,
    [Factor.OneMinusConstantAlpha]: GL.ONE_MINUS_CONSTANT_ALPHA,
  };
  function setBlending(
    blending?: any,
    blendEquation?: any,
    blendSrc?: any,
    blendDst?: any,
    blendEquationAlpha?: any,
    blendSrcAlpha?: any,
    blendDstAlpha?: any,
    blendColor?: any,
    blendAlpha?: any,
    premultipliedAlpha?: any,
  ) {
    if (blending === Blending.No) {
      if (currentBlendingEnabled === true) {
        disable(GL.BLEND);
        currentBlendingEnabled = false;
      }
      return;
    }
    if (currentBlendingEnabled === false) {
      enable(GL.BLEND);
      currentBlendingEnabled = true;
    }
    if (blending !== Blending.Custom) {
      if (blending !== currentBlending || premultipliedAlpha !== currentPremultipledAlpha) {
        if (currentBlendEquation !== Equation.Add || currentBlendEquationAlpha !== Equation.Add) {
          gl.blendEquation(GL.FUNC_ADD);
          currentBlendEquation = Equation.Add;
          currentBlendEquationAlpha = Equation.Add;
        }
        if (premultipliedAlpha) {
          switch (blending) {
            case Blending.Normal:
              gl.blendFuncSeparate(GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
              break;
            case Blending.Additive:
              gl.blendFunc(GL.ONE, GL.ONE);
              break;
            case Blending.Subtractive:
              gl.blendFuncSeparate(GL.ZERO, GL.ONE_MINUS_SRC_COLOR, GL.ZERO, GL.ONE);
              break;
            case Blending.Multiply:
              gl.blendFuncSeparate(GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA, GL.ZERO, GL.ONE);
              break;
            default:
              error("WebGLState: Invalid blending: ", blending);
              break;
          }
        } else {
          switch (blending) {
            case Blending.Normal:
              gl.blendFuncSeparate(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
              break;
            case Blending.Additive:
              gl.blendFuncSeparate(GL.SRC_ALPHA, GL.ONE, GL.ONE, GL.ONE);
              break;
            case Blending.Subtractive:
              error("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");
              break;
            case Blending.Multiply:
              error("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");
              break;
            default:
              error("WebGLState: Invalid blending: ", blending);
              break;
          }
        }
        currentBlendSrc = null;
        currentBlendDst = null;
        currentBlendSrcAlpha = null;
        currentBlendDstAlpha = null;
        currentBlendColor.set(0, 0, 0);
        currentBlendAlpha = 0;
        currentBlending = blending;
        currentPremultipledAlpha = premultipliedAlpha;
      }
      return;
    }
    // custom blending
    blendEquationAlpha = blendEquationAlpha || blendEquation;
    blendSrcAlpha = blendSrcAlpha || blendSrc;
    blendDstAlpha = blendDstAlpha || blendDst;
    if (blendEquation !== currentBlendEquation || blendEquationAlpha !== currentBlendEquationAlpha) {
      gl.blendEquationSeparate((equationToGL as any)[blendEquation], (equationToGL as any)[blendEquationAlpha]);
      currentBlendEquation = blendEquation;
      currentBlendEquationAlpha = blendEquationAlpha;
    }
    if (
      blendSrc !== currentBlendSrc ||
      blendDst !== currentBlendDst ||
      blendSrcAlpha !== currentBlendSrcAlpha ||
      blendDstAlpha !== currentBlendDstAlpha
    ) {
      gl.blendFuncSeparate(
        (factorToGL as any)[blendSrc],
        (factorToGL as any)[blendDst],
        (factorToGL as any)[blendSrcAlpha],
        (factorToGL as any)[blendDstAlpha],
      );
      currentBlendSrc = blendSrc;
      currentBlendDst = blendDst;
      currentBlendSrcAlpha = blendSrcAlpha;
      currentBlendDstAlpha = blendDstAlpha;
    }
    if (blendColor.equals(currentBlendColor) === false || blendAlpha !== currentBlendAlpha) {
      gl.blendColor(blendColor.r, blendColor.g, blendColor.b, blendAlpha);
      currentBlendColor.copy(blendColor);
      currentBlendAlpha = blendAlpha;
    }
    currentBlending = blending;
    currentPremultipledAlpha = false;
  }
  function setMaterial(material?: any, frontFaceCW?: any) {
    if (material.side === Side.Double) disable(GL.CULL_FACE);
    else enable(GL.CULL_FACE);
    let flipSided = material.side === Side.Back;
    if (frontFaceCW) flipSided = !flipSided;
    setFlipSided(flipSided);
    if (material.blending === Blending.Normal && material.transparent === false) {
      setBlending(Blending.No);
    } else {
      setBlending(
        material.blending,
        material.blendEquation,
        material.blendSrc,
        material.blendDst,
        material.blendEquationAlpha,
        material.blendSrcAlpha,
        material.blendDstAlpha,
        material.blendColor,
        material.blendAlpha,
        material.premultipliedAlpha,
      );
    }
    depthBuffer.setFunc(material.depthFunc);
    depthBuffer.setTest(material.depthTest);
    depthBuffer.setMask(material.depthWrite);
    colorBuffer.setMask(material.colorWrite);
    const stencilWrite = material.stencilWrite;
    stencilBuffer.setTest(stencilWrite);
    if (stencilWrite) {
      stencilBuffer.setMask(material.stencilWriteMask);
      stencilBuffer.setFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
      stencilBuffer.setOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
    }
    setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
    if (material.alphaToCoverage === true) enable(GL.SAMPLE_ALPHA_TO_COVERAGE);
    else disable(GL.SAMPLE_ALPHA_TO_COVERAGE);
  }
  //
  function setFlipSided(flipSided?: any) {
    if (currentFlipSided !== flipSided) {
      if (flipSided) {
        gl.frontFace(GL.CW);
      } else {
        gl.frontFace(GL.CCW);
      }
      currentFlipSided = flipSided;
    }
  }
  function setCullFace(cullFace?: CullFace) {
    if (cullFace !== CullFace.None) {
      enable(GL.CULL_FACE);
      if (cullFace !== currentCullFace) {
        if (cullFace === CullFace.Back) {
          gl.cullFace(GL.BACK);
        } else if (cullFace === CullFace.Front) {
          gl.cullFace(GL.FRONT);
        } else {
          gl.cullFace(GL.FRONT_AND_BACK);
        }
      }
    } else {
      disable(GL.CULL_FACE);
    }
    currentCullFace = cullFace;
  }
  function setLineWidth(width?: any) {
    if (width !== currentLineWidth) {
      if (lineWidthAvailable) gl.lineWidth(width);
      currentLineWidth = width;
    }
  }
  function setPolygonOffset(polygonOffset?: any, factor?: any, units?: any) {
    if (polygonOffset) {
      enable(GL.POLYGON_OFFSET_FILL);
      if (currentPolygonOffsetFactor !== factor || currentPolygonOffsetUnits !== units) {
        currentPolygonOffsetFactor = factor;
        currentPolygonOffsetUnits = units;
        if (depthBuffer.getReversed()) {
          factor = -factor;
          units = -units;
        }
        gl.polygonOffset(factor, units);
      }
    } else {
      disable(GL.POLYGON_OFFSET_FILL);
    }
  }
  function setScissorTest(scissorTest?: any) {
    if (scissorTest) {
      enable(GL.SCISSOR_TEST);
    } else {
      disable(GL.SCISSOR_TEST);
    }
  }
  // texture
  function activeTexture(webglSlot?: any) {
    if (webglSlot === undefined) webglSlot = GL.TEXTURE0 + maxTextures - 1;
    if (currentTextureSlot !== webglSlot) {
      gl.activeTexture(webglSlot);
      currentTextureSlot = webglSlot;
    }
  }
  function bindTexture(webglType?: any, webglTexture?: any, webglSlot?: any) {
    if (webglSlot === undefined) {
      if (currentTextureSlot === null) {
        webglSlot = GL.TEXTURE0 + maxTextures - 1;
      } else {
        webglSlot = currentTextureSlot;
      }
    }
    let boundTexture = (currentBoundTextures as any)[webglSlot];
    if (boundTexture === undefined) {
      boundTexture = { type: undefined, texture: undefined };
      (currentBoundTextures as any)[webglSlot] = boundTexture;
    }
    if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {
      if (currentTextureSlot !== webglSlot) {
        gl.activeTexture(webglSlot);
        currentTextureSlot = webglSlot;
      }
      gl.bindTexture(webglType, webglTexture || (emptyTextures as any)[webglType]);
      boundTexture.type = webglType;
      boundTexture.texture = webglTexture;
    }
  }
  function unbindTexture() {
    const boundTexture = (currentBoundTextures as any)[currentTextureSlot];
    if (boundTexture !== undefined && boundTexture.type !== undefined) {
      gl.bindTexture(boundTexture.type, null);
      boundTexture.type = undefined;
      boundTexture.texture = undefined;
    }
  }
  function compressedTexImage2D() {
    try {
      gl.compressedTexImage2D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function compressedTexImage3D() {
    try {
      gl.compressedTexImage3D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texSubImage2D() {
    try {
      gl.texSubImage2D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texSubImage3D() {
    try {
      gl.texSubImage3D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function compressedTexSubImage2D() {
    try {
      gl.compressedTexSubImage2D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function compressedTexSubImage3D() {
    try {
      gl.compressedTexSubImage3D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texStorage2D() {
    try {
      gl.texStorage2D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texStorage3D() {
    try {
      gl.texStorage3D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texImage2D() {
    try {
      gl.texImage2D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function texImage3D() {
    try {
      gl.texImage3D(...arguments);
    } catch (e: any) {
      error("WebGLState:", e);
    }
  }
  function getParameter(name?: any) {
    if ((parameters as any)[name] !== undefined) {
      return (parameters as any)[name];
    } else {
      return gl.getParameter(name);
    }
  }
  function pixelStorei(name?: any, value?: any) {
    if ((parameters as any)[name] !== value) {
      gl.pixelStorei(name, value);
      (parameters as any)[name] = value;
    }
  }
  //
  function scissor(scissor?: any) {
    if (currentScissor.equals(scissor) === false) {
      gl.scissor(scissor.x, scissor.y, scissor.z, scissor.w);
      currentScissor.copy(scissor);
    }
  }
  function viewport(viewport?: any) {
    if (currentViewport.equals(viewport) === false) {
      gl.viewport(viewport.x, viewport.y, viewport.z, viewport.w);
      currentViewport.copy(viewport);
    }
  }
  function updateUBOMapping(uniformsGroup?: any, program?: any) {
    let mapping = uboProgramMap.get(program);
    if (mapping === undefined) {
      mapping = new WeakMap();
      uboProgramMap.set(program, mapping);
    }
    let blockIndex = mapping.get(uniformsGroup);
    if (blockIndex === undefined) {
      blockIndex = gl.getUniformBlockIndex(program, uniformsGroup.name);
      // use the block index as the binding point
      gl.uniformBlockBinding(program, blockIndex, blockIndex);
      mapping.set(uniformsGroup, blockIndex);
    }
  }
  function uniformBlockBinding(uniformsGroup?: any, program?: any, buffer?: any) {
    const mapping = uboProgramMap.get(program);
    const blockIndex = mapping.get(uniformsGroup);
    if ((uboBindings as any)[blockIndex] !== buffer) {
      gl.bindBufferBase(GL.UNIFORM_BUFFER, blockIndex, buffer);
      (uboBindings as any)[blockIndex] = buffer;
    }
  }
  //
  function reset() {
    // reset state
    gl.disable(GL.BLEND);
    gl.disable(GL.CULL_FACE);
    gl.disable(GL.DEPTH_TEST);
    gl.disable(GL.POLYGON_OFFSET_FILL);
    gl.disable(GL.SCISSOR_TEST);
    gl.disable(GL.STENCIL_TEST);
    gl.disable(GL.SAMPLE_ALPHA_TO_COVERAGE);
    gl.blendEquation(GL.FUNC_ADD);
    gl.blendFunc(GL.ONE, GL.ZERO);
    gl.blendFuncSeparate(GL.ONE, GL.ZERO, GL.ONE, GL.ZERO);
    gl.blendColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.depthFunc(GL.LESS);
    depthBuffer.setReversed(false);
    gl.clearDepth(1);
    gl.stencilMask(0xffffffff);
    gl.stencilFunc(GL.ALWAYS, 0, 0xffffffff);
    gl.stencilOp(GL.KEEP, GL.KEEP, GL.KEEP);
    gl.clearStencil(0);
    gl.cullFace(GL.BACK);
    gl.frontFace(GL.CCW);
    gl.polygonOffset(0, 0);
    gl.activeTexture(GL.TEXTURE0);
    gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    gl.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
    gl.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
    gl.useProgram(null);
    gl.lineWidth(1);
    gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.pixelStorei(GL.PACK_ALIGNMENT, 4);
    gl.pixelStorei(GL.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.BROWSER_DEFAULT_WEBGL);
    gl.pixelStorei(GL.PACK_ROW_LENGTH, 0);
    gl.pixelStorei(GL.PACK_SKIP_PIXELS, 0);
    gl.pixelStorei(GL.PACK_SKIP_ROWS, 0);
    gl.pixelStorei(GL.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, 0);
    gl.pixelStorei(GL.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(GL.UNPACK_SKIP_ROWS, 0);
    gl.pixelStorei(GL.UNPACK_SKIP_IMAGES, 0);
    // reset internals
    enabledCapabilities = {};
    parameters = {};
    currentTextureSlot = null;
    currentBoundTextures = {};
    currentBoundFramebuffers = {};
    uboBindings = {};
    currentDrawbuffers = new WeakMap();
    defaultDrawbuffers = [];
    currentProgram = null;
    currentBlendingEnabled = false;
    currentBlending = null;
    currentBlendEquation = null;
    currentBlendSrc = null;
    currentBlendDst = null;
    currentBlendEquationAlpha = null;
    currentBlendSrcAlpha = null;
    currentBlendDstAlpha = null;
    currentBlendColor = new Color(0, 0, 0);
    currentBlendAlpha = 0;
    currentPremultipledAlpha = false;
    currentFlipSided = null;
    currentCullFace = null;
    currentLineWidth = null;
    currentPolygonOffsetFactor = null;
    currentPolygonOffsetUnits = null;
    currentScissor.set(0, 0, gl.canvas.width, gl.canvas.height);
    currentViewport.set(0, 0, gl.canvas.width, gl.canvas.height);
    colorBuffer.reset();
    depthBuffer.reset();
    stencilBuffer.reset();
  }
  return {
    buffers: {
      color: colorBuffer,
      depth: depthBuffer,
      stencil: stencilBuffer,
    },
    enable: enable,
    disable: disable,
    bindFramebuffer: bindFramebuffer,
    drawBuffers: drawBuffers,
    useProgram: useProgram,
    setBlending: setBlending,
    setMaterial: setMaterial,
    setFlipSided: setFlipSided,
    setCullFace: setCullFace,
    setLineWidth: setLineWidth,
    setPolygonOffset: setPolygonOffset,
    setScissorTest: setScissorTest,
    activeTexture: activeTexture,
    bindTexture: bindTexture,
    unbindTexture: unbindTexture,
    compressedTexImage2D: compressedTexImage2D,
    compressedTexImage3D: compressedTexImage3D,
    texImage2D: texImage2D,
    texImage3D: texImage3D,
    pixelStorei: pixelStorei,
    getParameter: getParameter,
    updateUBOMapping: updateUBOMapping,
    uniformBlockBinding: uniformBlockBinding,
    texStorage2D: texStorage2D,
    texStorage3D: texStorage3D,
    texSubImage2D: texSubImage2D,
    texSubImage3D: texSubImage3D,
    compressedTexSubImage2D: compressedTexSubImage2D,
    compressedTexSubImage3D: compressedTexSubImage3D,
    scissor: scissor,
    viewport: viewport,
    reset: reset,
  };
}
