import type { Texture } from "../../textures/Texture";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
/**
 * @module LuminosityShader
 * @three_import import { LuminosityShader } from 'ek3d/addons/shaders/LuminosityShader';
 */

/**
 * Luminosity shader.
 *
 * @constant
 */
export const LuminosityShader = {
  name: "LuminosityShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

${chunk_common}

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float l = luminance( texel.rgb );

			gl_FragColor = vec4( l, l, l, texel.w );

		}`,
};
