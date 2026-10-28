import type { Texture } from "../../textures/Texture";
/**
 * @module VignetteShader
 * @three_import import { VignetteShader } from 'ek3d/addons/shaders/VignetteShader';
 */

/**
 * Based on [PaintEffect postprocess from ro.me](https://github.com/dataarts/3-dreams-of-black/blob/master/deploy/js/effects/PaintEffect.js).
 *
 * @constant
 */
export const VignetteShader = {
  name: "VignetteShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform float offset;
		uniform float darkness;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			// Eskil's vignette

			vec4 texel = texture2D( tDiffuse, vUv );
			vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );
			gl_FragColor = vec4( mix( texel.rgb, vec3( 1.0 - darkness ), dot( uv, uv ) ), texel.a );

		}`,
};
