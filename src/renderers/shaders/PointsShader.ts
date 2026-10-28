import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { mergeUniforms } from "./UniformsUtils";
import { points, fog } from "./UniformsLib";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_color_pars_vertex from "./ShaderChunk/color_pars_vertex.glsl";
import chunk_fog_pars_vertex from "./ShaderChunk/fog_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "./ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "./ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "./ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_color_vertex from "./ShaderChunk/color_vertex.glsl";
import chunk_morphinstance_vertex from "./ShaderChunk/morphinstance_vertex.glsl";
import chunk_morphcolor_vertex from "./ShaderChunk/morphcolor_vertex.glsl";
import chunk_begin_vertex from "./ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "./ShaderChunk/morphtarget_vertex.glsl";
import chunk_project_vertex from "./ShaderChunk/project_vertex.glsl";
import chunk_logdepthbuf_vertex from "./ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "./ShaderChunk/clipping_planes_vertex.glsl";
import chunk_worldpos_vertex from "./ShaderChunk/worldpos_vertex.glsl";
import chunk_fog_vertex from "./ShaderChunk/fog_vertex.glsl";
import chunk_color_pars_fragment from "./ShaderChunk/color_pars_fragment.glsl";
import chunk_alphatest_pars_fragment from "./ShaderChunk/alphatest_pars_fragment.glsl";
import chunk_alphahash_pars_fragment from "./ShaderChunk/alphahash_pars_fragment.glsl";
import chunk_fog_pars_fragment from "./ShaderChunk/fog_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "./ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "./ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "./ShaderChunk/clipping_planes_fragment.glsl";
import chunk_logdepthbuf_fragment from "./ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_color_fragment from "./ShaderChunk/color_fragment.glsl";
import chunk_alphatest_fragment from "./ShaderChunk/alphatest_fragment.glsl";
import chunk_alphahash_fragment from "./ShaderChunk/alphahash_fragment.glsl";
import chunk_opaque_fragment from "./ShaderChunk/opaque_fragment.glsl";
import chunk_tonemapping_fragment from "./ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "./ShaderChunk/colorspace_fragment.glsl";
import chunk_fog_fragment from "./ShaderChunk/fog_fragment.glsl";
import chunk_premultiplied_alpha_fragment from "./ShaderChunk/premultiplied_alpha_fragment.glsl";
export const pointsShader = {
  uniforms: /*@__PURE__*/ mergeUniforms([points, fog]),
  vertexShader:
    "\nuniform float size;\nuniform float scale;\n\n" +
    chunk_common +
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
    "\n\n#ifdef USE_POINTS_UV\n\n\tvarying vec2 vUv;\n\tuniform mat3 uvTransform;\n\n#endif\n\nvoid main() {\n\n\t#ifdef USE_POINTS_UV\n\n\t\tvUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n\n\t#endif\n\n" +
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
    "\n\n\tgl_PointSize = size;\n\n\t#ifdef USE_SIZEATTENUATION\n\n\t\tbool isPerspective = isPerspectiveMatrix( projectionMatrix );\n\n\t\tif ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );\n\n\t#endif\n\n" +
    chunk_logdepthbuf_vertex +
    "\n" +
    chunk_clipping_planes_vertex +
    "\n" +
    chunk_worldpos_vertex +
    "\n" +
    chunk_fog_vertex +
    "\n\n}\n",
  fragmentShader:
    "\nuniform vec3 diffuse;\nuniform float opacity;\n\n" +
    chunk_common +
    "\n" +
    chunk_color_pars_fragment +
    "\n" +
    "\n#if defined( USE_POINTS_UV )\n\n\tvarying vec2 vUv;\n\n#else\n\n\t#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n\n\t\tuniform mat3 uvTransform;\n\n\t#endif\n\n#endif\n\n#ifdef USE_MAP\n\n\tuniform sampler2D map;\n\n#endif\n\n#ifdef USE_ALPHAMAP\n\n\tuniform sampler2D alphaMap;\n\n#endif\n" +
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
    "\n#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n\n\t#if defined( USE_POINTS_UV )\n\n\t\tvec2 uv = vUv;\n\n\t#else\n\n\t\tvec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n\n\t#endif\n\n#endif\n\n#ifdef USE_MAP\n\n\tdiffuseColor *= texture2D( map, uv );\n\n#endif\n\n#ifdef USE_ALPHAMAP\n\n\tdiffuseColor.a *= texture2D( alphaMap, uv ).g;\n\n#endif\n" +
    "\n" +
    chunk_color_fragment +
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
    "\n" +
    chunk_premultiplied_alpha_fragment +
    "\n\n}\n",
} satisfies WebGLShaderDescriptor;
