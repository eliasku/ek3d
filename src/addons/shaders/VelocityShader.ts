import { common, displacementmap } from "../../renderers/shaders/UniformsLib";
import { mergeUniforms } from "../../renderers/shaders/UniformsUtils";
import { Matrix4 } from "../../math/Matrix4";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_uv_pars_vertex from "../../renderers/shaders/ShaderChunk/uv_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_skinning_pars_vertex from "../../renderers/shaders/ShaderChunk/skinning_pars_vertex.glsl";
import chunk_logdepthbuf_pars_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_vertex.glsl";
import chunk_clipping_planes_pars_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_vertex.glsl";
import chunk_uv_vertex from "../../renderers/shaders/ShaderChunk/uv_vertex.glsl";
import chunk_beginnormal_vertex from "../../renderers/shaders/ShaderChunk/beginnormal_vertex.glsl";
import chunk_morphnormal_vertex from "../../renderers/shaders/ShaderChunk/morphnormal_vertex.glsl";
import chunk_skinbase_vertex from "../../renderers/shaders/ShaderChunk/skinbase_vertex.glsl";
import chunk_skinnormal_vertex from "../../renderers/shaders/ShaderChunk/skinnormal_vertex.glsl";
import chunk_defaultnormal_vertex from "../../renderers/shaders/ShaderChunk/defaultnormal_vertex.glsl";
import chunk_normal_pars_vertex from "../../renderers/shaders/ShaderChunk/normal_pars_vertex.glsl";
import chunk_normal_vertex from "../../renderers/shaders/ShaderChunk/normal_vertex.glsl";
import chunk_begin_vertex from "../../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_vertex.glsl";
import chunk_skinning_vertex from "../../renderers/shaders/ShaderChunk/skinning_vertex.glsl";
import chunk_logdepthbuf_vertex from "../../renderers/shaders/ShaderChunk/logdepthbuf_vertex.glsl";
import chunk_clipping_planes_vertex from "../../renderers/shaders/ShaderChunk/clipping_planes_vertex.glsl";
import chunk_uv_pars_fragment from "../../renderers/shaders/ShaderChunk/uv_pars_fragment.glsl";
import chunk_map_pars_fragment from "../../renderers/shaders/ShaderChunk/map_pars_fragment.glsl";
import chunk_alphamap_pars_fragment from "../../renderers/shaders/ShaderChunk/alphamap_pars_fragment.glsl";
import chunk_alphatest_pars_fragment from "../../renderers/shaders/ShaderChunk/alphatest_pars_fragment.glsl";
import chunk_logdepthbuf_pars_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_pars_fragment.glsl";
import chunk_clipping_planes_pars_fragment from "../../renderers/shaders/ShaderChunk/clipping_planes_pars_fragment.glsl";
import chunk_map_fragment from "../../renderers/shaders/ShaderChunk/map_fragment.glsl";
import chunk_alphamap_fragment from "../../renderers/shaders/ShaderChunk/alphamap_fragment.glsl";
import chunk_alphatest_fragment from "../../renderers/shaders/ShaderChunk/alphatest_fragment.glsl";
import chunk_logdepthbuf_fragment from "../../renderers/shaders/ShaderChunk/logdepthbuf_fragment.glsl";
import chunk_packing from "../../renderers/shaders/ShaderChunk/packing.glsl";
import chunk_displacementmap_pars_vertex from "../../renderers/shaders/ShaderChunk/displacementmap_pars_vertex.glsl";
import chunk_displacementmap_vertex from "../../renderers/shaders/ShaderChunk/displacementmap_vertex.glsl";
/**
 * @module VelocityShader
 */

/**
 * Mesh velocity shader by @bhouston.
 *
 * @constant
 */
export const VelocityShader = {
  name: "VelocityShader",

  uniforms: mergeUniforms([
    common,
    displacementmap,
    {
      modelMatrixPrev: { value: new Matrix4() },
      currentProjectionViewMatrix: { value: new Matrix4() },
      previousProjectionViewMatrix: { value: new Matrix4() },
    },
  ]),

  vertexShader: /* glsl */ `
#define NORMAL

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	varying vec3 vViewPosition;

#endif

${chunk_common}
${chunk_packing}
${chunk_uv_pars_vertex}
${chunk_displacementmap_pars_vertex}
${chunk_normal_pars_vertex}
${chunk_morphtarget_pars_vertex}
${chunk_skinning_pars_vertex}
${chunk_logdepthbuf_pars_vertex}
${chunk_clipping_planes_pars_vertex}

uniform mat4 previousProjectionViewMatrix;
uniform mat4 currentProjectionViewMatrix;

uniform mat4 modelMatrixPrev;

varying vec4 clipPositionCurrent;
varying vec4 clipPositionPrevious;

void main() {


${chunk_uv_vertex}

${chunk_beginnormal_vertex}
${chunk_morphnormal_vertex}
${chunk_skinbase_vertex}
${chunk_skinnormal_vertex}
${chunk_defaultnormal_vertex}
${chunk_normal_vertex}

${chunk_begin_vertex}
${chunk_morphtarget_vertex}
${chunk_displacementmap_vertex}
${chunk_morphtarget_vertex}
${chunk_skinning_vertex}

#ifdef USE_SKINNING

	vec4 mvPosition = modelViewMatrix * skinned;
	clipPositionCurrent  = currentProjectionViewMatrix * modelMatrix * skinned;
	clipPositionPrevious = previousProjectionViewMatrix * modelMatrixPrev * skinned;

#else

	vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
	clipPositionCurrent  = currentProjectionViewMatrix * modelMatrix * vec4( transformed, 1.0 );
	clipPositionPrevious = previousProjectionViewMatrix * modelMatrixPrev * vec4( transformed, 1.0 );

#endif

	gl_Position = projectionMatrix * mvPosition;

${chunk_logdepthbuf_vertex}
${chunk_clipping_planes_vertex}
}
`,
  fragmentShader: /* glsl */ `
#define NORMAL

uniform float opacity;

${chunk_packing}
${chunk_uv_pars_fragment}
${chunk_map_pars_fragment}
${chunk_alphamap_pars_fragment}
${chunk_alphatest_pars_fragment}
${chunk_logdepthbuf_pars_fragment}
${chunk_clipping_planes_pars_fragment}

varying vec4 clipPositionCurrent;
varying vec4 clipPositionPrevious;

void main() {

	vec4 diffuseColor = vec4( 1.0 );
	diffuseColor.a = opacity;

${chunk_map_fragment}
${chunk_alphamap_fragment}
${chunk_alphatest_fragment}

	vec2 ndcPositionCurrent  = clipPositionCurrent.xy/clipPositionCurrent.w;
	vec2 ndcPositionPrevious = clipPositionPrevious.xy/clipPositionPrevious.w;
	vec2 vel = ( ndcPositionCurrent - ndcPositionPrevious ) * 0.5;
	vel = vel * 0.5 + 0.5;
	vec2 v1 = packDepthToRG(vel.x);
	vec2 v2 = packDepthToRG(vel.y);
	gl_FragColor = vec4(v1.x, v1.y, v2.x, v2.y);

${chunk_logdepthbuf_fragment}

}

`,
};
