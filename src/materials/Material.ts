import type { WebGLRenderer, WebGLShaderDescriptor } from "../renderers/WebGLRenderer";
import type { Scene } from "../scenes/Scene";
import type { Camera } from "../cameras/Camera";
import type { BufferGeometry } from "../core/BufferGeometry";
import type { Object3D } from "../core/Object3D";
import type { Texture } from "../textures/Texture";
import { Color } from "../math/Color";
import { EventDispatcher } from "../core/EventDispatcher";
import {
  Side,
  Blending,
  DepthFunc,
  Equation,
  Factor,
  StencilFunc,
  StencilOp,
  Combine,
  DepthPacking,
  NormalMap,
} from "../constants";
import { generateUUID } from "../math/MathUtils";
import { warn } from "../utils";
import { Vector2 } from "../math/Vector2";
import { Plane } from "../math/Plane";
let _materialId = 0;
/** Optional properties supplied by material subclasses for serialization. */
export interface MaterialProperties {
  roughness?: number;
  metalness?: number;
  sheenColor?: Color;
  sheenRoughness?: number;
  specularIntensity?: number;
  shininess?: number;
  clearcoatRoughness?: number;
  iridescenceIOR?: number;
  iridescenceThicknessMinimum?: number;
  iridescenceThicknessMaximum?: number;
  thickness?: number;
  attenuationDistance?: number;
  anisotropyRotation?: number;
  fog?: boolean;
  flatShading?: boolean;
  combine?: Combine;
  depthPacking?: DepthPacking;
  wireframe?: boolean;
  wireframeLinewidth?: number;
  wireframeLinecap?: string;
  wireframeLinejoin?: string;
  rotation?: number;
  linewidth?: number;
  linecap?: string;
  linejoin?: string;
  dashSize?: number;
  gapSize?: number;
  scale?: number;
  size?: number;
  sizeAttenuation?: boolean;
  map?: Texture | null;
  matcap?: Texture | null;
  alphaMap?: Texture | null;
  bumpMap?: Texture | null;
  bumpScale?: number;
  normalMap?: Texture | null;
  normalMapType?: NormalMap;
  normalScale?: Vector2;
  displacementMap?: Texture | null;
  displacementScale?: number;
  displacementBias?: number;
  roughnessMap?: Texture | null;
  metalnessMap?: Texture | null;
  emissiveMap?: Texture | null;
  emissiveIntensity?: number;
  specularMap?: Texture | null;
  specularIntensityMap?: Texture | null;
  specularColorMap?: Texture | null;
  envMap?: Texture | null;
  envMapIntensity?: number;
  reflectivity?: number;
  refractionRatio?: number;
  lightMap?: Texture | null;
  lightMapIntensity?: number;
  aoMap?: Texture | null;
  aoMapIntensity?: number;
  gradientMap?: Texture | null;
  clearcoatMap?: Texture | null;
  clearcoatRoughnessMap?: Texture | null;
  clearcoatNormalMap?: Texture | null;
  clearcoatNormalScale?: Vector2;
  diffuseRoughnessMap?: Texture | null;
  iridescenceMap?: Texture | null;
  iridescenceThicknessMap?: Texture | null;
  transmissionMap?: Texture | null;
  thicknessMap?: Texture | null;
  anisotropyMap?: Texture | null;
  sheenColorMap?: Texture | null;
  sheenRoughnessMap?: Texture | null;
  anisotropy?: number;
  clearcoat?: number;
  diffuseRoughness?: number;
  dispersion?: number;
  iridescence?: number;
  retroreflectivity?: number;
  sheen?: number;
  transmission?: number;
}

/**
 * Abstract base class for materials.
 *
 * Materials define the appearance of renderable 3D objects.
 *
 * @abstract
 */
export class Material extends EventDispatcher {
  isMaterial: boolean;
  uuid: string;
  name: string;
  type: string;
  blending: Blending;
  side: Side;
  vertexColors: boolean;
  opacity: number;
  transparent: boolean;
  alphaHash: boolean;
  blendSrc: Factor;
  blendDst: Factor;
  blendEquation: Equation;
  blendSrcAlpha: Factor | null;
  blendDstAlpha: Factor | null;
  blendEquationAlpha: Equation | null;
  blendColor: Color;
  blendAlpha: number;
  depthFunc: DepthFunc;
  depthTest: boolean;
  depthWrite: boolean;
  stencilWriteMask: number;
  stencilFunc: StencilFunc;
  stencilRef: number;
  stencilFuncMask: number;
  stencilFail: StencilOp;
  stencilZFail: StencilOp;
  stencilZPass: StencilOp;
  stencilWrite: boolean;
  clippingPlanes: Plane[] | null;
  clipIntersection: boolean;
  clipShadows: boolean;
  shadowSide: Side | null;
  colorWrite: boolean;
  precision: string | null;
  polygonOffset: boolean;
  polygonOffsetFactor: number;
  polygonOffsetUnits: number;
  dithering: boolean;
  alphaToCoverage: boolean;
  premultipliedAlpha: boolean;
  forceSinglePass: boolean;
  allowOverride: boolean;
  visible: boolean;
  toneMapped: boolean;
  userData: any;
  version: number;
  _alphaTest: number;

  readonly id: number;

