import type { CurveFactory } from "./Curve";
import type { CurveJSON } from "./Curve";
import type { Vector2 } from "../../math/Vector2";
import { Path } from "./Path";
import { generateUUID } from "../../math/MathUtils";
/**
 * Defines an arbitrary 2d shape plane using paths with optional holes. It
 * can be used with {@link ExtrudeGeometry}, {@link ShapeGeometry}, to get
 * points, or to get triangulated faces.
 *
 * ```typescript
 * import { Shape } from 'ek3d/extras/core/Shape';
 * import { ExtrudeGeometry } from 'ek3d/geometries/ExtrudeGeometry';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 *
 * const heartShape = new Shape();
 *
 * heartShape.moveTo( 25, 25 );
 * heartShape.bezierCurveTo( 25, 25, 20, 0, 0, 0 );
 * heartShape.bezierCurveTo( - 30, 0, - 30, 35, - 30, 35 );
 * heartShape.bezierCurveTo( - 30, 55, - 10, 77, 25, 95 );
 * heartShape.bezierCurveTo( 60, 77, 80, 55, 80, 35 );
 * heartShape.bezierCurveTo( 80, 35, 80, 0, 50, 0 );
 * heartShape.bezierCurveTo( 35, 0, 25, 25, 25, 25 );
 *
 * const extrudeSettings = {
 * 	depth: 8,
 * 	bevelEnabled: true,
 * 	bevelSegments: 2,
 * 	steps: 2,
 * 	bevelSize: 1,
 * 	bevelThickness: 1
 * };
 *
 * const geometry = new ExtrudeGeometry( heartShape, extrudeSettings );
 * const mesh = new Mesh( geometry, new MeshBasicMaterial() );
 * ```
 *
 */
export class Shape extends Path {
  uuid: string;

  holes: Path[];

  /**
   * Constructs a new shape.
   *
   * @param [points] - An array of 2D points defining the shape.
   */
  constructor(points?: Vector2[]) {
    super(points);
    /**
     * The UUID of the shape.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    this.type = "Shape";
    /**
     * Defines the holes in the shape. Hole definitions must use the
     * opposite winding order (CW/CCW) than the outer shape.
     *
     * @readonly
     */
    this.holes = [];
  }
  /**
   * Returns an array representing each contour of the holes
   * as a list of 2D points.
   *
   * @param divisions - The fineness of the result.
   * @return The holes as a series of 2D points.
   */
  getPointsHoles(divisions: number): Vector2[][] {
    const holesPts: any[] = [];
    for (let i = 0, l = this.holes.length; i < l; i++) {
      holesPts[i] = this.holes[i].getPoints(divisions);
    }
    return holesPts;
  }
  // get points of shape and holes (keypoints based on segments parameter)
  /**
   * Returns an object that holds contour data for the shape and its holes as
   * arrays of 2D points.
   *
   * @param divisions - The fineness of the result.
   * @return An object with contour data.
   */
  extractPoints(divisions: number) {
    return {
      shape: this.getPoints(divisions),
      holes: this.getPointsHoles(divisions),
    };
  }
  copy(source: this): this {
    super.copy(source);
    this.holes = [];
    for (let i = 0, l = source.holes.length; i < l; i++) {
      const hole = source.holes[i];
      this.holes.push(hole.clone());
    }
    return this;
  }
  toJSON(): CurveJSON {
    const data = super.toJSON();
    data.uuid = this.uuid;
    data.holes = [];
    for (let i = 0, l = this.holes.length; i < l; i++) {
      const hole = this.holes[i];
      data.holes.push(hole.toJSON());
    }
    return data;
  }
  fromJSON(json: CurveJSON, createCurve: CurveFactory<Vector2>): this {
    super.fromJSON(json, createCurve);
    this.uuid = json.uuid!;
    this.holes = [];
    for (let i = 0, l = json.holes!.length; i < l; i++) {
      const hole = json.holes![i];
      this.holes.push(new Path().fromJSON(hole, createCurve));
    }
    return this;
  }
}
