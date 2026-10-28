import { Object3D } from "../core/Object3D";
import { Color } from "../math/Color";
/**
 * Abstract base class for lights - all other light types inherit the
 * properties and methods described here.
 *
 * @abstract
 */
export class Light extends Object3D {
  isLight: boolean;

  color: Color;
  intensity: number;

  /**
   * Constructs a new light.
   *
   * @param [color=0xffffff] - The light's color.
   * @param [intensity=1] - The light's strength/intensity.
   */
  constructor(color?: number | Color | string, intensity: number = 1) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLight = true;
    this.type = "Light";
    /**
     * The light's color.
     *
     */
    this.color = new Color(color);
    /**
     * The light's intensity.
     *
     * @default 1
     */
    this.intensity = intensity;
  }
  copy(source: Light, recursive?: boolean): this {
    super.copy(source, recursive);
    this.color.copy(source.color);
    this.intensity = source.intensity;
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.color = this.color.getHex();
    data.object.intensity = this.intensity;
    return data;
  }
}
