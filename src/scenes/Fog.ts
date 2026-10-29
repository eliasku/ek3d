import { Color } from "../math/Color";
/**
 * This class can be used to define a linear fog that grows linearly denser
 * with the distance.
 *
 * ```ts
 * import { Fog } from 'ek3d/scenes/Fog';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * scene.fog = new Fog( 0xcccccc, 10, 15 );
 * ```
 */
export class Fog {
  isFog: boolean;
  name: string;
  color: Color;
  near: number;
  far: number;

  /**
   * Constructs a new fog.
   *
   * @param color - The fog's color.
   * @param [near=1] - The minimum distance to start applying fog.
   * @param [far=1000] - The maximum distance at which fog stops being calculated and applied.
   */
  constructor(color: Color | number | string, near: number = 1, far: number = 1000) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isFog = true;
    /**
     * The name of the fog.
     *
     */
    this.name = "";
    /**
     * The fog's color.
     *
     */
    this.color = new Color(color);
    /**
     * The minimum distance to start applying fog. Objects that are less than
     * `near` units from the active camera won't be affected by fog.
     *
     * @default 1
     */
    this.near = near;
    /**
     * The maximum distance at which fog stops being calculated and applied.
     * Objects that are more than `far` units away from the active camera won't
     * be affected by fog.
     *
     * @default 1000
     */
    this.far = far;
  }
  /**
   * Returns a new fog with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Fog {
    return new Fog(this.color, this.near, this.far);
  }
  /**
   * Serializes the fog into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized fog
   */
  toJSON(/* meta */) {
    return {
      type: "Fog",
      name: this.name,
      color: this.color.getHex(),
      near: this.near,
      far: this.far,
    };
  }
}
