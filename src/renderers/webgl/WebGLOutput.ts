import type { WebGLRenderer } from "../WebGLRenderer";
import chunk_tonemapping_pars_fragment_chunk from "../shaders/ShaderChunk/tonemapping_pars_fragment.glsl";
import chunk_colorspace_pars_fragment from "../shaders/ShaderChunk/colorspace_pars_fragment.glsl";
import { ToneMapping, Transfer, TextureType, PixelFormat } from "../../constants";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { RawShaderMaterial } from "../../materials/RawShaderMaterial";
import { Mesh } from "../../objects/Mesh";
import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import { DepthTexture } from "../../textures/DepthTexture";
import { WebGLRenderTarget } from "../WebGLRenderTarget";
import { ColorManagement } from "../../math/ColorManagement";

export interface WebGLOutputEffect {
  enabled?: boolean;
  needsSwap?: boolean;
  isRenderPass?: boolean;
  isOutputPass?: boolean;
  needsDepthTexture?: boolean;
  setSize?(width: number, height: number): void;
  setDepthTexture?(texture: DepthTexture): void;
  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime?: number,
  ): void;
}
export interface WebGLOutputSystem {
  setSize(width: number, height: number): void;
  setEffects(effects: WebGLOutputEffect[]): void;
  begin(renderer: WebGLRenderer, renderTarget: WebGLRenderTarget | null): boolean;
  hasRenderPass(): boolean;
  end(renderer: WebGLRenderer, deltaTime?: number): void;
  isCompositing(): boolean;
  restore(renderer: WebGLRenderer): void;
  dispose(): void;
}
const toneMappingMap: Partial<Record<ToneMapping, string>> = {
  [ToneMapping.Linear]: "LINEAR_TONE_MAPPING",
  [ToneMapping.Reinhard]: "REINHARD_TONE_MAPPING",
  [ToneMapping.Cineon]: "CINEON_TONE_MAPPING",
  [ToneMapping.ACESFilmic]: "ACES_FILMIC_TONE_MAPPING",
  [ToneMapping.AgX]: "AGX_TONE_MAPPING",
  [ToneMapping.Neutral]: "NEUTRAL_TONE_MAPPING",
  [ToneMapping.Custom]: "CUSTOM_TONE_MAPPING",
};
export class WebGLOutput implements WebGLOutputSystem {
  private readonly depth: boolean;
  private readonly stencil: boolean;
  private readonly targetScene: WebGLRenderTarget;
  private targetA: WebGLRenderTarget | null;
  private targetB: WebGLRenderTarget | null;
  private depthTexture: DepthTexture | null;
  private readonly geometry: BufferGeometry;
  private readonly material: RawShaderMaterial;
  private readonly mesh: Mesh<RawShaderMaterial>;
  private readonly camera: OrthographicCamera;
  private _outputColorSpace: string | null;
  private _outputToneMapping: ToneMapping | null;
  private _isCompositing: boolean;
  private _savedToneMapping: ToneMapping | undefined;
  private _savedRenderTarget: WebGLRenderTarget | null;
  private _savedActiveCubeFace: number;
  private _savedActiveMipmapLevel: number;
  private _isActive: boolean;
  private _effects: WebGLOutputEffect[];
  private _hasRenderPass: boolean;

