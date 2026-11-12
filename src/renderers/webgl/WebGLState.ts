import { GL } from "../../GL";
import { DepthFunc, CullFace, Side, Blending, Equation, Factor } from "../../constants";
import type { RenderTarget } from "../../core/RenderTarget";
import type { UniformsGroup } from "../../core/UniformsGroup";
import type { Material } from "../../materials/Material";
import { Color } from "../../math/Color";
import { Vector4 } from "../../math/Vector4";
import { error, ReversedDepthFuncs } from "../../utils";
import type { WebGLExtensions } from "./WebGLExtensions";
class ColorBuffer {
  private gl: WebGL2RenderingContext;
  private locked: boolean;
  private color: Vector4;
  private currentColorMask: boolean | null;
  private currentColorClear: Vector4;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.locked = false;
    this.color = new Vector4();
    this.currentColorMask = null;
    this.currentColorClear = new Vector4(0, 0, 0, 0);
    this.setMask = this.setMask.bind(this);
    this.setLocked = this.setLocked.bind(this);
    this.setClear = this.setClear.bind(this);
    this.reset = this.reset.bind(this);
  }
  setMask(colorMask: boolean): void {
    if (this.currentColorMask !== colorMask && !this.locked) {
      this.gl.colorMask(colorMask, colorMask, colorMask, colorMask);
      this.currentColorMask = colorMask;
    }
  }
  setLocked(lock: boolean): void {
    this.locked = lock;
  }
  setClear(r: number, g: number, b: number, a: number, premultipliedAlpha?: boolean): void {
    if (premultipliedAlpha === true) {
      r *= a;
      g *= a;
      b *= a;
    }
    this.color.set(r, g, b, a);
    if (this.currentColorClear.equals(this.color) === false) {
      this.gl.clearColor(r, g, b, a);
      this.currentColorClear.copy(this.color);
    }
  }
  reset(): void {
    this.locked = false;
    this.currentColorMask = null;
    this.currentColorClear.set(-1, 0, 0, 0); // set to invalid state
  }
}
class DepthBuffer {
  private gl: WebGL2RenderingContext;
  private extensions: WebGLExtensions;
  private state: WebGLState;
  private locked: boolean;
  private currentReversed: boolean;
  private currentDepthMask: boolean | null;
  private currentDepthFunc: DepthFunc | null;
  private currentDepthClear: number | null;

  constructor(gl: WebGL2RenderingContext, extensions: WebGLExtensions, state: WebGLState) {
    this.gl = gl;
    this.extensions = extensions;
    this.state = state;
    this.locked = false;
    this.currentReversed = false;
    this.currentDepthMask = null;
    this.currentDepthFunc = null;
    this.currentDepthClear = null;
    this.getReversed = this.getReversed.bind(this);
    this.setTest = this.setTest.bind(this);
    this.setMask = this.setMask.bind(this);
    this.setFunc = this.setFunc.bind(this);
    this.setLocked = this.setLocked.bind(this);
    this.setClear = this.setClear.bind(this);
    this.reset = this.reset.bind(this);
  }
  setReversed(reversed: boolean): void {
    if (this.currentReversed !== reversed) {
      const ext = this.extensions.get("EXT_clip_control")!;
      if (reversed) {
        ext.clipControlEXT(ext.LOWER_LEFT_EXT, ext.ZERO_TO_ONE_EXT);
      } else {
        ext.clipControlEXT(ext.LOWER_LEFT_EXT, ext.NEGATIVE_ONE_TO_ONE_EXT);
      }
      this.currentReversed = reversed;
      const oldDepth = this.currentDepthClear;
      this.currentDepthClear = null;
      this.setClear(oldDepth);
    }
  }
  getReversed(): boolean {
    return this.currentReversed;
  }
  setTest(depthTest: boolean): void {
    if (depthTest) {
      this.state.enable(GL.DEPTH_TEST);
    } else {
      this.state.disable(GL.DEPTH_TEST);
    }
  }
  setMask(depthMask: boolean): void {
    if (this.currentDepthMask !== depthMask && !this.locked) {
      this.gl.depthMask(depthMask);
      this.currentDepthMask = depthMask;
    }
  }
  setFunc(depthFunc: DepthFunc): void {
    if (this.currentReversed) depthFunc = (ReversedDepthFuncs as Record<DepthFunc, DepthFunc>)[depthFunc];
    if (this.currentDepthFunc !== depthFunc) {
      switch (depthFunc) {
        case DepthFunc.Never:
          this.gl.depthFunc(GL.NEVER);
          break;
        case DepthFunc.Always:
          this.gl.depthFunc(GL.ALWAYS);
          break;
        case DepthFunc.Less:
          this.gl.depthFunc(GL.LESS);
          break;
        case DepthFunc.LessEqual:
          this.gl.depthFunc(GL.LEQUAL);
          break;
        case DepthFunc.Equal:
          this.gl.depthFunc(GL.EQUAL);
          break;
        case DepthFunc.GreaterEqual:
          this.gl.depthFunc(GL.GEQUAL);
          break;
        case DepthFunc.Greater:
          this.gl.depthFunc(GL.GREATER);
          break;
        case DepthFunc.NotEqual:
          this.gl.depthFunc(GL.NOTEQUAL);
          break;
        default:
          this.gl.depthFunc(GL.LEQUAL);
      }
      this.currentDepthFunc = depthFunc;
    }
  }
  setLocked(lock: boolean): void {
    this.locked = lock;
  }
  setClear(depth: number | null): void {
    if (this.currentDepthClear !== depth) {
      this.currentDepthClear = depth;
      if (this.currentReversed) {
        depth = 1 - depth!;
      }
      this.gl.clearDepth(depth!);
    }
  }
  reset(): void {
    this.locked = false;
    this.currentDepthMask = null;
    this.currentDepthFunc = null;
    this.currentDepthClear = null;
    this.currentReversed = false;
  }
}
class StencilBuffer {
  private gl: WebGL2RenderingContext;
  private state: WebGLState;
  private locked: boolean;
  private currentStencilMask: number | null;
  private currentStencilFunc: GLenum | null;
  private currentStencilRef: number | null;
  private currentStencilFuncMask: number | null;
  private currentStencilFail: GLenum | null;
  private currentStencilZFail: GLenum | null;
  private currentStencilZPass: GLenum | null;
  private currentStencilClear: number | null;

