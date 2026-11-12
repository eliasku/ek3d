import { warnOnce } from "../../utils";

interface EXTClipControl {
  readonly LOWER_LEFT_EXT: number;
  readonly UPPER_LEFT_EXT: number;
  readonly NEGATIVE_ONE_TO_ONE_EXT: number;
  readonly ZERO_TO_ONE_EXT: number;
  readonly CLIP_ORIGIN_EXT: number;
  readonly CLIP_DEPTH_MODE_EXT: number;
  clipControlEXT(origin: number, depth: number): void;
}

export interface WebGLMultisampledRenderToTexture {
  framebufferTexture2DMultisampleEXT(
    target: number,
    attachment: number,
    textarget: number,
    texture: WebGLTexture | null,
    level: number,
    samples: number,
  ): void;
  renderbufferStorageMultisampleEXT(
    target: number,
    samples: number,
    internalformat: number,
    width: number,
    height: number,
  ): void;
}

interface WebGLExtensionMap {
  ANGLE_instanced_arrays: ANGLE_instanced_arrays;
  EXT_blend_minmax: EXT_blend_minmax;
  EXT_clip_control: EXTClipControl;
  EXT_color_buffer_float: EXT_color_buffer_float;
  EXT_color_buffer_half_float: EXT_color_buffer_half_float;
  EXT_float_blend: EXT_float_blend;
  EXT_frag_depth: EXT_frag_depth;
  EXT_sRGB: EXT_sRGB;
  EXT_shader_texture_lod: EXT_shader_texture_lod;
  EXT_texture_compression_bptc: EXT_texture_compression_bptc;
  EXT_texture_compression_rgtc: EXT_texture_compression_rgtc;
  EXT_texture_filter_anisotropic: EXT_texture_filter_anisotropic;
  EXT_texture_norm16: EXT_texture_norm16;
  KHR_parallel_shader_compile: KHR_parallel_shader_compile;
  OES_element_index_uint: OES_element_index_uint;
  OES_fbo_render_mipmap: OES_fbo_render_mipmap;
  OES_standard_derivatives: OES_standard_derivatives;
  OES_texture_float: OES_texture_float;
  OES_texture_float_linear: OES_texture_float_linear;
  OES_texture_half_float: OES_texture_half_float;
  OES_texture_half_float_linear: OES_texture_half_float_linear;
  OES_vertex_array_object: OES_vertex_array_object;
  OVR_multiview2: OVR_multiview2;
  WEBGL_color_buffer_float: WEBGL_color_buffer_float;
  WEBGL_compressed_texture_astc: WEBGL_compressed_texture_astc;
  WEBGL_compressed_texture_etc: WEBGL_compressed_texture_etc;
  WEBGL_compressed_texture_etc1: WEBGL_compressed_texture_etc1;
  WEBGL_compressed_texture_pvrtc: WEBGL_compressed_texture_pvrtc;
  WEBGL_compressed_texture_s3tc: WEBGL_compressed_texture_s3tc;
  WEBGL_compressed_texture_s3tc_srgb: WEBGL_compressed_texture_s3tc_srgb;
  WEBGL_debug_renderer_info: WEBGL_debug_renderer_info;
  WEBGL_debug_shaders: WEBGL_debug_shaders;
  WEBGL_depth_texture: WEBGL_depth_texture;
  WEBGL_draw_buffers: WEBGL_draw_buffers;
  WEBGL_lose_context: WEBGL_lose_context;
  WEBGL_multi_draw: WEBGL_multi_draw;
  WEBGL_multisampled_render_to_texture: WebGLMultisampledRenderToTexture;
}

export class WebGLExtensions {
  private readonly gl: WebGL2RenderingContext;
  private readonly extensions: Record<string, unknown> = {};

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.has = this.has.bind(this);
    this.init = this.init.bind(this);
    this.get = this.get.bind(this);
  }

  private getExtension(name: string): unknown {
    if (this.extensions[name] !== undefined) {
      return this.extensions[name];
    }
    const extension = this.gl.getExtension(name);
    this.extensions[name] = extension;
    return extension;
  }

  has(name: string): boolean {
    return this.getExtension(name) !== null;
  }

  init(): void {
    this.getExtension("EXT_color_buffer_float");
    this.getExtension("WEBGL_clip_cull_distance");
    this.getExtension("OES_texture_float_linear");
    this.getExtension("EXT_color_buffer_half_float");
    this.getExtension("WEBGL_multisampled_render_to_texture");
    this.getExtension("WEBGL_render_shared_exponent");
  }

  get<K extends keyof WebGLExtensionMap>(name: K): WebGLExtensionMap[K] | null;
  get(name: string): unknown;
  get(name: string): unknown {
    const extension = this.getExtension(name);
    if (extension === null) {
      warnOnce("WebGLRenderer: " + name + " extension not supported.");
    }
    return extension;
  }
}
