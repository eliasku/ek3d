import type { Texture } from "../../textures/Texture";
import { Color } from "../../math/Color";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
/**
 * @module LuminosityHighPassShader
 * @three_import import { LuminosityHighPassShader } from 'ek3d/addons/shaders/LuminosityHighPassShader';
 */

/**
 * Luminosity high pass shader.
 *
 * Used by {@link UnrealBloomPass}.
 *
 * @constant
 */
export const LuminosityHighPassShader = {
  name: "LuminosityHighPassShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    luminosityThreshold: { value: 1.0 },
    smoothWidth: { value: 1.0 },
    defaultColor: { value: new Color(0x000000) },
    defaultOpacity: { value: 0.0 },
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
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			// The luminance() function is provided by the renderer's common chunk.
			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`,
};