  constructor(gl: WebGL2RenderingContext, state: WebGLState) {
    this.gl = gl;
    this.state = state;
    this.locked = false;
    this.currentStencilMask = null;
    this.currentStencilFunc = null;
    this.currentStencilRef = null;
    this.currentStencilFuncMask = null;
    this.currentStencilFail = null;
    this.currentStencilZFail = null;
    this.currentStencilZPass = null;
    this.currentStencilClear = null;
    this.setTest = this.setTest.bind(this);
    this.setMask = this.setMask.bind(this);
    this.setFunc = this.setFunc.bind(this);
    this.setOp = this.setOp.bind(this);
    this.setLocked = this.setLocked.bind(this);
    this.setClear = this.setClear.bind(this);
    this.reset = this.reset.bind(this);
  }
  setTest(stencilTest: boolean): void {
    if (!this.locked) {
      if (stencilTest) {
        this.state.enable(GL.STENCIL_TEST);
      } else {
        this.state.disable(GL.STENCIL_TEST);
      }
    }
  }
  setMask(stencilMask: number): void {
    if (this.currentStencilMask !== stencilMask && !this.locked) {
      this.gl.stencilMask(stencilMask);
      this.currentStencilMask = stencilMask;
    }
  }
  setFunc(stencilFunc: GLenum, stencilRef: number, stencilMask: number): void {
    if (
      this.currentStencilFunc !== stencilFunc ||
      this.currentStencilRef !== stencilRef ||
      this.currentStencilFuncMask !== stencilMask
    ) {
      this.gl.stencilFunc(stencilFunc, stencilRef, stencilMask);
      this.currentStencilFunc = stencilFunc;
      this.currentStencilRef = stencilRef;
      this.currentStencilFuncMask = stencilMask;
    }
  }
  setOp(stencilFail: GLenum, stencilZFail: GLenum, stencilZPass: GLenum): void {
    if (
      this.currentStencilFail !== stencilFail ||
      this.currentStencilZFail !== stencilZFail ||
      this.currentStencilZPass !== stencilZPass
    ) {
      this.gl.stencilOp(stencilFail, stencilZFail, stencilZPass);
      this.currentStencilFail = stencilFail;
      this.currentStencilZFail = stencilZFail;
      this.currentStencilZPass = stencilZPass;
    }
  }
  setLocked(lock: boolean): void {
    this.locked = lock;
  }
  setClear(stencil: number): void {
    if (this.currentStencilClear !== stencil) {
      this.gl.clearStencil(stencil);
      this.currentStencilClear = stencil;
    }
  }
  reset(): void {
    this.locked = false;
    this.currentStencilMask = null;
    this.currentStencilFunc = null;
    this.currentStencilRef = null;
    this.currentStencilFuncMask = null;
    this.currentStencilFail = null;
    this.currentStencilZFail = null;
    this.currentStencilZPass = null;
    this.currentStencilClear = null;
  }
}
export class WebGLState {
  private gl: WebGL2RenderingContext;
  private extensions: WebGLExtensions;
  private colorBuffer: ColorBuffer;
  private depthBuffer: DepthBuffer;
  private stencilBuffer: StencilBuffer;
  private uboBindings: Partial<Record<number, WebGLBuffer | null>>;
  private uboProgramMap: WeakMap<WebGLProgram, WeakMap<UniformsGroup, number>>;
  private enabledCapabilities: Partial<Record<number, boolean>>;
  private parameters: Partial<Record<number, number | boolean>>;
  private currentBoundFramebuffers: Partial<Record<number, WebGLFramebuffer | null>>;
  private currentDrawbuffers: WeakMap<WebGLFramebuffer, number[]>;
  private defaultDrawbuffers: number[];
  private currentProgram: WebGLProgram | null;
  private currentBlendingEnabled: boolean;
  private currentBlending: Blending | null;
  private currentBlendEquation: Equation | null | undefined;
  private currentBlendSrc: Factor | null | undefined;
  private currentBlendDst: Factor | null | undefined;
  private currentBlendEquationAlpha: Equation | null | undefined;
  private currentBlendSrcAlpha: Factor | null | undefined;
  private currentBlendDstAlpha: Factor | null | undefined;
  private currentBlendColor: Color;
  private currentBlendAlpha: number | undefined;
  private currentPremultipledAlpha: boolean | undefined;
  private currentFlipSided: boolean | null;
  private currentCullFace: CullFace | null | undefined;
  private currentLineWidth: number | null;
  private currentPolygonOffsetFactor: number | null;
  private currentPolygonOffsetUnits: number | null;
  private maxTextures: number;
  private lineWidthAvailable: boolean;
  private currentTextureSlot: number | null;
  private currentBoundTextures: Partial<
    Record<number, { type: number | undefined; texture: WebGLTexture | null | undefined }>
  >;
  private currentScissor: Vector4;
  private currentViewport: Vector4;
  private emptyTextures: Record<number, WebGLTexture | null>;
  private equationToGL: Partial<Record<Equation, number>>;
  private factorToGL: Record<Factor, number>;
  buffers: { color: ColorBuffer; depth: DepthBuffer; stencil: StencilBuffer };

