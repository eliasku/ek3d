import type { Texture } from "../../textures/Texture";
import chunk_tonemapping_pars_fragment_chunk from "../../renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl";
import chunk_colorspace_pars_fragment from "../../renderers/shaders/ShaderChunk/colorspace_pars_fragment.glsl";
/**
 * @module OutputShader
 */

/**
 * Performs tone mapping and color space conversion for
 * FX workflows.
 *
 * Used by {@link OutputPass}.
 *
 * The shader declares its own attributes and matrices, so pair it with
 * `RawShaderMaterial`:
 *
 * ```ts
 * import { OutputShader } from 'ek3d/addons/shaders/OutputShader';
 * import { RawShaderMaterial } from 'ek3d/materials/RawShaderMaterial';
 * import { WebGLRenderTarget } from 'ek3d/renderers/WebGLRenderTarget';
 *
 * const renderTarget = new WebGLRenderTarget(1024, 1024);
 * const material = new RawShaderMaterial({
 *   name: OutputShader.name,
 *   uniforms: { tDiffuse: { value: renderTarget.texture }, toneMappingExposure: { value: 1 } },
 *   vertexShader: OutputShader.vertexShader,
 *   fragmentShader: OutputShader.fragmentShader,
 * });
 * ```
 *
 * @constant
 */
export const OutputShader = {
  name: "OutputShader",

  uniforms: {
    tDiffuse: { value: null as Texture | null },
    toneMappingExposure: { value: 1 },
  },

  vertexShader: /* glsl */ `
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		precision highp float;

		uniform sampler2D tDiffuse;

${chunk_tonemapping_pars_fragment_chunk.get()}
${chunk_colorspace_pars_fragment}

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`,
};
