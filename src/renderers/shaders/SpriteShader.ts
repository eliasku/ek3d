import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { mergeUniforms } from "./UniformsUtils";
import { sprite, fog } from "./UniformsLib";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_uv_pars_vertex from "./ShaderChunk/uv_pars_vertex.glsl";
import chunk_fog_pars_vertex from "./ShaderChunk/fog_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "./ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "./ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_uv_vertex from "./ShaderChunk/uv_vertex.glsl";
import chunk_logdepthbuf_vertex from "./ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "./ShaderChunk/clipping_planes_vertex.glsl";
import chunk_fog_vertex from "./ShaderChunk/fog_vertex.glsl";
import chunk_uv_pars_fragment from "./ShaderChunk/uv_pars_fragment.glsl";
import chunk_map_pars_fragment from "./ShaderChunk/map_pars_fragment.glsl";
import chunk_alphamap_pars_fragment from "./ShaderChunk/alphamap_pars_fragment.glsl";
import chunk_alphatest_pars_fragment from "./ShaderChunk/alphatest_pars_fragment.glsl";
import chunk_alphahash_pars_fragment from "./ShaderChunk/alphahash_pars_fragment.glsl";
import chunk_fog_pars_fragment from "./ShaderChunk/fog_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "./ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "./ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "./ShaderChunk/clipping_planes_fragment.glsl";
import chunk_logdepthbuf_fragment from "./ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_map_fragment from "./ShaderChunk/map_fragment.glsl";
import chunk_alphamap_fragment from "./ShaderChunk/alphamap_fragment.glsl";
import chunk_alphatest_fragment from "./ShaderChunk/alphatest_fragment.glsl";
import chunk_alphahash_fragment from "./ShaderChunk/alphahash_fragment.glsl";
import chunk_opaque_fragment from "./ShaderChunk/opaque_fragment.glsl";
import chunk_tonemapping_fragment from "./ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "./ShaderChunk/colorspace_fragment.glsl";
import chunk_fog_fragment from "./ShaderChunk/fog_fragment.glsl";
export const spriteShader = {
  uniforms: /*@__PURE__*/ mergeUniforms([sprite, fog]),
  vertexShader:
    "\nuniform float rotation;\nuniform vec2 center;\n\n" +
    chunk_common +
    "\n" +
    chunk_uv_pars_vertex +
    "\n" +
    chunk_fog_pars_vertex +
    "\n" +
    chunk_logdepthbuf_pars_vertex +
    "\n" +
    chunk_clipping_planes_pars_vertex +
    "\n\nvoid main() {\n\n" +
    chunk_uv_vertex +
    "\n\n\tvec4 mvPosition = modelViewMatrix[ 3 ];\n\n\tvec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );\n\n\t#ifndef USE_SIZEATTENUATION\n\n\t\tbool isPerspective = isPerspectiveMatrix( projectionMatrix );\n\n\t\tif ( isPerspective ) scale *= - mvPosition.z;\n\n\t#endif\n\n\tvec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;\n\n\tvec2 rotatedPosition;\n\trotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;\n\trotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;\n\n\tmvPosition.xy += rotatedPosition;\n\n\tgl_Position = projectionMatrix * mvPosition;\n\n" +
    chunk_logdepthbuf_vertex +
    "\n" +
    chunk_clipping_planes_vertex +
    "\n" +
    chunk_fog_vertex +
    "\n\n}\n",
  fragmentShader:
    "\nuniform vec3 diffuse;\nuniform float opacity;\n\n" +
    chunk_common +
    "\n" +
    chunk_uv_pars_fragment +
    "\n" +
    chunk_map_pars_fragment +
    "\n" +
    chunk_alphamap_pars_fragment +
    "\n" +
    chunk_alphatest_pars_fragment +
    "\n" +
    chunk_alphahash_pars_fragment +
    "\n" +
    chunk_fog_pars_fragment +
    "\n" +
    chunk_logdepthbuf_pars_fragment +
    "\n" +
    chunk_clipping_planes_pars_fragment +
    "\n\nvoid main() {\n\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n" +
    chunk_clipping_planes_fragment +
    "\n\n\tvec3 outgoingLight = vec3( 0.0 );\n\n" +
    chunk_logdepthbuf_fragment +
    "\n" +
    chunk_map_fragment +
    "\n" +
    chunk_alphamap_fragment +
    "\n" +
    chunk_alphatest_fragment +
    "\n" +
    chunk_alphahash_fragment +
    "\n\n\toutgoingLight = diffuseColor.rgb;\n\n" +
    chunk_opaque_fragment +
    "\n" +
    chunk_tonemapping_fragment +
    "\n" +
    chunk_colorspace_fragment +
    "\n" +
    chunk_fog_fragment +
    "\n\n}\n",
} satisfies WebGLShaderDescriptor;
