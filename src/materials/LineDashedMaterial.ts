import type { Color } from "../math/Color";
import { LineBasicMaterial } from "./LineBasicMaterial";

export type LineDashedMaterialParameters = Omit<Partial<LineDashedMaterial>, "color"> & {
  color?: Color | number | string;
};
/**
 * A material for rendering line primitives.
 *
 * Materials define the appearance of renderable 3D objects.
 *
 * ```typescript
 * import { LineDashedMaterial } from 'ek3d/materials/LineDashedMaterial';
 *
 * const material = new LineDashedMaterial( {
 * 	color: 0xffffff,
 * 	scale: 1,
 * 	dashSize: 3,
 * 	gapSize: 1,
 * } );
 * ```
 *
 */
export class LineDashedMaterial extends LineBasicMaterial {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isLineDashedMaterial: boolean = true;

  /**
   * The scale of the dashed part of a line.
   *
   * @default 1
   */
  scale: number = 1;
  /**
   * The size of the dash. This is both the gap with the stroke.
   *
   * @default 3
   */
  dashSize: number = 3;
  /**
   * The size of the gap.
   *
   * @default 1
   */
  gapSize: number = 1;

  /**
   * Constructs a new line dashed material.
   *
   * @param [parameters] - An object with one or more properties
   * defining the material's appearance. Any property of the material
   * (including any property from inherited materials) can be passed
   * in here. Color values can be passed any type of value accepted
   * by {@link Color#set}.
   */
  constructor(parameters?: LineDashedMaterialParameters) {
    super();
    this.type = "LineDashedMaterial";
    this.setValues(parameters);
  }
  clone(): LineDashedMaterial {
    return new LineDashedMaterial().copy(this);
  }
  copy(source: LineDashedMaterial): this {
    super.copy(source);
    this.scale = source.scale;
    this.dashSize = source.dashSize;
    this.gapSize = source.gapSize;
    return this;
  }
}
