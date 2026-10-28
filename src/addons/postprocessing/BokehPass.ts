import { TextureType, TextureFilter, Blending, DepthPacking } from "../../constants";
import { Color } from "../../math/Color";
import { MeshDepthMaterial } from "../../materials/MeshDepthMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { BokehShader } from "../shaders/BokehShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";

/** Bokeh pass options. */
export interface BokehPassOptions {
  /** The focus distance along the camera's look direction in world units. */
  focus?: number;
  /** The aperture. */
  aperture?: number;
  /** The maximum blur. */
  maxblur?: number;
}

/**
 * Pass for creating depth of field (DOF) effect.
 *
 * ```typescript
 * const bokehPass = new BokehPass( scene, camera, {
 * 	focus: 500
 * 	aperture: 5,
 * 	maxblur: 0.01
 * } );
 * composer.addPass( bokehPass );
 * ```
 *
 * @three_import import { BokehPass } from 'ek3d/addons/postprocessing/BokehPass';
 */
export class BokehPass extends Pass {
  scene: Scene;
  camera: PerspectiveCamera;
  uniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  materialBokeh: ShaderMaterial;
  _fsQuad: FullScreenQuad;
  _renderTargetDepth: WebGLRenderTarget;
  _materialDepth: MeshDepthMaterial;
  _oldClearColor: Color;

  /**
   * Constructs a new Bokeh pass.
   *
   * @param scene - The scene to render the DOF for.
   * @param camera - The camera.
   * @param params - The pass options.
   */
  constructor(scene: Scene, camera: PerspectiveCamera, params: BokehPassOptions) {
    super();
    /**
     * The scene to render the DOF for.
     */
    this.scene = scene;

    /**
     * The camera.
     */
    this.camera = camera;

    const focus = params.focus !== undefined ? params.focus : 1.0;
    const aperture = params.aperture !== undefined ? params.aperture : 0.025;
    const maxblur = params.maxblur !== undefined ? params.maxblur : 1.0;

    // render targets

    this._renderTargetDepth = new WebGLRenderTarget(1, 1, {
      // will be resized later
      minFilter: TextureFilter.Nearest,
      magFilter: TextureFilter.Nearest,
      type: TextureType.HalfFloat,
    });

    this._renderTargetDepth.texture.name = "BokehPass.depth";

    // depth material

    this._materialDepth = new MeshDepthMaterial();
    this._materialDepth.depthPacking = DepthPacking.RGBA;
    this._materialDepth.blending = Blending.No;

    // bokeh material

    const bokehUniforms = cloneUniforms(BokehShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>;

    bokehUniforms["tDepth"].value = this._renderTargetDepth.texture;

    bokehUniforms["focus"].value = focus;
    bokehUniforms["aspect"].value = camera.aspect;
    bokehUniforms["aperture"].value = aperture;
    bokehUniforms["maxblur"].value = maxblur;
    bokehUniforms["nearClip"].value = camera.near;
    bokehUniforms["farClip"].value = camera.far;

    /**
     * The pass bokeh material.
     */
    this.materialBokeh = new ShaderMaterial({
      defines: { ...BokehShader.defines },
      uniforms: bokehUniforms,
      vertexShader: BokehShader.vertexShader,
      fragmentShader: BokehShader.fragmentShader,
    });

    /**
     * The pass uniforms. Use this object if you want to update the
     * `focus`, `aperture` or `maxblur` values at runtime.
     *
     * ```typescript
     * pass.uniforms.focus.value = focus;
     * pass.uniforms.aperture.value = aperture;
     * pass.uniforms.maxblur.value = maxblur;
     * ```
     */
    this.uniforms = bokehUniforms;

    // internals

    this._fsQuad = new FullScreenQuad(this.materialBokeh);

    this._oldClearColor = new Color();
  }

  /**
   * Performs the Bokeh pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, readBuffer: RT, _deltaTime: number, _maskActive: boolean): void {
    // Render depth into texture

    this.scene.overrideMaterial = this._materialDepth;

    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(1.0);
    renderer.setRenderTarget(this._renderTargetDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    // Render bokeh composite

    this.uniforms["tColor"].value = readBuffer.texture;
    this.uniforms["nearClip"].value = this.camera.near;
    this.uniforms["farClip"].value = this.camera.far;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this._fsQuad.render(renderer);
    }

    this.scene.overrideMaterial = null;
    renderer.setClearColor(this._oldClearColor);
    renderer.setClearAlpha(oldClearAlpha);
    renderer.autoClear = oldAutoClear;
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.materialBokeh.uniforms["aspect"].value = width / height;

    this._renderTargetDepth.setSize(width, height);
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this._renderTargetDepth.dispose();

    this._materialDepth.dispose();
    this.materialBokeh.dispose();

    this._fsQuad.dispose();
  }
}
