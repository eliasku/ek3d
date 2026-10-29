import type { Color } from "../math/Color";
import { Light } from "./Light";
/**
 * This class emits light uniformly across the face a rectangular plane.
 * This light type can be used to simulate light sources such as bright
 * windows or strip lighting.
 *
 * Important Notes:
 *
 * - There is no shadow support.
 * - Only PBR materials are supported.
 * - Pass caller-owned textures from `createLTCTextures()` as the renderer `ltcTextures` option.
 * Dispose all four textures when they are no longer used.
 *
 * ```ts
 * import { RectAreaLight } from 'ek3d/lights/RectAreaLight';
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { WebGLRenderer } from 'ek3d/renderers/WebGLRenderer';
 * import { createDFGLUT } from 'ek3d/renderers/shaders/DFGLUTData';
 * import { createLTCTextures } from 'ek3d/renderers/shaders/LTCTextures';
 * import { standardShader } from 'ek3d/renderers/shaders/StandardShader';
 *
 * const scene = new Scene();
 *
 * const ltcTextures = createLTCTextures();
 * const dfgLUT = createDFGLUT();
 * const renderer = new WebGLRenderer( { ltcTextures, getDFGLUT: () => dfgLUT, shaders: { MeshStandardMaterial: standardShader } } );
 *
 * const intensity = 1; const width = 10; const height = 10;
 * const rectLight = new RectAreaLight( 0xffffff, intensity, width, height );
 * rectLight.position.set( 5, 5, 0 );
 * rectLight.lookAt( 0, 0, 0 );
 * scene.add( rectLight )
 * ```
 *
 */
export class RectAreaLight extends Light {
  isRectAreaLight: boolean;

  width: number;
  height: number;

  /**
   * Constructs a new area light.
   *
   * @param [color=0xffffff] - The light's color.
   * @param [intensity=1] - The light's strength/intensity.
   * @param [width=10] - The width of the light.
   * @param [height=10] - The height of the light.
   */
  constructor(color?: number | Color | string, intensity?: number, width: number = 10, height: number = 10) {
    super(color, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isRectAreaLight = true;
    this.type = "RectAreaLight";
    /**
     * The width of the light.
     *
     * @default 10
     */
    this.width = width;
    /**
     * The height of the light.
     *
     * @default 10
     */
    this.height = height;
  }
  /**
   * The light's power. Power is the luminous power of the light measured in lumens (lm).
   * Changing the power will also change the light's intensity.
   *
   */
  get power() {
    // compute the light's luminous power (in lumens) from its intensity (in nits)
    return this.intensity * this.width * this.height * Math.PI;
  }
  set power(power: number) {
    // set the light's intensity (in nits) from the desired luminous power (in lumens)
    this.intensity = power / (this.width * this.height * Math.PI);
  }
  copy(source: RectAreaLight): this {
    super.copy(source);
    this.width = source.width;
    this.height = source.height;
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.width = this.width;
    data.object.height = this.height;
    return data;
  }
}
