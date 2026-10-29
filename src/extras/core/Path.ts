import type { CurveFactory } from "./Curve";
import type { CurveJSON } from "./Curve";
import { Vector2 } from "../../math/Vector2";
import { CurvePath } from "./CurvePath";
import { EllipseCurve } from "../curves/EllipseCurve";
import { SplineCurve } from "../curves/SplineCurve";
import { CubicBezierCurve } from "../curves/CubicBezierCurve";
import { QuadraticBezierCurve } from "../curves/QuadraticBezierCurve";
import { LineCurve } from "../curves/LineCurve";
/**
 * A 2D path representation. The class provides methods for creating paths
 * and contours of 2D shapes similar to the 2D Canvas API.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Path } from 'ek3d/extras/core/Path';
 * import { BufferGeometry } from 'ek3d/core/BufferGeometry';
 * import { LineBasicMaterial } from 'ek3d/materials/LineBasicMaterial';
 * import { Line } from 'ek3d/objects/Line';
 *
 * const scene = new Scene();
 *
 * const path = new Path();
 *
 * path.lineTo( 0, 0.8 );
 * path.quadraticCurveTo( 0, 1, 0.2, 1 );
 * path.lineTo( 1, 1 );
 *
 * const points = path.getPoints();
 *
 * const geometry = new BufferGeometry().setFromPoints( points );
 * const material = new LineBasicMaterial( { color: 0xffffff } );
 *
 * const line = new Line( geometry, material );
 * scene.add( line );
 * ```
 *
 */
export class Path extends CurvePath<Vector2> {
  currentPoint: Vector2;

