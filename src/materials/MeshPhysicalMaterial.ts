import type { Texture } from "../textures/Texture";
import { Vector2 } from "../math/Vector2";
import { MeshStandardMaterial } from "./MeshStandardMaterial";
import { Color } from "../math/Color";
import { clamp } from "../math/MathUtils";
import { warnOnce } from "../utils";

export type MeshPhysicalMaterialParameters = Omit<
  Partial<
    Pick<
      MeshPhysicalMaterial,
      | "isMeshPhysicalMaterial"
      | "defines"
      | "type"
      | "anisotropyRotation"
      | "anisotropyMap"
      | "clearcoatMap"
      | "clearcoatRoughness"
      | "clearcoatRoughnessMap"
      | "clearcoatNormalScale"
      | "clearcoatNormalMap"
      | "diffuseRoughnessMap"
      | "ior"
      | "iridescenceMap"
      | "iridescenceIOR"
      | "iridescenceThicknessMinimum"
      | "iridescenceThicknessMaximum"
      | "iridescenceThicknessMap"
      | "sheenColor"
      | "sheenColorMap"
      | "sheenRoughness"
      | "sheenRoughnessMap"
      | "transmissionMap"
      | "thickness"
      | "thicknessMap"
      | "attenuationDistance"
      | "attenuationColor"
      | "specularIntensity"
      | "specularIntensityMap"
      | "specularColor"
      | "specularColorMap"
      | "anisotropy"
      | "clearcoat"
      | "diffuseRoughness"
      | "iridescence"
      | "dispersion"
      | "retroreflectivity"
      | "sheen"
      | "transmission"
      | "iridescenceThicknessRange"
      | "isMeshStandardMaterial"
      | "color"
      | "roughness"
      | "metalness"
      | "map"
      | "lightMap"
      | "lightMapIntensity"
      | "aoMap"
      | "aoMapIntensity"
      | "emissive"
      | "emissiveIntensity"
      | "emissiveMap"
      | "bumpMap"
      | "bumpScale"
      | "normalMap"
      | "normalMapType"
      | "normalScale"
      | "displacementMap"
      | "displacementScale"
      | "displacementBias"
      | "roughnessMap"
      | "metalnessMap"
      | "alphaMap"
      | "envMap"
      | "envMapRotation"
      | "envMapIntensity"
      | "wireframe"
      | "wireframeLinewidth"
      | "wireframeLinecap"
      | "wireframeLinejoin"
      | "flatShading"
      | "fog"
      | "isMaterial"
      | "uuid"
      | "name"
      | "blending"
      | "side"
      | "vertexColors"
      | "opacity"
      | "transparent"
      | "alphaHash"
      | "blendSrc"
      | "blendDst"
      | "blendEquation"
      | "blendSrcAlpha"
      | "blendDstAlpha"
      | "blendEquationAlpha"
      | "blendColor"
      | "blendAlpha"
      | "depthFunc"
      | "depthTest"
      | "depthWrite"
      | "stencilWriteMask"
      | "stencilFunc"
      | "stencilRef"
      | "stencilFuncMask"
      | "stencilFail"
      | "stencilZFail"
      | "stencilZPass"
      | "stencilWrite"
      | "clippingPlanes"
      | "clipIntersection"
      | "clipShadows"
      | "shadowSide"
      | "colorWrite"
      | "precision"
      | "polygonOffset"
      | "polygonOffsetFactor"
      | "polygonOffsetUnits"
      | "dithering"
      | "alphaToCoverage"
      | "premultipliedAlpha"
      | "forceSinglePass"
      | "allowOverride"
      | "visible"
      | "toneMapped"
      | "userData"
      | "version"
      | "alphaTest"
      | "needsUpdate"
      | "reflectivity"
    >
  >,
  "color" | "emissive" | "sheenColor" | "attenuationColor" | "specularColor"
