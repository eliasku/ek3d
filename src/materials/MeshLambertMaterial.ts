import type { Texture } from "../textures/Texture";
import { Combine, NormalMap } from "../constants";
import { Material } from "./Material";
import { Vector2 } from "../math/Vector2";
import { Color } from "../math/Color";
import { Euler } from "../math/Euler";

export type MeshLambertMaterialParameters = Omit<Partial<MeshLambertMaterial>, "color" | "emissive"> & {
  color?: Color | number | string;
  emissive?: Color | number | string;
};
/**
 * A material for non-shiny surfaces, without specular highlights.
 *
 * The material uses a non-physically based [Lambertian](https://en.wikipedia.org/wiki/Lambertian_reflectance)
 * model for calculating reflectance. This can simulate some surfaces (such
 * as untreated wood or stone) well, but cannot simulate shiny surfaces with
 * specular highlights (such as varnished wood). `MeshLambertMaterial` uses per-fragment
 * shading.
 *
 * Due to the simplicity of the reflectance and illumination models,
 * performance will be greater when using this material over the
 * {@link MeshPhongMaterial}, {@link MeshStandardMaterial} or
 * {@link MeshPhysicalMaterial}, at the cost of some graphical accuracy.
 *
 * @demo scenes/material-browser.html#MeshLambertMaterial
 */
export class MeshLambertMaterial extends Material {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isMeshLambertMaterial: boolean = true;

  /**
   * Color of the material.
   *
   * @default (1,1,1)
   */
  color: Color = new Color(0xffffff); // diffuse
  /**
   * Emissive (light) color of the material, essentially a solid color
   * unaffected by other lighting.
   *
   * @default (0,0,0)
   */
  emissive: Color = new Color(0x000000);
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
   * Intensity of the emissive light. Modulates the emissive color.
   *
   * @default 1
   */
  emissiveIntensity: number = 1.0;
  /**
   * Set emissive (glow) map. The emissive map color is modulated by the
   * emissive color and the emissive intensity. If you have an emissive map,
   * be sure to set the emissive color to something other than black.
   *
   * `emissiveMap` represents color data, and the texture must be assigned a
   * {@link Texture#colorSpace}. Most `emissiveMap` textures set
   * `texture.colorSpace = ColorSpace.SRGB`.
   *
   * @default null
   */
  emissiveMap: Texture | null = null;
  /**
   * The texture to create a bump map. The black and white values map to the
   * perceived depth in relation to the lights. Bump doesn't actually affect
   * the geometry of the object, only the lighting. If a normal map is defined
   * this will be ignored.
   *
   * `bumpMap` represents non-color data. Any texture assigned must have
   * `texture.colorSpace = ColorSpace.No` (default).
   *
   * @default null
   */
  bumpMap: Texture | null = null;
  /**
   * How much the bump map affects the material. Typical range is `[0,1]`.
   *
   * @default 1
   */
  bumpScale: number = 1;
  /**
   * The texture to create a normal map. The RGB values affect the surface
   * normal for each pixel fragment and change the way the color is lit. Normal
   * maps do not change the actual shape of the surface, only the lighting. In
   * case the material has a normal map authored using the left handed
   * convention, the `y` component of `normalScale` should be negated to compensate
   * for the different handedness.
   *
   * `normalMap` represents non-color data. Any texture assigned must have
   * `texture.colorSpace = ColorSpace.No` (default).
   *
   * @default null
   */
  normalMap: Texture | null = null;
  /**
   * The type of normal map.
   *
   * @default NormalMap.TangentSpace
   */
  normalMapType: NormalMap = NormalMap.TangentSpace;
  /**
   * How much the normal map affects the material. Typical value range is `[0,1]`.
   *
   * @default (1,1)
   */
  normalScale: Vector2 = new Vector2(1, 1);
  /**
   * The displacement map affects the position of the mesh's vertices. Unlike
   * other maps which only affect the light and shade of the material the
   * displaced vertices can cast shadows, block other objects, and otherwise
   * act as real geometry. The displacement texture is an image where the value
   * of each pixel (white being the highest) is mapped against, and
   * repositions, the vertices of the mesh. For best results, pair a
   * displacement map with a matching normal map, since the renderer can
   * not recompute surface normals from the displaced vertices.
   *
   * `displacementMap` represents non-color data. Any texture assigned must have
   * `texture.colorSpace = ColorSpace.No` (default).
   *
   * @default null
   */
  displacementMap: Texture | null = null;
  /**
   * How much the displacement map affects the mesh (where black is no
   * displacement, and white is maximum displacement). Without a displacement
   * map set, this value is not applied.
   *
   * @default 1
   */
  displacementScale: number = 1;
  /**
   * The offset of the displacement map's values on the mesh's vertices.
   * The bias is added to the scaled sample of the displacement map.
   * Without a displacement map set, this value is not applied.
   *
   * @default 0
   */
  displacementBias: number = 0;
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
   * Scales the effect of the environment map by multiplying its color.
   *
   * @default 1
   */
  envMapIntensity: number = 1.0;
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
   * Whether the material is rendered with flat shading or not.
   *
   * @default false
   */
  flatShading: boolean = false;
  /**
   * Whether the material is affected by fog or not.
   *
   * @default true
   */
  fog: boolean = true;

  /**
   * Constructs a new mesh lambert material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshLambertMaterialParameters) {
    super();
    this.type = "MeshLambertMaterial";
    this.setValues(parameters);
  }
  clone(): MeshLambertMaterial {
    return new MeshLambertMaterial().copy(this);
  }
  copy(source: MeshLambertMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.envMapIntensity = source.envMapIntensity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.wireframeLinecap = source.wireframeLinecap;
    this.wireframeLinejoin = source.wireframeLinejoin;
    this.flatShading = source.flatShading;
    this.fog = source.fog;
    return this;
  }
}
