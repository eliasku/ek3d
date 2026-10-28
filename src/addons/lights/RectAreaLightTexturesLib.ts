import { createLTCTextures } from "../../renderers/shaders/LTCTextures";
import type { DataTexture } from "../../textures/DataTexture";

/** Supplies the LTC textures used by rectangular area lights. */
export class RectAreaLightTexturesLib {
  static LTC_HALF_1: DataTexture | null = null;
  static LTC_HALF_2: DataTexture | null = null;
  static LTC_FLOAT_1: DataTexture | null = null;
  static LTC_FLOAT_2: DataTexture | null = null;

  static init(): typeof RectAreaLightTexturesLib {
    const textures = createLTCTextures();
    this.LTC_HALF_1 = textures.LTC_HALF_1;
    this.LTC_HALF_2 = textures.LTC_HALF_2;
    this.LTC_FLOAT_1 = textures.LTC_FLOAT_1;
    this.LTC_FLOAT_2 = textures.LTC_FLOAT_2;
    return this;
  }
}
