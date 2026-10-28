import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { Matrix3 } from "../../math/Matrix3";
import chunk_common from "./ShaderChunk/common.glsl";
import chunk_begin_vertex from "./ShaderChunk/begin_vertex.glsl";
import chunk_project_vertex from "./ShaderChunk/project_vertex.glsl";
import chunk_envmap_common_pars_fragment from "./ShaderChunk/envmap_common_pars_fragment.glsl";
import chunk_tonemapping_fragment from "./ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "./ShaderChunk/colorspace_fragment.glsl";
export const backgroundCubeShader = {
  uniforms: {
    envMap: { value: null },
    backgroundBlurriness: { value: 0 },
    backgroundIntensity: { value: 1 },
    backgroundRotation: { value: /*@__PURE__*/ new Matrix3() },
  },
  vertexShader:
    "\nvarying vec3 vWorldDirection;\n\n" +
    chunk_common +
    "\n\nvoid main() {\n\n\tvWorldDirection = transformDirection( position, modelMatrix );\n\n" +
    chunk_begin_vertex +
    "\n" +
    chunk_project_vertex +
    "\n\n\tgl_Position.z = gl_Position.w; // set z to camera.far\n\n}\n",
  fragmentShader:
    "\n\nuniform float backgroundBlurriness;\nuniform float backgroundIntensity;\nuniform mat3 backgroundRotation;\n\nvarying vec3 vWorldDirection;\n\n" +
    chunk_envmap_common_pars_fragment +
    "\n\nvoid main() {\n\n\t#ifdef ENVMAP_TYPE_PMREM\n\n\t\tvec4 texColor = textureLod( envMap, backgroundRotation * vWorldDirection, roughnessToMip( backgroundBlurriness ) );\n\n\t#else\n\n\t\tvec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );\n\n\t#endif\n\n\ttexColor.rgb *= backgroundIntensity;\n\n\tgl_FragColor = texColor;\n\n" +
    chunk_tonemapping_fragment +
    "\n" +
    chunk_colorspace_fragment +
    "\n\n}\n",
} satisfies WebGLShaderDescriptor;
