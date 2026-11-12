import type { WebGLRenderer } from "../WebGLRenderer";
import type { Texture } from "../../textures/Texture";
import type { VideoTexture } from "../../textures/VideoTexture";
import type { Combine, Mapping, ShadowMap } from "../../constants";
import type { WebGLExtensions } from "./WebGLExtensions";
import type { WebGLCapabilitiesState } from "./WebGLCapabilities";
import type { WebGLBindingStates } from "./WebGLBindingStates";
import type { WebGLClipping } from "./WebGLClipping";
import type { Material, MaterialProperties } from "../../materials/Material";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";
import type { Object3D } from "../../core/Object3D";
import type { Light } from "../../lights/Light";
import type { Scene } from "../../scenes/Scene";
import type { FogExp2 } from "../../scenes/FogExp2";
import type { Mesh } from "../../objects/Mesh";
import type { InstancedMesh } from "../../objects/InstancedMesh";
import type { BatchedMesh } from "../../objects/BatchedMesh";
import type { SkinnedMesh } from "../../objects/SkinnedMesh";
import type { Points } from "../../objects/Points";
import type { WebGLLights } from "./WebGLLights";
import { getEnvironment } from "./WebGLEnvironmentAccess";
import { Side, NormalMap, ToneMapping, Blending, Transfer, PixelFormat } from "../../constants";
import { Layers } from "../../core/Layers";
import { WebGLProgram } from "./WebGLProgram";
import { WebGLShaderCache } from "./WebGLShaderCache";
import { cloneUniforms } from "../shaders/UniformsUtils";
import { ColorManagement } from "../../math/ColorManagement";
import { warn } from "../../utils";

type ProgramMaterial = Material &
  MaterialProperties &
  Partial<
    Pick<
      ShaderMaterial,
      | "isShaderMaterial"
      | "defines"
      | "vertexShader"
      | "fragmentShader"
      | "extensions"
      | "glslVersion"
      | "index0AttributeName"
    >
  > & {
    isRawShaderMaterial?: boolean;
    isMeshStandardMaterial?: boolean;
    isMeshLambertMaterial?: boolean;
    isMeshPhongMaterial?: boolean;
    isMeshPhysicalMaterial?: boolean;
  };

