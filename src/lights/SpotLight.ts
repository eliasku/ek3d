import type { Color } from "../math/Color";
import type { Texture } from "../textures/Texture";
import { Light } from "./Light";
import { SpotLightShadow } from "./SpotLightShadow";
import { Object3D } from "../core/Object3D";
/**
 * This light gets emitted from a single point in one direction, along a cone
 * that increases in size the further from the light it gets.
 *
 * This light can cast shadows - see the {@link SpotLightShadow} for details.
 *
 * ```ts
 * import { SpotLight } from 'ek3d/lights/SpotLight';
 * import { TextureLoader } from 'ek3d/loaders/TextureLoader';
 *
 * // white spotlight shining from the side, modulated by a texture
 * const spotLight = new SpotLight( 0xffffff );
 * spotLight.position.set( 100, 1000, 100 );
 * spotLight.map = new TextureLoader().load( 'spotlight.png' );
 *
 * spotLight.castShadow = true;
 * spotLight.shadow.mapSize.width = 1024;
 * spotLight.shadow.mapSize.height = 1024;
 * spotLight.shadow.camera.near = 500;
 * spotLight.shadow.camera.far = 4000;
 * spotLight.shadow.camera.fov = 30;
 * ```
 *
 */
export class SpotLight extends Light {
  isSpotLight: boolean;

  target: Object3D;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  map: Texture | null;
  shadow: SpotLightShadow;

  /**
   * Constructs a new spot light.
   *
   * @param [color=0xffffff] - The light's color.
   * @param [intensity=1] - The light's strength/intensity measured in candela (cd).
   * @param [distance=0] - Maximum range of the light. `0` means no limit.
   * @param [angle=Math.PI/3] - Maximum angle of light dispersion from its direction whose upper bound is `Math.PI/2`.
   * @param [penumbra=0] - Percent of the spotlight cone that is attenuated due to penumbra. Value range is `[0,1]`.
   * @param [decay=2] - The amount the light dims along the distance of the light.
   */
  constructor(
    color?: number | Color | string,
    intensity?: number,
    distance: number = 0,
    angle: number = Math.PI / 3,
    penumbra: number = 0,
    decay: number = 2,
  ) {
    super(color, intensity);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isSpotLight = true;
    this.type = "SpotLight";
    (this as any).position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    /**
     * The spot light points from its position to the
     * target's position.
     *
     * For the target's position to be changed to anything other
     * than the default, it must be added to the scene.
     *
     * It is also possible to set the target to be another 3D object
     * in the scene. The light will now track the target object.
     *
     */
    this.target = new Object3D();
    /**
     * Maximum range of the light. `0` means no limit.
     *
     * @default 0
     */
    this.distance = distance;
    /**
     * Maximum angle of light dispersion from its direction whose upper bound is `Math.PI/2`.
     *
     * @default Math.PI/3
     */
    this.angle = angle;
    /**
     * Percent of the spotlight cone that is attenuated due to penumbra.
     * Value range is `[0,1]`.
     *
     * @default 0
     */
    this.penumbra = penumbra;
    /**
     * The amount the light dims along the distance of the light. In context of
     * physically-correct rendering the default value should not be changed.
     *
     * @default 2
     */
    this.decay = decay;
    /**
     * A texture whose RGB multiplies the spot light color in WebGL; alpha is ignored.
     *
     * The texture also works when {@link Object3D#castShadow} is `false`.
     *
     * @default null
     */
    this.map = null;
    /**
     * This property holds the light's shadow configuration.
     *
     */
    this.shadow = new SpotLightShadow();
  }
  /**
   * The light's power. Power is the luminous power of the light measured in lumens (lm).
   *  Changing the power will also change the light's intensity.
   *
   */
  get power() {
    // compute the light's luminous power (in lumens) from its intensity (in candela)
    // by convention for a spotlight, luminous power (lm) = π * luminous intensity (cd)
    return this.intensity * Math.PI;
  }
  set power(power: number) {
    // set the light's intensity (in candela) from the desired luminous power (in lumens)
    this.intensity = power / Math.PI;
  }
  dispose() {
    super.dispose();
    this.shadow.dispose();
  }
  copy(source: SpotLight, recursive?: boolean): this {
    super.copy(source, recursive);
    this.distance = source.distance;
    this.angle = source.angle;
    this.penumbra = source.penumbra;
    this.decay = source.decay;
    this.target = source.target.clone();
    this.map = source.map;
    this.shadow = source.shadow.clone();
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.distance = this.distance;
    data.object.angle = this.angle;
    data.object.decay = this.decay;
    data.object.penumbra = this.penumbra;
    data.object.target = this.target.uuid;
    if (this.map && this.map.isTexture) data.object.map = this.map.toJSON(meta).uuid;
    data.object.shadow = this.shadow.toJSON();
    return data;
  }
}
