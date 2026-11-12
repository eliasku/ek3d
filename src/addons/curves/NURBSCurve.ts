import { Curve } from "../../extras/core/Curve";
import type { CurveJSON } from "../../extras/core/Curve";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { calcBSplinePoint, calcNURBSDerivatives } from "./NURBSUtils";

/** Serialized NURBS curve state, matching the JSON written by {@link NURBSCurve#toJSON}. */
export interface NURBSCurveJSON extends CurveJSON {
  degree: number;
  knots: number[];
  controlPoints: number[][];
  startKnot: number;
  endKnot: number;
}

/**
 * This class represents a NURBS curve.
 *
 * Implementation is based on `(x, y [, z=0 [, w=1]])` control points with `w=weight`.
 *
 * ```typescript
 * import { NURBSCurve } from 'ek3d/addons/curves/NURBSCurve';
 * import { Vector4 } from 'ek3d/math/Vector4';
 *
 * const curve = new NURBSCurve( 2, [ 0, 0, 0, 1, 1, 1 ], [
 *   new Vector4( 0, 0, 0, 1 ),
 *   new Vector4( 5, 10, 0, 1 ),
 *   new Vector4( 10, 0, 0, 1 )
 * ] );
 *
 * const points = curve.getPoints( 50 );
 * ```
 */
export class NURBSCurve extends Curve<Vector3> {
  /** The NURBS degree. */
  degree: number;

  /** The knots as a flat array of numbers. */
  knots: number[];

  /** An array of control points. */
  controlPoints: Vector4[];

  /** Index of the start knot into the `knots` array. */
  startKnot: number;

  /** Index of the end knot into the `knots` array. */
  endKnot: number;

  /**
   * Constructs a new NURBS curve.
   *
   * @param degree - The NURBS degree.
   * @param knots - The knots as a flat array of numbers.
   * @param controlPoints - An array holding control points.
   * @param [startKnot] - Index of the start knot into the `knots` array.
   * @param [endKnot] - Index of the end knot into the `knots` array.
   */
  constructor(
    degree: number,
    knots: number[],
    controlPoints: (Vector3 | Vector4)[],
    startKnot?: number,
    endKnot?: number,
  ) {
    super();

    const knotsLength = knots !== undefined && knots !== null ? knots.length - 1 : 0;
    const pointsLength = controlPoints !== undefined && controlPoints !== null ? controlPoints.length : 0;

    this.degree = degree;
    this.knots = knots;
    this.controlPoints = [];
    this.startKnot = startKnot || 0;
    this.endKnot = endKnot || knotsLength;

    for (let i = 0; i < pointsLength; ++i) {
      // ensure Vector4 for control points
      const point = controlPoints[i];
      const weight = point instanceof Vector4 ? point.w : 1;
      this.controlPoints[i] = new Vector4(point.x, point.y, point.z, weight);
    }
  }

  /**
   * This method returns a vector in 3D space for the given interpolation factor.
   *
   * @param t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve.
   */
  override getPoint(t: number, optionalTarget: Vector3 = new Vector3()): Vector3 {
    const point = optionalTarget;

    const u = this.knots[this.startKnot] + t * (this.knots[this.endKnot] - this.knots[this.startKnot]); // linear mapping t->u

    // following results in (wx, wy, wz, w) homogeneous point
    const hpoint = calcBSplinePoint(this.degree, this.knots, this.controlPoints, u);

    if (hpoint.w !== 1.0) {
      // project to 3D space: (wx, wy, wz, w) -> (x, y, z, 1)
      hpoint.divideScalar(hpoint.w);
    }

    return point.set(hpoint.x, hpoint.y, hpoint.z);
  }

  /**
   * Returns a unit vector tangent for the given interpolation factor.
   *
   * @param t - The interpolation factor.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The tangent vector.
   */
  override getTangent(t: number, optionalTarget: Vector3 = new Vector3()): Vector3 {
    const tangent = optionalTarget;

    const u = this.knots[0] + t * (this.knots[this.knots.length - 1] - this.knots[0]);
    const ders = calcNURBSDerivatives(this.degree, this.knots, this.controlPoints, u, 1);
    tangent.copy(ders[1]).normalize();

    return tangent;
  }

  override copy(source: this): this {
    super.copy(source);

    this.degree = source.degree;
    this.knots = [...source.knots];
    this.controlPoints = source.controlPoints.map((p) => p.clone());
    this.startKnot = source.startKnot;
    this.endKnot = source.endKnot;

    return this;
  }

  override toJSON(): NURBSCurveJSON {
    const data = super.toJSON() as NURBSCurveJSON;

    data.degree = this.degree;
    data.knots = [...this.knots];
    data.controlPoints = this.controlPoints.map((p) => [p.x, p.y, p.z, p.w]);
    data.startKnot = this.startKnot;
    data.endKnot = this.endKnot;

    return data;
  }

  override fromJSON(json: NURBSCurveJSON): this {
    super.fromJSON(json);

    this.degree = json.degree;
    this.knots = [...json.knots];
    this.controlPoints = json.controlPoints.map((p) => new Vector4(p[0], p[1], p[2], p[3]));
    this.startKnot = json.startKnot;
    this.endKnot = json.endKnot;

    return this;
  }
}
