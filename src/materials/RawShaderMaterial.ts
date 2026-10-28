import type { ShaderMaterialParameters } from "./ShaderMaterial";
import { ShaderMaterial } from "./ShaderMaterial";
/**
 * This class works just like {@link ShaderMaterial}, except that definitions
 * of built-in uniforms and attributes are not automatically prepended to the
 * GLSL shader code.
 *
 * `RawShaderMaterial` can only be used with {@link WebGLRenderer}.
 *
 */
export class RawShaderMaterial extends ShaderMaterial {
  isRawShaderMaterial: boolean;

  /**
   * Constructs a new raw shader material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: ShaderMaterialParameters) {
    super(parameters);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isRawShaderMaterial = true;
    this.type = "RawShaderMaterial";
  }
}
