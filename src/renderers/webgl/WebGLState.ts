import {
  NotEqualDepth,
  GreaterDepth,
  GreaterEqualDepth,
  EqualDepth,
  LessEqualDepth,
  LessDepth,
  AlwaysDepth,
  NeverDepth,
  CullFaceFront,
  CullFaceBack,
  CullFaceNone,
  DoubleSide,
  BackSide,
  CustomBlending,
  MultiplyBlending,
  SubtractiveBlending,
  AdditiveBlending,
  NoBlending,
  NormalBlending,
  AddEquation,
  SubtractEquation,
  ReverseSubtractEquation,
  MinEquation,
  MaxEquation,
  ZeroFactor,
  OneFactor,
  SrcColorFactor,
  SrcAlphaFactor,
  SrcAlphaSaturateFactor,
  DstColorFactor,
  DstAlphaFactor,
  OneMinusSrcColorFactor,
  OneMinusSrcAlphaFactor,
  OneMinusDstColorFactor,
  OneMinusDstAlphaFactor,
  ConstantColorFactor,
  OneMinusConstantColorFactor,
  ConstantAlphaFactor,
  OneMinusConstantAlphaFactor,
} from "../../constants";
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
          enable(gl.DEPTH_TEST);
        } else {
          disable(gl.DEPTH_TEST);
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
            case NeverDepth:
              gl.depthFunc(gl.NEVER);
              break;
            case AlwaysDepth:
              gl.depthFunc(gl.ALWAYS);
              break;
            case LessDepth:
              gl.depthFunc(gl.LESS);
              break;
            case LessEqualDepth:
              gl.depthFunc(gl.LEQUAL);
              break;
            case EqualDepth:
              gl.depthFunc(gl.EQUAL);
              break;
            case GreaterEqualDepth:
              gl.depthFunc(gl.GEQUAL);
              break;
            case GreaterDepth:
              gl.depthFunc(gl.GREATER);
              break;
            case NotEqualDepth:
              gl.depthFunc(gl.NOTEQUAL);
              break;
            default:
              gl.depthFunc(gl.LEQUAL);
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
            enable(gl.STENCIL_TEST);
          } else {
            disable(gl.STENCIL_TEST);
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
  let currentCullFace: any = null;
  let currentLineWidth: any = null;
  let currentPolygonOffsetFactor: any = null;
  let currentPolygonOffsetUnits: any = null;
  const maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  let lineWidthAvailable = false;
  let version = 0;
  const glVersion = gl.getParameter(gl.VERSION);
  if (glVersion.indexOf("WebGL") !== -1) {
    version = parseFloat((/^WebGL (\d)/.exec(glVersion) as any)[1]);
    lineWidthAvailable = version >= 1.0;
  } else if (glVersion.indexOf("OpenGL ES") !== -1) {
    version = parseFloat((/^OpenGL ES (\d)/.exec(glVersion) as any)[1]);
    lineWidthAvailable = version >= 2.0;
  }
  let currentTextureSlot: any = null;
  let currentBoundTextures: any = {};
  const scissorParam = gl.getParameter(gl.SCISSOR_BOX);
  const viewportParam = gl.getParameter(gl.VIEWPORT);
  const currentScissor = new Vector4().fromArray(scissorParam);
  const currentViewport = new Vector4().fromArray(viewportParam);
  function createTexture(type?: any, target?: any, count?: any, dimensions?: any) {
    const data = new Uint8Array(4); // 4 is required to match default unpack alignment of 4.
    const texture = gl.createTexture();
    gl.bindTexture(type, texture);
    gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    for (let i = 0; i < count; i++) {
      if (type === gl.TEXTURE_3D || type === gl.TEXTURE_2D_ARRAY) {
        gl.texImage3D(target, 0, gl.RGBA, 1, 1, dimensions, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      } else {
        gl.texImage2D(target + i, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      }
    }
    return texture;
  }
  const emptyTextures: any = {};
  (emptyTextures as any)[gl.TEXTURE_2D] = createTexture(gl.TEXTURE_2D, gl.TEXTURE_2D, 1);
  (emptyTextures as any)[gl.TEXTURE_CUBE_MAP] = createTexture(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_CUBE_MAP_POSITIVE_X, 6);
  (emptyTextures as any)[gl.TEXTURE_2D_ARRAY] = createTexture(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_2D_ARRAY, 1, 1);
  (emptyTextures as any)[gl.TEXTURE_3D] = createTexture(gl.TEXTURE_3D, gl.TEXTURE_3D, 1, 1);
  // init
  colorBuffer.setClear(0, 0, 0, 1);
  depthBuffer.setClear(1);
  stencilBuffer.setClear(0);
  enable(gl.DEPTH_TEST);
  depthBuffer.setFunc(LessEqualDepth);
  setFlipSided(false);
  setCullFace(CullFaceBack);
  enable(gl.CULL_FACE);
  setBlending(NoBlending);
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
      // gl.DRAW_FRAMEBUFFER is equivalent to gl.FRAMEBUFFER
      if (target === gl.DRAW_FRAMEBUFFER) {
        (currentBoundFramebuffers as any)[gl.FRAMEBUFFER] = framebuffer;
      }
      if (target === gl.FRAMEBUFFER) {
        (currentBoundFramebuffers as any)[gl.DRAW_FRAMEBUFFER] = framebuffer;
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
      if (drawBuffers.length !== textures.length || drawBuffers[0] !== gl.COLOR_ATTACHMENT0) {
        for (let i = 0, il = textures.length; i < il; i++) {
          drawBuffers[i] = gl.COLOR_ATTACHMENT0 + i;
        }
        drawBuffers.length = textures.length;
        needsUpdate = true;
      }
    } else {
      if (drawBuffers[0] !== gl.BACK) {
        drawBuffers[0] = gl.BACK;
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
    [AddEquation]: gl.FUNC_ADD,
    [SubtractEquation]: gl.FUNC_SUBTRACT,
    [ReverseSubtractEquation]: gl.FUNC_REVERSE_SUBTRACT,
  };
  (equationToGL as any)[MinEquation] = gl.MIN;
  (equationToGL as any)[MaxEquation] = gl.MAX;
  const factorToGL: any = {
    [ZeroFactor]: gl.ZERO,
    [OneFactor]: gl.ONE,
    [SrcColorFactor]: gl.SRC_COLOR,
    [SrcAlphaFactor]: gl.SRC_ALPHA,
    [SrcAlphaSaturateFactor]: gl.SRC_ALPHA_SATURATE,
    [DstColorFactor]: gl.DST_COLOR,
    [DstAlphaFactor]: gl.DST_ALPHA,
    [OneMinusSrcColorFactor]: gl.ONE_MINUS_SRC_COLOR,
    [OneMinusSrcAlphaFactor]: gl.ONE_MINUS_SRC_ALPHA,
    [OneMinusDstColorFactor]: gl.ONE_MINUS_DST_COLOR,
    [OneMinusDstAlphaFactor]: gl.ONE_MINUS_DST_ALPHA,
    [ConstantColorFactor]: gl.CONSTANT_COLOR,
    [OneMinusConstantColorFactor]: gl.ONE_MINUS_CONSTANT_COLOR,
    [ConstantAlphaFactor]: gl.CONSTANT_ALPHA,
    [OneMinusConstantAlphaFactor]: gl.ONE_MINUS_CONSTANT_ALPHA,
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
    if (blending === NoBlending) {
      if (currentBlendingEnabled === true) {
        disable(gl.BLEND);
        currentBlendingEnabled = false;
      }
      return;
    }
    if (currentBlendingEnabled === false) {
      enable(gl.BLEND);
      currentBlendingEnabled = true;
    }
    if (blending !== CustomBlending) {
      if (blending !== currentBlending || premultipliedAlpha !== currentPremultipledAlpha) {
        if (currentBlendEquation !== AddEquation || currentBlendEquationAlpha !== AddEquation) {
          gl.blendEquation(gl.FUNC_ADD);
          currentBlendEquation = AddEquation;
          currentBlendEquationAlpha = AddEquation;
        }
        if (premultipliedAlpha) {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
              break;
            case AdditiveBlending:
              gl.blendFunc(gl.ONE, gl.ONE);
              break;
            case SubtractiveBlending:
              gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
              break;
            case MultiplyBlending:
              gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
              break;
            default:
              error("WebGLState: Invalid blending: ", blending);
              break;
          }
        } else {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
              break;
            case AdditiveBlending:
              gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
              break;
            case SubtractiveBlending:
              error("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");
              break;
            case MultiplyBlending:
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
    if (material.side === DoubleSide) disable(gl.CULL_FACE);
    else enable(gl.CULL_FACE);
    let flipSided = material.side === BackSide;
    if (frontFaceCW) flipSided = !flipSided;
    setFlipSided(flipSided);
    if (material.blending === NormalBlending && material.transparent === false) {
      setBlending(NoBlending);
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
    if (material.alphaToCoverage === true) enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    else disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  }
  //
  function setFlipSided(flipSided?: any) {
    if (currentFlipSided !== flipSided) {
      if (flipSided) {
        gl.frontFace(gl.CW);
      } else {
        gl.frontFace(gl.CCW);
      }
      currentFlipSided = flipSided;
    }
  }
  function setCullFace(cullFace?: any) {
    if (cullFace !== CullFaceNone) {
      enable(gl.CULL_FACE);
      if (cullFace !== currentCullFace) {
        if (cullFace === CullFaceBack) {
          gl.cullFace(gl.BACK);
        } else if (cullFace === CullFaceFront) {
          gl.cullFace(gl.FRONT);
        } else {
          gl.cullFace(gl.FRONT_AND_BACK);
        }
      }
    } else {
      disable(gl.CULL_FACE);
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
      enable(gl.POLYGON_OFFSET_FILL);
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
      disable(gl.POLYGON_OFFSET_FILL);
    }
  }
  function setScissorTest(scissorTest?: any) {
    if (scissorTest) {
      enable(gl.SCISSOR_TEST);
    } else {
      disable(gl.SCISSOR_TEST);
    }
  }
  // texture
  function activeTexture(webglSlot?: any) {
    if (webglSlot === undefined) webglSlot = gl.TEXTURE0 + maxTextures - 1;
    if (currentTextureSlot !== webglSlot) {
      gl.activeTexture(webglSlot);
      currentTextureSlot = webglSlot;
    }
  }
  function bindTexture(webglType?: any, webglTexture?: any, webglSlot?: any) {
    if (webglSlot === undefined) {
      if (currentTextureSlot === null) {
        webglSlot = gl.TEXTURE0 + maxTextures - 1;
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
      gl.bindBufferBase(gl.UNIFORM_BUFFER, blockIndex, buffer);
      (uboBindings as any)[blockIndex] = buffer;
    }
  }
  //
  function reset() {
    // reset state
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);
    gl.blendColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    depthBuffer.setReversed(false);
    gl.clearDepth(1);
    gl.stencilMask(0xffffffff);
    gl.stencilFunc(gl.ALWAYS, 0, 0xffffffff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.clearStencil(0);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.polygonOffset(0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.useProgram(null);
    gl.lineWidth(1);
    gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.PACK_SKIP_ROWS, 0);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
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
