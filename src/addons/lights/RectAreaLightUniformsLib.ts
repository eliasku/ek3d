import { createLTCTextures, type LTCTextures } from "../../renderers/shaders/LTCTextures";

/** Creates LTC inputs for the WebGLRenderer `ltcTextures` option. The caller owns the textures. */
export class RectAreaLightUniformsLib {
  static init(): LTCTextures {
    return createLTCTextures();
  }
}
