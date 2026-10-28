import type { CurveFactory } from "./Curve";
import type { CurveJSON } from "./Curve";
import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import { LineCurve } from "../curves/LineCurve";
import { LineCurve3 } from "../curves/LineCurve3";
import { Curve } from "./Curve";
/**
 * A base class extending {@link Curve}. `CurvePath` is simply an
 * array of connected curves, but retains the API of a curve.
 *
 */
export class CurvePath<T extends Vector2 | Vector3 = Vector2 | Vector3> extends Curve<T | null> {
  curves: Curve<T | null>[];
  autoClose: boolean;
  cacheLengths: number[] | null;

  /**
   * Constructs a new curve path.
   */
  constructor() {
    super();
    this.type = "CurvePath";
    /**
     * An array of curves defining the
     * path.
     *
     */
    this.curves = [];
    /**
     * Whether the path should automatically be closed
     * by a line curve.
     *
     * @default false
     */
    this.autoClose = false;
    /**
     * An internal cache that holds precomputed curve length values.
     *
     * @private
     * @default null
     */
    this.cacheLengths = null;
  }
  /**
   * Adds a curve to this curve path.
   *
   * @param curve - The curve to add.
   */
  add(curve: Curve<T | null>): void;
  add(curve?: any) {
    this.curves.push(curve);
  }
  /**
   * Adds a line curve to close the path.
   *
   * @return A reference to this curve path.
   */
  closePath(): CurvePath {
    // Add a line curve if start and end of lines are not connected
    const startPoint = this.curves[0].getPoint(0);
    const endPoint = this.curves[this.curves.length - 1].getPoint(1);
    if (!startPoint!.equals(endPoint as Vector2 & Vector3)) {
      const lineType = (startPoint as any).isVector2 === true ? LineCurve : LineCurve3;
      this.curves.push(
        new (lineType as unknown as new (v1: T | null, v2: T | null) => Curve<T | null>)(endPoint, startPoint),
      );
    }
    return this;
  }
  /**
   * This method returns a vector in 2D or 3D space (depending on the curve definitions)
   * for the given interpolation factor.
   *
   * @param t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve. It can be a 2D or 3D vector depending on the curve definition.
   */
  getPoint(t: number, optionalTarget?: T): T | null {
    // To get accurate point with reference to
    // entire path distance at time t,
    // following has to be done:
    // 1. Length of each sub path have to be known
    // 2. Locate and identify type of curve
    // 3. Get t for the curve
    // 4. Return curve.getPointAt(t')
    const d = t * this.getLength();
    const curveLengths = this.getCurveLengths();
    let i = 0;
    // To think about boundaries points.
    while (i < curveLengths.length) {
      if (curveLengths[i] >= d) {
        const diff = curveLengths[i] - d;
        const curve = this.curves[i];
        const segmentLength = curve.getLength();
        const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength;
        return curve.getPointAt(u, optionalTarget);
      }
      i++;
    }
    return null;
    // loop where sum != 0, sum > d , sum+1 <d
  }
  getLength() {
    // We cannot use the default THREE.Curve getPoint() with getLength() because in
    // THREE.Curve, getLength() depends on getPoint() but in THREE.CurvePath
    // getPoint() depends on getLength
    const lens = this.getCurveLengths();
    return lens[lens.length - 1];
  }
  updateArcLengths() {
    // cacheLengths must be recalculated.
    this.needsUpdate = true;
    this.cacheLengths = null;
    this.getCurveLengths();
  }
  /**
   * Returns list of cumulative curve lengths of the defined curves.
   *
   * @return The curve lengths.
   */
  getCurveLengths(): number[] {
    // Compute lengths and cache them
    // We cannot overwrite getLengths() because UtoT mapping uses it.
    // We use cache values if curves and cache array are same length
    if (this.cacheLengths && this.cacheLengths.length === this.curves.length) {
      return this.cacheLengths;
    }
    // Get length of sub-curve
    // Push sums into cached array
    const lengths: any[] = [];
    let sums = 0;
    for (let i = 0, l = this.curves.length; i < l; i++) {
      sums += this.curves[i].getLength();
      lengths.push(sums);
    }
    this.cacheLengths = lengths;
    return lengths;
  }
  getSpacedPoints(divisions: number = 40): (T | null)[] {
    const points: any[] = [];
    for (let i = 0; i <= divisions; i++) {
      points.push(this.getPoint(i / divisions));
    }
    if (this.autoClose) {
      points.push(points[0]);
    }
    return points;
  }
  getPoints(divisions: number = 12): T[] {
    const points: any[] = [];
    let last: any;
    for (let i = 0, curves = this.curves; i < curves.length; i++) {
      const curve = curves[i];
      const resolution = (curve as any).isEllipseCurve
        ? divisions * 2
        : (curve as any).isLineCurve || (curve as any).isLineCurve3
          ? 1
          : (curve as any).isSplineCurve
            ? divisions * (curve as any).points.length
            : divisions;
      const pts = curve.getPoints(resolution);
      for (let j = 0; j < pts.length; j++) {
        const point = pts[j];
        if (last && last.equals(point)) continue; // ensures no consecutive points are duplicates
        points.push(point);
        last = point;
      }
    }
    if (this.autoClose && points.length > 1 && !points[points.length - 1].equals(points[0])) {
      points.push(points[0]);
    }
    return points;
  }
  copy(source: this): this {
    super.copy(source);
    this.curves = [];
    for (let i = 0, l = source.curves.length; i < l; i++) {
      const curve = source.curves[i];
      this.curves.push(curve.clone());
    }
    this.autoClose = source.autoClose;
    this.cacheLengths = null;
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.autoClose = this.autoClose;
    data.curves = [];
    for (let i = 0, l = this.curves.length; i < l; i++) {
      const curve = this.curves[i];
      data.curves.push(curve.toJSON());
    }
    return data;
  }
  fromJSON(json: CurveJSON, createCurve: CurveFactory<T>): this {
    super.fromJSON(json);
    this.autoClose = json.autoClose!;
    this.curves = [];
    for (let i = 0, l = json.curves!.length; i < l; i++) {
      const curve = json.curves![i];
      this.curves.push(createCurve(curve));
    }
    this.cacheLengths = null;
    return this;
  }
}
