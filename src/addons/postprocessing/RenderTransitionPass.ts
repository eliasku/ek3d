import { TextureType } from "../../constants";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import type { Camera } from "../../cameras/Camera";
import type { Scene } from "../../scenes/Scene";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

/**
 * A pass rendering two scenes into separate targets and blending them with
 * an optional transition texture.
 *
 * ```typescript
 * const transitionPass = new RenderTransitionPass( sceneA, cameraA, sceneB, cameraB );
 * composer.addPass( transitionPass );
 * ```
 *
 * @three_import import { RenderTransitionPass } from 'ek3d/addons/postprocessing/RenderTransitionPass';
 */
export class RenderTransitionPass extends Pass {
  sceneA: Scene;
  cameraA: Camera;
  sceneB: Scene;
  cameraB: Camera;
  material: ShaderMaterial;
  _renderTargetA: WebGLRenderTarget;
  _renderTargetB: WebGLRenderTarget;
  _fsQuad: FullScreenQuad;

  /**
   * Constructs a render transition pass.
   *
   * @param sceneA - The first scene.
   * @param cameraA - The camera of the first scene.
   * @param sceneB - The second scene.
   * @param cameraB - The camera of the second scene.
   */
  constructor(sceneA: Scene, cameraA: Camera, sceneB: Scene, cameraB: Camera) {
    super();
    /**
     * The first scene.
     */
    this.sceneA = sceneA;

    /**
     * The camera of the first scene.
     */
    this.cameraA = cameraA;

    /**
     * The second scene.
     */
    this.sceneB = sceneB;

    /**
     * The camera of the second scene.
     */
    this.cameraB = cameraB;

    /**
     * The pass material.
     */
    this.material = this._createMaterial();

    // internals

    this._renderTargetA = new WebGLRenderTarget();
    this._renderTargetA.texture.type = TextureType.HalfFloat;
    this._renderTargetB = new WebGLRenderTarget();
    this._renderTargetB.texture.type = TextureType.HalfFloat;

    this._fsQuad = new FullScreenQuad(this.material);
  }

  /**
   * Sets the transition factor. Must be in the range `[0,1]`.
   * This value determines to what degree both scenes are mixed.
   *
   * @param value - The transition factor.
   */
  setTransition(value: number): void {
    this.material.uniforms.mixRatio.value = value;
  }

  /**
   * Toggles the usage of a texture for the effect.
   *
   * @param value - Whether to use a texture for the transition effect or not.
   */
  useTexture(value: boolean): void {
    this.material.uniforms.useTexture.value = value ? 1 : 0;
  }

  /**
   * Sets the effect texture.
   *
   * @param value - The effect texture.
   */
  setTexture(value: Texture): void {
    this.material.uniforms.tMixTexture.value = value;
  }

  /**
   * Sets the texture threshold. This value defines how strong the texture effects
   * the transition. Must be in the range `[0,1]` (0 means full effect, 1 means no effect).
   *
   * @param value - The threshold value.
   */
  setTextureThreshold(value: number): void {
    this.material.uniforms.threshold.value = value;
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this._renderTargetA.setSize(width, height);
    this._renderTargetB.setSize(width, height);
  }

  /**
   * Performs the transition pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, _readBuffer: RT, _deltaTime: number, _maskActive: boolean): void {
    renderer.setRenderTarget(this._renderTargetA);
    renderer.render(this.sceneA, this.cameraA);
    renderer.setRenderTarget(this._renderTargetB);
    renderer.render(this.sceneB, this.cameraB);

    const uniforms = this.material.uniforms;
    uniforms.tDiffuse1.value = this._renderTargetA.texture;
    uniforms.tDiffuse2.value = this._renderTargetB.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      renderer.clear();
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }

    this._fsQuad.render(renderer);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.material.dispose();

    this._renderTargetA.dispose();
    this._renderTargetB.dispose();
    this._fsQuad.dispose();
  }

  // internals

  _createMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        tDiffuse1: {
          value: null,
        },
        tDiffuse2: {
          value: null,
        },
        mixRatio: {
          value: 0.0,
        },
        threshold: {
          value: 0.1,
        },
        useTexture: {
          value: 1,
        },
        tMixTexture: {
          value: null,
        },
      },
      vertexShader: /* glsl */ `
				varying vec2 vUv;

				void main() {

					vUv = vec2( uv.x, uv.y );
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,
      fragmentShader: /* glsl */ `
				uniform float mixRatio;

				uniform sampler2D tDiffuse1;
				uniform sampler2D tDiffuse2;
				uniform sampler2D tMixTexture;

				uniform int useTexture;
				uniform float threshold;

				varying vec2 vUv;

				void main() {

					vec4 texel1 = texture2D( tDiffuse1, vUv );
					vec4 texel2 = texture2D( tDiffuse2, vUv );

					if (useTexture == 1) {

						vec4 transitionTexel = texture2D( tMixTexture, vUv );
						float r = mixRatio * ( 1.0 + threshold * 2.0 ) - threshold;
						float mixf = clamp( ( transitionTexel.r - r ) * ( 1.0 / threshold ), 0.0, 1.0 );

						gl_FragColor = mix( texel1, texel2, mixf );

					} else {

						gl_FragColor = mix( texel2, texel1, mixRatio );

					}

				}
			`,
    });
  }
}
