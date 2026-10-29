import type { Color } from "../math/Color";
import { Light } from "./Light";
/**
 * This light globally illuminates all objects in the scene equally.
 *
 * It cannot be used to cast shadows as it does not have a direction.
 *
 * ```ts
 * import { AmbientLight } from 'ek3d/lights/AmbientLight';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const light = new AmbientLight( 0x404040 ); // soft white light
 * scene.add( light );
 * ```
 *
 */
export class AmbientLight extends Light {
  isAmbientLight: boolean;

  /**
   * Constructs a new ambient light.
   *
   * @param [color=0xffffff] - The light's color.
   * @param [intensity=1] - The light's strength/intensity.
   */
  constructor(color?: number | Color | string, intensity?: number) {
    super(color, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isAmbientLight = true;
    this.type = "AmbientLight";
  }
}
