import { AdditiveBlending, DoubleSide, HalfFloatType, NoBlending, RGBADepthPacking } from "../../constants";
import { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { MeshDepthMaterial } from "../../materials/MeshDepthMaterial";
import { ShaderMaterial } from "../../materials/ShaderMaterial";
import { cloneUniforms } from "../../renderers/shaders/UniformsUtils";
import { WebGLRenderTarget } from "../../renderers/WebGLRenderTarget";
import { CopyShader } from "../shaders/CopyShader";
import { Pass, FullScreenQuad } from "./Pass";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import type { Object3D } from "../../core/Object3D";
import type { Scene } from "../../scenes/Scene";
import type { Texture } from "../../textures/Texture";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import type { WebGLRenderTarget as RT } from "../../renderers/WebGLRenderTarget";
import type { Line } from "../../objects/Line";
import type { LineSegments } from "../../objects/LineSegments";
import type { Mesh } from "../../objects/Mesh";
import type { Points } from "../../objects/Points";
import type { Sprite } from "../../objects/Sprite";
import chunk_batching_pars_vertex from "../../renderers/shaders/ShaderChunk/batching_pars_vertex.glsl";
import chunk_morphtarget_pars_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_pars_vertex.glsl";
import chunk_skinning_pars_vertex from "../../renderers/shaders/ShaderChunk/skinning_pars_vertex.glsl";
import chunk_batching_vertex from "../../renderers/shaders/ShaderChunk/batching_vertex.glsl";
import chunk_skinning_base_vertex from "../../renderers/shaders/ShaderChunk/skinbase_vertex.glsl";
import chunk_begin_vertex from "../../renderers/shaders/ShaderChunk/begin_vertex.glsl";
import chunk_morphtarget_vertex from "../../renderers/shaders/ShaderChunk/morphtarget_vertex.glsl";
import chunk_skinning_vertex from "../../renderers/shaders/ShaderChunk/skinning_vertex.glsl";
import chunk_project_vertex from "../../renderers/shaders/ShaderChunk/project_vertex.glsl";
import chunk_packing from "../../renderers/shaders/ShaderChunk/packing.glsl";
import chunk_common from "../../renderers/shaders/ShaderChunk/common.glsl";

/** Internal object kinds tracked while changing outline visibility. */
type OutlineObject = Mesh | Points | Sprite | Line | (LineSegments & { isLine2?: boolean });

/**
 * A pass for rendering outlines around selected objects.
 *
 * ```typescript
 * const resolution = new Vector2( window.innerWidth, window.innerHeight );
 * const outlinePass = new OutlinePass( resolution, scene, camera );
 * composer.addPass( outlinePass );
 * ```
 *
 * @three_import import { OutlinePass } from 'ek3d/addons/postprocessing/OutlinePass';
 */
export class OutlinePass extends Pass {
  renderScene: Scene;
  renderCamera: PerspectiveCamera;
  selectedObjects: Object3D[];
  visibleEdgeColor: Color;
  hiddenEdgeColor: Color;
  edgeGlow: number;
  usePatternTexture: boolean;
  patternTexture: Texture | null;
  edgeThickness: number;
  edgeStrength: number;
  downSampleRatio: number;
  pulsePeriod: number;
  resolution: Vector2;
  renderTargetMaskBuffer: WebGLRenderTarget;
  depthMaterial: MeshDepthMaterial;
  prepareMaskMaterial: ShaderMaterial;
  renderTargetDepthBuffer: WebGLRenderTarget;
  renderTargetMaskDownSampleBuffer: WebGLRenderTarget;
  renderTargetBlurBuffer1: WebGLRenderTarget;
  renderTargetBlurBuffer2: WebGLRenderTarget;
  edgeDetectionMaterial: ShaderMaterial;
  renderTargetEdgeBuffer1: WebGLRenderTarget;
  renderTargetEdgeBuffer2: WebGLRenderTarget;
  separableBlurMaterial1: ShaderMaterial;
  separableBlurMaterial2: ShaderMaterial;
  overlayMaterial: ShaderMaterial;
  copyUniforms: Record<string, { value: any; needsUpdate?: boolean }>;
  materialCopy: ShaderMaterial;
  _oldClearColor: Color;
  oldClearAlpha: number;
  _fsQuad: FullScreenQuad;
  tempPulseColor1: Color;
  tempPulseColor2: Color;
  textureMatrix: Matrix4;
  _visibilityCache: Map<OutlineObject, boolean>;
  _selectionCache: Set<Mesh>;

  /** Static blur directions, shared by all instances. */
  static BlurDirectionX: Vector2 = new Vector2(1.0, 0.0);
  static BlurDirectionY: Vector2 = new Vector2(0.0, 1.0);

  /**
   * Constructs a new outline pass.
   *
   * @param resolution - The effect's resolution.
   * @param scene - The scene to render.
   * @param camera - The camera.
   * @param selectedObjects - The selected 3D objects that should receive an outline.
   */
  constructor(resolution?: Vector2, scene?: Scene, camera?: PerspectiveCamera, selectedObjects?: Object3D[]) {
    super();
    /**
     * The scene to render.
     */
    this.renderScene = scene!;

    /**
     * The camera.
     */
    this.renderCamera = camera!;

    /**
     * The selected 3D objects that should receive an outline.
     */
    this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];

    /**
     * The visible edge color.
     *
     * @default (1,1,1)
     */
    this.visibleEdgeColor = new Color(1, 1, 1);

    /**
     * The hidden edge color.
     *
     * @default (0.1,0.04,0.02)
     */
    this.hiddenEdgeColor = new Color(0.1, 0.04, 0.02);

    /**
     * Can be used for an animated glow/pulse effect.
     *
     * @default 0
     */
    this.edgeGlow = 0.0;

    /**
     * Whether to use a pattern texture for to highlight selected
     * 3D objects or not.
     *
     * @default false
     */
    this.usePatternTexture = false;

    /**
     * Can be used to highlight selected 3D objects. Requires to set
     * {@link OutlinePass#usePatternTexture} to `true`.
     *
     * @default null
     */
    this.patternTexture = null;

    /**
     * The edge thickness.
     *
     * @default 1
     */
    this.edgeThickness = 1.0;

    /**
     * The edge strength.
     *
     * @default 3
     */
    this.edgeStrength = 3.0;

    /**
     * The downsample ratio. The effect can be rendered in a much
     * lower resolution than the beauty pass.
     *
     * @default 2
     */
    this.downSampleRatio = 2;

    /**
     * The pulse period.
     *
     * @default 0
     */
    this.pulsePeriod = 0;

    this._visibilityCache = new Map();
    this._selectionCache = new Set();

    /**
     * The effect's resolution.
     *
     * @default (256,256)
     */
    this.resolution = resolution !== undefined ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);

    const resx = Math.round(this.resolution.x / this.downSampleRatio);
    const resy = Math.round(this.resolution.y / this.downSampleRatio);

    this.renderTargetMaskBuffer = new WebGLRenderTarget(this.resolution.x, this.resolution.y);
    this.renderTargetMaskBuffer.texture.name = "OutlinePass.mask";
    this.renderTargetMaskBuffer.texture.generateMipmaps = false;

    this.depthMaterial = new MeshDepthMaterial();
    this.depthMaterial.side = DoubleSide;
    this.depthMaterial.depthPacking = RGBADepthPacking;
    this.depthMaterial.blending = NoBlending;

    this.prepareMaskMaterial = this._getPrepareMaskMaterial();
    this.prepareMaskMaterial.side = DoubleSide;
    this.prepareMaskMaterial.fragmentShader = replaceDepthToViewZ(
      this.prepareMaskMaterial.fragmentShader,
      this.renderCamera,
    );

    this.renderTargetDepthBuffer = new WebGLRenderTarget(this.resolution.x, this.resolution.y, { type: HalfFloatType });
    this.renderTargetDepthBuffer.texture.name = "OutlinePass.depth";
    this.renderTargetDepthBuffer.texture.generateMipmaps = false;

    this.renderTargetMaskDownSampleBuffer = new WebGLRenderTarget(resx, resy, {
      type: HalfFloatType,
      depthBuffer: false,
    });
    this.renderTargetMaskDownSampleBuffer.texture.name = "OutlinePass.depthDownSample";
    this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps = false;

    this.renderTargetBlurBuffer1 = new WebGLRenderTarget(resx, resy, { type: HalfFloatType, depthBuffer: false });
    this.renderTargetBlurBuffer1.texture.name = "OutlinePass.blur1";
    this.renderTargetBlurBuffer1.texture.generateMipmaps = false;
    this.renderTargetBlurBuffer2 = new WebGLRenderTarget(Math.round(resx / 2), Math.round(resy / 2), {
      type: HalfFloatType,
      depthBuffer: false,
    });
    this.renderTargetBlurBuffer2.texture.name = "OutlinePass.blur2";
    this.renderTargetBlurBuffer2.texture.generateMipmaps = false;

    this.edgeDetectionMaterial = this._getEdgeDetectionMaterial();
    this.renderTargetEdgeBuffer1 = new WebGLRenderTarget(resx, resy, { type: HalfFloatType, depthBuffer: false });
    this.renderTargetEdgeBuffer1.texture.name = "OutlinePass.edge1";
    this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;
    this.renderTargetEdgeBuffer2 = new WebGLRenderTarget(Math.round(resx / 2), Math.round(resy / 2), {
      type: HalfFloatType,
      depthBuffer: false,
    });
    this.renderTargetEdgeBuffer2.texture.name = "OutlinePass.edge2";
    this.renderTargetEdgeBuffer2.texture.generateMipmaps = false;

    const MAX_EDGE_THICKNESS = 4;
    const MAX_EDGE_GLOW = 4;

    this.separableBlurMaterial1 = this._getSeparableBlurMaterial(MAX_EDGE_THICKNESS);
    this.separableBlurMaterial1.uniforms["texSize"].value.set(resx, resy);
    this.separableBlurMaterial1.uniforms["kernelRadius"].value = 1;
    this.separableBlurMaterial2 = this._getSeparableBlurMaterial(MAX_EDGE_GLOW);
    this.separableBlurMaterial2.uniforms["texSize"].value.set(Math.round(resx / 2), Math.round(resy / 2));
    this.separableBlurMaterial2.uniforms["kernelRadius"].value = MAX_EDGE_GLOW;

    // Overlay material
    this.overlayMaterial = this._getOverlayMaterial();

    // copy material

    const copyShader = CopyShader;

    this.copyUniforms = cloneUniforms(copyShader.uniforms) as Record<string, { value: any; needsUpdate?: boolean }>;

    this.materialCopy = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    } as never);

    this.enabled = true;
    this.needsSwap = false;

    this._oldClearColor = new Color();
    this.oldClearAlpha = 1;

    this._fsQuad = new FullScreenQuad(null);

    this.tempPulseColor1 = new Color();
    this.tempPulseColor2 = new Color();
    this.textureMatrix = new Matrix4();

    function replaceDepthToViewZ(string: string, camera: PerspectiveCamera): string {
      const type = camera.isPerspectiveCamera ? "perspective" : "orthographic";

      return string.replace(/DEPTH_TO_VIEW_Z/g, type + "DepthToViewZ");
    }
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever the pass is no longer used in your app.
   */
  dispose(): void {
    this.renderTargetMaskBuffer.dispose();
    this.renderTargetDepthBuffer.dispose();
    this.renderTargetMaskDownSampleBuffer.dispose();
    this.renderTargetBlurBuffer1.dispose();
    this.renderTargetBlurBuffer2.dispose();
    this.renderTargetEdgeBuffer1.dispose();
    this.renderTargetEdgeBuffer2.dispose();

    this.depthMaterial.dispose();
    this.prepareMaskMaterial.dispose();
    this.edgeDetectionMaterial.dispose();
    this.separableBlurMaterial1.dispose();
    this.separableBlurMaterial2.dispose();
    this.overlayMaterial.dispose();
    this.materialCopy.dispose();

    this._fsQuad.dispose();
  }

  /**
   * Sets the size of the pass.
   *
   * @param width - The width to set.
   * @param height - The height to set.
   */
  setSize(width: number, height: number): void {
    this.renderTargetMaskBuffer.setSize(width, height);
    this.renderTargetDepthBuffer.setSize(width, height);

    let resx = Math.round(width / this.downSampleRatio);
    let resy = Math.round(height / this.downSampleRatio);
    this.renderTargetMaskDownSampleBuffer.setSize(resx, resy);
    this.renderTargetBlurBuffer1.setSize(resx, resy);
    this.renderTargetEdgeBuffer1.setSize(resx, resy);
    this.separableBlurMaterial1.uniforms["texSize"].value.set(resx, resy);

    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);

    this.renderTargetBlurBuffer2.setSize(resx, resy);
    this.renderTargetEdgeBuffer2.setSize(resx, resy);

    this.separableBlurMaterial2.uniforms["texSize"].value.set(resx, resy);
  }

  /**
   * Performs the Outline pass.
   *
   * @param renderer - The renderer.
   * @param writeBuffer - The write buffer. This buffer is intended as the rendering
   * destination for the pass.
   * @param readBuffer - The read buffer. The pass can access the result from the
   * previous pass from this buffer.
   * @param deltaTime - The delta time in seconds.
   * @param maskActive - Whether masking is active or not.
   */
  render(renderer: WebGLRenderer, writeBuffer: RT, readBuffer: RT, deltaTime: number, maskActive: boolean): void {
    if (this.selectedObjects.length > 0) {
      renderer.getClearColor(this._oldClearColor);
      this.oldClearAlpha = renderer.getClearAlpha();
      const oldAutoClear = renderer.autoClear;

      renderer.autoClear = false;

      if (maskActive) renderer.state.buffers.stencil.setTest(false);

      renderer.setClearColor(0xffffff, 1);

      this._updateSelectionCache();

      // Make selected objects invisible
      this._changeVisibilityOfSelectedObjects(false);

      const currentBackground = this.renderScene.background;
      const currentOverrideMaterial = this.renderScene.overrideMaterial;
      this.renderScene.background = null;

      // 1. Draw Non Selected objects in the depth buffer
      this.renderScene.overrideMaterial = this.depthMaterial;
      renderer.setRenderTarget(this.renderTargetDepthBuffer);
      renderer.clear();
      renderer.render(this.renderScene, this.renderCamera);

      // Make selected objects visible
      this._changeVisibilityOfSelectedObjects(true);
      this._visibilityCache.clear();

      // Update Texture Matrix for Depth compare
      this._updateTextureMatrix();

      // Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects
      this._changeVisibilityOfNonSelectedObjects(false);
      this.renderScene.overrideMaterial = this.prepareMaskMaterial;
      this.prepareMaskMaterial.uniforms["cameraNearFar"].value.set(this.renderCamera.near, this.renderCamera.far);
      this.prepareMaskMaterial.uniforms["depthTexture"].value = this.renderTargetDepthBuffer.texture;
      this.prepareMaskMaterial.uniforms["textureMatrix"].value = this.textureMatrix;
      renderer.setRenderTarget(this.renderTargetMaskBuffer);
      renderer.clear();
      renderer.render(this.renderScene, this.renderCamera);
      this._changeVisibilityOfNonSelectedObjects(true);
      this._visibilityCache.clear();
      this._selectionCache.clear();

      this.renderScene.background = currentBackground;
      this.renderScene.overrideMaterial = currentOverrideMaterial;

      // 2. Downsample to Half resolution
      this._fsQuad.material = this.materialCopy;
      this.copyUniforms["tDiffuse"].value = this.renderTargetMaskBuffer.texture;
      renderer.setRenderTarget(this.renderTargetMaskDownSampleBuffer);
      renderer.clear();
      this._fsQuad.render(renderer);

      this.tempPulseColor1.copy(this.visibleEdgeColor);
      this.tempPulseColor2.copy(this.hiddenEdgeColor);

      if (this.pulsePeriod > 0) {
        const scalar = (1 + 0.25) / 2 + (Math.cos((performance.now() * 0.01) / this.pulsePeriod) * (1.0 - 0.25)) / 2;
        this.tempPulseColor1.multiplyScalar(scalar);
        this.tempPulseColor2.multiplyScalar(scalar);
      }

      // 3. Apply Edge Detection Pass
      this._fsQuad.material = this.edgeDetectionMaterial;
      this.edgeDetectionMaterial.uniforms["maskTexture"].value = this.renderTargetMaskDownSampleBuffer.texture;
      this.edgeDetectionMaterial.uniforms["texSize"].value.set(
        this.renderTargetMaskDownSampleBuffer.width,
        this.renderTargetMaskDownSampleBuffer.height,
      );
      this.edgeDetectionMaterial.uniforms["visibleEdgeColor"].value = this.tempPulseColor1;
      this.edgeDetectionMaterial.uniforms["hiddenEdgeColor"].value = this.tempPulseColor2;
      renderer.setRenderTarget(this.renderTargetEdgeBuffer1);
      renderer.clear();
      this._fsQuad.render(renderer);

      // 4. Apply Blur on Half res
      this._fsQuad.material = this.separableBlurMaterial1;
      this.separableBlurMaterial1.uniforms["colorTexture"].value = this.renderTargetEdgeBuffer1.texture;
      this.separableBlurMaterial1.uniforms["direction"].value = OutlinePass.BlurDirectionX;
      this.separableBlurMaterial1.uniforms["kernelRadius"].value = this.edgeThickness;
      renderer.setRenderTarget(this.renderTargetBlurBuffer1);
      renderer.clear();
      this._fsQuad.render(renderer);
      this.separableBlurMaterial1.uniforms["colorTexture"].value = this.renderTargetBlurBuffer1.texture;
      this.separableBlurMaterial1.uniforms["direction"].value = OutlinePass.BlurDirectionY;
      renderer.setRenderTarget(this.renderTargetEdgeBuffer1);
      renderer.clear();
      this._fsQuad.render(renderer);

      // Apply Blur on quarter res
      this._fsQuad.material = this.separableBlurMaterial2;
      this.separableBlurMaterial2.uniforms["colorTexture"].value = this.renderTargetEdgeBuffer1.texture;
      this.separableBlurMaterial2.uniforms["direction"].value = OutlinePass.BlurDirectionX;
      renderer.setRenderTarget(this.renderTargetBlurBuffer2);
      renderer.clear();
      this._fsQuad.render(renderer);
      this.separableBlurMaterial2.uniforms["colorTexture"].value = this.renderTargetBlurBuffer2.texture;
      this.separableBlurMaterial2.uniforms["direction"].value = OutlinePass.BlurDirectionY;
      renderer.setRenderTarget(this.renderTargetEdgeBuffer2);
      renderer.clear();
      this._fsQuad.render(renderer);

      // Blend it additively over the input texture
      this._fsQuad.material = this.overlayMaterial;
      this.overlayMaterial.uniforms["maskTexture"].value = this.renderTargetMaskBuffer.texture;
      this.overlayMaterial.uniforms["edgeTexture1"].value = this.renderTargetEdgeBuffer1.texture;
      this.overlayMaterial.uniforms["edgeTexture2"].value = this.renderTargetEdgeBuffer2.texture;
      this.overlayMaterial.uniforms["patternTexture"].value = this.patternTexture;
      this.overlayMaterial.uniforms["edgeStrength"].value = this.edgeStrength;
      this.overlayMaterial.uniforms["edgeGlow"].value = this.edgeGlow;
      this.overlayMaterial.uniforms["usePatternTexture"].value = this.usePatternTexture;

      if (maskActive) renderer.state.buffers.stencil.setTest(true);

      renderer.setRenderTarget(readBuffer);
      this._fsQuad.render(renderer);

      renderer.setClearColor(this._oldClearColor, this.oldClearAlpha);
      renderer.autoClear = oldAutoClear;
    }

    if (this.renderToScreen) {
      this._fsQuad.material = this.materialCopy;
      this.copyUniforms["tDiffuse"].value = readBuffer.texture;
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    }
  }

  // internals

  _updateSelectionCache(): void {
    const cache = this._selectionCache;

    function gatherSelectedMeshesCallBack(object: Object3D): void {
      if ((object as Mesh).isMesh) cache.add(object as Mesh);
    }

    cache.clear();

    for (let i = 0; i < this.selectedObjects.length; i++) {
      const selectedObject = this.selectedObjects[i];
      selectedObject.traverse(gatherSelectedMeshesCallBack);
    }
  }

  _changeVisibilityOfSelectedObjects(bVisible: boolean): void {
    const cache = this._visibilityCache;

    for (const mesh of this._selectionCache) {
      if (bVisible === true) {
        mesh.visible = cache.get(mesh)!;
      } else {
        cache.set(mesh, mesh.visible);
        mesh.visible = bVisible;
      }
    }
  }

  _changeVisibilityOfNonSelectedObjects(bVisible: boolean): void {
    const visibilityCache = this._visibilityCache;
    const selectionCache = this._selectionCache;

    function VisibilityChangeCallBack(object: Object3D): void {
      if (
        (object as Points).isPoints === true ||
        (object as Line).isLine === true ||
        (object as OutlineObject & { isLine2?: boolean }).isLine2 === true
      ) {
        // the visibility of points and lines is always set to false in order to
        // not affect the outline computation

        if (bVisible === true) {
          object.visible = visibilityCache.get(object as OutlineObject)!; // restore
        } else {
          visibilityCache.set(object as OutlineObject, object.visible);
          object.visible = bVisible;
        }
      } else if ((object as Mesh).isMesh === true || (object as Sprite).isSprite === true) {
        // only meshes and sprites are supported by OutlinePass

        if (!selectionCache.has(object as Mesh)) {
          const visibility = object.visible;

          if (bVisible === false || visibilityCache.get(object as OutlineObject) === true) {
            object.visible = bVisible;
          }

          visibilityCache.set(object as OutlineObject, visibility);
        }
      }
    }

    this.renderScene.traverse(VisibilityChangeCallBack);
  }

  _updateTextureMatrix(): void {
    this.textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    this.textureMatrix.multiply(this.renderCamera.projectionMatrix);
    this.textureMatrix.multiply(this.renderCamera.matrixWorldInverse);
  }

  _getPrepareMaskMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        depthTexture: { value: null },
        cameraNearFar: { value: new Vector2(0.5, 0.5) },
        textureMatrix: { value: null },
      },

      vertexShader: /* glsl */ `${chunk_batching_pars_vertex}
				${chunk_morphtarget_pars_vertex}
				${chunk_skinning_pars_vertex}

				varying vec4 projTexCoord;
				varying vec4 vPosition;
				uniform mat4 textureMatrix;

				void main() {

					${chunk_batching_vertex}
					${chunk_skinning_base_vertex}
					${chunk_begin_vertex}
					${chunk_morphtarget_vertex}
					${chunk_skinning_vertex}
					${chunk_project_vertex}

					vPosition = mvPosition;

					vec4 worldPosition = vec4( transformed, 1.0 );

					#ifdef USE_INSTANCING

						worldPosition = instanceMatrix * worldPosition;

					#endif

					worldPosition = modelMatrix * worldPosition;

					projTexCoord = textureMatrix * worldPosition;

				}`,

      fragmentShader: /* glsl */ `${chunk_packing}
				varying vec4 vPosition;
				varying vec4 projTexCoord;
				uniform sampler2D depthTexture;
				uniform vec2 cameraNearFar;

				void main() {

					float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));
					float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );
					float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;
					gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);

				}`,
    } as never);
  }

  _getEdgeDetectionMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        maskTexture: { value: null },
        texSize: { value: new Vector2(0.5, 0.5) },
        visibleEdgeColor: { value: new Vector3(1.0, 1.0, 1.0) },
        hiddenEdgeColor: { value: new Vector3(1.0, 1.0, 1.0) },
      },

      vertexShader: /* glsl */ `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

      fragmentShader: /* glsl */ `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform vec2 texSize;
				uniform vec3 visibleEdgeColor;
				uniform vec3 hiddenEdgeColor;

				void main() {
					vec2 invSize = 1.0 / texSize;
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);
					float diff1 = (c1.r - c2.r)*0.5;
					float diff2 = (c3.r - c4.r)*0.5;
					float d = length( vec2(diff1, diff2) );
					float a1 = min(c1.g, c2.g);
					float a2 = min(c3.g, c4.g);
					float visibilityFactor = min(a1, a2);
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);
				}`,
    } as never);
  }

  _getSeparableBlurMaterial(maxRadius: number): ShaderMaterial {
    return new ShaderMaterial({
      defines: {
        MAX_RADIUS: maxRadius,
      },

      uniforms: {
        colorTexture: { value: null },
        texSize: { value: new Vector2(0.5, 0.5) },
        direction: { value: new Vector2(0.5, 0.5) },
        kernelRadius: { value: 1.0 },
      },

      vertexShader: /* glsl */ `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

      fragmentShader: /* glsl */ `${chunk_common}
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;
				uniform float kernelRadius;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}

				void main() {
					vec2 invSize = 1.0 / texSize;
					float sigma = kernelRadius/2.0;
					float weightSum = gaussianPdf(0.0, sigma);
					vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);
					vec2 uvOffset = delta;
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {
						float x = kernelRadius * float(i) / float(MAX_RADIUS);
						float w = gaussianPdf(x, sigma);
						vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);
						vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);
						diffuseSum += ((sample1 + sample2) * w);
						weightSum += (2.0 * w);
						uvOffset += delta;
					}
					gl_FragColor = diffuseSum/weightSum;
				}`,
    } as never);
  }

  _getOverlayMaterial(): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        maskTexture: { value: null },
        edgeTexture1: { value: null },
        edgeTexture2: { value: null },
        patternTexture: { value: null },
        edgeStrength: { value: 1.0 },
        edgeGlow: { value: 1.0 },
        usePatternTexture: { value: 0.0 },
      },

      vertexShader: /* glsl */ `varying vec2 vUv;

				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,

      fragmentShader: /* glsl */ `varying vec2 vUv;

				uniform sampler2D maskTexture;
				uniform sampler2D edgeTexture1;
				uniform sampler2D edgeTexture2;
				uniform sampler2D patternTexture;
				uniform float edgeStrength;
				uniform float edgeGlow;
				uniform bool usePatternTexture;

				void main() {
					vec4 edgeValue1 = texture2D(edgeTexture1, vUv);
					vec4 edgeValue2 = texture2D(edgeTexture2, vUv);
					vec4 maskColor = texture2D(maskTexture, vUv);
					vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);
					float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;
					vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;
					vec4 finalColor = edgeStrength * maskColor.r * edgeValue;
					if(usePatternTexture)
						finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);
					gl_FragColor = finalColor;
				}`,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    } as never);
  }
}