> & {
  color?: Color | number | string;
  emissive?: Color | number | string;
  sheenColor?: Color | number | string;
  attenuationColor?: Color | number | string;
  specularColor?: Color | number | string;
};
/**
 * An extension of the {@link MeshStandardMaterial}, providing more advanced
 * physically-based rendering properties:
 *
 * - Anisotropy: Ability to represent the anisotropic property of materials
 * as observable with brushed metals.
 * - Clearcoat: Some materials — like car paints, carbon fiber, and wet surfaces — require
 * a clear, reflective layer on top of another layer that may be irregular or rough.
 * Clearcoat approximates this effect, without the need for a separate transparent surface.
 * - Diffuse roughness: Produces the flatter appearance and enhanced backscattering of
 * rough diffuse surfaces such as clay, concrete, and unpolished materials.
 * - Iridescence: Allows to render the effect where hue varies  depending on the viewing
 * angle and illumination angle. This can be seen on soap bubbles, oil films, or on the
 * wings of many insects.
 * - Physically-based transparency: One limitation of {@link Material#opacity} is that highly
 * transparent materials are less reflective. Physically-based transmission provides a more
 * realistic option for thin, transparent surfaces like glass.
 * - Advanced reflectivity: More flexible reflectivity for non-metallic materials.
 * - Retroreflection: Redirects specular light back toward the light source for
 * safety materials like road markings and reflective tape.
 * - Sheen: Can be used for representing cloth and fabric materials.
 *
 * As a result of these complex shading features, `MeshPhysicalMaterial` has a
 * higher performance cost, per pixel, than other three.js materials. Most
 * effects are disabled by default, and add cost as they are enabled. For
 * best results, always specify an environment map when using this material.
 *
 * @demo scenes/material-browser.html#MeshPhysicalMaterial
 */
export class MeshPhysicalMaterial extends MeshStandardMaterial {
  isMeshPhysicalMaterial: boolean;

  ior: number;
  attenuationColor: Color;
  specularColor: Color;
  _anisotropy: number;
  _clearcoat: number;
  _diffuseRoughness: number;
  _dispersion: number;
  _iridescence: number;
  _retroreflectivity: number;
  _sheen: number;
  _transmission: number;
  anisotropyRotation: number;
  anisotropyMap: Texture | null;
  clearcoatMap: Texture | null;
  clearcoatRoughness: number;
  clearcoatRoughnessMap: Texture | null;
  clearcoatNormalScale: Vector2;
  clearcoatNormalMap: Texture | null;
  diffuseRoughnessMap: Texture | null;
  // The constructor installs this own accessor with Object.defineProperty.
  reflectivity!: number;
  iridescenceMap: Texture | null;
  iridescenceIOR: number;
  iridescenceThicknessMinimum: number;
  iridescenceThicknessMaximum: number;
  iridescenceThicknessMap: Texture | null;
  sheenColor: Color;
  sheenColorMap: Texture | null;
  sheenRoughness: number;
  sheenRoughnessMap: Texture | null;
  transmissionMap: Texture | null;
  thickness: number;
  thicknessMap: Texture | null;
  attenuationDistance: number;
  specularIntensity: number;
  specularIntensityMap: Texture | null;
  specularColorMap: Texture | null;

