import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { mergeUniforms } from "./UniformsUtils";
import { common, displacementmap } from "./UniformsLib";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_batching_pars_vertex from "./ShaderChunk/batching_pars_vertex.glsl";
import chunk_uv_pars_vertex from "./ShaderChunk/uv_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "./ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_skinning_pars_vertex from "./ShaderChunk/skinning_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "./ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "./ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_uv_vertex from "./ShaderChunk/uv_vertex.glsl";
import chunk_batching_vertex from "./ShaderChunk/batching_vertex.glsl";
import chunk_skinbase_vertex from "./ShaderChunk/skinbase_vertex.glsl";
import chunk_morphinstance_vertex from "./ShaderChunk/morphinstance_vertex.glsl";
import chunk_beginnormal_vertex from "./ShaderChunk/beginnormal_vertex.glsl";
import chunk_morphnormal_vertex from "./ShaderChunk/morphnormal_vertex.glsl";
import chunk_skinnormal_vertex from "./ShaderChunk/skinnormal_vertex.glsl";
import chunk_begin_vertex from "./ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "./ShaderChunk/morphtarget_vertex.glsl";
import chunk_skinning_vertex from "./ShaderChunk/skinning_vertex.glsl";
import chunk_project_vertex from "./ShaderChunk/project_vertex.glsl";
import chunk_logdepthbuf_vertex from "./ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "./ShaderChunk/clipping_planes_vertex.glsl";
import chunk_uv_pars_fragment from "./ShaderChunk/uv_pars_fragment.glsl";
import chunk_map_pars_fragment from "./ShaderChunk/map_pars_fragment.glsl";
import chunk_alphamap_pars_fragment from "./ShaderChunk/alphamap_pars_fragment.glsl";
import chunk_alphatest_pars_fragment from "./ShaderChunk/alphatest_pars_fragment.glsl";
import chunk_alphahash_pars_fragment from "./ShaderChunk/alphahash_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "./ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "./ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "./ShaderChunk/clipping_planes_fragment.glsl";
import chunk_map_fragment from "./ShaderChunk/map_fragment.glsl";
import chunk_alphamap_fragment from "./ShaderChunk/alphamap_fragment.glsl";
import chunk_alphatest_fragment from "./ShaderChunk/alphatest_fragment.glsl";
import chunk_alphahash_fragment from "./ShaderChunk/alphahash_fragment.glsl";
import chunk_logdepthbuf_fragment from "./ShaderChunk/logdepthbuf_fragment.glsl";
export const depthShader = {
  uniforms: /*@__PURE__*/ mergeUniforms([common, displacementmap]),
  vertexShader:
    "\n" +
    chunk_common +
    "\n" +
    chunk_batching_pars_vertex +
    "\n" +
    chunk_uv_pars_vertex +
    "\n" +
    "\n#ifdef USE_DISPLACEMENTMAP\n\n\tuniform sampler2D displacementMap;\n\tuniform float displacementScale;\n\tuniform float displacementBias;\n\n#endif\n" +
    "\n" +
    chunk_morphtarget_pars_vertex +
    "\n" +
    chunk_skinning_pars_vertex +
    "\n" +
    chunk_logdepthbuf_pars_vertex +
    "\n" +
    chunk_clipping_planes_pars_vertex +
    "\n\n// This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.\n// Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for\n// depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.\nvarying vec2 vHighPrecisionZW;\n\nvoid main() {\n\n" +
    chunk_uv_vertex +
    "\n\n" +
    chunk_batching_vertex +
    "\n" +
    chunk_skinbase_vertex +
    "\n\n" +
    chunk_morphinstance_vertex +
    "\n\n\t#ifdef USE_DISPLACEMENTMAP\n\n" +
    chunk_beginnormal_vertex +
    "\n" +
    chunk_morphnormal_vertex +
    "\n" +
    chunk_skinnormal_vertex +
    "\n\n\t#endif\n\n" +
    chunk_begin_vertex +
    "\n" +
    chunk_morphtarget_vertex +
    "\n" +
    chunk_skinning_vertex +
    "\n" +
    "\n#ifdef USE_DISPLACEMENTMAP\n\n\ttransformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );\n\n#endif\n" +
    "\n" +
    chunk_project_vertex +
    "\n" +
    chunk_logdepthbuf_vertex +
    "\n" +
    chunk_clipping_planes_vertex +
    "\n\n\tvHighPrecisionZW = gl_Position.zw;\n\n}\n",
  fragmentShader:
    "\n#if DEPTH_PACKING == 3200\n\n\tuniform float opacity;\n\n#endif\n\n" +
    chunk_common +
    "\n" +
    "\nvec3 packNormalToRGB( const in vec3 normal ) {\n\treturn normalize( normal ) * 0.5 + 0.5;\n}\n\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n\treturn 2.0 * rgb.xyz - 1.0;\n}\n\nconst float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)\nconst float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)\nconst float ShiftRight8 = 1. / 256.;\nconst float Inv255 = 1. / 255.;\n\nconst vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );\n\nconst vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );\nconst vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );\nconst vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );\n\nvec4 packDepthToRGBA( const in float v ) {\n\tif( v <= 0.0 )\n\t\treturn vec4( 0., 0., 0., 0. );\n\tif( v >= 1.0 )\n\t\treturn vec4( 1., 1., 1., 1. );\n\tfloat vuf;\n\tfloat af = modf( v * PackFactors.a, vuf );\n\tfloat bf = modf( vuf * ShiftRight8, vuf );\n\tfloat gf = modf( vuf * ShiftRight8, vuf );\n\treturn vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );\n}\n\nvec3 packDepthToRGB( const in float v ) {\n\tif( v <= 0.0 )\n\t\treturn vec3( 0., 0., 0. );\n\tif( v >= 1.0 )\n\t\treturn vec3( 1., 1., 1. );\n\tfloat vuf;\n\tfloat bf = modf( v * PackFactors.b, vuf );\n\tfloat gf = modf( vuf * ShiftRight8, vuf );\n\t// the 0.9999 tweak is unimportant, very tiny empirical improvement\n\t// return vec3( vuf * Inv255, gf * PackUpscale, bf * 0.9999 );\n\treturn vec3( vuf * Inv255, gf * PackUpscale, bf );\n}\n\nvec2 packDepthToRG( const in float v ) {\n\tif( v <= 0.0 )\n\t\treturn vec2( 0., 0. );\n\tif( v >= 1.0 )\n\t\treturn vec2( 1., 1. );\n\tfloat vuf;\n\tfloat gf = modf( v * 256., vuf );\n\treturn vec2( vuf * Inv255, gf );\n}\n\nfloat unpackRGBAToDepth( const in vec4 v ) {\n\treturn dot( v, UnpackFactors4 );\n}\n\nfloat unpackRGBToDepth( const in vec3 v ) {\n\treturn dot( v, UnpackFactors3 );\n}\n\nfloat unpackRGToDepth( const in vec2 v ) {\n\treturn v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;\n}\n\nvec4 pack2HalfToRGBA( const in vec2 v ) {\n\tvec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );\n\treturn vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );\n}\n\nvec2 unpackRGBATo2Half( const in vec4 v ) {\n\treturn vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\n\n// NOTE: viewZ, the z-coordinate in camera space, is negative for points in front of the camera\n\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n\t// -near maps to 0; -far maps to 1\n\treturn ( viewZ + near ) / ( near - far );\n}\n\nfloat orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {\n\n\t#ifdef USE_REVERSED_DEPTH_BUFFER\n\t\n\t\treturn depth * ( far - near ) - far;\n\n\t#else\n\n\t\treturn depth * ( near - far ) - near;\n\n\t#endif\n}\n\n// NOTE: https://twitter.com/gonnavis/status/1377183786949959682\n\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n\t// -near maps to 0; -far maps to 1\n\treturn ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );\n}\n\nfloat perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {\n\t\n\t#ifdef USE_REVERSED_DEPTH_BUFFER\n\n\t\treturn ( near * far ) / ( ( near - far ) * depth - near );\n\n\t#else\n\n\t\treturn ( near * far ) / ( ( far - near ) * depth - far );\n\n\t#endif\n}\n" +
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
    chunk_logdepthbuf_pars_fragment +
    "\n" +
    chunk_clipping_planes_pars_fragment +
    "\n\nvarying vec2 vHighPrecisionZW;\n\nvoid main() {\n\n\tvec4 diffuseColor = vec4( 1.0 );\n" +
    chunk_clipping_planes_fragment +
    "\n\n\t#if DEPTH_PACKING == 3200\n\n\t\tdiffuseColor.a = opacity;\n\n\t#endif\n\n" +
    chunk_map_fragment +
    "\n" +
    chunk_alphamap_fragment +
    "\n" +
    chunk_alphatest_fragment +
    "\n" +
    chunk_alphahash_fragment +
    "\n\n" +
    chunk_logdepthbuf_fragment +
    "\n\n\t// Higher precision equivalent of gl_FragCoord.z\n\n\t#ifdef USE_REVERSED_DEPTH_BUFFER\n\n\t\tfloat fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];\n\n\t#else\n\n\t\tfloat fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;\n\n\t#endif\n\n\t#if DEPTH_PACKING == 3200\n\n\t\tgl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );\n\n\t#elif DEPTH_PACKING == 3201\n\n\t\t// TODO Deprecate\n\t\tgl_FragColor = packDepthToRGBA( fragCoordZ );\n\n\t#elif DEPTH_PACKING == 3202\n\n\t\t// TODO Deprecate\n\t\tgl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );\n\n\t#elif DEPTH_PACKING == 3203\n\n\t\t// TODO Deprecate\n\t\tgl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );\n\n\t#endif\n\n}\n",
} satisfies WebGLShaderDescriptor;
