import { Light } from "./Light";
import { Color } from "../math/Color";
import { Object3D } from "../core/Object3D";
/**
 * A light source positioned directly above the scene, with color fading from
 * the sky color to the ground color.
 *
 * This light cannot be used to cast shadows.
 *
 * ```typescript
 * import { HemisphereLight } from 'ek3d/lights/HemisphereLight';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const light = new HemisphereLight( 0xffffbb, 0x080820, 1 );
 * scene.add( light );
 * ```
 *
 */
export class HemisphereLight extends Light {
  isHemisphereLight: boolean;

  groundColor: Color;

  /**
   * Constructs a new hemisphere light.
   *
   * @param [skyColor=0xffffff] - The light's sky color.
   * @param [groundColor=0xffffff] - The light's ground color.
   * @param [intensity=1] - The light's strength/intensity.
   */
  constructor(skyColor?: number | Color | string, groundColor?: number | Color | string, intensity?: number) {
    super(skyColor, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isHemisphereLight = true;
    this.type = "HemisphereLight";
    (this as any).position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    /**
     * The light's ground color.
     *
     */
    this.groundColor = new Color(groundColor);
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    this.groundColor.copy(source.groundColor);
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.groundColor = this.groundColor.getHex();
    return data;
  }
}