  /**
   * Constructs a new mesh physical material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshPhysicalMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isMeshPhysicalMaterial = true;
    this.defines = {
      STANDARD: "",
      PHYSICAL: "",
    };
    this.type = "MeshPhysicalMaterial";
    /**
     * The rotation of the anisotropy in tangent, bitangent space, measured in radians
     * counter-clockwise from the tangent. When `anisotropyMap` is present, this
     * property provides additional rotation to the vectors in the texture.
     *
     * @default 0
     */
    this.anisotropyRotation = 0;
    /**
     * Red and green channels represent the anisotropy direction in `[-1, 1]` tangent,
     * bitangent space, to be rotated by `anisotropyRotation`. The blue channel
     * contains strength as `[0, 1]` to be multiplied by `anisotropy`.
     *
     * `anisotropyMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.anisotropyMap = null;
    /**
     * The red channel of this texture is multiplied against `clearcoat`,
     * for per-pixel control over a coating's intensity.
     *
     * `clearcoatMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.clearcoatMap = null;
    /**
     * Roughness of the clear coat layer, from `0.0` to `1.0`.
     *
     * @default 0
     */
    this.clearcoatRoughness = 0.0;
    /**
     * The green channel of this texture is multiplied against
     * `clearcoatRoughness`, for per-pixel control over a coating's roughness.
     *
     * `clearcoatRoughnessMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.clearcoatRoughnessMap = null;
    /**
     * How much `clearcoatNormalMap` affects the clear coat layer, from
     * `(0,0)` to `(1,1)`.
     *
     * @default (1,1)
     */
    this.clearcoatNormalScale = new Vector2(1, 1);
    /**
     * Can be used to enable independent normals for the clear coat layer.
     *
     * `clearcoatNormalMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.clearcoatNormalMap = null;
    /**
     * The red channel of this texture is multiplied against `diffuseRoughness`,
     * for per-pixel control over the diffuse roughness.
     *
     * `diffuseRoughnessMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.diffuseRoughnessMap = null;
    /**
     * Index-of-refraction for non-metallic materials, from `1.0` to `2.333`.
     *
     * @default 1.5
     */
    this.ior = 1.5;
    /**
     * Degree of reflectivity, from `0.0` to `1.0`. Default is `0.5`, which
     * corresponds to an index-of-refraction of `1.5`.
     *
     * This models the reflectivity of non-metallic materials. It has no effect
     * when `metalness` is `1.0`
     *
     * @name MeshPhysicalMaterial#reflectivity
     * @default 0.5
     */
    Object.defineProperty(this, "reflectivity", {
      enumerable: false,
      configurable: false,
      get: function (this: any) {
        return clamp((2.5 * (this.ior - 1)) / (this.ior + 1), 0, 1);
      },
      set: function (this: any, reflectivity: number) {
        this.ior = (1 + 0.4 * reflectivity) / (1 - 0.4 * reflectivity);
      },
    });
    /**
     * The red channel of this texture is multiplied against `iridescence`, for per-pixel
     * control over iridescence.
     *
     * `iridescenceMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.iridescenceMap = null;
    /**
     * Strength of the iridescence RGB color shift effect, represented by an index-of-refraction.
     * Between `1.0` to `2.333`.
     *
     * @default 1.3
     */
    this.iridescenceIOR = 1.3;
    /**
     * The minimum thickness of the iridescence layer in nanometers.
     *
     * @default 100
     */
    this.iridescenceThicknessMinimum = 100;
    /**
     * The maximum thickness of the iridescence layer in nanometers. If no
     * `iridescenceThicknessMap` is defined, this value is used as the thickness.
     *
     * @default 400
     */
    this.iridescenceThicknessMaximum = 400;
    /**
     * A texture that defines the thickness of the iridescence layer, stored in the green channel.
     * Minimum and maximum values of thickness are defined by `iridescenceThicknessMinimum` and
     * `iridescenceThicknessMaximum`:
     * - `0.0` in the green channel will result in thickness equal to `iridescenceThicknessMinimum`.
     * - `1.0` in the green channel will result in thickness equal to `iridescenceThicknessMaximum`.
     * - Values in-between will linearly interpolate between both values.
     *
     * `iridescenceThicknessMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.iridescenceThicknessMap = null;
    /**
     * The sheen tint.
     *
     * @default (0,0,0)
     */
    this.sheenColor = new Color(0x000000);
    /**
     * The RGB channels of this texture are multiplied against  `sheenColor`, for per-pixel control
     * over sheen tint.
     *
     * `sheenColorMap` represents color data, and the texture must be assigned a
     * {@link Texture#colorSpace}. Most `sheenColorMap` textures set
     * `texture.colorSpace = SRGBColorSpace`.
     *
     * @default null
     */
    this.sheenColorMap = null;
    /**
     * Roughness of the sheen layer, from `0.0` to `1.0`.
     *
     * @default 1
     */
    this.sheenRoughness = 1.0;
    /**
     * The alpha channel of this texture is multiplied against `sheenRoughness`, for per-pixel control
     * over sheen roughness.
     *
     * `sheenRoughnessMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.sheenRoughnessMap = null;
    /**
     * The red channel of this texture is multiplied against `transmission`, for per-pixel control over
     * optical transparency.
     *
     * `transmissionMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.transmissionMap = null;
    /**
     * The thickness of the volume beneath the surface. The value is given in the
     * coordinate space of the mesh. If the value is `0` the material is
     * thin-walled. Otherwise the material is a volume boundary.
     *
     * @default 0
     */
    this.thickness = 0;
    /**
     * A texture that defines the thickness, stored in the green channel. This will
     * be multiplied by `thickness`.
     *
     * `thicknessMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.thicknessMap = null;
    /**
     * Density of the medium given as the average distance that light travels in
     * the medium before interacting with a particle. The value is given in world
     * space units, and must be greater than zero.
     *
     * @default Infinity
     */
    this.attenuationDistance = Infinity;
    /**
     * The color that white light turns into due to absorption when reaching the
     * attenuation distance.
     *
     * @default (1,1,1)
     */
    this.attenuationColor = new Color(1, 1, 1);
    /**
     * A float that scales the amount of specular reflection for non-metals only.
     * When set to zero, the model is effectively Lambertian. From `0.0` to `1.0`.
     *
     * @default 1
     */
    this.specularIntensity = 1.0;
    /**
     * The alpha channel of this texture is multiplied against `specularIntensity`,
     * for per-pixel control over specular intensity.
     *
     * `specularIntensityMap` represents non-color data. Any texture assigned must have
     * `texture.colorSpace = NoColorSpace` (default).
     *
     * @default null
     */
    this.specularIntensityMap = null;
    /**
     * Tints the specular reflection at normal incidence for non-metals only.
     *
     * @default (1,1,1)
     */
    this.specularColor = new Color(1, 1, 1);
    /**
     * The RGB channels of this texture are multiplied against `specularColor`,
     * for per-pixel control over specular color.
     *
     * `specularColorMap` represents color data, and the texture must be assigned a
     * {@link Texture#colorSpace}. Most `specularColorMap` textures set
     * `texture.colorSpace = SRGBColorSpace`.
     *
     * @default null
     */
    this.specularColorMap = null;
    this._anisotropy = 0;
    this._clearcoat = 0;
    this._diffuseRoughness = 0;
    this._dispersion = 0;
    this._iridescence = 0;
    this._retroreflectivity = 0;
    this._sheen = 0.0;
    this._transmission = 0;
    this.setValues(parameters);
  }
  /**
   * The anisotropy strength, from `0.0` to `1.0`.
   *
   * @default 0
   */
  get anisotropy(): number {
    return this._anisotropy;
  }
  set anisotropy(value: number) {
    if (this._anisotropy > 0 !== value > 0) {
      this.version++;
    }
    this._anisotropy = value;
  }
  /**
   * Represents the intensity of the clear coat layer, from `0.0` to `1.0`. Use
   * clear coat related properties to enable multilayer materials that have a
   * thin translucent layer over the base layer.
   *
   * @default 0
   */
  get clearcoat(): number {
    return this._clearcoat;
  }
  set clearcoat(value: number) {
    if (this._clearcoat > 0 !== value > 0) {
      this.version++;
    }
    this._clearcoat = value;
  }
  /**
   * Roughness of the diffuse layer, from `0.0` to `1.0`. A value of `0.0`
   * uses Lambertian diffuse reflection. Values above `0.0` use the EON
   * energy-preserving rough diffuse model.
   *
   * @default 0
   */
  get diffuseRoughness(): number {
    return this._diffuseRoughness;
  }
  set diffuseRoughness(value: number) {
    if (this._diffuseRoughness > 0 !== value > 0) {
      this.version++;
    }
    this._diffuseRoughness = value;
  }
  /**
   * The intensity of the iridescence layer, simulating RGB color shift based on the angle between
   * the surface and the viewer, from `0.0` to `1.0`.
   *
   * @default 0
   */
  get iridescence(): number {
    return this._iridescence;
  }
  set iridescence(value: number) {
    if (this._iridescence > 0 !== value > 0) {
      this.version++;
    }
    this._iridescence = value;
  }
  /**
   * Defines the strength of the angular separation of colors (chromatic aberration) transmitting
   * through a relatively clear volume. Any value zero or larger is valid, the typical range of
   * realistic values is `[0, 1]`. This property can be only be used with transmissive objects.
   *
   * @default 0
   */
  get dispersion(): number {
    return this._dispersion;
  }
  set dispersion(value: number) {
    if (this._dispersion > 0 !== value > 0) {
      this.version++;
    }
    this._dispersion = value;
  }
  /**
   * The strength of retroreflection, from `0.0` to `1.0`. A value of `1.0`
   * evaluates the material's microfacet reflection with the view direction
   * reflected about the surface normal, redirecting the specular lobe back
   * toward the light source.
   *
   * @default 0
   */
  get retroreflectivity(): number {
    return this._retroreflectivity;
  }
  set retroreflectivity(value: number) {
    if (this._retroreflectivity > 0 !== value > 0) {
      this.version++;
    }
    this._retroreflectivity = value;
  }
  /**
   * The intensity of the sheen layer, from `0.0` to `1.0`.
   *
   * @default 0
   */
  get sheen(): number {
    return this._sheen;
  }
  set sheen(value: number) {
    if (this._sheen > 0 !== value > 0) {
      this.version++;
    }
    this._sheen = value;
  }
  /**
   * Degree of transmission (or optical transparency), from `0.0` to `1.0`.
   *
   * Thin, transparent or semitransparent, plastic or glass materials remain
   * largely reflective even if they are fully transmissive. The transmission
   * property can be used to model these materials.
   *
   * When transmission is non-zero, `opacity` should be  set to `1`.
   *
   * @default 0
   */
  get transmission(): number {
    return this._transmission;
  }
  set transmission(value: number) {
    if (this._transmission > 0 !== value > 0) {
      this.version++;
    }
    this._transmission = value;
  }
  /**
   * Array of exactly 2 elements, specifying minimum and maximum thickness of the iridescence layer.
   *
   * @deprecated since r187. Use {@link MeshPhysicalMaterial#iridescenceThicknessMinimum} and {@link MeshPhysicalMaterial#iridescenceThicknessMaximum} instead.
   * @default [100,400]
   */
  get iridescenceThicknessRange(): [number, number] {
    warnOnce(
      'MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".',
    ); // @deprecated r187
    return [this.iridescenceThicknessMinimum, this.iridescenceThicknessMaximum];
  }
  set iridescenceThicknessRange(value: [number, number]) {
    warnOnce(
      'MeshPhysicalMaterial: The "iridescenceThicknessRange" property has been replaced by "iridescenceThicknessMinimum" and "iridescenceThicknessMaximum".',
    ); // @deprecated r187
    this.iridescenceThicknessMinimum = value[0];
    this.iridescenceThicknessMaximum = value[1];
  }
  copy(source: MeshPhysicalMaterial): this {
    super.copy(source);
    this.defines = {
      STANDARD: "",
      PHYSICAL: "",
    };
    this.anisotropy = source.anisotropy;
    this.anisotropyRotation = source.anisotropyRotation;
    this.anisotropyMap = source.anisotropyMap;
    this.clearcoat = source.clearcoat;
    this.clearcoatMap = source.clearcoatMap;
    this.clearcoatRoughness = source.clearcoatRoughness;
    this.clearcoatRoughnessMap = source.clearcoatRoughnessMap;
    this.clearcoatNormalMap = source.clearcoatNormalMap;
    this.clearcoatNormalScale.copy(source.clearcoatNormalScale);
    this.diffuseRoughness = source.diffuseRoughness;
    this.diffuseRoughnessMap = source.diffuseRoughnessMap;
    this.dispersion = source.dispersion;
    this.ior = source.ior;
    this.iridescence = source.iridescence;
    this.iridescenceMap = source.iridescenceMap;
    this.iridescenceIOR = source.iridescenceIOR;
    this.iridescenceThicknessMinimum = source.iridescenceThicknessMinimum;
    this.iridescenceThicknessMaximum = source.iridescenceThicknessMaximum;
    this.iridescenceThicknessMap = source.iridescenceThicknessMap;
    this.retroreflectivity = source.retroreflectivity;
    this.sheen = source.sheen;
    this.sheenColor.copy(source.sheenColor);
    this.sheenColorMap = source.sheenColorMap;
    this.sheenRoughness = source.sheenRoughness;
    this.sheenRoughnessMap = source.sheenRoughnessMap;
    this.transmission = source.transmission;
    this.transmissionMap = source.transmissionMap;
    this.thickness = source.thickness;
    this.thicknessMap = source.thicknessMap;
    this.attenuationDistance = source.attenuationDistance;
    this.attenuationColor.copy(source.attenuationColor);
    this.specularIntensity = source.specularIntensity;
    this.specularIntensityMap = source.specularIntensityMap;
    this.specularColor.copy(source.specularColor);
    this.specularColorMap = source.specularColorMap;
    return this;
  }
}
