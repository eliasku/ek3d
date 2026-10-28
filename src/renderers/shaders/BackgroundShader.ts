import type { WebGLShaderDescriptor } from "../WebGLRenderer";
import { Matrix3 } from "../../math/Matrix3";
import chunk_tonemapping_fragment from "./ShaderChunk/tonemapping_fragment.glsl";
import chunk_colorspace_fragment from "./ShaderChunk/colorspace_fragment.glsl";
export const backgroundShader = {
  uniforms: {
    uvTransform: { value: /*@__PURE__*/ new Matrix3() },
    t2D: { value: null },
    backgroundIntensity: { value: 1 },
  },
  vertexShader:
    "\nvarying vec2 vUv;\nuniform mat3 uvTransform;\n\nvoid main() {\n\n\tvUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n\n\tgl_Position = vec4( position.xy, 1.0, 1.0 );\n\n}\n",
  fragmentShader:
    "\nuniform sampler2D t2D;\nuniform float backgroundIntensity;\n\nvarying vec2 vUv;\n\nvoid main() {\n\n\tvec4 texColor = texture2D( t2D, vUv );\n\n\t#ifdef DECODE_VIDEO_TEXTURE\n\n\t\t// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures\n\n\t\ttexColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );\n\n\t#endif\n\n\ttexColor.rgb *= backgroundIntensity;\n\n\tgl_FragColor = texColor;\n\n" +
    chunk_tonemapping_fragment +
    "\n" +
    chunk_colorspace_fragment +
    "\n\n}\n",
} satisfies WebGLShaderDescriptor;
