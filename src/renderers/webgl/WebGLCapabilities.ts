import { FloatType, HalfFloatType, RGBAFormat, UnsignedByteType } from "../../constants";
import { warn } from "../../utils";
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
  /** Whether logarithmic depth was requested. */
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
export function WebGLCapabilities(gl?: any, extensions?: any, parameters?: any, utils?: any) {
  let maxAnisotropy: any;
  function getMaxAnisotropy() {
    if (maxAnisotropy !== undefined) return maxAnisotropy;
    if (extensions.has("EXT_texture_filter_anisotropic") === true) {
      const extension = extensions.get("EXT_texture_filter_anisotropic");
      maxAnisotropy = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else {
      maxAnisotropy = 0;
    }
    return maxAnisotropy;
  }
  function textureFormatReadable(textureFormat?: any) {
    if (
      textureFormat !== RGBAFormat &&
      utils.convert(textureFormat) !== gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT)
    ) {
      return false;
    }
    return true;
  }
  function textureTypeReadable(textureType?: any) {
    const halfFloatSupportedByExt =
      textureType === HalfFloatType &&
      (extensions.has("EXT_color_buffer_half_float") || extensions.has("EXT_color_buffer_float"));
    if (
      textureType !== UnsignedByteType &&
      textureType !== FloatType &&
      !halfFloatSupportedByExt &&
      utils.convert(textureType) !== gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE)
    ) {
      // Edge and Chrome Mac < 52 (#9513)
      return false;
    }
    return true;
  }
  function getMaxPrecision(precision?: any) {
    if (precision === "highp") {
      if (
        gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision > 0 &&
        gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0
      ) {
        return "highp";
      }
      precision = "mediump";
    }
    if (precision === "mediump") {
      if (
        gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT).precision > 0 &&
        gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0
      ) {
        return "mediump";
      }
    }
    return "lowp";
  }
  let precision = parameters.precision !== undefined ? parameters.precision : "highp";
  const maxPrecision = getMaxPrecision(precision);
  if (maxPrecision !== precision) {
    warn("WebGLRenderer:", precision, "not supported, using", maxPrecision, "instead.");
    precision = maxPrecision;
  }
  const logarithmicDepthBuffer = parameters.logarithmicDepthBuffer === true;
  const reversedDepthBuffer = parameters.reversedDepthBuffer === true && extensions.has("EXT_clip_control");
  if (parameters.reversedDepthBuffer === true && reversedDepthBuffer === false) {
    warn(
      "WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.",
    );
  }
  const maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxCubemapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
  const maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
  const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
  const maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
  const maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  const maxSamples = gl.getParameter(gl.MAX_SAMPLES);
  const samples = gl.getParameter(gl.SAMPLES);
  return {
    isWebGL2: true, // keeping this for backwards compatibility
    getMaxAnisotropy: getMaxAnisotropy,
    getMaxPrecision: getMaxPrecision,
    textureFormatReadable: textureFormatReadable,
    textureTypeReadable: textureTypeReadable,
    precision: precision,
    logarithmicDepthBuffer: logarithmicDepthBuffer,
    reversedDepthBuffer: reversedDepthBuffer,
    maxTextures: maxTextures,
    maxVertexTextures: maxVertexTextures,
    maxTextureSize: maxTextureSize,
    maxCubemapSize: maxCubemapSize,
    maxAttributes: maxAttributes,
    maxVertexUniforms: maxVertexUniforms,
    maxVaryings: maxVaryings,
    maxFragmentUniforms: maxFragmentUniforms,
    maxSamples: maxSamples,
    samples: samples,
  };
}
