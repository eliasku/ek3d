import { GL } from "../../GL";
import { TextureType, PixelFormat } from "../../constants";
import { warn } from "../../utils";
import type { WebGLRendererOptions } from "../WebGLRenderer";
import type { WebGLExtensions } from "./WebGLExtensions";
import type { WebGLUtils } from "./WebGLUtils";
export interface WebGLCapabilitiesState {
  isWebGL2: boolean;
  /** Maximum available anisotropy. */
  getMaxAnisotropy(): number;
  /** Maximum supported vertex and fragment shader precision. */
  getMaxPrecision(precision: "highp" | "mediump" | "lowp"): "highp" | "mediump" | "lowp";
  textureFormatReadable(format: number): boolean;
  textureTypeReadable(type: number): boolean;
  /** Shader precision currently used by the renderer. */
  precision: "highp" | "mediump" | "lowp";
  /** Whether logarithmic depth was requested without active reversed depth. */
  logarithmicDepthBuffer: boolean;
  /** Whether reversed depth was requested and EXT_clip_control is available. */
  reversedDepthBuffer: boolean;
  /** Maximum texture units available to fragment shaders. */
  maxTextures: number;
  /** Maximum texture units available to vertex shaders. */
  maxVertexTextures: number;
  /** Maximum texture width and height. */
  maxTextureSize: number;
  /** Maximum cube-map face width and height. */
  maxCubemapSize: number;
  /** Maximum vertex shader attributes. */
  maxAttributes: number;
  /** Maximum vertex shader uniform vectors. */
  maxVertexUniforms: number;
  /** Maximum shader varying vectors. */
  maxVaryings: number;
  /** Maximum fragment shader uniform vectors. */
  maxFragmentUniforms: number;
  /** Maximum multisample anti-aliasing samples. */
  maxSamples: number;
  /** Samples in the current drawing buffer. */
  samples: number;
}
export class WebGLCapabilities implements WebGLCapabilitiesState {
  private readonly gl: WebGL2RenderingContext;
  private readonly extensions: WebGLExtensions;
  private readonly utils: WebGLUtils;
  private maxAnisotropy: number | undefined = undefined;
  isWebGL2: boolean = true; // keeping this for backwards compatibility
  precision: WebGLCapabilitiesState["precision"];
  logarithmicDepthBuffer: boolean;
  reversedDepthBuffer: boolean;
  maxTextures: number;
  maxVertexTextures: number;
  maxTextureSize: number;
  maxCubemapSize: number;
  maxAttributes: number;
  maxVertexUniforms: number;
  maxVaryings: number;
  maxFragmentUniforms: number;
  maxSamples: number;
  samples: number;

  constructor(
    gl: WebGL2RenderingContext,
    extensions: WebGLExtensions,
    parameters: Pick<WebGLRendererOptions, "precision" | "reversedDepthBuffer" | "logarithmicDepthBuffer">,
    utils: WebGLUtils,
  ) {
    this.gl = gl;
    this.extensions = extensions;
    this.utils = utils;
    let precision = parameters.precision !== undefined ? parameters.precision : "highp";
    const maxPrecision = this.getMaxPrecision(precision);
    if (maxPrecision !== precision) {
      warn("WebGLRenderer:", precision, "not supported, using", maxPrecision, "instead.");
      precision = maxPrecision;
    }
    const reversedDepthBuffer = parameters.reversedDepthBuffer === true && extensions.has("EXT_clip_control");
    const logarithmicDepthBuffer = parameters.logarithmicDepthBuffer === true && reversedDepthBuffer === false;
    if (parameters.reversedDepthBuffer === true && reversedDepthBuffer === false) {
      warn(
        "WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.",
      );
    }
    if (parameters.logarithmicDepthBuffer === true && reversedDepthBuffer === true) {
      warn("WebGLRenderer: Logarithmic depth buffer is ignored when reversed depth buffer is enabled.");
    }
    this.precision = precision;
    this.logarithmicDepthBuffer = logarithmicDepthBuffer;
    this.reversedDepthBuffer = reversedDepthBuffer;
    this.maxTextures = gl.getParameter(GL.MAX_TEXTURE_IMAGE_UNITS);
    this.maxVertexTextures = gl.getParameter(GL.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this.maxTextureSize = gl.getParameter(GL.MAX_TEXTURE_SIZE);
    this.maxCubemapSize = gl.getParameter(GL.MAX_CUBE_MAP_TEXTURE_SIZE);
    this.maxAttributes = gl.getParameter(GL.MAX_VERTEX_ATTRIBS);
    this.maxVertexUniforms = gl.getParameter(GL.MAX_VERTEX_UNIFORM_VECTORS);
    this.maxVaryings = gl.getParameter(GL.MAX_VARYING_VECTORS);
    this.maxFragmentUniforms = gl.getParameter(GL.MAX_FRAGMENT_UNIFORM_VECTORS);
    this.maxSamples = gl.getParameter(GL.MAX_SAMPLES);
    this.samples = gl.getParameter(GL.SAMPLES);
    this.getMaxAnisotropy = this.getMaxAnisotropy.bind(this);
    this.getMaxPrecision = this.getMaxPrecision.bind(this);
    this.textureFormatReadable = this.textureFormatReadable.bind(this);
    this.textureTypeReadable = this.textureTypeReadable.bind(this);
  }

  getMaxAnisotropy(): number {
    if (this.maxAnisotropy !== undefined) return this.maxAnisotropy;
    if (this.extensions.has("EXT_texture_filter_anisotropic") === true) {
      const extension = this.extensions.get("EXT_texture_filter_anisotropic")!;
      this.maxAnisotropy = this.gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else {
      this.maxAnisotropy = 0;
    }
    return this.maxAnisotropy!;
  }

  textureFormatReadable(textureFormat: number): boolean {
    if (
      textureFormat !== PixelFormat.RGBA &&
      this.utils.convert(textureFormat) !== this.gl.getParameter(GL.IMPLEMENTATION_COLOR_READ_FORMAT)
    ) {
      return false;
    }
    return true;
  }

  textureTypeReadable(textureType: number): boolean {
    const halfFloatSupportedByExt =
      textureType === TextureType.HalfFloat &&
      (this.extensions.has("EXT_color_buffer_half_float") || this.extensions.has("EXT_color_buffer_float"));
    if (
      textureType !== TextureType.UnsignedByte &&
      textureType !== TextureType.Float &&
      !halfFloatSupportedByExt &&
      this.utils.convert(textureType) !== this.gl.getParameter(GL.IMPLEMENTATION_COLOR_READ_TYPE)
    ) {
      // Edge and Chrome Mac < 52 (#9513)
      return false;
    }
    return true;
  }

  getMaxPrecision(precision: string): WebGLCapabilitiesState["precision"] {
    if (precision === "highp") {
      if (
        this.gl.getShaderPrecisionFormat(GL.VERTEX_SHADER, GL.HIGH_FLOAT)!.precision > 0 &&
        this.gl.getShaderPrecisionFormat(GL.FRAGMENT_SHADER, GL.HIGH_FLOAT)!.precision > 0
      ) {
        return "highp";
      }
      precision = "mediump";
    }
    if (precision === "mediump") {
      if (
        this.gl.getShaderPrecisionFormat(GL.VERTEX_SHADER, GL.MEDIUM_FLOAT)!.precision > 0 &&
        this.gl.getShaderPrecisionFormat(GL.FRAGMENT_SHADER, GL.MEDIUM_FLOAT)!.precision > 0
      ) {
        return "mediump";
      }
    }
    return "lowp";
  }
}
