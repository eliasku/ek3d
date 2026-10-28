import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { BufferGeometry } from "../core/BufferGeometry";
import type { Material } from "../materials/Material";
import { Line } from "./Line";
import { Vector3 } from "../math/Vector3";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { warn } from "../utils";
const _start = /*@__PURE__*/ new Vector3();
const _end = /*@__PURE__*/ new Vector3();
/**
 * A series of lines drawn between pairs of vertices.
 *
 */
export class LineSegments<TMaterial extends Material | Material[] = Material | Material[]> extends Line<TMaterial> {
  isLineSegments: boolean;

  /**
   * Constructs a new line segments.
   *
   * @param geometry - The line geometry.
   * @param material - The line material.
   */
  constructor(geometry: BufferGeometry, material: NoInfer<TMaterial>) {
    super(geometry, material);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLineSegments = true;
    this.type = "LineSegments";
  }
  computeLineDistances(): this {
    const geometry = this.geometry;
    // we assume non-indexed geometry
    if (geometry.index === null) {
      const positionAttribute = geometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
      const lineDistances: any[] = [];
      for (let i = 0, l = positionAttribute.count; i < l; i += 2) {
        _start.fromBufferAttribute(positionAttribute, i);
        _end.fromBufferAttribute(positionAttribute, i + 1);
        lineDistances[i] = i === 0 ? 0 : lineDistances[i - 1];
        lineDistances[i + 1] = lineDistances[i] + _start.distanceTo(_end);
      }
      geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
    } else {
      warn("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    }
    return this;
  }
}
