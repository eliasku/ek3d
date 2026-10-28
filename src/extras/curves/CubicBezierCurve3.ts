import type { CurveJSON } from "../core/Curve";
import { Curve } from "../core/Curve";
import { CubicBezier } from "../core/Interpolations";
import { Vector3 } from "../../math/Vector3";
/**
 * A curve representing a 3D Cubic Bezier curve.
 *
 */
export class CubicBezierCurve3 extends Curve<Vector3> {
  isCubicBezierCurve3: boolean;

  v0: Vector3;
  v1: Vector3;
  v2: Vector3;
  v3: Vector3;

  /**
   * Constructs a new Cubic Bezier curve.
   *
   * @param [v0] - The start point.
   * @param [v1] - The first control point.
   * @param [v2] - The second control point.
   * @param [v3] - The end point.
   */
  constructor(
    v0: Vector3 = new Vector3(),
    v1: Vector3 = new Vector3(),
    v2: Vector3 = new Vector3(),
    v3: Vector3 = new Vector3(),
  ) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCubicBezierCurve3 = true;
    this.type = "CubicBezierCurve3";
    /**
     * The start point.
     *
     */
    this.v0 = v0;
    /**
     * The first control point.
     *
     */
    this.v1 = v1;
    /**
     * The second control point.
     *
     */
    this.v2 = v2;
    /**
     * The end point.
     *
     */
    this.v3 = v3;
  }
  /**
   * Returns a point on the curve.
   *
   * @param t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve.
   */
  getPoint(t: number, optionalTarget: Vector3 = new Vector3()): Vector3 {
    const point = optionalTarget;
    const v0 = this.v0,
      v1 = this.v1,
      v2 = this.v2,
      v3 = this.v3;
    point.set(
      CubicBezier(t, v0.x, v1.x, v2.x, v3.x),
      CubicBezier(t, v0.y, v1.y, v2.y, v3.y),
      CubicBezier(t, v0.z, v1.z, v2.z, v3.z),
    );
    return point;
  }
  copy(source: this): this {
    super.copy(source);
    this.v0.copy(source.v0);
    this.v1.copy(source.v1);
    this.v2.copy(source.v2);
    this.v3.copy(source.v3);
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.v0 = this.v0.toArray();
    data.v1 = this.v1.toArray();
    data.v2 = this.v2.toArray();
    data.v3 = this.v3.toArray();
    return data;
  }
  fromJSON(json: CurveJSON): this {
    super.fromJSON(json);
    this.v0.fromArray(json.v0!);
    this.v1.fromArray(json.v1!);
    this.v2.fromArray(json.v2!);
    this.v3.fromArray(json.v3!);
    return this;
  }
}
