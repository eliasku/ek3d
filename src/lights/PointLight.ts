import type { Color } from "../math/Color";
import { Light } from "./Light";
import { PointLightShadow } from "./PointLightShadow";
/**
 * A light that gets emitted from a single point in all directions. A common
 * use case for this is to replicate the light emitted from a bare
 * lightbulb.
 *
 * This light can cast shadows - see the {@link PointLightShadow} for details.
 *
 * ```ts
 * import { PointLight } from 'ek3d/lights/PointLight';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const light = new PointLight( 0xff0000, 1, 100 );
 * light.position.set( 50, 50, 50 );
 * scene.add( light );
 * ```
 *
 */
export class PointLight extends Light {
  isPointLight: boolean;

  distance: number;
  decay: number;
  shadow: PointLightShadow;

  /**
   * Constructs a new point light.
   *
   * @param [color=0xffffff] - The light's color.
   * @param [intensity=1] - The light's strength/intensity measured in candela (cd).
   * @param [distance=0] - Maximum range of the light. `0` means no limit.
   * @param [decay=2] - The amount the light dims along the distance of the light.
   */
  constructor(color?: number | Color | string, intensity?: number, distance: number = 0, decay: number = 2) {
    super(color, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isPointLight = true;
    this.type = "PointLight";
    /**
     * When distance is zero, light will attenuate according to inverse-square
     * law to infinite distance. When distance is non-zero, light will attenuate
     * according to inverse-square law until near the distance cutoff, where it
     * will then attenuate quickly and smoothly to 0. Inherently, cutoffs are not
     * physically correct.
     *
     * @default 0
     */
    this.distance = distance;
    /**
     * The amount the light dims along the distance of the light. In context of
     * physically-correct rendering the default value should not be changed.
     *
     * @default 2
     */
    this.decay = decay;
    /**
     * This property holds the light's shadow configuration.
     *
     */
    this.shadow = new PointLightShadow();
  }
  /**
   * The light's power. Power is the luminous power of the light measured in lumens (lm).
   * Changing the power will also change the light's intensity.
   *
   */
  get power() {
    // compute the light's luminous power (in lumens) from its intensity (in candela)
    // for an isotropic light source, luminous power (lm) = 4 π luminous intensity (cd)
    return this.intensity * 4 * Math.PI;
  }
  set power(power: number) {
    // set the light's intensity (in candela) from the desired luminous power (in lumens)
    this.intensity = power / (4 * Math.PI);
  }
  dispose() {
    super.dispose();
    this.shadow.dispose();
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    this.distance = source.distance;
    this.decay = source.decay;
    this.shadow = source.shadow.clone();
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.distance = this.distance;
    data.object.decay = this.decay;
    data.object.shadow = this.shadow.toJSON();
    return data;
  }
}
