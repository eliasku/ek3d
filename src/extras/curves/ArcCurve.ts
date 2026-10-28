import { EllipseCurve } from "./EllipseCurve";
/**
 * A curve representing an arc.
 *
 */
export class ArcCurve extends EllipseCurve {
  isArcCurve: boolean;

  /**
   * Constructs a new arc curve.
   *
   * @param [aX=0] - The X center of the ellipse.
   * @param [aY=0] - The Y center of the ellipse.
   * @param [aRadius=1] - The radius of the ellipse in the x direction.
   * @param [aStartAngle=0] - The start angle of the curve in radians starting from the positive X axis.
   * @param [aEndAngle=Math.PI*2] - The end angle of the curve in radians starting from the positive X axis.
   * @param [aClockwise=false] - Whether the ellipse is drawn clockwise or not.
   */
  constructor(
    aX?: number,
    aY?: number,
    aRadius?: number,
    aStartAngle?: number,
    aEndAngle?: number,
    aClockwise?: boolean,
  ) {
    super(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isArcCurve = true;
    this.type = "ArcCurve";
  }
}
