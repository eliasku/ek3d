import type { CurveJSON } from "../core/Curve";
import { Curve } from "../core/Curve";
import { QuadraticBezier } from "../core/Interpolations";
import { Vector2 } from "../../math/Vector2";
/**
 * A curve representing a 2D Quadratic Bezier curve.
 *
 * ```typescript
 * import { QuadraticBezierCurve } from 'ek3d/extras/curves/QuadraticBezierCurve';
 * import { Vector2 } from 'ek3d/math/Vector2';
 * import { BufferGeometry } from 'ek3d/core/BufferGeometry';
 * import { LineBasicMaterial } from 'ek3d/materials/LineBasicMaterial';
 * import { Line } from 'ek3d/objects/Line';
 *
 * const curve = new QuadraticBezierCurve(
 * 	new Vector2( - 10, 0 ),
 * 	new Vector2( 20, 15 ),
 * 	new Vector2( 10, 0 )
 * )
 *
 * const points = curve.getPoints( 50 );
 * const geometry = new BufferGeometry().setFromPoints( points );
 *
 * const material = new LineBasicMaterial( { color: 0xff0000 } );
 *
 * // Create the final object to add to the scene
 * const curveObject = new Line( geometry, material );
 * ```
 *
 */
export class QuadraticBezierCurve extends Curve<Vector2> {
  isQuadraticBezierCurve: boolean;

  v0: Vector2;
  v1: Vector2;
  v2: Vector2;

  /**
   * Constructs a new Quadratic Bezier curve.
   *
   * @param [v0] - The start point.
   * @param [v1] - The control point.
   * @param [v2] - The end point.
   */
  constructor(v0: Vector2 = new Vector2(), v1: Vector2 = new Vector2(), v2: Vector2 = new Vector2()) {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isQuadraticBezierCurve = true;
    this.type = "QuadraticBezierCurve";
    /**
     * The start point.
     *
     */
    this.v0 = v0;
    /**
     * The control point.
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
   * Returns a point on the curve.
   *
   * @param t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve.
   */
  getPoint(t: number, optionalTarget: Vector2 = new Vector2()): Vector2 {
    const point = optionalTarget;
    const v0 = this.v0,
      v1 = this.v1,
      v2 = this.v2;
    point.set(QuadraticBezier(t, v0.x, v1.x, v2.x), QuadraticBezier(t, v0.y, v1.y, v2.y));
    return point;
  }
  copy(source: this): this {
    super.copy(source);
    this.v0.copy(source.v0);
    this.v1.copy(source.v1);
    this.v2.copy(source.v2);
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.v0 = this.v0.toArray();
    data.v1 = this.v1.toArray();
    data.v2 = this.v2.toArray();
    return data;
  }
  fromJSON(json: CurveJSON): this {
    super.fromJSON(json);
    this.v0.fromArray(json.v0!);
    this.v1.fromArray(json.v1!);
    this.v2.fromArray(json.v2!);
    return this;
  }
}
