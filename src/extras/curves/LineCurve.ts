import type { CurveJSON } from "../core/Curve";
import { Vector2 } from "../../math/Vector2";
import { Curve } from "../core/Curve";
/**
 * A curve representing a 2D line segment.
 *
 */
export class LineCurve extends Curve<Vector2> {
  isLineCurve: boolean;

  v1: Vector2;
  v2: Vector2;

  /**
   * Constructs a new line curve.
   *
   * @param [v1] - The start point.
   * @param [v2] - The end point.
   */
  constructor(v1: Vector2 = new Vector2(), v2: Vector2 = new Vector2()) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isLineCurve = true;
    this.type = "LineCurve";
    /**
     * The start point.
     *
     */
    this.v1 = v1;
    /**
     * The end point.
     *
     */
    this.v2 = v2;
  }
  /**
   * Returns a point on the line.
   *
   * @param t - A interpolation factor representing a position on the line. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the line.
   */
  getPoint(t: number, optionalTarget: Vector2 = new Vector2()): Vector2 {
    const point = optionalTarget;
    if (t === 1) {
      point.copy(this.v2);
    } else {
      point.copy(this.v2).sub(this.v1);
      point.multiplyScalar(t).add(this.v1);
    }
    return point;
  }
  // Line curve is linear, so we can overwrite default getPointAt
  getPointAt(u: number, optionalTarget?: Vector2) {
    return this.getPoint(u, optionalTarget);
  }
  getTangent(t: number, optionalTarget: Vector2 = new Vector2()) {
    return optionalTarget.subVectors(this.v2, this.v1).normalize();
  }
  getTangentAt(u: number, optionalTarget?: Vector2) {
    return this.getTangent(u, optionalTarget);
  }
  copy(source: this): this {
    super.copy(source);
    this.v1.copy(source.v1);
    this.v2.copy(source.v2);
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.v1 = this.v1.toArray();
    data.v2 = this.v2.toArray();
    return data;
  }
  fromJSON(json: CurveJSON): this {
    super.fromJSON(json);
    this.v1.fromArray(json.v1!);
    this.v2.fromArray(json.v2!);
    return this;
  }
}
