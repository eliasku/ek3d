import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { mergeUniforms } from "./UniformsUtils";
import { Vector3 } from "../../math/Vector3";
import { common, displacementmap } from "./UniformsLib";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_batching_pars_vertex from "./ShaderChunk/batching_pars_vertex.glsl";
import chunk_uv_pars_vertex from "./ShaderChunk/uv_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "./ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_skinning_pars_vertex from "./ShaderChunk/skinning_pars_vertex.glsl";
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
import chunk_worldpos_vertex from "./ShaderChunk/worldpos_vertex.glsl";
import chunk_clipping_planes_vertex from "./ShaderChunk/clipping_planes_vertex.glsl";
import chunk_uv_pars_fragment from "./ShaderChunk/uv_pars_fragment.glsl";
import chunk_map_pars_fragment from "./ShaderChunk/map_pars_fragment.glsl";
import chunk_alphamap_pars_fragment from "./ShaderChunk/alphamap_pars_fragment.glsl";
import chunk_alphatest_pars_fragment from "./ShaderChunk/alphatest_pars_fragment.glsl";
import chunk_alphahash_pars_fragment from "./ShaderChunk/alphahash_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "./ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_clipping_planes_fragment from "./ShaderChunk/clipping_planes_fragment.glsl";
import chunk_map_fragment from "./ShaderChunk/map_fragment.glsl";
import chunk_alphamap_fragment from "./ShaderChunk/alphamap_fragment.glsl";
import chunk_alphatest_fragment from "./ShaderChunk/alphatest_fragment.glsl";
import chunk_alphahash_fragment from "./ShaderChunk/alphahash_fragment.glsl";
export const distanceShader = {
  uniforms: /*@__PURE__*/ mergeUniforms([
    common,
    displacementmap,
    {
      referencePosition: { value: /*@__PURE__*/ new Vector3() },
      nearDistance: { value: 1 },
      farDistance: { value: 1000 },
    },
  ]),
  vertexShader:
    "\n#define DISTANCE\n\nvarying vec3 vWorldPosition;\n\n" +
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
    chunk_clipping_planes_pars_vertex +
    "\n\nvoid main() {\n\n" +
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
    chunk_worldpos_vertex +
    "\n" +
    chunk_clipping_planes_vertex +
    "\n\n\tvWorldPosition = worldPosition.xyz;\n\n}\n",
  fragmentShader:
    "\n#define DISTANCE\n\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n\n" +
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
    chunk_clipping_planes_pars_fragment +
    "\n\nvoid main() {\n\n\tvec4 diffuseColor = vec4( 1.0 );\n" +
    chunk_clipping_planes_fragment +
    "\n\n" +
    chunk_map_fragment +
    "\n" +
    chunk_alphamap_fragment +
    "\n" +
    chunk_alphatest_fragment +
    "\n" +
    chunk_alphahash_fragment +
    "\n\n\tfloat dist = length( vWorldPosition - referencePosition );\n\tdist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n\tdist = saturate( dist ); // clamp to [ 0, 1 ]\n\n\tgl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );\n\n}\n",
} satisfies WebGLShaderDescriptor;