  /**
   * Constructs a new path.
   *
   * @param [points] - An array of 2D points defining the path.
   */
  constructor(points?: Vector2[]) {
    super();
    this.type = "Path";
    /**
     * The current offset of the path. Any new curve added will start here.
     *
     */
    this.currentPoint = new Vector2();
    if (points!) {
      this.setFromPoints(points!);
    }
  }
  /**
   * Creates a path from the given list of points. The points are added
   * to the path as instances of {@link LineCurve}.
   *
   * @param points - An array of 2D points.
   * @return A reference to this path.
   */
  setFromPoints(points: Vector2[]): this {
    this.moveTo(points[0].x, points[0].y);
    for (let i = 1, l = points.length; i < l; i++) {
      this.lineTo(points[i].x, points[i].y);
    }
    return this;
  }
  /**
   * Moves {@link Path#currentPoint} to the given point.
   *
   * @param x - The x coordinate.
   * @param y - The y coordinate.
   * @return A reference to this path.
   */
  moveTo(x: number, y: number): this {
    this.currentPoint.set(x, y); // TODO consider referencing vectors instead of copying?
    return this;
  }
  /**
   * Adds an instance of {@link LineCurve} to the path by connecting
   * the current point with the given one.
   *
   * @param x - The x coordinate of the end point.
   * @param y - The y coordinate of the end point.
   * @return A reference to this path.
   */
  lineTo(x: number, y: number): this {
    const curve = new LineCurve(this.currentPoint.clone(), new Vector2(x, y));
    this.curves.push(curve);
    this.currentPoint.set(x, y);
    return this;
  }
  /**
   * Adds an instance of {@link QuadraticBezierCurve} to the path by connecting
   * the current point with the given one.
   *
   * @param aCPx - The x coordinate of the control point.
   * @param aCPy - The y coordinate of the control point.
   * @param aX - The x coordinate of the end point.
   * @param aY - The y coordinate of the end point.
   * @return A reference to this path.
   */
  quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number): this {
    const curve = new QuadraticBezierCurve(this.currentPoint.clone(), new Vector2(aCPx, aCPy), new Vector2(aX, aY));
    this.curves.push(curve);
    this.currentPoint.set(aX, aY);
    return this;
  }
  /**
   * Adds an instance of {@link CubicBezierCurve} to the path by connecting
   * the current point with the given one.
   *
   * @param aCP1x - The x coordinate of the first control point.
   * @param aCP1y - The y coordinate of the first control point.
   * @param aCP2x - The x coordinate of the second control point.
   * @param aCP2y - The y coordinate of the second control point.
   * @param aX - The x coordinate of the end point.
   * @param aY - The y coordinate of the end point.
   * @return A reference to this path.
   */
  bezierCurveTo(aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number): this {
    const curve = new CubicBezierCurve(
      this.currentPoint.clone(),
      new Vector2(aCP1x, aCP1y),
      new Vector2(aCP2x, aCP2y),
      new Vector2(aX, aY),
    );
    this.curves.push(curve);
    this.currentPoint.set(aX, aY);
    return this;
  }
  /**
   * Adds an instance of {@link SplineCurve} to the path by connecting
   * the current point with the given list of points.
   *
   * @param pts - An array of points in 2D space.
   * @return A reference to this path.
   */
  splineThru(pts: Vector2[]): this {
    const npts = [this.currentPoint.clone()].concat(pts);
    const curve = new SplineCurve(npts);
    this.curves.push(curve);
    this.currentPoint.copy(pts[pts.length - 1]);
    return this;
  }
  /**
   * Adds an arc as an instance of {@link EllipseCurve} to the path, positioned relative
   * to the current point.
   *
   * @param [aX=0] - The x coordinate of the center of the arc offsetted from the previous curve.
   * @param [aY=0] - The y coordinate of the center of the arc offsetted from the previous curve.
   * @param [aRadius=1] - The radius of the arc.
   * @param [aStartAngle=0] - The start angle in radians.
   * @param [aEndAngle=Math.PI*2] - The end angle in radians.
   * @param [aClockwise=false] - Whether to sweep the arc clockwise or not.
   * @return A reference to this path.
   */
  arc(
    aX?: number,
    aY?: number,
    aRadius?: number,
    aStartAngle?: number,
    aEndAngle?: number,
    aClockwise?: boolean,
  ): this {
    const x0 = this.currentPoint.x;
    const y0 = this.currentPoint.y;
    this.absarc(aX! + x0, aY! + y0, aRadius!, aStartAngle!, aEndAngle!, aClockwise!);
    return this;
  }
  /**
   * Adds an absolutely positioned arc as an instance of {@link EllipseCurve} to the path.
   *
   * @param [aX=0] - The x coordinate of the center of the arc.
   * @param [aY=0] - The y coordinate of the center of the arc.
   * @param [aRadius=1] - The radius of the arc.
   * @param [aStartAngle=0] - The start angle in radians.
   * @param [aEndAngle=Math.PI*2] - The end angle in radians.
   * @param [aClockwise=false] - Whether to sweep the arc clockwise or not.
   * @return A reference to this path.
   */
  absarc(
    aX?: number,
    aY?: number,
    aRadius?: number,
    aStartAngle?: number,
    aEndAngle?: number,
    aClockwise?: boolean,
  ): this {
    this.absellipse(aX!, aY!, aRadius!, aRadius!, aStartAngle!, aEndAngle!, aClockwise!);
    return this;
  }
  /**
   * Adds an ellipse as an instance of {@link EllipseCurve} to the path, positioned relative
   * to the current point
   *
   * @param [aX=0] - The x coordinate of the center of the ellipse offsetted from the previous curve.
   * @param [aY=0] - The y coordinate of the center of the ellipse offsetted from the previous curve.
   * @param [xRadius=1] - The radius of the ellipse in the x axis.
   * @param [yRadius=1] - The radius of the ellipse in the y axis.
   * @param [aStartAngle=0] - The start angle in radians.
   * @param [aEndAngle=Math.PI*2] - The end angle in radians.
   * @param [aClockwise=false] - Whether to sweep the ellipse clockwise or not.
   * @param [aRotation=0] - The rotation angle of the ellipse in radians, counterclockwise from the positive X axis.
   * @return A reference to this path.
   */
  ellipse(
    aX?: number,
    aY?: number,
    xRadius?: number,
    yRadius?: number,
    aStartAngle?: number,
    aEndAngle?: number,
    aClockwise?: boolean,
    aRotation?: number,
  ): this {
    const x0 = this.currentPoint.x;
    const y0 = this.currentPoint.y;
    this.absellipse(aX! + x0, aY! + y0, xRadius!, yRadius!, aStartAngle!, aEndAngle!, aClockwise!, aRotation!);
    return this;
  }
  /**
   * Adds an absolutely positioned ellipse as an instance of {@link EllipseCurve} to the path.
   *
   * @param [aX=0] - The x coordinate of the absolute center of the ellipse.
   * @param [aY=0] - The y coordinate of the absolute center of the ellipse.
   * @param [xRadius=1] - The radius of the ellipse in the x axis.
   * @param [yRadius=1] - The radius of the ellipse in the y axis.
   * @param [aStartAngle=0] - The start angle in radians.
   * @param [aEndAngle=Math.PI*2] - The end angle in radians.
   * @param [aClockwise=false] - Whether to sweep the ellipse clockwise or not.
   * @param [aRotation=0] - The rotation angle of the ellipse in radians, counterclockwise from the positive X axis.
   * @return A reference to this path.
   */
  absellipse(
    aX?: number,
    aY?: number,
    xRadius?: number,
    yRadius?: number,
    aStartAngle?: number,
    aEndAngle?: number,
    aClockwise?: boolean,
    aRotation?: number,
  ): this {
    const curve = new EllipseCurve(aX!, aY!, xRadius!, yRadius!, aStartAngle!, aEndAngle!, aClockwise!, aRotation!);
    if (this.curves.length > 0) {
      // if a previous curve is present, attempt to join
      const firstPoint = curve.getPoint(0);
      if (!firstPoint.equals(this.currentPoint)) {
        this.lineTo(firstPoint.x, firstPoint.y);
      }
    }
    this.curves.push(curve);
    const lastPoint = curve.getPoint(1);
    this.currentPoint.copy(lastPoint);
    return this;
  }
  copy(source: this): this {
    super.copy(source);
    this.currentPoint.copy(source.currentPoint);
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.currentPoint = this.currentPoint.toArray();
    return data;
  }
  fromJSON(json: CurveJSON, createCurve: CurveFactory<Vector2>): this {
    super.fromJSON(json, createCurve);
    this.currentPoint.fromArray(json.currentPoint!);
    return this;
  }
}
