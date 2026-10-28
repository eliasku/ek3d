import type { Color } from "../math/Color";
import type { PointLight } from "../lights/PointLight";
import { Mesh } from "../objects/Mesh";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { SphereGeometry } from "../geometries/SphereGeometry";
/**
 * This displays a helper object consisting of a spherical mesh for
 * visualizing an instance of {@link PointLight}.
 *
 * ```typescript
 * import { PointLight } from 'ek3d/lights/PointLight';
 * import { PointLightHelper } from 'ek3d/helpers/PointLightHelper';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const pointLight = new PointLight( 0xff0000, 1, 100 );
 * pointLight.position.set( 10, 10, 10 );
 * scene.add( pointLight );
 *
 * const sphereSize = 1;
 * const pointLightHelper = new PointLightHelper( pointLight, sphereSize );
 * scene.add( pointLightHelper );
 * ```
 *
 */
export class PointLightHelper extends Mesh<MeshBasicMaterial> {
  light: PointLight;
  color: Color | string | number | undefined;

  /**
   * Constructs a new point light helper.
   *
   * @param light - The light to be visualized.
   * @param [sphereSize=1] - The size of the sphere helper.
   * @param [color] - The helper's color. If not set, the helper will take
   * the color of the light.
   */
  constructor(light: PointLight, sphereSize?: number, color?: Color | string | number) {
    const geometry = new SphereGeometry(sphereSize, 4, 2);
    const material = new MeshBasicMaterial({ wireframe: true, fog: false, toneMapped: false });
    super(geometry, material);
    /**
     * The light being visualized.
     *
     */
    this.light = light;
    /**
     * The color parameter passed in the constructor.
     * If not set, the helper will take the color of the light.
     *
     */
    this.color = color;
    this.type = "PointLightHelper";
    this.matrix = this.light.matrixWorld;
    this.matrixAutoUpdate = false;
    this.update();
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
  /**
   * Updates the helper to match the position of the
   * light being visualized.
   */
  update() {
    this.matrixWorldNeedsUpdate = true;
    this.light.updateWorldMatrix(true, false);
    if (this.color !== undefined) {
      this.material.color.set(this.color);
    } else {
      this.material.color.copy(this.light.color);
    }
    /*
        const d = this.light.distance;

        if ( d === 0.0 ) {

            this.lightDistance.visible = false;

        } else {

            this.lightDistance.visible = true;
            this.lightDistance.scale.set( d, d, d );

        }
        */
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)().copy(this, recursive);
  }
}