  constructor(gl: WebGL2RenderingContext, extensions: WebGLExtensions) {
    this.gl = gl;
    this.extensions = extensions;
    this.enable = this.enable.bind(this);
    this.disable = this.disable.bind(this);
    this.bindFramebuffer = this.bindFramebuffer.bind(this);
    this.drawBuffers = this.drawBuffers.bind(this);
    this.useProgram = this.useProgram.bind(this);
    this.setBlending = this.setBlending.bind(this);
    this.setMaterial = this.setMaterial.bind(this);
    this.setFlipSided = this.setFlipSided.bind(this);
    this.setCullFace = this.setCullFace.bind(this);
    this.setLineWidth = this.setLineWidth.bind(this);
    this.setPolygonOffset = this.setPolygonOffset.bind(this);
    this.setScissorTest = this.setScissorTest.bind(this);
    this.activeTexture = this.activeTexture.bind(this);
    this.bindTexture = this.bindTexture.bind(this);
    this.unbindTexture = this.unbindTexture.bind(this);
    this.compressedTexImage2D = this.compressedTexImage2D.bind(this);
    this.compressedTexImage3D = this.compressedTexImage3D.bind(this);
    this.texSubImage2D = this.texSubImage2D.bind(this);
    this.texSubImage3D = this.texSubImage3D.bind(this);
    this.compressedTexSubImage2D = this.compressedTexSubImage2D.bind(this);
    this.compressedTexSubImage3D = this.compressedTexSubImage3D.bind(this);
    this.texStorage2D = this.texStorage2D.bind(this);
    this.texStorage3D = this.texStorage3D.bind(this);
    this.texImage2D = this.texImage2D.bind(this);
    this.texImage3D = this.texImage3D.bind(this);
    this.getParameter = this.getParameter.bind(this);
    this.pixelStorei = this.pixelStorei.bind(this);
    this.scissor = this.scissor.bind(this);
    this.viewport = this.viewport.bind(this);
    this.updateUBOMapping = this.updateUBOMapping.bind(this);
    this.uniformBlockBinding = this.uniformBlockBinding.bind(this);
    this.reset = this.reset.bind(this);
    this.dispose = this.dispose.bind(this);
    this.colorBuffer = new ColorBuffer(this.gl);
    this.depthBuffer = new DepthBuffer(this.gl, this.extensions, this);
    this.stencilBuffer = new StencilBuffer(this.gl, this);
    this.uboBindings = {};
    this.uboProgramMap = new WeakMap<WebGLProgram, WeakMap<UniformsGroup, number>>();
    this.enabledCapabilities = {};
    this.parameters = {};
    this.currentBoundFramebuffers = {};
    this.currentDrawbuffers = new WeakMap<WebGLFramebuffer, number[]>();
    this.defaultDrawbuffers = [];
    this.currentProgram = null;
    this.currentBlendingEnabled = false;
    this.currentBlending = null;
    this.currentBlendEquation = null;
    this.currentBlendSrc = null;
    this.currentBlendDst = null;
    this.currentBlendEquationAlpha = null;
    this.currentBlendSrcAlpha = null;
    this.currentBlendDstAlpha = null;
    this.currentBlendColor = new Color(0, 0, 0);
    this.currentBlendAlpha = 0;
    this.currentPremultipledAlpha = false;
    this.currentFlipSided = null;
    this.currentCullFace = null;
    this.currentLineWidth = null;
    this.currentPolygonOffsetFactor = null;
    this.currentPolygonOffsetUnits = null;
    this.maxTextures = this.gl.getParameter(GL.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    this.lineWidthAvailable = false;
    let version = 0;
    const glVersion: string = this.gl.getParameter(GL.VERSION);
    if (glVersion.indexOf("WebGL") !== -1) {
      version = parseFloat(/^WebGL (\d)/.exec(glVersion)![1]);
      this.lineWidthAvailable = version >= 1.0;
    } else if (glVersion.indexOf("OpenGL ES") !== -1) {
      version = parseFloat(/^OpenGL ES (\d)/.exec(glVersion)![1]);
      this.lineWidthAvailable = version >= 2.0;
    }
    this.currentTextureSlot = null;
    this.currentBoundTextures = {};
    const scissorParam: Int32Array = this.gl.getParameter(GL.SCISSOR_BOX);
    const viewportParam: Int32Array = this.gl.getParameter(GL.VIEWPORT);
    this.currentScissor = new Vector4().fromArray(scissorParam);
    this.currentViewport = new Vector4().fromArray(viewportParam);
    this.emptyTextures = {};
    this.emptyTextures[GL.TEXTURE_2D] = this.createTexture(GL.TEXTURE_2D, GL.TEXTURE_2D, 1);
    this.emptyTextures[GL.TEXTURE_CUBE_MAP] = this.createTexture(
      GL.TEXTURE_CUBE_MAP,
      GL.TEXTURE_CUBE_MAP_POSITIVE_X,
      6,
    );
    this.emptyTextures[GL.TEXTURE_2D_ARRAY] = this.createTexture(GL.TEXTURE_2D_ARRAY, GL.TEXTURE_2D_ARRAY, 1, 1);
    this.emptyTextures[GL.TEXTURE_3D] = this.createTexture(GL.TEXTURE_3D, GL.TEXTURE_3D, 1, 1);
    // init
    this.colorBuffer.setClear(0, 0, 0, 1);
    this.depthBuffer.setClear(1);
    this.stencilBuffer.setClear(0);
    this.enable(GL.DEPTH_TEST);
    this.depthBuffer.setFunc(DepthFunc.LessEqual);
    this.setFlipSided(false);
    this.setCullFace(CullFace.Back);
    this.enable(GL.CULL_FACE);
    this.setBlending(Blending.No);
    //
    this.equationToGL = {
      [Equation.Add]: GL.FUNC_ADD,
      [Equation.Subtract]: GL.FUNC_SUBTRACT,
      [Equation.ReverseSubtract]: GL.FUNC_REVERSE_SUBTRACT,
    };
    this.equationToGL[Equation.Min] = GL.MIN;
    this.equationToGL[Equation.Max] = GL.MAX;
    this.factorToGL = {
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
    this.buffers = {
      color: this.colorBuffer,
      depth: this.depthBuffer,
      stencil: this.stencilBuffer,
    };
  }
  private createTexture(type: number, target: number, count: number, dimensions?: number): WebGLTexture | null {
    const data = new Uint8Array(4); // 4 is required to match default unpack alignment of 4.
    const texture = this.gl.createTexture();
    this.gl.bindTexture(type, texture);
    this.gl.texParameteri(type, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    this.gl.texParameteri(type, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    for (let i = 0; i < count; i++) {
      if (type === GL.TEXTURE_3D || type === GL.TEXTURE_2D_ARRAY) {
        this.gl.texImage3D(target, 0, GL.RGBA, 1, 1, dimensions!, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
      } else {
        this.gl.texImage2D(target + i, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, data);
      }
    }
    return texture;
  }
  enable(id: number): void {
    if (this.enabledCapabilities[id] !== true) {
      this.gl.enable(id);
      this.enabledCapabilities[id] = true;
    }
  }
  disable(id: number): void {
    if (this.enabledCapabilities[id] !== false) {
      this.gl.disable(id);
      this.enabledCapabilities[id] = false;
    }
  }
  bindFramebuffer(target: number, framebuffer: WebGLFramebuffer | null): boolean {
    if (this.currentBoundFramebuffers[target] !== framebuffer) {
      this.gl.bindFramebuffer(target, framebuffer);
      this.currentBoundFramebuffers[target] = framebuffer;
      // GL.DRAW_FRAMEBUFFER is equivalent to GL.FRAMEBUFFER
      if (target === GL.DRAW_FRAMEBUFFER) {
        this.currentBoundFramebuffers[GL.FRAMEBUFFER] = framebuffer;
      }
      if (target === GL.FRAMEBUFFER) {
        this.currentBoundFramebuffers[GL.DRAW_FRAMEBUFFER] = framebuffer;
      }
      return true;
    }
    return false;
  }
  drawBuffers(renderTarget: RenderTarget | null, framebuffer: WebGLFramebuffer | null): void {
    let drawBuffers: number[] | undefined = this.defaultDrawbuffers;
    let needsUpdate = false;
    if (renderTarget) {
      drawBuffers = this.currentDrawbuffers.get(framebuffer!);
      if (drawBuffers === undefined) {
        drawBuffers = [];
        this.currentDrawbuffers.set(framebuffer!, drawBuffers);
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
      this.gl.drawBuffers(drawBuffers);
    }
  }
  useProgram(program: WebGLProgram | null): boolean {
    if (this.currentProgram !== program) {
      this.gl.useProgram(program);
      this.currentProgram = program;
      return true;
    }
    return false;
  }
  setBlending(
    blending: Blending,
    blendEquation?: Equation,
    blendSrc?: Factor,
    blendDst?: Factor,
    blendEquationAlpha?: Equation | null,
    blendSrcAlpha?: Factor | null,
    blendDstAlpha?: Factor | null,
    blendColor?: Color,
    blendAlpha?: number,
    premultipliedAlpha?: boolean,
  ): void {
    if (blending === Blending.No) {
      if (this.currentBlendingEnabled === true) {
        this.disable(GL.BLEND);
        this.currentBlendingEnabled = false;
      }
      return;
    }
    if (this.currentBlendingEnabled === false) {
      this.enable(GL.BLEND);
      this.currentBlendingEnabled = true;
    }
    if (blending !== Blending.Custom) {
      if (blending !== this.currentBlending || premultipliedAlpha !== this.currentPremultipledAlpha) {
        if (this.currentBlendEquation !== Equation.Add || this.currentBlendEquationAlpha !== Equation.Add) {
          this.gl.blendEquation(GL.FUNC_ADD);
          this.currentBlendEquation = Equation.Add;
          this.currentBlendEquationAlpha = Equation.Add;
        }
        if (premultipliedAlpha) {
          switch (blending) {
            case Blending.Normal:
              this.gl.blendFuncSeparate(GL.ONE, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
              break;
            case Blending.Additive:
              this.gl.blendFunc(GL.ONE, GL.ONE);
              break;
            case Blending.Subtractive:
              this.gl.blendFuncSeparate(GL.ZERO, GL.ONE_MINUS_SRC_COLOR, GL.ZERO, GL.ONE);
              break;
            case Blending.Multiply:
              this.gl.blendFuncSeparate(GL.DST_COLOR, GL.ONE_MINUS_SRC_ALPHA, GL.ZERO, GL.ONE);
              break;
            default:
              error("WebGLState: Invalid blending: ", blending);
              break;
          }
        } else {
          switch (blending) {
            case Blending.Normal:
              this.gl.blendFuncSeparate(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA);
              break;
            case Blending.Additive:
              this.gl.blendFuncSeparate(GL.SRC_ALPHA, GL.ONE, GL.ONE, GL.ONE);
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
        this.currentBlendSrc = null;
        this.currentBlendDst = null;
        this.currentBlendSrcAlpha = null;
        this.currentBlendDstAlpha = null;
        this.currentBlendColor.set(0, 0, 0);
        this.currentBlendAlpha = 0;
        this.currentBlending = blending;
        this.currentPremultipledAlpha = premultipliedAlpha;
      }
      return;
    }
    // custom blending
    blendEquationAlpha = blendEquationAlpha || blendEquation;
    blendSrcAlpha = blendSrcAlpha || blendSrc;
    blendDstAlpha = blendDstAlpha || blendDst;
    if (blendEquation !== this.currentBlendEquation || blendEquationAlpha !== this.currentBlendEquationAlpha) {
      this.gl.blendEquationSeparate(this.equationToGL[blendEquation!]!, this.equationToGL[blendEquationAlpha!]!);
      this.currentBlendEquation = blendEquation;
      this.currentBlendEquationAlpha = blendEquationAlpha;
    }
    if (
      blendSrc !== this.currentBlendSrc ||
      blendDst !== this.currentBlendDst ||
      blendSrcAlpha !== this.currentBlendSrcAlpha ||
      blendDstAlpha !== this.currentBlendDstAlpha
    ) {
      this.gl.blendFuncSeparate(
        this.factorToGL[blendSrc!],
        this.factorToGL[blendDst!],
        this.factorToGL[blendSrcAlpha!],
        this.factorToGL[blendDstAlpha!],
      );
      this.currentBlendSrc = blendSrc;
      this.currentBlendDst = blendDst;
      this.currentBlendSrcAlpha = blendSrcAlpha;
      this.currentBlendDstAlpha = blendDstAlpha;
    }
    if (blendColor!.equals(this.currentBlendColor) === false || blendAlpha !== this.currentBlendAlpha) {
      this.gl.blendColor(blendColor!.r, blendColor!.g, blendColor!.b, blendAlpha!);
      this.currentBlendColor.copy(blendColor!);
      this.currentBlendAlpha = blendAlpha;
    }
    this.currentBlending = blending;
    this.currentPremultipledAlpha = false;
  }
  setMaterial(material: Material, frontFaceCW?: boolean): void {
    if (material.side === Side.Double) this.disable(GL.CULL_FACE);
    else this.enable(GL.CULL_FACE);
    let flipSided = material.side === Side.Back;
    if (frontFaceCW) flipSided = !flipSided;
    this.setFlipSided(flipSided);
    if (material.blending === Blending.Normal && material.transparent === false) {
      this.setBlending(Blending.No);
    } else {
      this.setBlending(
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
    this.depthBuffer.setFunc(material.depthFunc);
    this.depthBuffer.setTest(material.depthTest);
    this.depthBuffer.setMask(material.depthWrite);
    this.colorBuffer.setMask(material.colorWrite);
    const stencilWrite = material.stencilWrite;
    this.stencilBuffer.setTest(stencilWrite);
    if (stencilWrite) {
      this.stencilBuffer.setMask(material.stencilWriteMask);
      this.stencilBuffer.setFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
      this.stencilBuffer.setOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
    }
    this.setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
    if (material.alphaToCoverage === true) this.enable(GL.SAMPLE_ALPHA_TO_COVERAGE);
    else this.disable(GL.SAMPLE_ALPHA_TO_COVERAGE);
  }
  setFlipSided(flipSided: boolean): void {
    if (this.currentFlipSided !== flipSided) {
      if (flipSided) {
        this.gl.frontFace(GL.CW);
      } else {
        this.gl.frontFace(GL.CCW);
      }
      this.currentFlipSided = flipSided;
    }
  }
  setCullFace(cullFace?: CullFace): void {
    if (cullFace !== CullFace.None) {
      this.enable(GL.CULL_FACE);
      if (cullFace !== this.currentCullFace) {
        if (cullFace === CullFace.Back) {
          this.gl.cullFace(GL.BACK);
        } else if (cullFace === CullFace.Front) {
          this.gl.cullFace(GL.FRONT);
        } else {
          this.gl.cullFace(GL.FRONT_AND_BACK);
        }
      }
    } else {
      this.disable(GL.CULL_FACE);
    }
    this.currentCullFace = cullFace;
  }
  setLineWidth(width: number): void {
    if (width !== this.currentLineWidth) {
      if (this.lineWidthAvailable) this.gl.lineWidth(width);
      this.currentLineWidth = width;
    }
  }
  setPolygonOffset(polygonOffset: false, factor?: number, units?: number): void;
  setPolygonOffset(polygonOffset: boolean, factor: number, units: number): void;
  setPolygonOffset(polygonOffset: boolean, factor?: number, units?: number): void {
    if (polygonOffset) {
      this.enable(GL.POLYGON_OFFSET_FILL);
      if (this.currentPolygonOffsetFactor !== factor || this.currentPolygonOffsetUnits !== units) {
        this.currentPolygonOffsetFactor = factor!;
        this.currentPolygonOffsetUnits = units!;
        if (this.depthBuffer.getReversed()) {
          factor = -factor!;
          units = -units!;
        }
        this.gl.polygonOffset(factor!, units!);
      }
    } else {
      this.disable(GL.POLYGON_OFFSET_FILL);
    }
  }
  setScissorTest(scissorTest: boolean): void {
    if (scissorTest) {
      this.enable(GL.SCISSOR_TEST);
    } else {
      this.disable(GL.SCISSOR_TEST);
    }
  }
  activeTexture(webglSlot?: number): void {
    if (webglSlot === undefined) webglSlot = GL.TEXTURE0 + this.maxTextures - 1;
    if (this.currentTextureSlot !== webglSlot) {
      this.gl.activeTexture(webglSlot);
      this.currentTextureSlot = webglSlot;
    }
  }
  bindTexture(webglType: number, webglTexture?: WebGLTexture | null, webglSlot?: number): void {
    if (webglSlot === undefined) {
      if (this.currentTextureSlot === null) {
        webglSlot = GL.TEXTURE0 + this.maxTextures - 1;
      } else {
        webglSlot = this.currentTextureSlot;
      }
    }
    let boundTexture = this.currentBoundTextures[webglSlot];
    if (boundTexture === undefined) {
      boundTexture = { type: undefined, texture: undefined };
      this.currentBoundTextures[webglSlot] = boundTexture;
    }
    if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {
      if (this.currentTextureSlot !== webglSlot) {
        this.gl.activeTexture(webglSlot);
        this.currentTextureSlot = webglSlot;
      }
      this.gl.bindTexture(webglType, webglTexture || this.emptyTextures[webglType]);
      boundTexture.type = webglType;
      boundTexture.texture = webglTexture;
    }
  }
  unbindTexture(): void {
    const boundTexture = this.currentBoundTextures[this.currentTextureSlot!];
    if (boundTexture !== undefined && boundTexture.type !== undefined) {
      this.gl.bindTexture(boundTexture.type, null);
      boundTexture.type = undefined;
      boundTexture.texture = undefined;
    }
  }
  // Forward the original arguments object without allocating rest arrays; tuple casts bridge DOM overloads.
  compressedTexImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLenum,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    imageSize: GLsizei,
    offset: GLintptr,
  ): void;
  compressedTexImage2D(...args: Parameters<WebGL2RenderingContext["compressedTexImage2D"]>): void;
  compressedTexImage2D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["compressedTexImage2D"]>;
      this.gl.compressedTexImage2D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  compressedTexImage3D(
    target: GLenum,
    level: GLint,
    internalformat: GLenum,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    imageSize: GLsizei,
    offset: GLintptr,
  ): void;
  compressedTexImage3D(...args: Parameters<WebGL2RenderingContext["compressedTexImage3D"]>): void;
  compressedTexImage3D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["compressedTexImage3D"]>;
      this.gl.compressedTexImage3D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: GLenum,
    type: GLenum,
    pixels: ArrayBufferView<ArrayBufferLike> | null,
  ): void;
  texSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: GLenum,
    type: GLenum,
    pboOffset: GLintptr,
  ): void;
  texSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texSubImage2D(...args: Parameters<WebGL2RenderingContext["texSubImage2D"]>): void;
  texSubImage2D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texSubImage2D"]>;
      this.gl.texSubImage2D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texSubImage3D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: GLenum,
    type: GLenum,
    pboOffset: GLintptr,
  ): void;
  texSubImage3D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texSubImage3D(...args: Parameters<WebGL2RenderingContext["texSubImage3D"]>): void;
  texSubImage3D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texSubImage3D"]>;
      this.gl.texSubImage3D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  compressedTexSubImage2D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    format: GLenum,
    imageSize: GLsizei,
    offset: GLintptr,
  ): void;
  compressedTexSubImage2D(...args: Parameters<WebGL2RenderingContext["compressedTexSubImage2D"]>): void;
  compressedTexSubImage2D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["compressedTexSubImage2D"]>;
      this.gl.compressedTexSubImage2D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  compressedTexSubImage3D(
    target: GLenum,
    level: GLint,
    xoffset: GLint,
    yoffset: GLint,
    zoffset: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    format: GLenum,
    imageSize: GLsizei,
    offset: GLintptr,
  ): void;
  compressedTexSubImage3D(...args: Parameters<WebGL2RenderingContext["compressedTexSubImage3D"]>): void;
  compressedTexSubImage3D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["compressedTexSubImage3D"]>;
      this.gl.compressedTexSubImage3D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texStorage2D(...args: Parameters<WebGL2RenderingContext["texStorage2D"]>): void;
  texStorage2D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texStorage2D"]>;
      this.gl.texStorage2D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texStorage3D(...args: Parameters<WebGL2RenderingContext["texStorage3D"]>): void;
  texStorage3D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texStorage3D"]>;
      this.gl.texStorage3D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    pixels: ArrayBufferView<ArrayBufferLike> | null,
  ): void;
  texImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    pboOffset: GLintptr,
  ): void;
  texImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texImage2D(...args: Parameters<WebGL2RenderingContext["texImage2D"]>): void;
  texImage2D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texImage2D"]>;
      this.gl.texImage2D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  texImage3D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    pboOffset: GLintptr,
  ): void;
  texImage3D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    source: TexImageSource,
  ): void;
  texImage3D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    width: GLsizei,
    height: GLsizei,
    depth: GLsizei,
    border: GLint,
    format: GLenum,
    type: GLenum,
    srcData: ArrayBufferView<ArrayBufferLike> | null,
  ): void;
  texImage3D(...args: Parameters<WebGL2RenderingContext["texImage3D"]>): void;
  texImage3D(): void {
    try {
      const args = arguments as unknown as Parameters<WebGL2RenderingContext["texImage3D"]>;
      this.gl.texImage3D(...args);
    } catch (e) {
      error("WebGLState:", e);
    }
  }
  getParameter(
    name:
      | GL.PACK_ALIGNMENT
      | GL.UNPACK_ALIGNMENT
      | GL.UNPACK_COLORSPACE_CONVERSION_WEBGL
      | GL.PACK_ROW_LENGTH
      | GL.PACK_SKIP_PIXELS
      | GL.PACK_SKIP_ROWS
      | GL.UNPACK_ROW_LENGTH
      | GL.UNPACK_IMAGE_HEIGHT
      | GL.UNPACK_SKIP_PIXELS
      | GL.UNPACK_SKIP_ROWS
      | GL.UNPACK_SKIP_IMAGES,
  ): number;
  getParameter(name: GL.UNPACK_FLIP_Y_WEBGL | GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL): boolean;
  getParameter(name: number): unknown;
  getParameter(name: number): unknown {
    if (this.parameters[name] !== undefined) {
      return this.parameters[name];
    } else {
      return this.gl.getParameter(name);
    }
  }
  pixelStorei(name: number, value: number | boolean): void {
    if (this.parameters[name] !== value) {
      this.gl.pixelStorei(name, value);
      this.parameters[name] = value;
    }
  }
  scissor(scissor: Vector4): void {
    if (this.currentScissor.equals(scissor) === false) {
      this.gl.scissor(scissor.x, scissor.y, scissor.z, scissor.w);
      this.currentScissor.copy(scissor);
    }
  }
  viewport(viewport: Vector4): void {
    if (this.currentViewport.equals(viewport) === false) {
      this.gl.viewport(viewport.x, viewport.y, viewport.z, viewport.w);
      this.currentViewport.copy(viewport);
    }
  }
  updateUBOMapping(uniformsGroup: UniformsGroup, program: WebGLProgram): void {
    let mapping = this.uboProgramMap.get(program);
    if (mapping === undefined) {
      mapping = new WeakMap();
      this.uboProgramMap.set(program, mapping);
    }
    let blockIndex = mapping.get(uniformsGroup);
    if (blockIndex === undefined) {
      blockIndex = this.gl.getUniformBlockIndex(program, uniformsGroup.name);
      // use the block index as the binding point
      this.gl.uniformBlockBinding(program, blockIndex, blockIndex);
      mapping.set(uniformsGroup, blockIndex);
    }
  }
  uniformBlockBinding(uniformsGroup: UniformsGroup, program: WebGLProgram, buffer: WebGLBuffer | null): void {
    const mapping = this.uboProgramMap.get(program)!;
    const blockIndex = mapping.get(uniformsGroup)!;
    if (this.uboBindings[blockIndex] !== buffer) {
      this.gl.bindBufferBase(GL.UNIFORM_BUFFER, blockIndex, buffer);
      this.uboBindings[blockIndex] = buffer;
    }
  }
  reset(): void {
    // reset state
    this.gl.disable(GL.BLEND);
    this.gl.disable(GL.CULL_FACE);
    this.gl.disable(GL.DEPTH_TEST);
    this.gl.disable(GL.POLYGON_OFFSET_FILL);
    this.gl.disable(GL.SCISSOR_TEST);
    this.gl.disable(GL.STENCIL_TEST);
    this.gl.disable(GL.SAMPLE_ALPHA_TO_COVERAGE);
    this.gl.blendEquation(GL.FUNC_ADD);
    this.gl.blendFunc(GL.ONE, GL.ZERO);
    this.gl.blendFuncSeparate(GL.ONE, GL.ZERO, GL.ONE, GL.ZERO);
    this.gl.blendColor(0, 0, 0, 0);
    this.gl.colorMask(true, true, true, true);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.depthMask(true);
    this.gl.depthFunc(GL.LESS);
    this.depthBuffer.setReversed(false);
    this.gl.clearDepth(1);
    this.gl.stencilMask(0xffffffff);
    this.gl.stencilFunc(GL.ALWAYS, 0, 0xffffffff);
    this.gl.stencilOp(GL.KEEP, GL.KEEP, GL.KEEP);
    this.gl.clearStencil(0);
    this.gl.cullFace(GL.BACK);
    this.gl.frontFace(GL.CCW);
    this.gl.polygonOffset(0, 0);
    this.gl.activeTexture(GL.TEXTURE0);
    this.gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    this.gl.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
    this.gl.bindFramebuffer(GL.READ_FRAMEBUFFER, null);
    this.gl.useProgram(null);
    this.gl.lineWidth(1);
    this.gl.scissor(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.pixelStorei(GL.PACK_ALIGNMENT, 4);
    this.gl.pixelStorei(GL.UNPACK_ALIGNMENT, 4);
    this.gl.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, false);
    this.gl.pixelStorei(GL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.gl.pixelStorei(GL.UNPACK_COLORSPACE_CONVERSION_WEBGL, GL.BROWSER_DEFAULT_WEBGL);
    this.gl.pixelStorei(GL.PACK_ROW_LENGTH, 0);
    this.gl.pixelStorei(GL.PACK_SKIP_PIXELS, 0);
    this.gl.pixelStorei(GL.PACK_SKIP_ROWS, 0);
    this.gl.pixelStorei(GL.UNPACK_ROW_LENGTH, 0);
    this.gl.pixelStorei(GL.UNPACK_IMAGE_HEIGHT, 0);
    this.gl.pixelStorei(GL.UNPACK_SKIP_PIXELS, 0);
    this.gl.pixelStorei(GL.UNPACK_SKIP_ROWS, 0);
    this.gl.pixelStorei(GL.UNPACK_SKIP_IMAGES, 0);
    // reset internals
    this.enabledCapabilities = {};
    this.parameters = {};
    this.currentTextureSlot = null;
    this.currentBoundTextures = {};
    this.currentBoundFramebuffers = {};
    this.uboBindings = {};
    this.currentDrawbuffers = new WeakMap();
    this.defaultDrawbuffers = [];
    this.currentProgram = null;
    this.currentBlendingEnabled = false;
    this.currentBlending = null;
    this.currentBlendEquation = null;
    this.currentBlendSrc = null;
    this.currentBlendDst = null;
    this.currentBlendEquationAlpha = null;
    this.currentBlendSrcAlpha = null;
    this.currentBlendDstAlpha = null;
    this.currentBlendColor = new Color(0, 0, 0);
    this.currentBlendAlpha = 0;
    this.currentPremultipledAlpha = false;
    this.currentFlipSided = null;
    this.currentCullFace = null;
    this.currentLineWidth = null;
    this.currentPolygonOffsetFactor = null;
    this.currentPolygonOffsetUnits = null;
    this.currentScissor.set(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.currentViewport.set(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.colorBuffer.reset();
    this.depthBuffer.reset();
    this.stencilBuffer.reset();
  }
  dispose(): void {
    for (const target in this.emptyTextures) {
      this.gl.deleteTexture(this.emptyTextures[target]);
      delete this.emptyTextures[target];
    }
  }
}