export interface WebGLProgramParameters {
  shaderID: string | undefined;
  shaderType: string;
  shaderName: string;
  vertexShader: string;
  fragmentShader: string;
  defines: ShaderMaterial["defines"] | undefined;
  customVertexShaderID: number | undefined;
  customFragmentShaderID: number | undefined;
  isRawShaderMaterial: boolean;
  glslVersion: ShaderMaterial["glslVersion"] | undefined;
  precision: WebGLCapabilitiesState["precision"];
  batching: boolean;
  batchingColor: boolean;
  instancing: boolean;
  instancingColor: boolean;
  instancingMorph: boolean;
  outputColorSpace: string;
  alphaToCoverage: boolean;
  map: boolean;
  matcap: boolean;
  envMap: boolean;
  envMapMode: Mapping | false;
  envMapPMREM: boolean;
  envMapMaxLod: number | null;
  envMapSize: number | null;
  aoMap: boolean;
  lightMap: boolean;
  bumpMap: boolean;
  normalMap: boolean;
  displacementMap: boolean;
  emissiveMap: boolean;
  normalMapObjectSpace: boolean;
  normalMapTangentSpace: boolean;
  packedNormalMap: boolean;
  metalnessMap: boolean;
  roughnessMap: boolean;
  anisotropy: boolean;
  anisotropyMap: boolean;
  clearcoat: boolean;
  clearcoatMap: boolean;
  clearcoatNormalMap: boolean;
  clearcoatRoughnessMap: boolean;
  diffuseRoughness: boolean;
  diffuseRoughnessMap: boolean;
  dispersion: boolean;
  retroreflection: boolean;
  iridescence: boolean;
  iridescenceMap: boolean;
  iridescenceThicknessMap: boolean;
  sheen: boolean;
  sheenColorMap: boolean;
  sheenRoughnessMap: boolean;
  specularMap: boolean;
  specularColorMap: boolean;
  specularIntensityMap: boolean;
  transmission: boolean;
  transmissionMap: boolean;
  thicknessMap: boolean;
  gradientMap: boolean;
  opaque: boolean;
  alphaMap: boolean;
  alphaTest: boolean;
  alphaHash: boolean;
  combine: Combine | undefined;
  mapUv: string | false;
  aoMapUv: string | false;
  lightMapUv: string | false;
  bumpMapUv: string | false;
  normalMapUv: string | false;
  displacementMapUv: string | false;
  emissiveMapUv: string | false;
  metalnessMapUv: string | false;
  roughnessMapUv: string | false;
  anisotropyMapUv: string | false;
  clearcoatMapUv: string | false;
  clearcoatNormalMapUv: string | false;
  clearcoatRoughnessMapUv: string | false;
  diffuseRoughnessMapUv: string | false;
  iridescenceMapUv: string | false;
  iridescenceThicknessMapUv: string | false;
  sheenColorMapUv: string | false;
  sheenRoughnessMapUv: string | false;
  specularMapUv: string | false;
  specularColorMapUv: string | false;
  specularIntensityMapUv: string | false;
  transmissionMapUv: string | false;
  thicknessMapUv: string | false;
  alphaMapUv: string | false;
  vertexTangents: boolean;
  vertexNormals: boolean;
  vertexColors: boolean;
  vertexAlphas: boolean;
  pointsUvs: boolean;
  fog: boolean;
  useFog: boolean;
  fogExp2: boolean | undefined;
  flatShading: boolean | undefined;
  sizeAttenuation: boolean;
  logarithmicDepthBuffer: boolean;
  reversedDepthBuffer: boolean;
  skinning: boolean;
  hasPositionAttribute: boolean;
  morphTargets: boolean;
  morphNormals: boolean;
  morphColors: boolean;
  morphTargetsCount: number;
  morphTextureStride: number;
  numSunLights: number;
  numDirLights: number;
  numPointLights: number;
  numSpotLights: number;
  numSpotLightMaps: number;
  numRectAreaLights: number;
  numHemiLights: number;
  numSunLightShadows: number;
  numDirLightShadows: number;
  numPointLightShadows: number;
  numSpotLightShadows: number;
  numSpotLightShadowsWithMaps: number;
  numLightProbes: number;
  numLightProbeGrids: number;
  numClippingPlanes: number;
  numClipIntersection: number;
  dithering: boolean;
  shadowMapEnabled: boolean;
  shadowMapType: ShadowMap | undefined;
  toneMapping: ToneMapping;
  decodeVideoTexture: boolean;
  decodeVideoTextureEmissive: boolean;
  premultipliedAlpha: boolean;
  doubleSided: boolean;
  flipSided: boolean;
  useDepthPacking: boolean;
  depthPacking: number;
  index0AttributeName: string | undefined;
  extensionClipCullDistance: boolean;
  extensionMultiDraw: boolean;
  rendererExtensionParallelShaderCompile: boolean;
  customProgramCacheKey: string;
  vertexUv1s: boolean;
  vertexUv2s: boolean;
  vertexUv3s: boolean;
  uniforms?: ShaderMaterial["uniforms"];
}

function isPackedRGFormat(format: number) {
  return format === PixelFormat.RG || format === PixelFormat.RG11_EAC || format === PixelFormat.RED_GREEN_RGTC2;
}
export class WebGLPrograms {
  private readonly renderer: WebGLRenderer;
  private readonly environments: Parameters<typeof getEnvironment>[0];
  private readonly extensions: WebGLExtensions;
  private readonly capabilities: WebGLCapabilitiesState;
  private readonly bindingStates: WebGLBindingStates;
  private readonly clipping: WebGLClipping;
  private readonly _programLayers: Layers = new Layers();
  private readonly _customShaders: WebGLShaderCache = new WebGLShaderCache();
  private readonly _activeChannels: Set<number> = new Set();
  private readonly cachedPrograms: WebGLProgram[] = [];
  private readonly programsMap: Map<string, WebGLProgram> = new Map();
  private readonly logarithmicDepthBuffer: boolean;
  // Exposed for resource monitoring & error feedback via renderer.info:
  programs: WebGLProgram[] = this.cachedPrograms;

