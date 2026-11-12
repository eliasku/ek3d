import type { BufferGeometry } from "../core/BufferGeometry";
import type { Material } from "../materials/Material";
import { Line } from "./Line";
/**
 * A continuous line. This is nearly the same as {@link Line} the only difference
 * is that the last vertex is connected with the first vertex in order to close
 * the line to form a loop.
 *
 */
export class LineLoop<TMaterial extends Material | Material[] = Material | Material[]> extends Line<TMaterial> {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isLineLoop: boolean = true;

  /**
   * Constructs a new line loop.
   *
   * @param geometry - The line geometry.
   * @param material - The line material.
   */
  constructor(geometry: BufferGeometry, material: NoInfer<TMaterial>) {
    super(geometry, material);
    this.type = "LineLoop";
  }
  clone(recursive: boolean = true): LineLoop<TMaterial> {
    return new LineLoop<TMaterial>(this.geometry, this.material).copy(this, recursive);
  }
}