  /**
   * Constructs a new material.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isMaterial = true;
    /**
     * The ID of the material.
     *
     * @name Material#id
     * @readonly
     */
    Object.defineProperty(this, "id", {
      value: (this.id = _materialId++),
      writable: false,
      enumerable: false,
      configurable: false,
    });
    /**
     * The UUID of the material.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    /**
     * The name of the material.
     *
     */
    this.name = "";
    /**
     * The type property is used for detecting the object type
     * in context of serialization/deserialization.
     *
     * @readonly
     */
    this.type = "Material";
    /**
     * Defines the blending type of the material.
     *
     * It must be set to `Blending.Custom` if custom blending properties like
     * {@link Material#blendSrc}, {@link Material#blendDst} or {@link Material#blendEquation}
     * should have any effect.
     *
     * @default Blending.Normal
     */
    this.blending = Blending.Normal;
    /**
     * Defines which side of faces will be rendered - front, back or both.
     *
     * @default Side.Front
     */
    this.side = Side.Front;
    /**
     * If set to `true`, vertex colors should be used.
     *
     * The engine supports RGB and RGBA vertex colors depending on whether a three (RGB) or
     * four (RGBA) component color buffer attribute is used.
     *
     * @default false
     */
    this.vertexColors = false;
    /**
     * Defines how transparent the material is.
     * A value of `0.0` indicates fully transparent, `1.0` is fully opaque.
     *
     * If the {@link Material#transparent} is not set to `true`,
     * the material will remain fully opaque and this value will only affect its color.
     *
     * @default 1
     */
    this.opacity = 1;
    /**
     * Defines whether this material is transparent. This has an effect on
     * rendering as transparent objects need special treatment and are rendered
     * after non-transparent objects.
     *
     * When set to true, the extent to which the material is transparent is
     * controlled by {@link Material#opacity}.
     *
     * @default false
     */
    this.transparent = false;
    /**
     * Enables alpha hashed transparency, an alternative to {@link Material#transparent} or
     * {@link Material#alphaTest}. The material will not be rendered if opacity is lower than
     * a random threshold. Randomization introduces some grain or noise, but approximates alpha
     * blending without the associated problems of sorting. Using TAA can reduce the resulting noise.
     *
     * @default false
     */
    this.alphaHash = false;
    /**
     * Defines the blending source factor.
     *
     * @default Factor.SrcAlpha
     */
    this.blendSrc = Factor.SrcAlpha;
    /**
     * Defines the blending destination factor.
     *
     * @default Factor.OneMinusSrcAlpha
     */
    this.blendDst = Factor.OneMinusSrcAlpha;
    /**
     * Defines the blending equation.
     *
     * @default Equation.Add
     */
    this.blendEquation = Equation.Add;
    /**
     * Defines the blending source alpha factor.
     *
     * @default null
     */
    this.blendSrcAlpha = null;
    /**
     * Defines the blending destination alpha factor.
     *
     * @default null
     */
    this.blendDstAlpha = null;
    /**
     * Defines the blending equation of the alpha channel.
     *
     * @default null
     */
    this.blendEquationAlpha = null;
    /**
     * Represents the RGB values of the constant blend color.
     *
     * This property has only an effect when using custom blending with `ConstantColor` or `OneMinusConstantColor`.
     *
     * @default (0,0,0)
     */
    this.blendColor = new Color(0, 0, 0);
    /**
     * Represents the alpha value of the constant blend color.
     *
     * This property has only an effect when using custom blending with `ConstantAlpha` or `OneMinusConstantAlpha`.
     *
     * @default 0
     */
    this.blendAlpha = 0;
    /**
     * Defines the depth function.
     *
     * @default DepthFunc.LessEqual
     */
    this.depthFunc = DepthFunc.LessEqual;
    /**
     * Whether to have depth test enabled when rendering this material.
     * When the depth test is disabled, the depth write will also be implicitly disabled.
     *
     * @default true
     */
    this.depthTest = true;
    /**
     * Whether rendering this material has any effect on the depth buffer.
     *
     * When drawing 2D overlays it can be useful to disable the depth writing in
     * order to layer several things together without creating z-index artifacts.
     *
     * @default true
     */
    this.depthWrite = true;
    /**
     * The bit mask to use when writing to the stencil buffer.
     *
     * @default 0xff
     */
    this.stencilWriteMask = 0xff;
    /**
     * The stencil comparison function to use.
     *
     * @default StencilFunc.Always
     */
    this.stencilFunc = StencilFunc.Always;
    /**
     * The value to use when performing stencil comparisons or stencil operations.
     *
     * @default 0
     */
    this.stencilRef = 0;
    /**
     * The bit mask to use when comparing against the stencil buffer.
     *
     * @default 0xff
     */
    this.stencilFuncMask = 0xff;
    /**
     * Which stencil operation to perform when the comparison function returns `false`.
     *
     * @default StencilOp.Keep
     */
    this.stencilFail = StencilOp.Keep;
    /**
     * Which stencil operation to perform when the comparison function returns
     * `true` but the depth test fails.
     *
     * @default StencilOp.Keep
     */
    this.stencilZFail = StencilOp.Keep;
    /**
     * Which stencil operation to perform when the comparison function returns
     * `true` and the depth test passes.
     *
     * @default StencilOp.Keep
     */
    this.stencilZPass = StencilOp.Keep;
    /**
     * Whether stencil operations are performed against the stencil buffer. In
     * order to perform writes or comparisons against the stencil buffer this
     * value must be `true`.
     *
     * @default false
     */
    this.stencilWrite = false;
    /**
     * User-defined clipping planes specified as THREE.Plane objects in world
     * space. These planes apply to the objects this material is attached to.
     * Points in space whose signed distance to the plane is negative are clipped
     * (not rendered). This requires {@link WebGLRenderer#localClippingEnabled} to
     * be `true`.
     *
     * @default null
     */
    this.clippingPlanes = null;
    /**
     * Changes the behavior of clipping planes so that only their intersection is
     * clipped, rather than their union.
     *
     * @default false
     */
    this.clipIntersection = false;
    /**
     * Defines whether to clip shadows according to the clipping planes specified
     * on this material.
     *
     * @default false
     */
    this.clipShadows = false;
    /**
     * Defines which side of faces cast shadows. If `null`, the side casting shadows
     * is determined as follows:
     *
     * - When {@link Material#side} is set to `Side.Front`, the back side cast shadows.
     * - When {@link Material#side} is set to `Side.Back`, the front side cast shadows.
     * - When {@link Material#side} is set to `Side.Double`, both sides cast shadows.
     *
     * @default null
     */
    this.shadowSide = null;
    /**
     * Whether to render the material's color.
     *
     * This can be used in conjunction with {@link Object3D#renderOder} to create invisible
     * objects that occlude other objects.
     *
     * @default true
     */
    this.colorWrite = true;
    /**
     * Override the renderer's default precision for this material.
     *
     * @default null
     */
    this.precision = null;
    /**
     * Whether to use polygon offset or not. When enabled, each fragment's depth value will
     * be offset after it is interpolated from the depth values of the appropriate vertices.
     * The offset is added before the depth test is performed and before the value is written
     * into the depth buffer.
     *
     * Can be useful for rendering hidden-line images, for applying decals to surfaces, and for
     * rendering solids with highlighted edges.
     *
     * @default false
     */
    this.polygonOffset = false;
    /**
     * Specifies a scale factor that is used to create a variable depth offset for each polygon.
     *
     * @default 0
     */
    this.polygonOffsetFactor = 0;
    /**
     * Is multiplied by an implementation-specific value to create a constant depth offset.
     *
     * @default 0
     */
    this.polygonOffsetUnits = 0;
    /**
     * Whether to apply dithering to the color to remove the appearance of banding.
     *
     * @default false
     */
    this.dithering = false;
    /**
     * Whether alpha to coverage should be enabled or not. Can only be used with MSAA-enabled contexts
     * (meaning when the renderer was created with *antialias* parameter set to `true`). Enabling this
     * will smooth aliasing on clip plane edges and alphaTest-clipped edges.
     *
     * @default false
     */
    this.alphaToCoverage = false;
    /**
     * Whether to premultiply the alpha (transparency) value.
     *
     * @default false
     */
    this.premultipliedAlpha = false;
    /**
     * Whether double-sided, transparent objects should be rendered with a single pass or not.
     *
     * The engine renders double-sided, transparent objects with two draw calls (back faces first,
     * then front faces) to mitigate transparency artifacts. There are scenarios however where this
     * approach produces no quality gains but still doubles draw calls e.g. when rendering flat
     * vegetation like grass sprites. In these cases, set the `forceSinglePass` flag to `true` to
     * disable the two pass rendering to avoid performance issues.
     *
     * @default false
     */
    this.forceSinglePass = false;
    /**
     * Whether it's possible to override the material with {@link Scene#overrideMaterial} or not.
     *
     * @default true
     */
    this.allowOverride = true;
    /**
     * Defines whether 3D objects using this material are visible.
     *
     * @default true
     */
    this.visible = true;
    /**
     * Defines whether this material is tone mapped according to the renderer's tone mapping setting.
     *
     * It is ignored when rendering to a render target or using post processing.
     * In these cases, all materials are honored by tone mapping.
     *
     * @default true
     */
    this.toneMapped = true;
    /**
     * An object that can be used to store custom data about the Material. It
     * should not hold references to functions as these will not be cloned.
     *
     */
    this.userData = {};
    /**
     * This starts at `0` and counts how many times {@link Material#needsUpdate} is set to `true`.
     *
     * @readonly
     * @default 0
     */
    this.version = 0;
    this._alphaTest = 0;
  }
  /**
   * Sets the alpha value to be used when running an alpha test. The material
   * will not be rendered if the opacity is lower than this value.
   *
   * @readonly
   * @default 0
   */
  get alphaTest() {
    return this._alphaTest;
  }
  set alphaTest(value: number) {
    if (this._alphaTest > 0 !== value > 0) {
      this.version++;
    }
    this._alphaTest = value;
  }
  /**
   * An optional callback that is executed immediately before the material is used to render a 3D object.
   *
   * This method can only be used when rendering with {@link WebGLRenderer}.
   *
   * @param _renderer - The renderer.
   * @param _scene - The scene.
   * @param _camera - The camera that is used to render the scene.
   * @param _geometry - The 3D object's geometry.
   * @param _object - The 3D object.
   * @param _group - The geometry group data.
   */
  onBeforeRender(
    _renderer: WebGLRenderer,
    _scene: Scene,
    _camera: Camera,
    _geometry: BufferGeometry,
    _object: Object3D,
    _group: BufferGeometry["groups"][number],
  ): void {}
  /**
   * An optional callback that is executed immediately before the shader
   * program is compiled. This function is called with the shader source code
   * as a parameter. Useful for the modification of built-in materials.
   *
   * This method customizes materials rendered with {@link WebGLRenderer}.
   *
   * @param _shaderobject - The object holds the uniforms and the vertex and fragment shader source.
   * @param _renderer - A reference to the renderer.
   */
  onBeforeCompile(_shaderobject: WebGLShaderDescriptor, _renderer: WebGLRenderer): void {}
  /**
   * In case {@link Material#onBeforeCompile} is used, this callback can be used to identify
   * values of settings used in `onBeforeCompile()`, so three.js can reuse a cached
   * shader or recompile the shader for this material as needed.
   *
   * This method can only be used when rendering with {@link WebGLRenderer}.
   *
   * @return The custom program cache key.
   */
  customProgramCacheKey(): string {
    return this.onBeforeCompile.toString();
  }
  /**
   * This method can be used to set default values from parameter objects.
   * It is a generic implementation so it can be used with different types
   * of materials.
   *
   * @param [values] - The material values to set.
   */
  setValues(values?: any) {
    if (values === undefined) return;
    for (const key in values) {
      const newValue = values[key];
      if (newValue === undefined) {
        warn(`Material: parameter '${key}' has value of undefined.`);
        continue;
      }
      const currentValue = (this as any)[key];
      if (currentValue === undefined) {
        warn(`Material: '${key}' is not a property of THREE.${this.type}.`);
        continue;
      }
      if (currentValue && currentValue.isColor) {
        currentValue.set(newValue);
      } else if (
        (currentValue && currentValue.isVector2 && newValue && newValue.isVector2) ||
        (currentValue && currentValue.isEuler && newValue && newValue.isEuler) ||
        (currentValue && currentValue.isVector3 && newValue && newValue.isVector3)
      ) {
        currentValue.copy(newValue);
      } else {
        (this as any)[key] = newValue;
      }
    }
  }
  /**
   * Serializes the material into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized material.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta?: any) {
    const material = this as this & MaterialProperties;
    const isRootObject = meta === undefined || typeof meta === "string";
    if (isRootObject) {
      meta = {
        textures: {},
        images: {},
      };
    }
    const data: any = {
      metadata: {
        version: 4.7,
        type: "Material",
        generator: "Material.toJSON",
      },
    };
    // standard Material serialization
    (data as any).uuid = this.uuid;
    (data as any).type = this.type;
    (data as any).blending = this.blending;
    (data as any).side = this.side;
    (data as any).shadowSide = this.shadowSide;
    (data as any).vertexColors = this.vertexColors;
    (data as any).opacity = this.opacity;
    (data as any).transparent = this.transparent;
    (data as any).blendSrc = this.blendSrc;
    (data as any).blendDst = this.blendDst;
    (data as any).blendEquation = this.blendEquation;
    (data as any).blendSrcAlpha = this.blendSrcAlpha;
    (data as any).blendDstAlpha = this.blendDstAlpha;
    (data as any).blendEquationAlpha = this.blendEquationAlpha;
    (data as any).blendColor = this.blendColor.getHex();
    (data as any).blendAlpha = this.blendAlpha;
    (data as any).depthFunc = this.depthFunc;
    (data as any).depthTest = this.depthTest;
    (data as any).depthWrite = this.depthWrite;
    (data as any).colorWrite = this.colorWrite;
    (data as any).clipIntersection = this.clipIntersection;
    (data as any).clipShadows = this.clipShadows;
    (data as any).stencilWriteMask = this.stencilWriteMask;
    (data as any).stencilFunc = this.stencilFunc;
    (data as any).stencilRef = this.stencilRef;
    (data as any).stencilFuncMask = this.stencilFuncMask;
    (data as any).stencilFail = this.stencilFail;
    (data as any).stencilZFail = this.stencilZFail;
    (data as any).stencilZPass = this.stencilZPass;
    (data as any).stencilWrite = this.stencilWrite;
    (data as any).polygonOffset = this.polygonOffset;
    (data as any).polygonOffsetFactor = this.polygonOffsetFactor;
    (data as any).polygonOffsetUnits = this.polygonOffsetUnits;
    (data as any).dithering = this.dithering;
    (data as any).alphaTest = this.alphaTest;
    (data as any).alphaHash = this.alphaHash;
    (data as any).alphaToCoverage = this.alphaToCoverage;
    (data as any).premultipliedAlpha = this.premultipliedAlpha;
    (data as any).forceSinglePass = this.forceSinglePass;
    (data as any).allowOverride = this.allowOverride;
    (data as any).visible = this.visible;
    (data as any).toneMapped = this.toneMapped;
    (data as any).name = this.name;
    if ((this as any).color && (this as any).color.isColor) (data as any).color = (this as any).color.getHex();
    if (material.roughness !== undefined) (data as any).roughness = material.roughness;
    if (material.metalness !== undefined) (data as any).metalness = material.metalness;
    if (material.sheen !== undefined) (data as any).sheen = material.sheen;
    if (material.sheenColor && material.sheenColor.isColor) (data as any).sheenColor = material.sheenColor.getHex();
    if (material.sheenRoughness !== undefined) (data as any).sheenRoughness = material.sheenRoughness;
    if ((this as any).emissive && (this as any).emissive.isColor)
      (data as any).emissive = (this as any).emissive.getHex();
    if (material.emissiveIntensity !== undefined) (data as any).emissiveIntensity = material.emissiveIntensity;
    if ((this as any).specular && (this as any).specular.isColor)
      (data as any).specular = (this as any).specular.getHex();
    if (material.specularIntensity !== undefined) (data as any).specularIntensity = material.specularIntensity;
    if ((this as any).specularColor && (this as any).specularColor.isColor)
      (data as any).specularColor = (this as any).specularColor.getHex();
    if (material.shininess !== undefined) (data as any).shininess = material.shininess;
    if (material.clearcoat !== undefined) (data as any).clearcoat = material.clearcoat;
    if (material.clearcoatRoughness !== undefined) (data as any).clearcoatRoughness = material.clearcoatRoughness;
    if (material.diffuseRoughness !== undefined) (data as any).diffuseRoughness = material.diffuseRoughness;
    if (material.diffuseRoughnessMap && material.diffuseRoughnessMap.isTexture) {
      (data as any).diffuseRoughnessMap = material.diffuseRoughnessMap.toJSON(meta).uuid;
    }
    if (material.clearcoatMap && material.clearcoatMap.isTexture) {
      (data as any).clearcoatMap = material.clearcoatMap.toJSON(meta).uuid;
    }
    if (material.clearcoatRoughnessMap && material.clearcoatRoughnessMap.isTexture) {
      (data as any).clearcoatRoughnessMap = material.clearcoatRoughnessMap.toJSON(meta).uuid;
    }
    if (material.clearcoatNormalMap && material.clearcoatNormalMap.isTexture) {
      (data as any).clearcoatNormalMap = material.clearcoatNormalMap.toJSON(meta).uuid;
      (data as any).clearcoatNormalScale = material.clearcoatNormalScale!.toArray();
    }
    if (material.sheenColorMap && material.sheenColorMap.isTexture) {
      (data as any).sheenColorMap = material.sheenColorMap.toJSON(meta).uuid;
    }
    if (material.sheenRoughnessMap && material.sheenRoughnessMap.isTexture) {
      (data as any).sheenRoughnessMap = material.sheenRoughnessMap.toJSON(meta).uuid;
    }
    if (material.dispersion !== undefined) (data as any).dispersion = material.dispersion;
    if (material.retroreflectivity !== undefined) (data as any).retroreflectivity = material.retroreflectivity;
    if (material.iridescence !== undefined) (data as any).iridescence = material.iridescence;
    if (material.iridescenceIOR !== undefined) (data as any).iridescenceIOR = material.iridescenceIOR;
    if (material.iridescenceThicknessMinimum !== undefined)
      (data as any).iridescenceThicknessMinimum = material.iridescenceThicknessMinimum;
    if (material.iridescenceThicknessMaximum !== undefined)
      (data as any).iridescenceThicknessMaximum = material.iridescenceThicknessMaximum;
    if (material.iridescenceMap && material.iridescenceMap.isTexture) {
      (data as any).iridescenceMap = material.iridescenceMap.toJSON(meta).uuid;
    }
    if (material.iridescenceThicknessMap && material.iridescenceThicknessMap.isTexture) {
      (data as any).iridescenceThicknessMap = material.iridescenceThicknessMap.toJSON(meta).uuid;
    }
    if (material.anisotropy !== undefined) (data as any).anisotropy = material.anisotropy;
    if (material.anisotropyRotation !== undefined) (data as any).anisotropyRotation = material.anisotropyRotation;
    if (material.anisotropyMap && material.anisotropyMap.isTexture) {
      (data as any).anisotropyMap = material.anisotropyMap.toJSON(meta).uuid;
    }
    if (material.map && material.map.isTexture) (data as any).map = material.map.toJSON(meta).uuid;
    if (material.matcap && material.matcap.isTexture) (data as any).matcap = material.matcap.toJSON(meta).uuid;
    if (material.alphaMap && material.alphaMap.isTexture) (data as any).alphaMap = material.alphaMap.toJSON(meta).uuid;
    if (material.lightMap && material.lightMap.isTexture) {
      (data as any).lightMap = material.lightMap.toJSON(meta).uuid;
      (data as any).lightMapIntensity = material.lightMapIntensity;
    }
    if (material.aoMap && material.aoMap.isTexture) {
      (data as any).aoMap = material.aoMap.toJSON(meta).uuid;
      (data as any).aoMapIntensity = material.aoMapIntensity;
    }
    if (material.bumpMap && material.bumpMap.isTexture) {
      (data as any).bumpMap = material.bumpMap.toJSON(meta).uuid;
      (data as any).bumpScale = material.bumpScale;
    }
    if (material.normalMap && material.normalMap.isTexture) {
      (data as any).normalMap = material.normalMap.toJSON(meta).uuid;
      (data as any).normalMapType = material.normalMapType;
      (data as any).normalScale = material.normalScale!.toArray();
    }
    if (material.displacementMap && material.displacementMap.isTexture) {
      (data as any).displacementMap = material.displacementMap.toJSON(meta).uuid;
      (data as any).displacementScale = material.displacementScale;
      (data as any).displacementBias = material.displacementBias;
    }
    if (material.roughnessMap && material.roughnessMap.isTexture)
      (data as any).roughnessMap = material.roughnessMap.toJSON(meta).uuid;
    if (material.metalnessMap && material.metalnessMap.isTexture)
      (data as any).metalnessMap = material.metalnessMap.toJSON(meta).uuid;
    if (material.emissiveMap && material.emissiveMap.isTexture)
      (data as any).emissiveMap = material.emissiveMap.toJSON(meta).uuid;
    if (material.specularMap && material.specularMap.isTexture)
      (data as any).specularMap = material.specularMap.toJSON(meta).uuid;
    if (material.specularIntensityMap && material.specularIntensityMap.isTexture)
      (data as any).specularIntensityMap = material.specularIntensityMap.toJSON(meta).uuid;
    if (material.specularColorMap && material.specularColorMap.isTexture)
      (data as any).specularColorMap = material.specularColorMap.toJSON(meta).uuid;
    if (material.envMap && material.envMap.isTexture) {
      (data as any).envMap = material.envMap.toJSON(meta).uuid;
      if (material.combine !== undefined) (data as any).combine = material.combine;
    }
    if ((this as any).envMapRotation !== undefined)
      (data as any).envMapRotation = (this as any).envMapRotation.toArray();
    if (material.envMapIntensity !== undefined) (data as any).envMapIntensity = material.envMapIntensity;
    if (material.reflectivity !== undefined) (data as any).reflectivity = material.reflectivity;
    if (material.refractionRatio !== undefined) (data as any).refractionRatio = material.refractionRatio;
    if (material.gradientMap && material.gradientMap.isTexture) {
      (data as any).gradientMap = material.gradientMap.toJSON(meta).uuid;
    }
    if (material.transmission !== undefined) (data as any).transmission = material.transmission;
    if (material.transmissionMap && material.transmissionMap.isTexture)
      (data as any).transmissionMap = material.transmissionMap.toJSON(meta).uuid;
    if (material.thickness !== undefined) (data as any).thickness = material.thickness;
    if (material.thicknessMap && material.thicknessMap.isTexture)
      (data as any).thicknessMap = material.thicknessMap.toJSON(meta).uuid;
    if (material.attenuationDistance !== undefined) (data as any).attenuationDistance = material.attenuationDistance;
    if ((this as any).attenuationColor !== undefined)
      (data as any).attenuationColor = (this as any).attenuationColor.getHex();
    if (material.size !== undefined) (data as any).size = material.size;
    if (material.sizeAttenuation !== undefined) (data as any).sizeAttenuation = material.sizeAttenuation;
    if (Array.isArray(this.clippingPlanes) && this.clippingPlanes.length > 0) {
      (data as any).clippingPlanes = this.clippingPlanes.map((plane: Plane) => plane.toJSON());
    }
    // rotation (SpriteMaterial)
    if (material.rotation !== undefined) (data as any).rotation = material.rotation;
    // depthPacking (MeshDepthMaterial)
    if (material.depthPacking !== undefined) (data as any).depthPacking = material.depthPacking;
    if (material.linewidth !== undefined) (data as any).linewidth = material.linewidth;
    if (material.linecap !== undefined) (data as any).linecap = material.linecap;
    if (material.linejoin !== undefined) (data as any).linejoin = material.linejoin;
    if (material.dashSize !== undefined) (data as any).dashSize = material.dashSize;
    if (material.gapSize !== undefined) (data as any).gapSize = material.gapSize;
    if (material.scale !== undefined) (data as any).scale = material.scale;
    if (material.wireframe !== undefined) (data as any).wireframe = material.wireframe;
    if (material.wireframeLinewidth !== undefined) (data as any).wireframeLinewidth = material.wireframeLinewidth;
    if (material.wireframeLinecap !== undefined) (data as any).wireframeLinecap = material.wireframeLinecap;
    if (material.wireframeLinejoin !== undefined) (data as any).wireframeLinejoin = material.wireframeLinejoin;
    if (material.flatShading !== undefined) (data as any).flatShading = material.flatShading;
    if (material.fog !== undefined) (data as any).fog = material.fog;
    if (Object.keys(this.userData).length > 0) (data as any).userData = this.userData;
    // TODO: Copied from Object3D.toJSON
    function extractFromCache(cache?: any) {
      const values: any[] = [];
      for (const key in cache) {
        const data = cache[key];
        delete data.metadata;
        values.push(data);
      }
      return values;
    }
    if (isRootObject) {
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);
      if (textures.length > 0) (data as any).textures = textures;
      if (images.length > 0) (data as any).images = images;
    }
    return data;
  }
  /**
   * Deserializes the material from the given JSON.
   *
   * @param json - The JSON holding the serialized material.
   * @param textures - A dictionary holding textures referenced by the material.
   * @return A reference to this material.
   */
  fromJSON(json: any, textures?: any): this {
    const material = this as this & MaterialProperties;
    if (json.uuid !== undefined) this.uuid = json.uuid;
    if (json.name !== undefined) this.name = json.name;
    if (json.color !== undefined && (this as any).color !== undefined) (this as any).color.setHex(json.color);
    if (json.roughness !== undefined) material.roughness = json.roughness;
    if (json.metalness !== undefined) material.metalness = json.metalness;
    if (json.sheen !== undefined) material.sheen = json.sheen;
    if (json.sheenColor !== undefined) material.sheenColor = new Color().setHex(json.sheenColor);
    if (json.sheenRoughness !== undefined) material.sheenRoughness = json.sheenRoughness;
    if (json.emissive !== undefined && (this as any).emissive !== undefined)
      (this as any).emissive.setHex(json.emissive);
    if (json.specular !== undefined && (this as any).specular !== undefined)
      (this as any).specular.setHex(json.specular);
    if (json.specularIntensity !== undefined) material.specularIntensity = json.specularIntensity;
    if (json.specularColor !== undefined && (this as any).specularColor !== undefined)
      (this as any).specularColor.setHex(json.specularColor);
    if (json.shininess !== undefined) material.shininess = json.shininess;
    if (json.clearcoat !== undefined) material.clearcoat = json.clearcoat;
    if (json.clearcoatRoughness !== undefined) material.clearcoatRoughness = json.clearcoatRoughness;
    if (json.diffuseRoughness !== undefined) material.diffuseRoughness = json.diffuseRoughness;
    if (json.dispersion !== undefined) material.dispersion = json.dispersion;
    if (json.retroreflectivity !== undefined) material.retroreflectivity = json.retroreflectivity;
    if (json.iridescence !== undefined) material.iridescence = json.iridescence;
    if (json.iridescenceIOR !== undefined) material.iridescenceIOR = json.iridescenceIOR;
    if (json.iridescenceThicknessMinimum !== undefined)
      material.iridescenceThicknessMinimum = json.iridescenceThicknessMinimum;
    if (json.iridescenceThicknessMaximum !== undefined)
      material.iridescenceThicknessMaximum = json.iridescenceThicknessMaximum;
    if (json.iridescenceThicknessRange !== undefined) {
      // @deprecated r187
      material.iridescenceThicknessMinimum = json.iridescenceThicknessRange[0];
      material.iridescenceThicknessMaximum = json.iridescenceThicknessRange[1];
    }
    if (json.transmission !== undefined) material.transmission = json.transmission;
    if (json.thickness !== undefined) material.thickness = json.thickness;
    if (json.attenuationDistance !== undefined) material.attenuationDistance = json.attenuationDistance;
    if (json.attenuationColor !== undefined && (this as any).attenuationColor !== undefined)
      (this as any).attenuationColor.setHex(json.attenuationColor);
    if (json.anisotropy !== undefined) material.anisotropy = json.anisotropy;
    if (json.anisotropyRotation !== undefined) material.anisotropyRotation = json.anisotropyRotation;
    if (json.fog !== undefined) material.fog = json.fog;
    if (json.flatShading !== undefined) material.flatShading = json.flatShading;
    if (json.blending !== undefined) this.blending = json.blending;
    if (json.combine !== undefined) material.combine = json.combine;
    if (json.side !== undefined) this.side = json.side;
    if (json.shadowSide !== undefined) this.shadowSide = json.shadowSide;
    if (json.opacity !== undefined) this.opacity = json.opacity;
    if (json.transparent !== undefined) this.transparent = json.transparent;
    if (json.alphaTest !== undefined) this.alphaTest = json.alphaTest;
    if (json.alphaHash !== undefined) this.alphaHash = json.alphaHash;
    if (json.depthFunc !== undefined) this.depthFunc = json.depthFunc;
    if (json.depthTest !== undefined) this.depthTest = json.depthTest;
    if (json.depthWrite !== undefined) this.depthWrite = json.depthWrite;
    if (json.colorWrite !== undefined) this.colorWrite = json.colorWrite;
    if (json.clippingPlanes !== undefined)
      this.clippingPlanes = json.clippingPlanes.map((plane?: any) => new Plane().fromJSON(plane));
    if (json.clipIntersection !== undefined) this.clipIntersection = json.clipIntersection;
    if (json.clipShadows !== undefined) this.clipShadows = json.clipShadows;
    if (json.depthPacking !== undefined) material.depthPacking = json.depthPacking;
    if (json.blendSrc !== undefined) this.blendSrc = json.blendSrc;
    if (json.blendDst !== undefined) this.blendDst = json.blendDst;
    if (json.blendEquation !== undefined) this.blendEquation = json.blendEquation;
    if (json.blendSrcAlpha !== undefined) this.blendSrcAlpha = json.blendSrcAlpha;
    if (json.blendDstAlpha !== undefined) this.blendDstAlpha = json.blendDstAlpha;
    if (json.blendEquationAlpha !== undefined) this.blendEquationAlpha = json.blendEquationAlpha;
    if (json.blendColor !== undefined && this.blendColor !== undefined) this.blendColor.setHex(json.blendColor);
    if (json.blendAlpha !== undefined) this.blendAlpha = json.blendAlpha;
    if (json.stencilWriteMask !== undefined) this.stencilWriteMask = json.stencilWriteMask;
    if (json.stencilFunc !== undefined) this.stencilFunc = json.stencilFunc;
    if (json.stencilRef !== undefined) this.stencilRef = json.stencilRef;
    if (json.stencilFuncMask !== undefined) this.stencilFuncMask = json.stencilFuncMask;
    if (json.stencilFail !== undefined) this.stencilFail = json.stencilFail;
    if (json.stencilZFail !== undefined) this.stencilZFail = json.stencilZFail;
    if (json.stencilZPass !== undefined) this.stencilZPass = json.stencilZPass;
    if (json.stencilWrite !== undefined) this.stencilWrite = json.stencilWrite;
    if (json.wireframe !== undefined) material.wireframe = json.wireframe;
    if (json.wireframeLinewidth !== undefined) material.wireframeLinewidth = json.wireframeLinewidth;
    if (json.wireframeLinecap !== undefined) material.wireframeLinecap = json.wireframeLinecap;
    if (json.wireframeLinejoin !== undefined) material.wireframeLinejoin = json.wireframeLinejoin;
    if (json.rotation !== undefined) material.rotation = json.rotation;
    if (json.linewidth !== undefined) material.linewidth = json.linewidth;
    if (json.linecap !== undefined) material.linecap = json.linecap;
    if (json.linejoin !== undefined) material.linejoin = json.linejoin;
    if (json.dashSize !== undefined) material.dashSize = json.dashSize;
    if (json.gapSize !== undefined) material.gapSize = json.gapSize;
    if (json.scale !== undefined) material.scale = json.scale;
    if (json.polygonOffset !== undefined) this.polygonOffset = json.polygonOffset;
    if (json.polygonOffsetFactor !== undefined) this.polygonOffsetFactor = json.polygonOffsetFactor;
    if (json.polygonOffsetUnits !== undefined) this.polygonOffsetUnits = json.polygonOffsetUnits;
    if (json.dithering !== undefined) this.dithering = json.dithering;
    if (json.alphaToCoverage !== undefined) this.alphaToCoverage = json.alphaToCoverage;
    if (json.premultipliedAlpha !== undefined) this.premultipliedAlpha = json.premultipliedAlpha;
    if (json.forceSinglePass !== undefined) this.forceSinglePass = json.forceSinglePass;
    if (json.allowOverride !== undefined) this.allowOverride = json.allowOverride;
    if (json.visible !== undefined) this.visible = json.visible;
    if (json.toneMapped !== undefined) this.toneMapped = json.toneMapped;
    if (json.userData !== undefined) this.userData = json.userData;
    if (json.vertexColors !== undefined) {
      if (typeof json.vertexColors === "number") {
        this.vertexColors = json.vertexColors > 0;
      } else {
        this.vertexColors = json.vertexColors;
      }
    }
    // for PointsMaterial
    if (json.size !== undefined) material.size = json.size;
    if (json.sizeAttenuation !== undefined) material.sizeAttenuation = json.sizeAttenuation;
    // maps
    if (json.map !== undefined) material.map = textures[json.map] || null;
    if (json.matcap !== undefined) material.matcap = textures[json.matcap] || null;
    if (json.alphaMap !== undefined) material.alphaMap = textures[json.alphaMap] || null;
    if (json.bumpMap !== undefined) material.bumpMap = textures[json.bumpMap] || null;
    if (json.bumpScale !== undefined) material.bumpScale = json.bumpScale;
    if (json.normalMap !== undefined) material.normalMap = textures[json.normalMap] || null;
    if (json.normalMapType !== undefined) material.normalMapType = json.normalMapType;
    if (json.normalScale !== undefined) {
      let normalScale = json.normalScale;
      if (Array.isArray(normalScale) === false) {
        // Blender exporter used to export a scalar. See #7459
        normalScale = [normalScale, normalScale];
      }
      material.normalScale = new Vector2().fromArray(normalScale);
    }
    if (json.displacementMap !== undefined) material.displacementMap = textures[json.displacementMap] || null;
    if (json.displacementScale !== undefined) material.displacementScale = json.displacementScale;
    if (json.displacementBias !== undefined) material.displacementBias = json.displacementBias;
    if (json.roughnessMap !== undefined) material.roughnessMap = textures[json.roughnessMap] || null;
    if (json.metalnessMap !== undefined) material.metalnessMap = textures[json.metalnessMap] || null;
    if (json.emissiveMap !== undefined) material.emissiveMap = textures[json.emissiveMap] || null;
    if (json.emissiveIntensity !== undefined) material.emissiveIntensity = json.emissiveIntensity;
    if (json.specularMap !== undefined) material.specularMap = textures[json.specularMap] || null;
    if (json.specularIntensityMap !== undefined)
      material.specularIntensityMap = textures[json.specularIntensityMap] || null;
    if (json.specularColorMap !== undefined) material.specularColorMap = textures[json.specularColorMap] || null;
    if (json.envMap !== undefined) material.envMap = textures[json.envMap] || null;
    if (json.envMapRotation !== undefined) (this as any).envMapRotation.fromArray(json.envMapRotation);
    if (json.envMapIntensity !== undefined) material.envMapIntensity = json.envMapIntensity;
    if (json.reflectivity !== undefined) material.reflectivity = json.reflectivity;
    if (json.refractionRatio !== undefined) material.refractionRatio = json.refractionRatio;
    if (json.lightMap !== undefined) material.lightMap = textures[json.lightMap] || null;
    if (json.lightMapIntensity !== undefined) material.lightMapIntensity = json.lightMapIntensity;
    if (json.aoMap !== undefined) material.aoMap = textures[json.aoMap] || null;
    if (json.aoMapIntensity !== undefined) material.aoMapIntensity = json.aoMapIntensity;
    if (json.gradientMap !== undefined) material.gradientMap = textures[json.gradientMap] || null;
    if (json.clearcoatMap !== undefined) material.clearcoatMap = textures[json.clearcoatMap] || null;
    if (json.clearcoatRoughnessMap !== undefined)
      material.clearcoatRoughnessMap = textures[json.clearcoatRoughnessMap] || null;
    if (json.clearcoatNormalMap !== undefined) material.clearcoatNormalMap = textures[json.clearcoatNormalMap] || null;
    if (json.clearcoatNormalScale !== undefined)
      material.clearcoatNormalScale = new Vector2().fromArray(json.clearcoatNormalScale);
    if (json.diffuseRoughnessMap !== undefined)
      material.diffuseRoughnessMap = textures[json.diffuseRoughnessMap] || null;
    if (json.iridescenceMap !== undefined) material.iridescenceMap = textures[json.iridescenceMap] || null;
    if (json.iridescenceThicknessMap !== undefined)
      material.iridescenceThicknessMap = textures[json.iridescenceThicknessMap] || null;
    if (json.transmissionMap !== undefined) material.transmissionMap = textures[json.transmissionMap] || null;
    if (json.thicknessMap !== undefined) material.thicknessMap = textures[json.thicknessMap] || null;
    if (json.anisotropyMap !== undefined) material.anisotropyMap = textures[json.anisotropyMap] || null;
    if (json.sheenColorMap !== undefined) material.sheenColorMap = textures[json.sheenColorMap] || null;
    if (json.sheenRoughnessMap !== undefined) material.sheenRoughnessMap = textures[json.sheenRoughnessMap] || null;
    return this;
  }
  /**
   * Returns a new material with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the values of the given material to this instance.
   *
   * @param source - The material to copy.
   * @return A reference to this instance.
   */
  copy(source: Material): this {
    this.name = source.name;
    this.blending = source.blending;
    this.side = source.side;
    this.vertexColors = source.vertexColors;
    this.opacity = source.opacity;
    this.transparent = source.transparent;
    this.blendSrc = source.blendSrc;
    this.blendDst = source.blendDst;
    this.blendEquation = source.blendEquation;
    this.blendSrcAlpha = source.blendSrcAlpha;
    this.blendDstAlpha = source.blendDstAlpha;
    this.blendEquationAlpha = source.blendEquationAlpha;
    this.blendColor.copy(source.blendColor);
    this.blendAlpha = source.blendAlpha;
    this.depthFunc = source.depthFunc;
    this.depthTest = source.depthTest;
    this.depthWrite = source.depthWrite;
    this.stencilWriteMask = source.stencilWriteMask;
    this.stencilFunc = source.stencilFunc;
    this.stencilRef = source.stencilRef;
    this.stencilFuncMask = source.stencilFuncMask;
    this.stencilFail = source.stencilFail;
    this.stencilZFail = source.stencilZFail;
    this.stencilZPass = source.stencilZPass;
    this.stencilWrite = source.stencilWrite;
    const srcPlanes = source.clippingPlanes;
    let dstPlanes: any = null;
    if (srcPlanes !== null) {
      const n = srcPlanes.length;
      dstPlanes = Array(n);
      for (let i = 0; i !== n; ++i) {
        dstPlanes[i] = srcPlanes[i].clone();
      }
    }
    this.clippingPlanes = dstPlanes;
    this.clipIntersection = source.clipIntersection;
    this.clipShadows = source.clipShadows;
    this.shadowSide = source.shadowSide;
    this.colorWrite = source.colorWrite;
    this.precision = source.precision;
    this.polygonOffset = source.polygonOffset;
    this.polygonOffsetFactor = source.polygonOffsetFactor;
    this.polygonOffsetUnits = source.polygonOffsetUnits;
    this.dithering = source.dithering;
    this.alphaTest = source.alphaTest;
    this.alphaHash = source.alphaHash;
    this.alphaToCoverage = source.alphaToCoverage;
    this.premultipliedAlpha = source.premultipliedAlpha;
    this.forceSinglePass = source.forceSinglePass;
    this.allowOverride = source.allowOverride;
    this.visible = source.visible;
    this.toneMapped = source.toneMapped;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * @fires Material#dispose
   */
  dispose() {
    /**
     * Fires when the material has been disposed of.
     *
     * @event Material#dispose
     */
    this.dispatchEvent({ type: "dispose" });
  }
  /**
   * Setting this property to `true` indicates the engine the material
   * needs to be recompiled.
   *
   * @default false
   * @param value
   */
  set needsUpdate(value: boolean) {
    if (value === true) this.version++;
  }
}
