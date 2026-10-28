import type { Vector2 } from "../math/Vector2";
import { Earcut } from "./Earcut";
/**
 * A class containing utility functions for shapes.
 *
 * @hideconstructor
 */
export class ShapeUtils {
  /**
   * Calculate area of a ( 2D ) contour polygon.
   *
   * @param contour - An array of 2D points.
   * @return The area.
   */
  static area(contour: Vector2[]): number {
    const n = contour.length;
    let a = 0.0;
    for (let p = n - 1, q = 0; q < n; p = q++) {
      a += contour[p].x * contour[q].y - contour[q].x * contour[p].y;
    }
    return a * 0.5;
  }
  /**
   * Returns `true` if the given contour uses a clockwise winding order.
   *
   * @param pts - An array of 2D points defining a polygon.
   * @return Whether the given contour uses a clockwise winding order or not.
   */
  static isClockWise(pts: Vector2[]): boolean {
    return ShapeUtils.area(pts) < 0;
  }
  /**
   * Triangulates the given shape definition.
   *
   * @param contour - An array of 2D points defining the contour.
   * @param holes - An array that holds arrays of 2D points defining the holes.
   * @return An array that holds for each face definition an array with three indices.
   */
  static triangulateShape(contour: Vector2[], holes: Vector2[][]): number[][] {
    const vertices: any[] = []; // flat array of vertices like [ x0,y0, x1,y1, x2,y2, ... ]
    const holeIndices: any[] = []; // array of hole indices
    const faces: any[] = []; // final array of vertex indices like [ [ a,b,d ], [ b,c,d ] ]
    removeDupEndPts(contour);
    addContour(vertices, contour);
    //
    let holeIndex = contour.length;
    holes.forEach(removeDupEndPts);
    for (let i = 0; i < holes.length; i++) {
      holeIndices.push(holeIndex);
      holeIndex += holes[i].length;
      addContour(vertices, holes[i]);
    }
    //
    const triangles = Earcut.triangulate(vertices, holeIndices);
    //
    for (let i = 0; i < triangles.length; i += 3) {
      faces.push(triangles.slice(i, i + 3));
    }
    return faces;
  }
}
function removeDupEndPts(points?: any) {
  const l = points.length;
  if (l > 2 && points[l - 1].equals(points[0])) {
    points.pop();
  }
}
function addContour(vertices?: any, contour?: any) {
  for (let i = 0; i < contour.length; i++) {
    vertices.push(contour[i].x);
    vertices.push(contour[i].y);
  }
}
