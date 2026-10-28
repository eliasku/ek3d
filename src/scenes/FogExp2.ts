import { Color } from "../math/Color";
/**
 * This class can be used to define an exponential squared fog,
 * which gives a clear view near the camera and a faster than exponentially
 * densening fog farther from the camera.
 *
 * ```typescript
 * import { FogExp2 } from 'ek3d/scenes/FogExp2';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 * scene.fog = new FogExp2( 0xcccccc, 0.002 );
 * ```
 */
export class FogExp2 {
  isFogExp2: boolean;
  name: string;
  color: Color;
  density: number;

  /**
   * Constructs a new fog.
   *
   * @param color - The fog's color.
   * @param [density=0.00025] - Defines how fast the fog will grow dense.
   */
  constructor(color: Color | number | string, density: number = 0.00025) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isFogExp2 = true;
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
     *  Defines how fast the fog will grow dense.
     *
     * @default 0.00025
     */
    this.density = density;
  }
  /**
   * Returns a new fog with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): FogExp2 {
    return new FogExp2(this.color, this.density);
  }
  /**
   * Serializes the fog into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized fog
   */
  toJSON(/* meta */) {
    return {
      type: "FogExp2",
      name: this.name,
      color: this.color.getHex(),
      density: this.density,
    };
  }
}