  constructor(type: TextureType, width: number, height: number, antialias: boolean, depth: boolean, stencil: boolean) {
    this.depth = depth;
    this.stencil = stencil;
    // render target for the scene pass (potentially multisampled)
    this.targetScene = new WebGLRenderTarget(width, height, {
      type: type,
      depthBuffer: depth,
      stencilBuffer: stencil,
      samples: antialias ? 4 : 0,
      storeMultisampledDepthBuffer: false,
      storeMultisampledStencilBuffer: false,
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
    });
    // single-sampled ping-pong buffers for post-processing effects, allocated on demand
    this.targetA = null;
    this.targetB = null;
    // scene depth for effects with needsDepthTexture set to true, allocated on demand
    this.depthTexture = null;
    // create fullscreen triangle geometry
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
    this.geometry.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
    // create output material with tone mapping support
    this.material = new RawShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: /* glsl */ `
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,
      fragmentShader:
        /* glsl */ "\n\t\t\tprecision highp float;\n\n\t\t\tuniform sampler2D tDiffuse;\n\n\t\t\tvarying vec2 vUv;\n\n" +
        chunk_tonemapping_pars_fragment_chunk.get() +
        "\n" +
        chunk_colorspace_pars_fragment +
        "\n\n\t\t\tvoid main() {\n\t\t\t\tgl_FragColor = texture2D( tDiffuse, vUv );\n\n\t\t\t\t#ifdef LINEAR_TONE_MAPPING\n\t\t\t\t\tgl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( REINHARD_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( CINEON_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( ACES_FILMIC_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( AGX_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( NEUTRAL_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );\n\t\t\t\t#elif defined( CUSTOM_TONE_MAPPING )\n\t\t\t\t\tgl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );\n\t\t\t\t#endif\n\n\t\t\t\t#ifdef SRGB_TRANSFER\n\t\t\t\t\tgl_FragColor = sRGBTransferOETF( gl_FragColor );\n\t\t\t\t#endif\n\t\t\t}",
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._outputColorSpace = null;
    this._outputToneMapping = null;
    this._isCompositing = false;
    this._savedToneMapping = undefined;
    this._savedRenderTarget = null;
    this._savedActiveCubeFace = 0;
    this._savedActiveMipmapLevel = 0;
    this._isActive = false;
    this._effects = [];
    this._hasRenderPass = false;
    this.setSize = this.setSize.bind(this);
    this.setEffects = this.setEffects.bind(this);
    this.begin = this.begin.bind(this);
    this.hasRenderPass = this.hasRenderPass.bind(this);
    this.end = this.end.bind(this);
    this.isCompositing = this.isCompositing.bind(this);
    this.restore = this.restore.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  setSize(width: number, height: number): void {
    this.targetScene.setSize(width, height);
    if (this.targetA !== null) this.targetA.setSize(width, height);
    if (this.targetB !== null) this.targetB.setSize(width, height);
    for (let i = 0; i < this._effects.length; i++) {
      const effect = this._effects[i];
      if (effect.setSize) effect.setSize(width, height);
    }
  }

  setEffects(effects: WebGLOutputEffect[]): void {
    this._effects = effects;
    this._hasRenderPass = this._effects.length > 0 && this._effects[0].isRenderPass === true;
    const width = this.targetScene.width;
    const height = this.targetScene.height;
    if (this._effects.length > 0 && this.targetA === null) {
      this.targetA = new WebGLRenderTarget(width, height, {
        type: TextureType.HalfFloat,
        depthBuffer: false,
        stencilBuffer: false,
      });
      this.targetB = new WebGLRenderTarget(width, height, {
        type: TextureType.HalfFloat,
        depthBuffer: false,
        stencilBuffer: false,
      });
    }
    // only store and resolve the scene depth if an effect reads it
    const needsDepthTexture =
      this.depth === true && this._effects.some((effect: WebGLOutputEffect) => effect.needsDepthTexture === true);
    if (needsDepthTexture !== (this.targetScene.depthTexture !== null)) {
      if (needsDepthTexture === true && this.depthTexture === null) {
        this.depthTexture = new DepthTexture(width, height);
        if (this.stencil === true) {
          this.depthTexture.format = PixelFormat.DepthStencil;
          this.depthTexture.type = TextureType.UnsignedInt248;
        }
      }
      // release GPU resources so the scene target is rebuilt with the new depth setup
      this.targetScene.dispose();
      this.targetScene.depthTexture = needsDepthTexture ? this.depthTexture : null;
      this.targetScene.resolveDepthBuffer = needsDepthTexture;
      this.targetScene.storeMultisampledDepthBuffer = needsDepthTexture;
    }
    for (let i = 0; i < this._effects.length; i++) {
      const effect = this._effects[i];
      if (effect.setSize) effect.setSize(width, height);
      if (needsDepthTexture && effect.needsDepthTexture === true && effect.setDepthTexture)
        effect.setDepthTexture(this.depthTexture!);
    }
  }

  begin(renderer: WebGLRenderer, renderTarget: WebGLRenderTarget | null): boolean {
    // Don't begin during compositing phase (post-processing effects call render())
    if (this._isActive) return false;
    if (renderer.toneMapping === ToneMapping.No && this._effects.length === 0) return false;
    try {
      this._savedRenderTarget = renderTarget;
      this._savedToneMapping = renderer.toneMapping;
      this._savedActiveCubeFace = renderer.getActiveCubeFace();
      this._savedActiveMipmapLevel = renderer.getActiveMipmapLevel();
      this._isActive = true;
      // resize internal buffers to match render target
      if (renderTarget !== null) {
        const width = renderTarget.width;
        const height = renderTarget.height;
        if (this.targetScene.width !== width || this.targetScene.height !== height) {
          this.setSize(width, height);
        }
      }
      // if the first effect is a RenderPass, it renders the scene itself (see end())
      if (this._hasRenderPass === false) {
        renderer.setRenderTarget(this.targetScene);
      }
      // disable tone mapping during render - it will be applied in end()
      renderer.toneMapping = ToneMapping.No;
      return true;
    } catch (error: unknown) {
      this.restore(renderer);
      throw error;
    }
  }

  hasRenderPass(): boolean {
    return this._hasRenderPass;
  }

  end(renderer: WebGLRenderer, deltaTime?: number): void {
    try {
      // restore tone mapping
      renderer.toneMapping = this._savedToneMapping!;
      this._isCompositing = true;
      // run post-processing effects - the scene lives in the multisampled targetScene,
      // effects ping-pong between the single-sampled targetA and targetB
      let readBuffer = this.targetScene;
      let writeBuffer = this.targetA;
      for (let i = 0; i < this._effects.length; i++) {
        const effect = this._effects[i];
        if (effect.enabled === false) continue;
        effect.render(renderer, writeBuffer!, readBuffer, deltaTime);
        if (effect.needsSwap !== false) {
          // keep targetScene out of the rotation so only the scene pass is multisampled
          readBuffer = writeBuffer!;
          writeBuffer = writeBuffer === this.targetA ? this.targetB : this.targetA;
        }
      }
      // update output material defines if settings changed
      if (this._outputColorSpace !== renderer.outputColorSpace || this._outputToneMapping !== renderer.toneMapping) {
        this._outputColorSpace = renderer.outputColorSpace;
        this._outputToneMapping = renderer.toneMapping;
        this.material.defines = {};
        if (ColorManagement.getTransfer(this._outputColorSpace) === Transfer.SRGB)
          this.material.defines.SRGB_TRANSFER = "";
        const toneMapping = toneMappingMap[this._outputToneMapping];
        if (toneMapping) this.material.defines[toneMapping] = "";
        this.material.needsUpdate = true;
      }
      // final output to canvas or render target
      this.material.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this._savedRenderTarget, this._savedActiveCubeFace, this._savedActiveMipmapLevel);
      renderer.render(this.mesh, this.camera);
    } finally {
      this.restore(renderer);
    }
  }

  isCompositing(): boolean {
    return this._isCompositing;
  }

  dispose(): void {
    this.targetScene.dispose();
    if (this.targetA !== null) this.targetA.dispose();
    if (this.targetB !== null) this.targetB.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  restore(renderer: WebGLRenderer): void {
    if (!this._isActive) return;
    renderer.toneMapping = this._savedToneMapping!;
    this._isCompositing = false;
    this._isActive = false;
    renderer.setRenderTarget(this._savedRenderTarget, this._savedActiveCubeFace, this._savedActiveMipmapLevel);
    this._savedRenderTarget = null;
  }
}
