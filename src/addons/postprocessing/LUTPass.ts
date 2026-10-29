import { ShaderPass } from "./ShaderPass";
import type { Data3DTexture } from "../../textures/Data3DTexture";

const LUTShader = {
  name: "LUTShader",

  uniforms: {
    lut: { value: null },
    lutSize: { value: 0 },

    tDiffuse: { value: null },
    intensity: { value: 1.0 },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}

	`,

  fragmentShader: /* glsl */ `

		uniform float lutSize;
		uniform sampler3D lut;

		varying vec2 vUv;
		uniform float intensity;
		uniform sampler2D tDiffuse;
		void main() {

			vec4 val = texture2D( tDiffuse, vUv );
			vec4 lutVal;

			// pull the sample in by half a pixel so the sample begins
			// at the center of the edge pixels.
			float pixelWidth = 1.0 / lutSize;
			float halfPixelWidth = 0.5 / lutSize;
			vec3 uvw = vec3( halfPixelWidth ) + val.rgb * ( 1.0 - pixelWidth );


			lutVal = vec4( texture( lut, uvw ).rgb, val.a );

			gl_FragColor = vec4( mix( val, lutVal, intensity ) );

		}

	`,
};

/** LUT pass options. */
export interface LUTPassOptions {
  /** The LUT as a 3D texture. */
  lut?: Data3DTexture | null;
  /** The blend intensity. */
  intensity?: number;
}

/**
 * Pass for color grading via lookup tables.
 *
 * ```ts
 * const lutPass = new LUTPass( { lut: lut.texture3D } );
 * composer.addPass( lutPass );
 * ```
 *
 */
export class LUTPass extends ShaderPass {
  /**
   * Constructs a LUT pass.
   *
   * @param options - The pass options.
   */
  constructor(options: LUTPassOptions = {}) {
    super(LUTShader);

    this.lut = options.lut || null;
    this.intensity = options.intensity ?? 1;
  }

  /**
   * The LUT as a 3D texture.
   */
  get lut(): Data3DTexture | null {
    return this.material!.uniforms.lut.value;
  }

  set lut(v: Data3DTexture | null) {
    if (v !== this.material!.uniforms.lut.value) {
      this.material!.uniforms.lut.value = null;

      if (v) {
        this.material!.uniforms.lutSize.value = v.image.width;
        this.material!.uniforms.lut.value = v;
      }
    }
  }

  /**
   * The intensity.
   */
  get intensity(): number {
    return this.material!.uniforms.intensity.value;
  }

  set intensity(v: number) {
    this.material!.uniforms.intensity.value = v;
  }
}
