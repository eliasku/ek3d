import type { Texture } from "../textures/Texture";
import { Material } from "./Material";
import { Combine } from "../constants";
import { Color } from "../math/Color";
import { Euler } from "../math/Euler";

export type MeshBasicMaterialParameters = Omit<Partial<MeshBasicMaterial>, "color"> & {
  color?: Color | number | string;
};
/**
 * A material for drawing geometries in a simple shaded (flat or wireframe) way.
 *
 * This material is not affected by lights.
 *
 * @demo scenes/material-browser.html#MeshBasicMaterial
 */
export class MeshBasicMaterial extends Material {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isMeshBasicMaterial: boolean = true;

  /**
   * Color of the material.
   *
   * @default (1,1,1)
   */
  color: Color = new Color(0xffffff); // diffuse
  /**
   * The rotation of the environment map in radians.
   *
   * @default (0,0,0)
   */
  envMapRotation: Euler = new Euler();
  /**
   * The color map. May optionally include an alpha channel, typically combined
   * with {@link Material#transparent} or {@link Material#alphaTest}. The texture map
   * color is modulated by the diffuse `color`.
   *
   * `map` represents color data, and the texture must be assigned a
   * {@link Texture#colorSpace}. Most `map` textures set
   * `texture.colorSpace = ColorSpace.SRGB`.
   *
   * @default null
   */
  map: Texture | null = null;
  /**
   * The light map. Requires a second set of UVs.
   *
   * `lightMap` represents pre-baked illuminance data, and the texture must be assigned
   * a {@link Texture#colorSpace}. Most `lightMap` textures set
   * `texture.colorSpace = ColorSpace.LinearSRGB` and use float-type formats
   * such as `.exr` or `.hdr`.
   *
   * @default null
   */
  lightMap: Texture | null = null;
  /**
   * Intensity of the baked light.
   *
   * @default 1
   */
  lightMapIntensity: number = 1.0;
  /**
   * The red channel of this texture is used as the ambient occlusion map.
   * Requires a second set of UVs.
   *
   * `aoMap` represents non-color data. Any texture assigned must have
   * `texture.colorSpace = ColorSpace.No` (default).
   *
   * @default null
   */
  aoMap: Texture | null = null;
  /**
   * Intensity of the ambient occlusion effect. Range is `[0,1]`, where `0`
   * disables ambient occlusion. Where intensity is `1` and the AO map's
   * red channel is also `1`, ambient light is fully occluded on a surface.
   *
   * @default 1
   */
  aoMapIntensity: number = 1.0;
  /**
   * Specular map used by the material.
   *
   * `specularMap` represents color data, and the texture must be assigned a
   * {@link Texture#colorSpace}. Most `specularMap` textures set
   * `texture.colorSpace = ColorSpace.SRGB`.
   *
   * @default null
   */
  specularMap: Texture | null = null;
  /**
   * The alpha map is a grayscale texture that controls the opacity across the
   * surface (black: fully transparent; white: fully opaque).
   *
   * Only the color of the texture is used, ignoring the alpha channel if one
   * exists. For RGB and RGBA textures, the renderer will use the green channel
   * when sampling this texture due to the extra bit of precision provided for
   * green in DXT-compressed and uncompressed RGB 565 formats. Luminance-only and
   * luminance/alpha textures will also still work as expected.
   *
   * `alphaMap` represents non-color data. Any texture assigned must have
   * `texture.colorSpace = ColorSpace.No` (default).
   *
   * @default null
   */
  alphaMap: Texture | null = null;
  /**
   * The environment map.
   *
   * `envMap` represents luminance data, and the texture must be assigned
   * a {@link Texture#colorSpace}. Most `envMap` textures set
   * `texture.colorSpace = ColorSpace.LinearSRGB` and use float-type formats
   * such as `.exr` or `.hdr`.
   *
   * @default null
   */
  envMap: Texture | null = null;
  /**
   * How to combine the result of the surface's color with the environment map, if any.
   *
   * When set to `Combine.Mix`, the {@link MeshBasicMaterial#reflectivity} is used to
   * blend between the two colors.
   *
   * @default Combine.Multiply
   */
  combine: Combine = Combine.Multiply;
  /**
   * How much the environment map affects the surface.
   * The valid range is between `0` (no reflections) and `1` (full reflections).
   *
   * @default 1
   */
  reflectivity: number = 1;
  /**
   * The index of refraction (IOR) of air (approximately 1) divided by the
   * index of refraction of the material. It is used with environment mapping
   * modes {@link Mapping.CubeRefraction} and {@link Mapping.EquirectangularRefraction}.
   * The refraction ratio should not exceed `1`.
   *
   * @default 0.98
   */
  refractionRatio: number = 0.98;
  /**
   * Renders the geometry as a wireframe.
   *
   * @default false
   */
  wireframe: boolean = false;
  /**
   * Controls the thickness of the wireframe.
   *
   * Can only be used with {@link SVGRenderer}.
   *
   * @default 1
   */
  wireframeLinewidth: number = 1;
  /**
   * Defines appearance of wireframe ends.
   *
   * Can only be used with {@link SVGRenderer}.
   *
   * @default 'round'
   */
  wireframeLinecap: string = "round";
  /**
   * Defines appearance of wireframe joints.
   *
   * Can only be used with {@link SVGRenderer}.
   *
   * @default 'round'
   */
  wireframeLinejoin: string = "round";
  /**
   * Whether the material is affected by fog or not.
   *
   * @default true
   */
  fog: boolean = true;

  /**
   * Constructs a new mesh basic material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshBasicMaterialParameters) {
    super();
    this.type = "MeshBasicMaterial";
    this.setValues(parameters);
  }
  clone(): MeshBasicMaterial {
    return new MeshBasicMaterial().copy(this);
  }
  copy(source: MeshBasicMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.wireframeLinecap = source.wireframeLinecap;
    this.wireframeLinejoin = source.wireframeLinejoin;
    this.fog = source.fog;
    return this;
  }
}
