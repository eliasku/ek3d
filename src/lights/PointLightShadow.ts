import { LightShadow } from "./LightShadow";
import { PerspectiveCamera } from "../cameras/PerspectiveCamera";
/**
 * Represents the shadow configuration of point lights.
 *
 */
export class PointLightShadow extends LightShadow<PerspectiveCamera> {
  isPointLightShadow: boolean;

  /**
   * Constructs a new point light shadow.
   */
  constructor() {
    super(new PerspectiveCamera(90, 1, 0.5, 500));
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isPointLightShadow = true;
  }
}
