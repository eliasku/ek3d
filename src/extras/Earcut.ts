import earcut from "./lib/earcut";
/**
 * An implementation of the earcut polygon triangulation algorithm.
 * The code is a port of [mapbox/earcut](https://github.com/mapbox/earcut).
 *
 * @see https://github.com/mapbox/earcut
 */
export class Earcut {
  /**
   * Triangulates the given shape definition by returning an array of triangles.
   *
   * @param data - An array with 2D points.
   * @param holeIndices - An array with indices defining holes.
   * @param [dim=2] - The number of coordinates per vertex in the input array.
   * @return An array representing the triangulated faces. Each face is defined by three consecutive numbers
   * representing vertex indices.
   */
  static triangulate(data: number[], holeIndices: number[], dim: number = 2): number[] {
    return earcut(data, holeIndices, dim);
  }
}
