import { LightShadow } from "./LightShadow";
import { OrthographicCamera } from "../cameras/OrthographicCamera";
/**
 * Represents the shadow configuration of directional lights.
 *
 */
export class DirectionalLightShadow extends LightShadow<OrthographicCamera> {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isDirectionalLightShadow: boolean = true;

  /**
   * Constructs a new directional light shadow.
   */
  constructor() {
    super(new OrthographicCamera(-5, 5, 5, -5, 0.5, 500));
  }

  override clone(_recursive?: boolean): DirectionalLightShadow {
    return new DirectionalLightShadow().copy(this);
  }
}
