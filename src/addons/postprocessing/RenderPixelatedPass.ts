import { TextureType, TextureFilter } from "../../constants";
import { DepthTexture } from "../../textures/DepthTexture";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { Vector2 } from "../../math/Vector2";
import { Vector4 } from "../../math/Vector4";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { Pass, FullScreenQuad } from "./Pass";
import type { Camera } from "../../cameras/Camera";
import type { Scene } from "../../scenes/Scene";
import { MeshNormalMaterial } from "../../materials/MeshNormalMaterial";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

/** Render pixelation options. */
export interface RenderPixelatedPassOptions {
  /** The strength of normal edges, in the range `[0,1]`. */
  normalEdgeStrength?: number;
  /** The strength of depth edges, in the range `[0,1]`. */
  depthEdgeStrength?: number;
}

/**
 * A special type of render pass that produces a pixelated beauty pass.
 *
 * ```typescript
 * const renderPixelatedPass = new RenderPixelatedPass( 6, scene, camera );
 * composer.addPass( renderPixelatedPass );
 * ```
 *
 * @three_import import { RenderPixelatedPass } from 'ek3d/addons/postprocessing/RenderPixelatedPass';
 */
export class RenderPixelatedPass extends Pass {
  pixelSize: number;
  scene: Scene;
  camera: Camera;
  normalEdgeStrength: number;
  depthEdgeStrength: number;
  pixelatedMaterial: ShaderMaterial;
  _fsQuad: FullScreenQuad;
  _resolution: Vector2;
  _renderResolution: Vector2;
  _normalMaterial: MeshNormalMaterial;
  _beautyRenderTarget: WebGLRenderTarget;
  _normalRenderTarget: WebGLRenderTarget;

  /**
   * Constructs a new render pixelated pass.
   *
   * @param pixelSize - The effect's pixel size.
   * @param scene - The scene to render.
   * @param camera - The camera.
   * @param options - The pixelation options.
   */
  constructor(pixelSize: number, scene: Scene, camera: Camera, options: RenderPixelatedPassOptions = {}) {
    super();
    /**
     * The effect's pixel size.
     */
    this.pixelSize = pixelSize;

    /**
     * The scene to render.
     */
    this.scene = scene;

    /**
     * The camera.
     */
    this.camera = camera;

    /**
     * The normal edge strength.
     *
     * @default 0.3
     */
    this.normalEdgeStrength = options.normalEdgeStrength || 0.3;

    /**
     * The depth edge strength.
     *
     * @default 0.4
     */
    this.depthEdgeStrength = options.depthEdgeStrength || 0.4;

    /**
     * The pixelated material.
     */
    this.pixelatedMaterial = this._createPixelatedMaterial();

    // internals

    this._resolution = new Vector2();
    this._renderResolution = new Vector2();

    this._normalMaterial = new MeshNormalMaterial();

    this._beautyRenderTarget = new WebGLRenderTarget();
    this._beautyRenderTarget.texture.minFilter = TextureFilter.Nearest;
    this._beautyRenderTarget.texture.magFilter = TextureFilter.Nearest;
    this._beautyRenderTarget.texture.type = TextureType.HalfFloat;
    this._beautyRenderTarget.depthTexture = new DepthTexture(1, 1);

    this._normalRenderTarget = new WebGLRenderTarget();
    this._normalRenderTarget.texture.minFilter = TextureFilter.Nearest;
    this._normalRenderTarget.texture.magFilter = TextureFilter.Nearest;
    this._normalRenderTarget.texture.type = TextureType.HalfFloat;

    this._fsQuad = new FullScreenQuad(this.pixelatedMaterial);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this._beautyRenderTarget.dispose();
    this._normalRenderTarget.dispose();

    this.pixelatedMaterial.dispose();
    this._normalMaterial.dispose();

    this._fsQuad.dispose();
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this._resolution.set(width, height);
    this._renderResolution.set((width / this.pixelSize) | 0, (height / this.pixelSize) | 0);
    const { x, y } = this._renderResolution;
    this._beautyRenderTarget.setSize(x, y);
    this._normalRenderTarget.setSize(x, y);
    this.pixelatedMaterial.uniforms["resolution"].value.set(x, y, 1 / x, 1 / y);
  }

  /**
   * Sets the effect's pixel size.
   *
   * @param pixelSize - The pixel size to set.
   */
  setPixelSize(pixelSize: number): void {
    this.pixelSize = pixelSize;
    this.setSize(this._resolution.x, this._resolution.y);
  }

