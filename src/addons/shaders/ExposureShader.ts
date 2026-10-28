import type { Texture } from "../../textures/Texture";
/**
 * @module ExposureShader
 * @three_import import { ExposureShader } from 'ek3d/addons/shaders/ExposureShader';
 */

/**
 * Exposure shader that scales the image color by an exposure factor.
 *
 * @constant
 */
export const ExposureShader = {
  name: "ExposureShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    exposure: { value: 1.0 },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform float exposure;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragColor.rgb *= exposure;

		}`,
};
