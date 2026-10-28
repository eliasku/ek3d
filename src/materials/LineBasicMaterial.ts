import type { Texture } from "../textures/Texture";
import { Material } from "./Material";
import { Color } from "../math/Color";

export type LineBasicMaterialParameters = Omit<Partial<LineBasicMaterial>, "color"> & {
  color?: Color | number | string;
};
/**
 * A material for rendering line primitives.
 *
 * Materials define the appearance of renderable 3D objects.
 *
 * ```typescript
 * import { LineBasicMaterial } from 'ek3d/materials/LineBasicMaterial';
 *
 * const material = new LineBasicMaterial( { color: 0xffffff } );
 * ```
 *
 */
export class LineBasicMaterial extends Material {
  isLineBasicMaterial: boolean;

  color: Color;
  map: Texture | null;
  linewidth: number;
  linecap: string;
  linejoin: string;
  fog: boolean;

  /**
   * Constructs a new line basic material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: LineBasicMaterialParameters) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLineBasicMaterial = true;
    this.type = "LineBasicMaterial";
    /**
     * Color of the material.
     *
     * @default (1,1,1)
     */
    this.color = new Color(0xffffff);
    /**
     * Sets the color of the lines using data from a texture. The texture map
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
     * Controls line thickness or lines.
     *
     * Can only be used with {@link SVGRenderer}. WebGL ignores this setting and always render line primitives with a
     * width of one pixel.
     *
     * @default 1
     */
    this.linewidth = 1;
    /**
     * Defines appearance of line ends.
     *
     * Can only be used with {@link SVGRenderer}.
     *
     * @default 'round'
     */
    this.linecap = "round";
    /**
     * Defines appearance of line joints.
     *
     * Can only be used with {@link SVGRenderer}.
     *
     * @default 'round'
     */
    this.linejoin = "round";
    /**
     * Whether the material is affected by fog or not.
     *
     * @default true
     */
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source: LineBasicMaterial): this {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.linewidth = source.linewidth;
    this.linecap = source.linecap;
    this.linejoin = source.linejoin;
    this.fog = source.fog;
    return this;
  }
}
