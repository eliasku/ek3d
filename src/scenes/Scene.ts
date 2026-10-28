import type { Color } from "../math/Color";
import type { Fog } from "./Fog";
import type { FogExp2 } from "./FogExp2";
import type { Material } from "../materials/Material";
import type { Texture } from "../textures/Texture";
import { Object3D } from "../core/Object3D";
import { Euler } from "../math/Euler";
/**
 * Scenes allow you to set up what is to be rendered and where by three.js.
 * This is where you place 3D objects like meshes, lines or lights.
 *
 */
export class Scene extends Object3D {
  isScene: boolean;

  background: Color | Texture | null;
  environment: Texture | null;
  fog: Fog | FogExp2 | null;
  backgroundBlurriness: number;
  backgroundIntensity: number;
  backgroundRotation: Euler;
  environmentIntensity: number;
  environmentRotation: Euler;
  overrideMaterial: Material | null;

  /**
   * Constructs a new scene.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isScene = true;
    this.type = "Scene";
    /**
     * Defines the background of the scene. Valid inputs are:
     *
     * - A color for defining a uniform colored background.
     * - A texture for defining a (flat) textured background.
     * - Cube textures or equirectangular textures for defining a skybox.
     *
     * @default null
     */
    this.background = null;
    /**
     * Sets the environment map for all physical materials in the scene. However,
     * it's not possible to overwrite an existing texture assigned to the `envMap`
     * material property.
     *
     * @default null
     */
    this.environment = null;
    /**
     * A fog instance defining the type of fog that affects everything
     * rendered in the scene.
     *
     * @default null
     */
    this.fog = null;
    /**
     * Sets the blurriness of the background. Only influences environment maps
     * assigned to {@link Scene#background}. Valid input is a float between `0`
     * and `1`.
     *
     * @default 0
     */
    this.backgroundBlurriness = 0;
    /**
     * Attenuates the color of the background. Only applies to background textures.
     *
     * @default 1
     */
    this.backgroundIntensity = 1;
    /**
     * The rotation of the background in radians. Only influences environment maps
     * assigned to {@link Scene#background}.
     *
     * @default (0,0,0)
     */
    this.backgroundRotation = new Euler();
    /**
     * Attenuates the color of the environment. Only influences environment maps
     * assigned to {@link Scene#environment}.
     *
     * @default 1
     */
    this.environmentIntensity = 1;
    /**
     * The rotation of the environment map in radians. Only influences physical materials
     * in the scene when {@link Scene#environment} is used.
     *
     * @default (0,0,0)
     */
    this.environmentRotation = new Euler();
    /**
     * Forces everything in the scene to be rendered with the defined material. It is possible
     * to exclude materials from override by setting {@link Material#allowOverride} to `false`.
     *
     * @default null
     */
    this.overrideMaterial = null;
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    this.background = source.background !== null ? source.background.clone() : null;
    this.environment = source.environment !== null ? source.environment.clone() : null;
    this.fog = source.fog !== null ? source.fog.clone() : null;
    this.backgroundBlurriness = source.backgroundBlurriness;
    this.backgroundIntensity = source.backgroundIntensity;
    this.backgroundRotation.copy(source.backgroundRotation);
    this.environmentIntensity = source.environmentIntensity;
    this.environmentRotation.copy(source.environmentRotation);
    this.overrideMaterial = source.overrideMaterial !== null ? source.overrideMaterial.clone() : null;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    return this;
  }
  toJSON(meta?: any) {
    const data = super.toJSON(meta);
    if (this.fog !== null) data.object.fog = this.fog.toJSON();
    data.object.backgroundBlurriness = this.backgroundBlurriness;
    data.object.backgroundIntensity = this.backgroundIntensity;
    data.object.backgroundRotation = this.backgroundRotation.toArray();
    data.object.environmentIntensity = this.environmentIntensity;
    data.object.environmentRotation = this.environmentRotation.toArray();
    return data;
  }
}
