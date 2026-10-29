import type { Color } from "../math/Color";
import { Light } from "./Light";
import { DirectionalLightShadow } from "./DirectionalLightShadow";
import { Object3D } from "../core/Object3D";
/**
 * A light that gets emitted in a specific direction. This light will behave
 * as though it is infinitely far away and the rays produced from it are all
 * parallel. The common use case for this is to simulate daylight; the sun is
 * far enough away that its position can be considered to be infinite, and
 * all light rays coming from it are parallel.
 *
 * A common point of confusion for directional lights is that setting the
 * rotation has no effect. This is because three.js's DirectionalLight is the
 * equivalent to what is often called a 'Target Direct Light' in other
 * applications.
 *
 * This means that its direction is calculated as pointing from the light's
 * {@link Object3D#position} to the {@link DirectionalLight#target} position
 * (as opposed to a 'Free Direct Light' that just has a rotation
 * component).
 *
 * This light can cast shadows - see the {@link DirectionalLightShadow} for details.
 *
 * ```ts
 * import { DirectionalLight } from 'ek3d/lights/DirectionalLight';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * // White directional light at half intensity shining from the top.
 * const directionalLight = new DirectionalLight( 0xffffff, 0.5 );
 * scene.add( directionalLight );
 * ```
 *
 */
export class DirectionalLight extends Light {
  isDirectionalLight: boolean;

  target: Object3D;
  shadow: DirectionalLightShadow;

  /**
   * Constructs a new directional light.
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
    this.isDirectionalLight = true;
    this.type = "DirectionalLight";
    (this as any).position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    /**
     * The directional light points from its position to the
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
     * This property holds the light's shadow configuration.
     *
     */
    this.shadow = new DirectionalLightShadow();
  }
  dispose() {
    super.dispose();
    this.shadow.dispose();
  }
  copy(source?: any): this {
    super.copy(source);
    this.target = source.target.clone();
    this.shadow = source.shadow.clone();
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    data.object.shadow = this.shadow.toJSON();
    data.object.target = this.target.uuid;
    return data;
  }
}
