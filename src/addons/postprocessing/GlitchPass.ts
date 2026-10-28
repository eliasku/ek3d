import { TextureType, PixelFormat } from "../../constants";
import { DataTexture } from "../../textures/DataTexture";
import { randFloat, randInt } from "../../math/MathUtils";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { DigitalGlitch } from "../shaders/DigitalGlitch";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";

/**
 * Pass for a glitch effect, based on the DigitalGlitch shader.
 *
 * ```typescript
 * const glitchPass = new GlitchPass();
 * composer.addPass( glitchPass );
 * ```
 *
 * @three_import import { GlitchPass } from 'ek3d/addons/postprocessing/GlitchPass';
 */
export class GlitchPass extends Pass {
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  material: ShaderMaterial;
  goWild: boolean;
  _fsQuad: FullScreenQuad;
  _curF: number;
  _randX: number;
  _heightMap: DataTexture;

  /**
   * Constructs a new glitch pass.
   *
   * @param dtSize - The size of the displacement texture
   * for digital glitch squares.
   */
  constructor(dtSize: number = 64) {
    super();
    /**
     * The pass uniforms.
     */
    this.uniforms = cloneUniforms(DigitalGlitch.uniforms);

    /**
     * The pass material.
     */
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: DigitalGlitch.vertexShader,
      fragmentShader: DigitalGlitch.fragmentShader,
    });

    /**
     * Whether to noticeably increase the effect intensity or not.
     *
     * @default false
     */
    this.goWild = false;

    // internals

    this._heightMap = this._generateHeightmap(dtSize);
    this.uniforms["tDisp"].value = this._heightMap;

    this._fsQuad = new FullScreenQuad(this.material);

    this._curF = 0;
    this._randX = 0;

    this._generateTrigger();
  }

  /**
   * Performs the glitch pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    _deltaTime: number,
    _maskActive: boolean,
  ): void {
    this.uniforms["tDiffuse"].value = readBuffer.texture;
    this.uniforms["seed"].value = Math.random(); // default seeding
    this.uniforms["byp"].value = 0;

    if (this._curF % this._randX == 0 || this.goWild == true) {
      this.uniforms["amount"].value = Math.random() / 30;
      this.uniforms["angle"].value = randFloat(-Math.PI, Math.PI);
      this.uniforms["seed_x"].value = randFloat(-1, 1);
      this.uniforms["seed_y"].value = randFloat(-1, 1);
      this.uniforms["distortion_x"].value = randFloat(0, 1);
      this.uniforms["distortion_y"].value = randFloat(0, 1);
      this._curF = 0;
      this._generateTrigger();
    } else if (this._curF % this._randX < this._randX / 5) {
      this.uniforms["amount"].value = Math.random() / 90;
      this.uniforms["angle"].value = randFloat(-Math.PI, Math.PI);
      this.uniforms["distortion_x"].value = randFloat(0, 1);
      this.uniforms["distortion_y"].value = randFloat(0, 1);
      this.uniforms["seed_x"].value = randFloat(-0.3, 0.3);
      this.uniforms["seed_y"].value = randFloat(-0.3, 0.3);
    } else if (this.goWild == false) {
      this.uniforms["byp"].value = 1;
    }

    this._curF++;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this._fsQuad.render(renderer);
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.material.dispose();

    this._heightMap.dispose();

    this._fsQuad.dispose();
  }

  // internals

  _generateTrigger(): void {
    this._randX = randInt(120, 240);
  }

  _generateHeightmap(dtSize: number): DataTexture {
    const dataArr = new Float32Array(dtSize * dtSize);
    const length = dtSize * dtSize;

    for (let i = 0; i < length; i++) {
      const val = randFloat(0, 1);
      dataArr[i] = val;
    }

    const texture = new DataTexture(dataArr, dtSize, dtSize, PixelFormat.Red, TextureType.Float);
    texture.needsUpdate = true;
    return texture;
  }
}
