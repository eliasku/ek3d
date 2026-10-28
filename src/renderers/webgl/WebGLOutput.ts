import type { WebGLRenderer } from "../WebGLRenderer";
import chunk_tonemapping_pars_fragment_chunk from "../shaders/ShaderChunk/tonemapping_pars_fragment.glsl";
import chunk_colorspace_pars_fragment from "../shaders/ShaderChunk/colorspace_pars_fragment.glsl";
import {
  NoToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  ACESFilmicToneMapping,
  AgXToneMapping,
  NeutralToneMapping,
  CustomToneMapping,
  SRGBTransfer,
  HalfFloatType,
  DepthStencilFormat,
  UnsignedInt248Type,
} from "../../constants";
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
const toneMappingMap = {
  [LinearToneMapping]: "LINEAR_TONE_MAPPING",
  [ReinhardToneMapping]: "REINHARD_TONE_MAPPING",
  [CineonToneMapping]: "CINEON_TONE_MAPPING",
  [ACESFilmicToneMapping]: "ACES_FILMIC_TONE_MAPPING",
  [AgXToneMapping]: "AGX_TONE_MAPPING",
  [NeutralToneMapping]: "NEUTRAL_TONE_MAPPING",
  [CustomToneMapping]: "CUSTOM_TONE_MAPPING",
};
export function WebGLOutput(
  type: number,
  width: number,
  height: number,
  antialias: boolean,
  depth: boolean,
  stencil: boolean,
): WebGLOutputSystem {
  // render target for the scene pass (potentially multisampled)
  const targetScene = new WebGLRenderTarget(width, height, {
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
  let targetA: any = null;
  let targetB: any = null;
  // scene depth for effects with needsDepthTexture set to true, allocated on demand
  let depthTexture: any = null;
  // create fullscreen triangle geometry
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  // create output material with tone mapping support
  const material = new RawShaderMaterial({
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
  const mesh = new Mesh(geometry, material);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let _outputColorSpace: any = null;
  let _outputToneMapping: any = null;
  let _isCompositing = false;
  let _savedToneMapping: any;
  let _savedRenderTarget: any = null;
  let _savedActiveCubeFace = 0;
  let _savedActiveMipmapLevel = 0;
  let _isActive = false;
  let _effects: WebGLOutputEffect[] = [];
  let _hasRenderPass = false;
  function setSize(width: number, height: number): void {
    targetScene.setSize(width, height);
    if (targetA !== null) targetA.setSize(width, height);
    if (targetB !== null) targetB.setSize(width, height);
    for (let i = 0; i < _effects.length; i++) {
      const effect = _effects[i];
      if (effect.setSize) effect.setSize(width, height);
    }
  }
  function setEffects(effects: WebGLOutputEffect[]): void {
    _effects = effects;
    _hasRenderPass = _effects.length > 0 && _effects[0].isRenderPass === true;
    const width = targetScene.width;
    const height = targetScene.height;
    if (_effects.length > 0 && targetA === null) {
      targetA = new WebGLRenderTarget(width, height, { type: HalfFloatType, depthBuffer: false, stencilBuffer: false });
      targetB = new WebGLRenderTarget(width, height, { type: HalfFloatType, depthBuffer: false, stencilBuffer: false });
    }
    // only store and resolve the scene depth if an effect reads it
    const needsDepthTexture =
      depth === true && _effects.some((effect: WebGLOutputEffect) => effect.needsDepthTexture === true);
    if (needsDepthTexture !== (targetScene.depthTexture !== null)) {
      if (needsDepthTexture === true && depthTexture === null) {
        depthTexture = new DepthTexture(width, height);
        if (stencil === true) {
          depthTexture.format = DepthStencilFormat;
          depthTexture.type = UnsignedInt248Type;
        }
      }
      // release GPU resources so the scene target is rebuilt with the new depth setup
      targetScene.dispose();
      targetScene.depthTexture = needsDepthTexture ? depthTexture : null;
      targetScene.resolveDepthBuffer = needsDepthTexture;
      targetScene.storeMultisampledDepthBuffer = needsDepthTexture;
    }
    for (let i = 0; i < _effects.length; i++) {
      const effect = _effects[i];
      if (effect.setSize) effect.setSize(width, height);
      if (needsDepthTexture && effect.needsDepthTexture === true && effect.setDepthTexture)
        effect.setDepthTexture(depthTexture);
    }
  }
  function begin(renderer: WebGLRenderer, renderTarget: WebGLRenderTarget | null) {
    // Don't begin during compositing phase (post-processing effects call render())
    if (_isActive) return false;
    if (renderer.toneMapping === NoToneMapping && _effects.length === 0) return false;
    try {
      _savedRenderTarget = renderTarget;
      _savedToneMapping = renderer.toneMapping;
      _savedActiveCubeFace = renderer.getActiveCubeFace();
      _savedActiveMipmapLevel = renderer.getActiveMipmapLevel();
      _isActive = true;
      // resize internal buffers to match render target
      if (renderTarget !== null) {
        const width = renderTarget.width;
        const height = renderTarget.height;
        if (targetScene.width !== width || targetScene.height !== height) {
          setSize(width, height);
        }
      }
      // if the first effect is a RenderPass, it renders the scene itself (see end())
      if (_hasRenderPass === false) {
        renderer.setRenderTarget(targetScene);
      }
      // disable tone mapping during render - it will be applied in end()
      renderer.toneMapping = NoToneMapping;
      return true;
    } catch (error: any) {
      restore(renderer);
      throw error;
    }
  }
  function hasRenderPass() {
    return _hasRenderPass;
  }
  function end(renderer: WebGLRenderer, deltaTime?: number): void {
    try {
      // restore tone mapping
      renderer.toneMapping = _savedToneMapping;
      _isCompositing = true;
      // run post-processing effects - the scene lives in the multisampled targetScene,
      // effects ping-pong between the single-sampled targetA and targetB
      let readBuffer = targetScene;
      let writeBuffer = targetA;
      for (let i = 0; i < _effects.length; i++) {
        const effect = _effects[i];
        if (effect.enabled === false) continue;
        effect.render(renderer, writeBuffer, readBuffer, deltaTime);
        if (effect.needsSwap !== false) {
          // keep targetScene out of the rotation so only the scene pass is multisampled
          readBuffer = writeBuffer;
          writeBuffer = writeBuffer === targetA ? targetB : targetA;
        }
      }
      // update output material defines if settings changed
      if (_outputColorSpace !== renderer.outputColorSpace || _outputToneMapping !== renderer.toneMapping) {
        _outputColorSpace = renderer.outputColorSpace;
        _outputToneMapping = renderer.toneMapping;
        material.defines = {};
        if (ColorManagement.getTransfer(_outputColorSpace) === SRGBTransfer) material.defines.SRGB_TRANSFER = "";
        const toneMapping = (toneMappingMap as any)[_outputToneMapping];
        if (toneMapping) material.defines[toneMapping] = "";
        material.needsUpdate = true;
      }
      // final output to canvas or render target
      material.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(_savedRenderTarget, _savedActiveCubeFace, _savedActiveMipmapLevel);
      renderer.render(mesh, camera);
    } finally {
      restore(renderer);
    }
  }
  function isCompositing() {
    return _isCompositing;
  }
  function dispose(): void {
    targetScene.dispose();
    if (targetA !== null) targetA.dispose();
    if (targetB !== null) targetB.dispose();
    geometry.dispose();
    material.dispose();
  }
  function restore(renderer: WebGLRenderer): void {
    if (!_isActive) return;
    renderer.toneMapping = _savedToneMapping;
    _isCompositing = false;
    _isActive = false;
    renderer.setRenderTarget(_savedRenderTarget, _savedActiveCubeFace, _savedActiveMipmapLevel);
    _savedRenderTarget = null;
  }
  return { setSize, setEffects, begin, hasRenderPass, end, isCompositing, restore, dispose };
}