  /**
   * Performs the pixelation pass.
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
    const uniforms = this.pixelatedMaterial.uniforms;
    uniforms["normalEdgeStrength"].value = this.normalEdgeStrength;
    uniforms["depthEdgeStrength"].value = this.depthEdgeStrength;

    renderer.setRenderTarget(this._beautyRenderTarget);
    renderer.render(this.scene, this.camera);

    const overrideMaterialOld = this.scene.overrideMaterial;
    renderer.setRenderTarget(this._normalRenderTarget);
    this.scene.overrideMaterial = this._normalMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = overrideMaterialOld;

    uniforms["tDiffuse"].value = this._beautyRenderTarget.texture;
    uniforms["tDepth"].value = this._beautyRenderTarget.depthTexture;
    uniforms["tNormal"].value = this._normalRenderTarget.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);

      if (this.clear) renderer.clear();
    }

    this._fsQuad.render(renderer);
  }

  // internals

  _createPixelatedMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        tNormal: { value: null },
        resolution: { value: new Vector4() },
        normalEdgeStrength: { value: 0 },
        depthEdgeStrength: { value: 0 },
      },
      vertexShader: /* glsl */ `
				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,
      fragmentShader: /* glsl */ `
				uniform sampler2D tDiffuse;
				uniform sampler2D tDepth;
				uniform sampler2D tNormal;
				uniform vec4 resolution;
				uniform float normalEdgeStrength;
				uniform float depthEdgeStrength;
				varying vec2 vUv;

				float getDepth(int x, int y) {

					return texture2D( tDepth, vUv + vec2(x, y) * resolution.zw ).r;

				}

				vec3 getNormal(int x, int y) {

					return texture2D( tNormal, vUv + vec2(x, y) * resolution.zw ).rgb * 2.0 - 1.0;

				}

				float depthEdgeIndicator(float depth, vec3 normal) {

					float diff = 0.0;
					diff += clamp(getDepth(1, 0) - depth, 0.0, 1.0);
					diff += clamp(getDepth(-1, 0) - depth, 0.0, 1.0);
					diff += clamp(getDepth(0, 1) - depth, 0.0, 1.0);
					diff += clamp(getDepth(0, -1) - depth, 0.0, 1.0);
					return floor(smoothstep(0.01, 0.02, diff) * 2.) / 2.;

				}

				float neighborNormalEdgeIndicator(int x, int y, float depth, vec3 normal) {

					float depthDiff = getDepth(x, y) - depth;
					vec3 neighborNormal = getNormal(x, y);

					// Edge pixels should yield to faces who's normals are closer to the bias normal.
					vec3 normalEdgeBias = vec3(1., 1., 1.); // This should probably be a parameter.
					float normalDiff = dot(normal - neighborNormal, normalEdgeBias);
					float normalIndicator = clamp(smoothstep(-.01, .01, normalDiff), 0.0, 1.0);

					// Only the shallower pixel should detect the normal edge.
					float depthIndicator = clamp(sign(depthDiff * .25 + .0025), 0.0, 1.0);

					return (1.0 - dot(normal, neighborNormal)) * depthIndicator * normalIndicator;

				}

				float normalEdgeIndicator(float depth, vec3 normal) {

					float indicator = 0.0;

					indicator += neighborNormalEdgeIndicator(0, -1, depth, normal);
					indicator += neighborNormalEdgeIndicator(0, 1, depth, normal);
					indicator += neighborNormalEdgeIndicator(-1, 0, depth, normal);
					indicator += neighborNormalEdgeIndicator(1, 0, depth, normal);

					return step(0.1, indicator);

				}

				void main() {

					vec4 texel = texture2D( tDiffuse, vUv );

					float depth = 0.0;
					vec3 normal = vec3(0.0);

					if (depthEdgeStrength > 0.0 || normalEdgeStrength > 0.0) {

						depth = getDepth(0, 0);
						normal = getNormal(0, 0);

					}

					float dei = 0.0;
					if (depthEdgeStrength > 0.0)
						dei = depthEdgeIndicator(depth, normal);

					float nei = 0.0;
					if (normalEdgeStrength > 0.0)
						nei = normalEdgeIndicator(depth, normal);

					float Strength = dei > 0.0 ? (1.0 - depthEdgeStrength * dei) : (1.0 + normalEdgeStrength * nei);

					gl_FragColor = texel * Strength;

				}
			`,
    });
  }
}
