import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { calcSurfacePoint } from "./NURBSUtils";

/** A NURBS surface using control points with optional z and weight coordinates. */
export class NURBSSurface {
  degree1: number;
  degree2: number;
  knots1: number[];
  knots2: number[];
  controlPoints: Vector4[][];

  constructor(
    degree1: number,
    degree2: number,
    knots1: number[],
    knots2: number[],
    controlPoints: (Vector2 | Vector3 | Vector4)[][],
  ) {
    this.degree1 = degree1;
    this.degree2 = degree2;
    this.knots1 = knots1;
    this.knots2 = knots2;
    this.controlPoints = [];
    const len1 = knots1.length - degree1 - 1;
    const len2 = knots2.length - degree2 - 1;
    for (let i = 0; i < len1; ++i) {
      this.controlPoints[i] = [];
      for (let j = 0; j < len2; ++j) {
        const point = controlPoints[i][j];
        this.controlPoints[i][j] = new Vector4(
          point.x,
          point.y,
          "z" in point ? point.z : undefined,
          "w" in point ? point.w : undefined,
        );
      }
    }
  }

  /** Writes the point at interpolation factors t1 and t2 to target. */
  getPoint(t1: number, t2: number, target: Vector3): void {
    const u = this.knots1[0] + t1 * (this.knots1[this.knots1.length - 1] - this.knots1[0]);
    const v = this.knots2[0] + t2 * (this.knots2[this.knots2.length - 1] - this.knots2[0]);
    calcSurfacePoint(this.degree1, this.degree2, this.knots1, this.knots2, this.controlPoints, u, v, target);
  }
}
