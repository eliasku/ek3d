import type { Texture } from "../textures/Texture";
import { NormalMap } from "../constants";
import { Material } from "./Material";
import { Vector2 } from "../math/Vector2";

export type MeshNormalMaterialParameters = Partial<
  Pick<
    MeshNormalMaterial,
    | "isMeshNormalMaterial"
    | "type"
    | "bumpMap"
    | "bumpScale"
    | "normalMap"
    | "normalMapType"
    | "normalScale"
    | "displacementMap"
    | "displacementScale"
    | "displacementBias"
    | "wireframe"
    | "wireframeLinewidth"
    | "flatShading"
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
>;
/**
 * A material that maps the normal vectors to RGB colors.
 *
 * @demo scenes/material-browser.html#MeshNormalMaterial
 */
export class MeshNormalMaterial extends Material {
  isMeshNormalMaterial: boolean;

  bumpMap: Texture | null;
  bumpScale: number;
  normalMap: Texture | null;
  normalMapType: NormalMap;
  normalScale: Vector2;
  displacementMap: Texture | null;
  displacementScale: number;
  displacementBias: number;
  wireframe: boolean;
  wireframeLinewidth: number;
  flatShading: boolean;

  /**
   * Constructs a new mesh normal material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshNormalMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isMeshNormalMaterial = true;
    this.type = "MeshNormalMaterial";
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
     * Renders the geometry as a wireframe.
     *
     * @default false
     */
    this.wireframe = false;
    /**
     * Controls the thickness of the wireframe.
     *
     * WebGL ignores this property and always render
     * 1 pixel wide lines.
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
    this.setValues(parameters);
  }
  copy(source: MeshNormalMaterial): this {
    super.copy(source);
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    return this;
  }
}
