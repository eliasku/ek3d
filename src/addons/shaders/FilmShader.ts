import type { Texture } from "../../textures/Texture";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
/**
 * @module FilmShader
 * @three_import import { FilmShader } from 'ek3d/addons/shaders/FilmShader';
 */

/**
 * Film grain shader that adds animated noise to the image, with an optional
 * grayscale conversion.
 *
 * Used by {@link FilmPass}.
 *
 * @constant
 */
export const FilmShader = {
  name: "FilmShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    time: { value: 0.0 },
    intensity: { value: 0.5 },
    grayscale: { value: false },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

${chunk_common}

		uniform float intensity;
		uniform bool grayscale;
		uniform float time;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 base = texture2D( tDiffuse, vUv );

			float noise = rand( fract( vUv + time ) );

			vec3 color = base.rgb + base.rgb * clamp( 0.1 + noise, 0.0, 1.0 );

			color = mix( base.rgb, color, intensity );

			if ( grayscale ) {

				color = vec3( luminance( color ) ); // assuming linear-srgb

			}

			gl_FragColor = vec4( color, base.a );

		}`,
};
