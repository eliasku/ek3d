import { FXAAShader } from "../shaders/FXAAShader";
import { ShaderPass } from "./ShaderPass";

/**
 * A pass for applying FXAA.
 *
 * ```typescript
 * const fxaaPass = new FXAAPass();
 * composer.addPass( fxaaPass );
 * ```
 *
 * @three_import import { FXAAPass } from 'ek3d/addons/postprocessing/FXAAPass';
 */
export class FXAAPass extends ShaderPass {
  /**
   * Constructs a new FXAA pass.
   */
  constructor() {
    super(FXAAShader);
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.material!.uniforms["resolution"].value.set(1 / width, 1 / height);
  }
}
