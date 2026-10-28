import { LightShadow } from "./LightShadow";
import { OrthographicCamera } from "../cameras/OrthographicCamera";
/**
 * Represents the shadow configuration of directional lights.
 *
 */
export class DirectionalLightShadow extends LightShadow<OrthographicCamera> {
  isDirectionalLightShadow: boolean;

  /**
   * Constructs a new directional light shadow.
   */
  constructor() {
    super(new OrthographicCamera(-5, 5, 5, -5, 0.5, 500));
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isDirectionalLightShadow = true;
  }
}
