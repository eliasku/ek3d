import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { mergeUniforms } from "./UniformsUtils";
import { common, fog } from "./UniformsLib";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_uv_pars_vertex from "./ShaderChunk/uv_pars_vertex.glsl";
import chunk_color_pars_vertex from "./ShaderChunk/color_pars_vertex.glsl";
import chunk_fog_pars_vertex from "./ShaderChunk/fog_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "./ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "./ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "./ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_uv_vertex from "./ShaderChunk/uv_vertex.glsl";
import chunk_color_vertex from "./ShaderChunk/color_vertex.glsl";
import chunk_morphinstance_vertex from "./ShaderChunk/morphinstance_vertex.glsl";
import chunk_morphcolor_vertex from "./ShaderChunk/morphcolor_vertex.glsl";
import chunk_begin_vertex from "./ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "./ShaderChunk/morphtarget_vertex.glsl";
import chunk_project_vertex from "./ShaderChunk/project_vertex.glsl";
import chunk_logdepthbuf_vertex from "./ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "./ShaderChunk/clipping_planes_vertex.glsl";
import chunk_fog_vertex from "./ShaderChunk/fog_vertex.glsl";
import chunk_color_pars_fragment from "./ShaderChunk/color_pars_fragment.glsl";
import chunk_uv_pars_fragment from "./ShaderChunk/uv_pars_fragment.glsl";
import chunk_map_pars_fragment from "./ShaderChunk/map_pars_fragment.glsl";
import chunk_fog_pars_fragment from "./ShaderChunk/fog_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "./ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "./ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "./ShaderChunk/clipping_planes_fragment.glsl";
import chunk_logdepthbuf_fragment from "./ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_map_fragment from "./ShaderChunk/map_fragment.glsl";
import chunk_color_fragment from "./ShaderChunk/color_fragment.glsl";
import chunk_opaque_fragment from "./ShaderChunk/opaque_fragment.glsl";
import chunk_tonemapping_fragment from "./ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "./ShaderChunk/colorspace_fragment.glsl";
import chunk_fog_fragment from "./ShaderChunk/fog_fragment.glsl";
import chunk_premultiplied_alpha_fragment from "./ShaderChunk/premultiplied_alpha_fragment.glsl";
export const dashedShader = {
  uniforms: /*@__PURE__*/ mergeUniforms([
    common,
    fog,
    {
      scale: { value: 1 },
      dashSize: { value: 1 },
      totalSize: { value: 2 },
    },
  ]),
  vertexShader:
    "\nuniform float scale;\nattribute float lineDistance;\n\nvarying float vLineDistance;\n\n" +
    chunk_common +
    "\n" +
    chunk_uv_pars_vertex +
    "\n" +
    chunk_color_pars_vertex +
    "\n" +
    chunk_fog_pars_vertex +
    "\n" +
    chunk_morphtarget_pars_vertex +
    "\n" +
    chunk_logdepthbuf_pars_vertex +
    "\n" +
    chunk_clipping_planes_pars_vertex +
    "\n\nvoid main() {\n\n\tvLineDistance = scale * lineDistance;\n\n" +
    chunk_uv_vertex +
    "\n" +
    chunk_color_vertex +
    "\n" +
    chunk_morphinstance_vertex +
    "\n" +
    chunk_morphcolor_vertex +
    "\n" +
    chunk_begin_vertex +
    "\n" +
    chunk_morphtarget_vertex +
    "\n" +
    chunk_project_vertex +
    "\n" +
    chunk_logdepthbuf_vertex +
    "\n" +
    chunk_clipping_planes_vertex +
    "\n" +
    chunk_fog_vertex +
    "\n\n}\n",
  fragmentShader:
    "\nuniform vec3 diffuse;\nuniform float opacity;\n\nuniform float dashSize;\nuniform float totalSize;\n\nvarying float vLineDistance;\n\n" +
    chunk_common +
    "\n" +
    chunk_color_pars_fragment +
    "\n" +
    chunk_uv_pars_fragment +
    "\n" +
    chunk_map_pars_fragment +
    "\n" +
    chunk_fog_pars_fragment +
    "\n" +
    chunk_logdepthbuf_pars_fragment +
    "\n" +
    chunk_clipping_planes_pars_fragment +
    "\n\nvoid main() {\n\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n" +
    chunk_clipping_planes_fragment +
    "\n\n\tif ( mod( vLineDistance, totalSize ) > dashSize ) {\n\n\t\tdiscard;\n\n\t}\n\n\tvec3 outgoingLight = vec3( 0.0 );\n\n" +
    chunk_logdepthbuf_fragment +
    "\n" +
    chunk_map_fragment +
    "\n" +
    chunk_color_fragment +
    "\n\n\toutgoingLight = diffuseColor.rgb; // simple shader\n\n" +
    chunk_opaque_fragment +
    "\n" +
    chunk_tonemapping_fragment +
    "\n" +
    chunk_colorspace_fragment +
    "\n" +
    chunk_fog_fragment +
    "\n" +
    chunk_premultiplied_alpha_fragment +
    "\n\n}\n",
} satisfies WebGLShaderDescriptor;
