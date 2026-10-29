import { Blending, TextureType } from "../../constants";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { Vector2 } from "../../math/Vector2";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { ConvolutionShader } from "../shaders/ConvolutionShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/**
 * A pass for a basic Bloom effect.
 *
 * {@link https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/UnrealBloomPass.js | UnrealBloomPass}
 * produces a more advanced Bloom but is also more expensive.
 *
 * ```ts
 * const effectBloom = new BloomPass( 0.75 );
 * composer.addPass( effectBloom );
 * ```
 *
 */
export class BloomPass extends Pass {
  combineUniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  materialCombine: ShaderMaterial;
  convolutionUniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  materialConvolution: ShaderMaterial;
  needsSwap: boolean;
  _fsQuad: FullScreenQuad;
  _renderTargetX: WebGLRenderTarget;
  _renderTargetY: WebGLRenderTarget;

  /**
   * Static blur increments along the image X and Y axes, shared by all instances.
   */
  static blurX: Vector2 = new Vector2(0.001953125, 0.0);
  static blurY: Vector2 = new Vector2(0.0, 0.001953125);

  /**
   * Constructs a new Bloom pass.
   *
   * @param strength - The bloom strength. A higher value increases the effect.
   * @param kernelSize - The convolution kernel size, used for the blur quality.
   * @param sigma - The sigma of the gaussian kernel; a higher value means a stronger blur.
   */
  constructor(strength: number = 1, kernelSize: number = 25, sigma: number = 4) {
    super();

    // combine material

    /**
     * The combine pass uniforms.
     */
    this.combineUniforms = cloneUniforms(CombineShader.uniforms);
    this.combineUniforms["strength"].value = strength;

    /**
     * The combine pass material.
     */
    this.materialCombine = new ShaderMaterial({
      name: CombineShader.name,
      uniforms: this.combineUniforms,
      vertexShader: CombineShader.vertexShader,
      fragmentShader: CombineShader.fragmentShader,
      blending: Blending.Additive,
      transparent: true,
    });

    // convolution material

    const convolutionShader = ConvolutionShader;

    /**
     * The convolution pass uniforms.
     */
    this.convolutionUniforms = cloneUniforms(convolutionShader.uniforms);

    this.convolutionUniforms["uImageIncrement"].value = BloomPass.blurX;
    this.convolutionUniforms["cKernel"].value = buildKernel(sigma);

    /**
     * The convolution pass material.
     */
    this.materialConvolution = new ShaderMaterial({
      name: convolutionShader.name,
      uniforms: this.convolutionUniforms,
      vertexShader: convolutionShader.vertexShader,
      fragmentShader: convolutionShader.fragmentShader,
      defines: {
        KERNEL_SIZE_FLOAT: kernelSize.toFixed(1),
        KERNEL_SIZE_INT: kernelSize.toFixed(0),
      },
    });

    /**
     * Overwritten to disable the swap.
     *
     * @default false
     */
    this.needsSwap = false;

    // internals

    this._renderTargetX = new WebGLRenderTarget(1, 1, { type: TextureType.HalfFloat, depthBuffer: false }); // will be resized later
    this._renderTargetX.texture.name = "BloomPass.x";
    this._renderTargetY = new WebGLRenderTarget(1, 1, { type: TextureType.HalfFloat, depthBuffer: false }); // will be resized later
    this._renderTargetY.texture.name = "BloomPass.y";

    this._fsQuad = new FullScreenQuad(null);
  }

  /**
   * Performs the Bloom pass.
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
    deltaTime: number,
    maskActive: boolean,
  ): void {
    if (maskActive) renderer.state.buffers.stencil.setTest(false);

    // Render quad with blurred scene into texture (convolution pass 1)

    this._fsQuad.material = this.materialConvolution;

    this.convolutionUniforms["tDiffuse"].value = readBuffer.texture;
    this.convolutionUniforms["uImageIncrement"].value = BloomPass.blurX;

    renderer.setRenderTarget(this._renderTargetX);
    renderer.clear();
    this._fsQuad.render(renderer);

    // Render quad with blurred scene into texture (convolution pass 2)

    this.convolutionUniforms["tDiffuse"].value = this._renderTargetX.texture;
    this.convolutionUniforms["uImageIncrement"].value = BloomPass.blurY;

    renderer.setRenderTarget(this._renderTargetY);
    renderer.clear();
    this._fsQuad.render(renderer);

    // Render original scene with superimposed blur to texture

    this._fsQuad.material = this.materialCombine;

    this.combineUniforms["tDiffuse"].value = this._renderTargetY.texture;

    if (maskActive) renderer.state.buffers.stencil.setTest(true);

    renderer.setRenderTarget(readBuffer);
    if (this.clear) renderer.clear();
    this._fsQuad.render(renderer);
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this._renderTargetX.setSize(width, height);
    this._renderTargetY.setSize(width, height);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this._renderTargetX.dispose();
    this._renderTargetY.dispose();

    this.materialCombine.dispose();
    this.materialConvolution.dispose();

    this._fsQuad.dispose();
  }
}

const CombineShader = {
  name: "CombineShader",

  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 1.0 },
  },

  vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

  fragmentShader: /* glsl */ `

		uniform float strength;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = strength * texel;

		}`,
};

function gauss(x: number, sigma: number): number {
  return Math.exp(-(x * x) / (2.0 * sigma * sigma));
}

function buildKernel(sigma: number): number[] {
  // We loop off the sqrt(2 * pi) * sigma term, since we're going to normalize anyway.

  const kMaxKernelSize = 25;
  let kernelSize = 2 * Math.ceil(sigma * 3.0) + 1;

  if (kernelSize > kMaxKernelSize) kernelSize = kMaxKernelSize;

  const halfWidth = (kernelSize - 1) * 0.5;

  const values: number[] = [];
  let sum = 0.0;
  for (let i = 0; i < kernelSize; ++i) {
    values[i] = gauss(i - halfWidth, sigma);
    sum += values[i];
  }

  // normalize the kernel

  for (let i = 0; i < kernelSize; ++i) values[i] /= sum;

  return values;
}
