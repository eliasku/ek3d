import { Vector2 } from "../../math/Vector2";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";
import chunk_packing from "../../renderers/shaders/ShaderChunk/packing.glsl";

/**
 * @module DepthLimitedBlurShader
 */

/**
 * A separable Gaussian blur shader that limits blurring across depth
 * discontinuities, stopping when the view-space depth difference to a
 * neighboring sample exceeds `depthCutoff`. This preserves edges and
 * avoids bleeding across them.
 *
 * Used by {@link SAOPass}.
 *
 * @constant
 */
export const DepthLimitedBlurShader = {
  name: "DepthLimitedBlurShader",

  defines: {
    KERNEL_RADIUS: 4,
    DEPTH_PACKING: 1,
    PERSPECTIVE_CAMERA: 1,
  },

  uniforms: {
    tDiffuse: { value: null },
    size: { value: new Vector2(512, 512) },
    sampleUvOffsets: { value: [new Vector2(0, 0)] },
    sampleWeights: { value: [1.0] },
    tDepth: { value: null },
    cameraNear: { value: 10 },
    cameraFar: { value: 1000 },
    depthCutoff: { value: 10 },
  },

  vertexShader: /* glsl */ `

${chunk_common}

		uniform vec2 size;

		varying vec2 vUv;
		varying vec2 vInvSize;

		void main() {
			vUv = uv;
			vInvSize = 1.0 / size;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

  fragmentShader: /* glsl */ `

${chunk_common}
${chunk_packing}

		uniform sampler2D tDiffuse;
		uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform float depthCutoff;

		uniform vec2 sampleUvOffsets[ KERNEL_RADIUS + 1 ];
		uniform float sampleWeights[ KERNEL_RADIUS + 1 ];

		varying vec2 vUv;
		varying vec2 vInvSize;

		float getDepth( const in vec2 screenPosition ) {
			#if DEPTH_PACKING == 1
			return unpackRGBAToDepth( texture2D( tDepth, screenPosition ) );
			#else
			return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		float getViewZ( const in float depth ) {
			#if PERSPECTIVE_CAMERA == 1
			return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );
			#else
			return orthographicDepthToViewZ( depth, cameraNear, cameraFar );
			#endif
		}

		void main() {
			float depth = getDepth( vUv );
			if( depth >= ( 1.0 - EPSILON ) ) {
				discard;
			}

			float centerViewZ = -getViewZ( depth );
			bool rBreak = false, lBreak = false;

			float weightSum = sampleWeights[0];
			vec4 diffuseSum = texture2D( tDiffuse, vUv ) * weightSum;

			for( int i = 1; i <= KERNEL_RADIUS; i ++ ) {

				float sampleWeight = sampleWeights[i];
				vec2 sampleUvOffset = sampleUvOffsets[i] * vInvSize;

				vec2 sampleUv = vUv + sampleUvOffset;
				float viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) rBreak = true;

				if( ! rBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

				sampleUv = vUv - sampleUvOffset;
				viewZ = -getViewZ( getDepth( sampleUv ) );

				if( abs( viewZ - centerViewZ ) > depthCutoff ) lBreak = true;

				if( ! lBreak ) {
					diffuseSum += texture2D( tDiffuse, sampleUv ) * sampleWeight;
					weightSum += sampleWeight;
				}

			}

			gl_FragColor = diffuseSum / weightSum;
		}`,
};

/**
 * A utility object with helpers for configuring blur shaders like {@link DepthLimitedBlurShader}.
 */
export const BlurShaderUtils = {
  /**
   * Creates the sample weights for a Gaussian kernel.
   *
   * @param kernelRadius - The kernel radius.
   * @param stdDev - The standard deviation.
   * @return The sample weights.
   */
  createSampleWeights(kernelRadius: number, stdDev: number): number[] {
    const weights = [];

    for (let i = 0; i <= kernelRadius; i++) {
      weights.push(gaussian(i, stdDev));
    }

    return weights;
  },

  /**
   * Creates the sample offsets for a Gaussian kernel.
   *
   * @param kernelRadius - The kernel radius.
   * @param uvIncrement - The UV increment.
   * @return The sample offsets.
   */
  createSampleOffsets(kernelRadius: number, uvIncrement: Vector2): Vector2[] {
    const offsets = [];

    for (let i = 0; i <= kernelRadius; i++) {
      offsets.push(uvIncrement.clone().multiplyScalar(i));
    }

    return offsets;
  },

  /**
   * Configures the given blur material.
   *
   * @param material - The blur material.
   * @param kernelRadius - The kernel radius.
   * @param stdDev - The standard deviation.
   * @param uvIncrement - The UV increment.
   */
  configure(
    material: {
      defines: Record<string, any>;
      uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
      needsUpdate: boolean;
    },
    kernelRadius: number,
    stdDev: number,
    uvIncrement: Vector2,
  ): void {
    material.defines["KERNEL_RADIUS"] = kernelRadius;
    material.uniforms["sampleUvOffsets"].value = BlurShaderUtils.createSampleOffsets(kernelRadius, uvIncrement);
    material.uniforms["sampleWeights"].value = BlurShaderUtils.createSampleWeights(kernelRadius, stdDev);
    material.needsUpdate = true;
  },
};

function gaussian(x: number, stdDev: number): number {
  return Math.exp(-(x * x) / (2.0 * (stdDev * stdDev))) / (Math.sqrt(2.0 * Math.PI) * stdDev);
}
