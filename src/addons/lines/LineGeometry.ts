import type { Float32BufferAttribute } from "../../core/BufferAttribute";
import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import type { Line } from "../../objects/Line";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry";

/** A chain of vertices forming a polyline for Line2. */
export class LineGeometry extends LineSegmentsGeometry {
  isLineGeometry: boolean;

  constructor() {
    super();
    this.isLineGeometry = true;
    this.type = "LineGeometry";
  }

  setPositions(array: Float32Array | number[]): this {
    const length = array.length - 3;
    const points = new Float32Array(2 * length);
    for (let i = 0; i < length; i += 3) {
      points[2 * i] = array[i];
      points[2 * i + 1] = array[i + 1];
      points[2 * i + 2] = array[i + 2];
      points[2 * i + 3] = array[i + 3];
      points[2 * i + 4] = array[i + 4];
      points[2 * i + 5] = array[i + 5];
    }
    super.setPositions(points);
    return this;
  }

  setColors(array: Float32Array | number[]): this {
    const length = array.length - 3;
    const colors = new Float32Array(2 * length);
    for (let i = 0; i < length; i += 3) {
      colors[2 * i] = array[i];
      colors[2 * i + 1] = array[i + 1];
      colors[2 * i + 2] = array[i + 2];
      colors[2 * i + 3] = array[i + 3];
      colors[2 * i + 4] = array[i + 4];
      colors[2 * i + 5] = array[i + 5];
    }
    super.setColors(colors);
    return this;
  }

  setFromPoints(points: (Vector2 | Vector3)[]): this {
    const length = points.length - 1;
    const positions = new Float32Array(6 * length);
    for (let i = 0; i < length; i++) {
      const start = points[i];
      const end = points[i + 1];
      positions[6 * i] = start.x;
      positions[6 * i + 1] = start.y;
      positions[6 * i + 2] = ("z" in start && start.z) || 0;
      positions[6 * i + 3] = end.x;
      positions[6 * i + 4] = end.y;
      positions[6 * i + 5] = ("z" in end && end.z) || 0;
    }
    super.setPositions(positions);
    return this;
  }

  /** The source line geometry must be non-indexed. */
  fromLine(line: Line): this {
    this.setPositions((line.geometry.attributes.position as Float32BufferAttribute).array as Float32Array);
    return this;
  }
}
