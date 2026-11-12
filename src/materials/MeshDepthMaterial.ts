import type { Texture } from "../textures/Texture";
import { Material } from "./Material";
import { DepthPacking } from "../constants";

export type MeshDepthMaterialParameters = Partial<MeshDepthMaterial>;
/**
 * A material for drawing geometry by depth. Depth is based off of the camera
 * near and far plane. White is nearest, black is farthest.
 *
 * @demo scenes/material-browser.html#MeshDepthMaterial
 */
export class MeshDepthMaterial extends Material {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isMeshDepthMaterial: boolean = true;

  /**
   * Type for depth packing.
   *
   * @default DepthPacking.Basic
   */
  depthPacking: DepthPacking = DepthPacking.Basic;
  /**
   * The color map. May optionally include an alpha channel, typically combined
   * with {@link Material#transparent} or {@link Material#alphaTest}.
   *
   * `map` represents color data, and the texture must be assigned a
   * {@link Texture#colorSpace}. Most `map` textures set
   * `texture.colorSpace = ColorSpace.SRGB`.
   *
   * @default null
   */
  map: Texture | null = null;
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
   * The displacement map affects the position of the mesh's vertices. Unlike
   * other maps which only affect the light and shade of the material the
   * displaced vertices can cast shadows, block other objects, and otherwise
   * act as real geometry. The displacement texture is an image where the value
   * of each pixel (white being the highest) is mapped against, and
   * repositions, the vertices of the mesh.
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
   * Renders the geometry as a wireframe.
   *
   * @default false
   */
  wireframe: boolean = false;
  /**
   * Controls the thickness of the wireframe.
   *
   * WebGL ignores this property and always render
   * 1 pixel wide lines.
   *
   * @default 1
   */
  wireframeLinewidth: number = 1;

  /**
   * Constructs a new mesh depth material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: MeshDepthMaterialParameters) {
    super();
    this.type = "MeshDepthMaterial";
    this.setValues(parameters);
  }
  clone(): MeshDepthMaterial {
    return new MeshDepthMaterial().copy(this);
  }
  copy(source: MeshDepthMaterial): this {
    super.copy(source);
    this.depthPacking = source.depthPacking;
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    return this;
  }
}
