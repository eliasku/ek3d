import type { Texture } from "../../textures/Texture";
import { Color } from "../../math/Color";
/**
 * @module ColorifyShader
 */

/**
 * Colorify shader.
 *
 * @constant
 */
export const ColorifyShader = {
  name: "ColorifyShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    color: { value: new Color(0xffffff) },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform vec3 color;
		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			gl_FragColor = vec4( v * color, texel.w );

		}`,
};