  constructor(
    renderer: WebGLRenderer,
    environments: Parameters<typeof getEnvironment>[0],
    extensions: WebGLExtensions,
    capabilities: WebGLCapabilitiesState,
    bindingStates: WebGLBindingStates,
    clipping: WebGLClipping,
  ) {
    this.renderer = renderer;
    this.environments = environments;
    this.extensions = extensions;
    this.capabilities = capabilities;
    this.bindingStates = bindingStates;
    this.clipping = clipping;
    this.logarithmicDepthBuffer = capabilities.logarithmicDepthBuffer;
    this.getParameters = this.getParameters.bind(this);
    this.getProgramCacheKey = this.getProgramCacheKey.bind(this);
    this.getUniforms = this.getUniforms.bind(this);
    this.acquireProgram = this.acquireProgram.bind(this);
    this.releaseProgram = this.releaseProgram.bind(this);
    this.releaseShaderCache = this.releaseShaderCache.bind(this);
    this.dispose = this.dispose.bind(this);
  }
  private getChannel(value: number) {
    this._activeChannels.add(value);
    if (value === 0) return "uv";
    return `uv${value}`;
  }
  getParameters(
    material: ProgramMaterial,
    lights: WebGLLights["state"],
    shadows: Light[],
    scene: Scene,
    object: Object3D,
    lightProbeGrids: readonly { texture: Texture | null }[] = [],
  ): WebGLProgramParameters {
    let numLightProbeGrids = 0;
    for (const grid of lightProbeGrids) if (grid.texture !== null) numLightProbeGrids++;
    const fog = scene.fog;
    const geometry = (object as Mesh).geometry;
    const environment =
      material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial
        ? scene.environment
        : null;
    const usePMREM =
      material.isMeshStandardMaterial ||
      (material.isMeshLambertMaterial && !material.envMap) ||
      (material.isMeshPhongMaterial && !material.envMap);
    const envMap = getEnvironment(this.environments, material.envMap || environment, usePMREM);
    const shaderID = this.renderer.shaders[material.type] !== undefined ? material.type : undefined;
    if (shaderID === undefined && material.isShaderMaterial !== true)
      throw new Error("No explicit shader selected for " + material.type);
    // heuristics to create shader parameters according to lights in the scene
    // (not to blow over maxLights budget)
    let precision = this.capabilities.precision;
    if (material.precision !== null) {
      precision = this.capabilities.getMaxPrecision(material.precision as WebGLCapabilitiesState["precision"]);
      if (precision !== material.precision) {
        warn("WebGLProgram.getParameters:", material.precision, "not supported, using", precision, "instead.");
      }
    }
    //
    const morphAttribute =
      geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
    const morphTargetsCount = morphAttribute !== undefined ? morphAttribute.length : 0;
    let morphTextureStride = 0;
    if (geometry.morphAttributes.position !== undefined) morphTextureStride = 1;
    if (geometry.morphAttributes.normal !== undefined) morphTextureStride = 2;
    if (geometry.morphAttributes.color !== undefined) morphTextureStride = 3;
    //
    let vertexShader: string, fragmentShader: string;
    let customVertexShaderID: number | undefined, customFragmentShaderID: number | undefined;
    if (shaderID) {
      const shader = this.renderer.shaders[shaderID];
      vertexShader = shader.vertexShader;
      fragmentShader = shader.fragmentShader;
    } else {
      vertexShader = material.vertexShader!;
      fragmentShader = material.fragmentShader!;
      const vertexShaderStage = this._customShaders.getVertexShaderStage(material as ShaderMaterial);
      const fragmentShaderStage = this._customShaders.getFragmentShaderStage(material as ShaderMaterial);
      this._customShaders.update(material, vertexShaderStage, fragmentShaderStage);
      customVertexShaderID = vertexShaderStage.id;
      customFragmentShaderID = fragmentShaderStage.id;
    }
    const currentRenderTarget = this.renderer.getRenderTarget();
    const reversedDepthBuffer = this.renderer.state.buffers.depth.getReversed();
    const IS_INSTANCEDMESH = (object as InstancedMesh).isInstancedMesh === true;
    const IS_BATCHEDMESH = (object as BatchedMesh).isBatchedMesh === true;
    const HAS_MAP = !!material.map;
    const HAS_MATCAP = !!material.matcap;
    const HAS_ENVMAP = !!envMap;
    const HAS_PMREM = HAS_ENVMAP && envMap!.isPMREMTexture === true;
    const HAS_AOMAP = !!material.aoMap;
    const HAS_LIGHTMAP = !!material.lightMap;
    const HAS_BUMPMAP = !!material.bumpMap && material.wireframe === false;
    const HAS_NORMALMAP = !!material.normalMap;
    const HAS_DISPLACEMENTMAP = !!material.displacementMap;
    const HAS_EMISSIVEMAP = !!material.emissiveMap;
    const HAS_METALNESSMAP = !!material.metalnessMap;
    const HAS_ROUGHNESSMAP = !!material.roughnessMap;
    const HAS_ANISOTROPY = material.anisotropy! > 0;
    const HAS_CLEARCOAT = material.clearcoat! > 0;
    const HAS_DIFFUSE_ROUGHNESS = material.diffuseRoughness! > 0;
    const HAS_DISPERSION = material.dispersion! > 0;
    const HAS_RETROREFLECTION = material.retroreflectivity! > 0;
    const HAS_IRIDESCENCE = material.iridescence! > 0;
    const HAS_SHEEN = material.sheen! > 0;
    const HAS_TRANSMISSION = material.transmission! > 0;
    const HAS_ANISOTROPYMAP = HAS_ANISOTROPY && !!material.anisotropyMap;
    const HAS_CLEARCOATMAP = HAS_CLEARCOAT && !!material.clearcoatMap;
    const HAS_CLEARCOAT_NORMALMAP = HAS_CLEARCOAT && !!material.clearcoatNormalMap;
    const HAS_CLEARCOAT_ROUGHNESSMAP = HAS_CLEARCOAT && !!material.clearcoatRoughnessMap;
    const HAS_DIFFUSE_ROUGHNESSMAP = HAS_DIFFUSE_ROUGHNESS && !!material.diffuseRoughnessMap;
    const HAS_IRIDESCENCEMAP = HAS_IRIDESCENCE && !!material.iridescenceMap;
    const HAS_IRIDESCENCE_THICKNESSMAP = HAS_IRIDESCENCE && !!material.iridescenceThicknessMap;
    const HAS_SHEEN_COLORMAP = HAS_SHEEN && !!material.sheenColorMap;
    const HAS_SHEEN_ROUGHNESSMAP = HAS_SHEEN && !!material.sheenRoughnessMap;
    const HAS_SPECULARMAP = !!material.specularMap;
    const HAS_SPECULAR_COLORMAP = !!material.specularColorMap;
    const HAS_SPECULAR_INTENSITYMAP = !!material.specularIntensityMap;
    const HAS_TRANSMISSIONMAP = HAS_TRANSMISSION && !!material.transmissionMap;
    const HAS_THICKNESSMAP = HAS_TRANSMISSION && !!material.thicknessMap;
    const HAS_GRADIENTMAP = !!material.gradientMap;
    const HAS_ALPHAMAP = !!material.alphaMap;
    const HAS_ALPHATEST = material.alphaTest > 0;
    const HAS_ALPHAHASH = !!material.alphaHash;
    const HAS_EXTENSIONS = !!material.extensions;
    let toneMapping = ToneMapping.No;
    if (material.toneMapped) {
      if (currentRenderTarget === null) {
        toneMapping = this.renderer.toneMapping;
      }
    }
    const envMapMipmaps: { width: number }[] | null = HAS_PMREM
      ? (envMap as Texture & { isCompressedCubeTexture?: boolean }).isCompressedCubeTexture
        ? envMap!.image[0].mipmaps
        : envMap!.mipmaps
      : null;
    const parameters = {
      shaderID: shaderID,
      shaderType: material.type,
      shaderName: material.name,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      defines: material.defines,
      customVertexShaderID: customVertexShaderID,
      customFragmentShaderID: customFragmentShaderID,
      isRawShaderMaterial: material.isRawShaderMaterial === true,
      glslVersion: material.glslVersion,
      precision: precision,
      batching: IS_BATCHEDMESH,
      batchingColor: IS_BATCHEDMESH && (object as BatchedMesh)._colorsTexture !== null,
      instancing: IS_INSTANCEDMESH,
      instancingColor: IS_INSTANCEDMESH && (object as InstancedMesh).instanceColor !== null,
      instancingMorph: IS_INSTANCEDMESH && (object as InstancedMesh).morphTexture !== null,
      outputColorSpace:
        currentRenderTarget === null ? this.renderer.outputColorSpace : ColorManagement.workingColorSpace,
      alphaToCoverage: !!material.alphaToCoverage,
      map: HAS_MAP,
      matcap: HAS_MATCAP,
      envMap: HAS_ENVMAP,
      envMapMode: HAS_ENVMAP && envMap!.mapping,
      envMapPMREM: HAS_PMREM,
      envMapMaxLod: HAS_PMREM ? envMapMipmaps!.length - 1 : null,
      envMapSize: HAS_PMREM ? envMapMipmaps![0].width : null,
      aoMap: HAS_AOMAP,
      lightMap: HAS_LIGHTMAP,
      bumpMap: HAS_BUMPMAP,
      normalMap: HAS_NORMALMAP,
      displacementMap: HAS_DISPLACEMENTMAP,
      emissiveMap: HAS_EMISSIVEMAP,
      normalMapObjectSpace: HAS_NORMALMAP && material.normalMapType === NormalMap.ObjectSpace,
      normalMapTangentSpace: HAS_NORMALMAP && material.normalMapType === NormalMap.TangentSpace,
      packedNormalMap:
        HAS_NORMALMAP &&
        material.normalMapType === NormalMap.TangentSpace &&
        isPackedRGFormat(material.normalMap!.format),
      metalnessMap: HAS_METALNESSMAP,
      roughnessMap: HAS_ROUGHNESSMAP,
      anisotropy: HAS_ANISOTROPY,
      anisotropyMap: HAS_ANISOTROPYMAP,
      clearcoat: HAS_CLEARCOAT,
      clearcoatMap: HAS_CLEARCOATMAP,
      clearcoatNormalMap: HAS_CLEARCOAT_NORMALMAP,
      clearcoatRoughnessMap: HAS_CLEARCOAT_ROUGHNESSMAP,
      diffuseRoughness: HAS_DIFFUSE_ROUGHNESS,
      diffuseRoughnessMap: HAS_DIFFUSE_ROUGHNESSMAP,
      dispersion: HAS_DISPERSION,
      retroreflection: HAS_RETROREFLECTION,
      iridescence: HAS_IRIDESCENCE,
      iridescenceMap: HAS_IRIDESCENCEMAP,
      iridescenceThicknessMap: HAS_IRIDESCENCE_THICKNESSMAP,
      sheen: HAS_SHEEN,
      sheenColorMap: HAS_SHEEN_COLORMAP,
      sheenRoughnessMap: HAS_SHEEN_ROUGHNESSMAP,
      specularMap: HAS_SPECULARMAP,
      specularColorMap: HAS_SPECULAR_COLORMAP,
      specularIntensityMap: HAS_SPECULAR_INTENSITYMAP,
      transmission: HAS_TRANSMISSION,
      transmissionMap: HAS_TRANSMISSIONMAP,
      thicknessMap: HAS_THICKNESSMAP,
      gradientMap: HAS_GRADIENTMAP,
      opaque:
        material.transparent === false && material.blending === Blending.Normal && material.alphaToCoverage === false,
      alphaMap: HAS_ALPHAMAP,
      alphaTest: HAS_ALPHATEST,
      alphaHash: HAS_ALPHAHASH,
      combine: material.combine,
      //
      mapUv: HAS_MAP && this.getChannel(material.map!.channel),
      aoMapUv: HAS_AOMAP && this.getChannel(material.aoMap!.channel),
      lightMapUv: HAS_LIGHTMAP && this.getChannel(material.lightMap!.channel),
      bumpMapUv: HAS_BUMPMAP && this.getChannel(material.bumpMap!.channel),
      normalMapUv: HAS_NORMALMAP && this.getChannel(material.normalMap!.channel),
      displacementMapUv: HAS_DISPLACEMENTMAP && this.getChannel(material.displacementMap!.channel),
      emissiveMapUv: HAS_EMISSIVEMAP && this.getChannel(material.emissiveMap!.channel),
      metalnessMapUv: HAS_METALNESSMAP && this.getChannel(material.metalnessMap!.channel),
      roughnessMapUv: HAS_ROUGHNESSMAP && this.getChannel(material.roughnessMap!.channel),
      anisotropyMapUv: HAS_ANISOTROPYMAP && this.getChannel(material.anisotropyMap!.channel),
      clearcoatMapUv: HAS_CLEARCOATMAP && this.getChannel(material.clearcoatMap!.channel),
      clearcoatNormalMapUv: HAS_CLEARCOAT_NORMALMAP && this.getChannel(material.clearcoatNormalMap!.channel),
      clearcoatRoughnessMapUv: HAS_CLEARCOAT_ROUGHNESSMAP && this.getChannel(material.clearcoatRoughnessMap!.channel),
      diffuseRoughnessMapUv: HAS_DIFFUSE_ROUGHNESSMAP && this.getChannel(material.diffuseRoughnessMap!.channel),
      iridescenceMapUv: HAS_IRIDESCENCEMAP && this.getChannel(material.iridescenceMap!.channel),
      iridescenceThicknessMapUv:
        HAS_IRIDESCENCE_THICKNESSMAP && this.getChannel(material.iridescenceThicknessMap!.channel),
      sheenColorMapUv: HAS_SHEEN_COLORMAP && this.getChannel(material.sheenColorMap!.channel),
      sheenRoughnessMapUv: HAS_SHEEN_ROUGHNESSMAP && this.getChannel(material.sheenRoughnessMap!.channel),
      specularMapUv: HAS_SPECULARMAP && this.getChannel(material.specularMap!.channel),
      specularColorMapUv: HAS_SPECULAR_COLORMAP && this.getChannel(material.specularColorMap!.channel),
      specularIntensityMapUv: HAS_SPECULAR_INTENSITYMAP && this.getChannel(material.specularIntensityMap!.channel),
      transmissionMapUv: HAS_TRANSMISSIONMAP && this.getChannel(material.transmissionMap!.channel),
      thicknessMapUv: HAS_THICKNESSMAP && this.getChannel(material.thicknessMap!.channel),
      alphaMapUv: HAS_ALPHAMAP && this.getChannel(material.alphaMap!.channel),
      //
      vertexTangents: !!geometry.attributes.tangent && (HAS_NORMALMAP || HAS_ANISOTROPY),
      vertexNormals: !!geometry.attributes.normal,
      vertexColors: material.vertexColors,
      vertexAlphas:
        material.vertexColors === true && !!geometry.attributes.color && geometry.attributes.color.itemSize === 4,
      pointsUvs: (object as Points).isPoints === true && !!geometry.attributes.uv && (HAS_MAP || HAS_ALPHAMAP),
      fog: !!fog,
      useFog: material.fog === true,
      fogExp2: !!fog && (fog as FogExp2).isFogExp2,
      flatShading:
        material.wireframe === false &&
        (material.flatShading === true ||
          (geometry.attributes.normal === undefined &&
            HAS_NORMALMAP === false &&
            (material.isMeshLambertMaterial ||
              material.isMeshPhongMaterial ||
              material.isMeshStandardMaterial ||
              material.isMeshPhysicalMaterial))),
      sizeAttenuation: material.sizeAttenuation === true,
      logarithmicDepthBuffer: this.logarithmicDepthBuffer,
      reversedDepthBuffer: reversedDepthBuffer,
      skinning: (object as SkinnedMesh).isSkinnedMesh === true,
      hasPositionAttribute: geometry.attributes.position !== undefined,
      morphTargets: geometry.morphAttributes.position !== undefined,
      morphNormals: geometry.morphAttributes.normal !== undefined,
      morphColors: geometry.morphAttributes.color !== undefined,
      morphTargetsCount: morphTargetsCount,
      morphTextureStride: morphTextureStride,
      numSunLights: lights.sun.length,
      numDirLights: lights.directional.length,
      numPointLights: lights.point.length,
      numSpotLights: lights.spot.length,
      numSpotLightMaps: lights.spotLightMap.length,
      numRectAreaLights: lights.rectArea.length,
      numHemiLights: lights.hemi.length,
      numSunLightShadows: lights.sunShadowMap.length,
      numDirLightShadows: lights.directionalShadowMap.length,
      numPointLightShadows: lights.pointShadowMap.length,
      numSpotLightShadows: lights.spotShadowMap.length,
      numSpotLightShadowsWithMaps: lights.numSpotLightShadowsWithMaps,
      numLightProbes: lights.numLightProbes,
      numLightProbeGrids: numLightProbeGrids,
      numClippingPlanes: this.clipping.numPlanes,
      numClipIntersection: this.clipping.numIntersection,
      dithering: material.dithering,
      shadowMapEnabled: this.renderer.shadowMap?.enabled === true && shadows.length > 0,
      shadowMapType: this.renderer.shadowMap?.type,
      toneMapping: toneMapping,
      decodeVideoTexture:
        HAS_MAP &&
        (material.map as VideoTexture).isVideoTexture === true &&
        ColorManagement.getTransfer(material.map!.colorSpace) === Transfer.SRGB,
      decodeVideoTextureEmissive:
        HAS_EMISSIVEMAP &&
        (material.emissiveMap as VideoTexture).isVideoTexture === true &&
        ColorManagement.getTransfer(material.emissiveMap!.colorSpace) === Transfer.SRGB,
      premultipliedAlpha: material.premultipliedAlpha,
      doubleSided: material.side === Side.Double,
      flipSided: material.side === Side.Back,
      useDepthPacking: material.depthPacking! >= 0,
      depthPacking: material.depthPacking || 0,
      index0AttributeName: material.index0AttributeName,
      extensionClipCullDistance:
        HAS_EXTENSIONS &&
        material.extensions!.clipCullDistance === true &&
        this.extensions.has("WEBGL_clip_cull_distance"),
      extensionMultiDraw:
        ((HAS_EXTENSIONS && material.extensions!.multiDraw === true) || IS_BATCHEDMESH) &&
        this.extensions.has("WEBGL_multi_draw"),
      rendererExtensionParallelShaderCompile: this.extensions.has("KHR_parallel_shader_compile"),
      customProgramCacheKey: material.customProgramCacheKey(),
      // the usage of getChannel() determines the active texture channels for this shader
      vertexUv1s: this._activeChannels.has(1),
      vertexUv2s: this._activeChannels.has(2),
      vertexUv3s: this._activeChannels.has(3),
    };
    this._activeChannels.clear();
    return parameters;
  }
  getProgramCacheKey(parameters: WebGLProgramParameters) {
    const array: (string | number | boolean | null | undefined)[] = [];
    if (parameters.shaderID) {
      array.push(parameters.shaderID);
    } else {
      array.push(parameters.customVertexShaderID);
      array.push(parameters.customFragmentShaderID);
    }
    if (parameters.defines !== undefined) {
      for (const name in parameters.defines) {
        array.push(name);
        array.push(parameters.defines[name]);
      }
    }
    if (parameters.isRawShaderMaterial === false) {
      this.getProgramCacheKeyParameters(array, parameters);
      this.getProgramCacheKeyBooleans(array, parameters);
      array.push(this.renderer.outputColorSpace);
    }
    array.push(parameters.customProgramCacheKey);
    return array.join();
  }
  private getProgramCacheKeyParameters(
    array: (string | number | boolean | null | undefined)[],
    parameters: WebGLProgramParameters,
  ) {
    array.push(parameters.precision);
    array.push(parameters.outputColorSpace);
    array.push(parameters.envMapMode);
    array.push(parameters.envMapPMREM);
    array.push(parameters.envMapMaxLod);
    array.push(parameters.envMapSize);
    array.push(parameters.mapUv);
    array.push(parameters.alphaMapUv);
    array.push(parameters.lightMapUv);
    array.push(parameters.aoMapUv);
    array.push(parameters.bumpMapUv);
    array.push(parameters.normalMapUv);
    array.push(parameters.displacementMapUv);
    array.push(parameters.emissiveMapUv);
    array.push(parameters.metalnessMapUv);
    array.push(parameters.roughnessMapUv);
    array.push(parameters.anisotropyMapUv);
    array.push(parameters.clearcoatMapUv);
    array.push(parameters.clearcoatNormalMapUv);
    array.push(parameters.clearcoatRoughnessMapUv);
    array.push(parameters.diffuseRoughnessMapUv);
    array.push(parameters.iridescenceMapUv);
    array.push(parameters.iridescenceThicknessMapUv);
    array.push(parameters.sheenColorMapUv);
    array.push(parameters.sheenRoughnessMapUv);
    array.push(parameters.specularMapUv);
    array.push(parameters.specularColorMapUv);
    array.push(parameters.specularIntensityMapUv);
    array.push(parameters.transmissionMapUv);
    array.push(parameters.thicknessMapUv);
    array.push(parameters.combine);
    array.push(parameters.fogExp2);
    array.push(parameters.sizeAttenuation);
    array.push(parameters.morphTargetsCount);
    array.push(parameters.numSunLights);
    array.push(parameters.numDirLights);
    array.push(parameters.numPointLights);
    array.push(parameters.numSpotLights);
    array.push(parameters.numSpotLightMaps);
    array.push(parameters.numHemiLights);
    array.push(parameters.numRectAreaLights);
    array.push(parameters.numSunLightShadows);
    array.push(parameters.numDirLightShadows);
    array.push(parameters.numPointLightShadows);
    array.push(parameters.numSpotLightShadows);
    array.push(parameters.numSpotLightShadowsWithMaps);
    array.push(parameters.numLightProbes);
    array.push(parameters.numLightProbeGrids);
    array.push(parameters.shadowMapType);
    array.push(parameters.toneMapping);
    array.push(parameters.numClippingPlanes);
    array.push(parameters.numClipIntersection);
    array.push(parameters.depthPacking);
  }
  private getProgramCacheKeyBooleans(
    array: (string | number | boolean | null | undefined)[],
    parameters: WebGLProgramParameters,
  ) {
    this._programLayers.disableAll();
    if (parameters.instancing) this._programLayers.enable(0);
    if (parameters.instancingColor) this._programLayers.enable(1);
    if (parameters.instancingMorph) this._programLayers.enable(2);
    if (parameters.matcap) this._programLayers.enable(3);
    if (parameters.envMap) this._programLayers.enable(4);
    if (parameters.normalMapObjectSpace) this._programLayers.enable(5);
    if (parameters.normalMapTangentSpace) this._programLayers.enable(6);
    if (parameters.clearcoat) this._programLayers.enable(7);
    if (parameters.iridescence) this._programLayers.enable(8);
    if (parameters.alphaTest) this._programLayers.enable(9);
    if (parameters.vertexColors) this._programLayers.enable(10);
    if (parameters.vertexAlphas) this._programLayers.enable(11);
    if (parameters.vertexUv1s) this._programLayers.enable(12);
    if (parameters.vertexUv2s) this._programLayers.enable(13);
    if (parameters.vertexUv3s) this._programLayers.enable(14);
    if (parameters.vertexTangents) this._programLayers.enable(15);
    if (parameters.anisotropy) this._programLayers.enable(16);
    if (parameters.alphaHash) this._programLayers.enable(17);
    if (parameters.batching) this._programLayers.enable(18);
    if (parameters.dispersion) this._programLayers.enable(19);
    if (parameters.retroreflection) this._programLayers.enable(24);
    if (parameters.diffuseRoughness) this._programLayers.enable(25);
    if (parameters.batchingColor) this._programLayers.enable(20);
    if (parameters.gradientMap) this._programLayers.enable(21);
    if (parameters.packedNormalMap) this._programLayers.enable(22);
    if (parameters.vertexNormals) this._programLayers.enable(23);
    array.push(this._programLayers.mask);
    this._programLayers.disableAll();
    if (parameters.fog) this._programLayers.enable(0);
    if (parameters.useFog) this._programLayers.enable(1);
    if (parameters.flatShading) this._programLayers.enable(2);
    if (parameters.logarithmicDepthBuffer) this._programLayers.enable(3);
    if (parameters.reversedDepthBuffer) this._programLayers.enable(4);
    if (parameters.skinning) this._programLayers.enable(5);
    if (parameters.morphTargets) this._programLayers.enable(6);
    if (parameters.morphNormals) this._programLayers.enable(7);
    if (parameters.morphColors) this._programLayers.enable(8);
    if (parameters.premultipliedAlpha) this._programLayers.enable(9);
    if (parameters.shadowMapEnabled) this._programLayers.enable(10);
    if (parameters.doubleSided) this._programLayers.enable(11);
    if (parameters.flipSided) this._programLayers.enable(12);
    if (parameters.useDepthPacking) this._programLayers.enable(13);
    if (parameters.dithering) this._programLayers.enable(14);
    if (parameters.transmission) this._programLayers.enable(15);
    if (parameters.sheen) this._programLayers.enable(16);
    if (parameters.opaque) this._programLayers.enable(17);
    if (parameters.pointsUvs) this._programLayers.enable(18);
    if (parameters.decodeVideoTexture) this._programLayers.enable(19);
    if (parameters.decodeVideoTextureEmissive) this._programLayers.enable(20);
    if (parameters.alphaToCoverage) this._programLayers.enable(21);
    if (parameters.numLightProbeGrids > 0) this._programLayers.enable(22);
    if (parameters.hasPositionAttribute) this._programLayers.enable(23);
    array.push(this._programLayers.mask);
  }
  getUniforms(material: Material) {
    const shaderID = this.renderer.shaders[material.type] !== undefined ? material.type : undefined;
    if (shaderID === undefined && (material as ShaderMaterial).isShaderMaterial !== true)
      throw new Error("No explicit shader selected for " + material.type);
    let uniforms: ShaderMaterial["uniforms"];
    if (shaderID) {
      const shader = this.renderer.shaders[shaderID];
      uniforms = cloneUniforms(shader.uniforms);
    } else {
      uniforms = (material as ShaderMaterial).uniforms;
    }
    return uniforms;
  }
  acquireProgram(parameters: WebGLProgramParameters, cacheKey: string) {
    let program = this.programsMap.get(cacheKey);
    if (program !== undefined) {
      ++program.usedTimes;
    } else {
      program = new WebGLProgram(this.renderer, cacheKey, parameters, this.bindingStates);
      this.cachedPrograms.push(program);
      this.programsMap.set(cacheKey, program);
    }
    return program;
  }
  releaseProgram(program: WebGLProgram) {
    if (--program.usedTimes === 0) {
      // Remove from unordered set
      const i = this.cachedPrograms.indexOf(program);
      this.cachedPrograms[i] = this.cachedPrograms[this.cachedPrograms.length - 1];
      this.cachedPrograms.pop();
      // Remove from map
      this.programsMap.delete(program.cacheKey);
      // Free WebGL resources
      program.destroy();
    }
  }
  releaseShaderCache(material: Material) {
    this._customShaders.remove(material);
  }
  dispose() {
    for (const program of this.cachedPrograms) program.destroy();
    this.cachedPrograms.length = 0;
    this.programsMap.clear();
    this._customShaders.dispose();
  }
}
