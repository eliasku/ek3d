import type { Texture } from "../textures/Texture";
import { NormalMap } from "../constants";
import { Material } from "./Material";
import { Vector2 } from "../math/Vector2";
import { Color } from "../math/Color";

export type MeshMatcapMaterialParameters = Omit<
  Partial<
    Pick<
      MeshMatcapMaterial,
      | "isMeshMatcapMaterial"
      | "defines"
      | "type"
      | "color"
      | "matcap"
      | "map"
      | "bumpMap"
      | "bumpScale"
      | "normalMap"
      | "normalMapType"
      | "normalScale"
      | "displacementMap"
      | "displacementScale"
      | "displacementBias"
      | "alphaMap"
      | "wireframe"
      | "wireframeLinewidth"
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
    >
  >,
  "color"
> & { color?: Color | number | string };
/**
 * This material is defined by a MatCap (or Lit Sphere) texture, which encodes the
 * material color and shading.
 *
 * `MeshMatcapMaterial` does not respond to lights since the matcap image file encodes
 * baked lighting. It will cast a shadow onto an object that receives shadows
 * (and shadow clipping works), but it will not self-shadow or receive
 * shadows.
 *
 * @demo scenes/material-browser.html#MeshMatcapMaterial
 */
export class MeshMatcapMaterial extends Material {
  isMeshMatcapMaterial: boolean;
  defines: Record<string, string | number | boolean>;

  color: Color;
  matcap: Texture | null;
  map: Texture | null;
  bumpMap: Texture | null;
  bumpScale: number;
  normalMap: Texture | null;
  normalMapType: NormalMap;
  normalScale: Vector2;
  displacementMap: Texture | null;
  displacementScale: number;
  displacementBias: number;
  alphaMap: Texture | null;
  wireframe: boolean;
  wireframeLinewidth: number;
  flatShading: boolean;
  fog: boolean;

  /**
   * Constructs a new mesh matcap material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshMatcapMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isMeshMatcapMaterial = true;
    this.defines = { MATCAP: "" };
    this.type = "MeshMatcapMaterial";
    /**
     * Color of the material.
     *
     * @default (1,1,1)
     */
    this.color = new Color(0xffffff); // diffuse
    /**
     * The matcap map.
     *
     * `matcap` represents luminance data, and the texture must be assigned
     * a {@link Texture#colorSpace}. HDR `matcap` textures (e.g. `.exr`)
     * typically set `texture.colorSpace = ColorSpace.LinearSRGB`, while LDR
     * `matcap` textures (e.g. `.png`, `.jpg`, `.webp`) typically set
     * `texture.colorSpace = ColorSpace.SRGB`.
     *
     * @default null
     */
    this.matcap = null;
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
    this.map = null;
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
    this.bumpMap = null;
    /**
     * How much the bump map affects the material. Typical range is `[0,1]`.
     *
     * @default 1
     */
    this.bumpScale = 1;
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
    this.normalMap = null;
    /**
     * The type of normal map.
     *
     * @default NormalMap.TangentSpace
     */
    this.normalMapType = NormalMap.TangentSpace;
    /**
     * How much the normal map affects the material. Typical value range is `[0,1]`.
     *
     * @default (1,1)
     */
    this.normalScale = new Vector2(1, 1);
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
    this.displacementMap = null;
    /**
     * How much the displacement map affects the mesh (where black is no
     * displacement, and white is maximum displacement). Without a displacement
     * map set, this value is not applied.
     *
     * @default 1
     */
    this.displacementScale = 1;
    /**
     * The offset of the displacement map's values on the mesh's vertices.
     * The bias is added to the scaled sample of the displacement map.
     * Without a displacement map set, this value is not applied.
     *
     * @default 0
     */
    this.displacementBias = 0;
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
    this.alphaMap = null;
    /**
     * Renders the geometry as a wireframe.
     *
     * @default false
     */
    this.wireframe = false;
    /**
     * Controls the thickness of the wireframe.
     *
     * Can only be used with {@link SVGRenderer}.
     *
     * @default 1
     */
    this.wireframeLinewidth = 1;
    /**
     * Whether the material is rendered with flat shading or not.
     *
     * @default false
     */
    this.flatShading = false;
    /**
     * Whether the material is affected by fog or not.
     *
     * @default true
     */
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source: MeshMatcapMaterial): this {
    super.copy(source);
    this.defines = { MATCAP: "" };
    this.color.copy(source.color);
    this.matcap = source.matcap;
    this.map = source.map;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.alphaMap = source.alphaMap;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    this.fog = source.fog;
    return this;
  }
}
