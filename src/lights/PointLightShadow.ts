import { LightShadow } from "./LightShadow";
import { PerspectiveCamera } from "../cameras/PerspectiveCamera";
/**
 * Represents the shadow configuration of point lights.
 *
 */
export class PointLightShadow extends LightShadow<PerspectiveCamera> {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isPointLightShadow: boolean = true;

  /**
   * Constructs a new point light shadow.
   */
  constructor() {
    super(new PerspectiveCamera(90, 1, 0.5, 500));
  }

  override clone(_recursive?: boolean): PointLightShadow {
    return new PointLightShadow().copy(this);
  }
}
