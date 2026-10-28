import { clamp } from "../../math/MathUtils";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Matrix4 } from "../../math/Matrix4";
import { warn } from "../../utils";

export interface CurveJSON {
  metadata?: { version: number; type: string; generator: string };
  type: string;
  arcLengthDivisions: number;
  v0?: number[];
  v1?: number[];
  v2?: number[];
  v3?: number[];
  points?: number[][];
  aX?: number;
  aY?: number;
  xRadius?: number;
  yRadius?: number;
  aStartAngle?: number;
  aEndAngle?: number;
  aClockwise?: boolean;
  aRotation?: number;
  closed?: boolean;
  curveType?: "centripetal" | "chordal" | "catmullrom";
  tension?: number;
  autoClose?: boolean;
  curves?: CurveJSON[];
  currentPoint?: number[];
  uuid?: string;
  holes?: CurveJSON[];
  [key: string]: unknown;
}
export type CurveFactory<T extends Vector2 | Vector3 = Vector2 | Vector3> = (json: CurveJSON) => Curve<T | null>;
/**
 * An abstract base class for creating an analytic curve object that contains methods
 * for interpolation.
 *
 * @abstract
 */
export class Curve<T extends Vector2 | Vector3 | null = Vector2 | Vector3> {
  type: string;
  arcLengthDivisions: number;
  needsUpdate: boolean;
  cacheArcLengths: number[] | null;

  /**
   * Constructs a new curve.
   */
  constructor() {
    /**
     * The type property is used for detecting the object type
     * in context of serialization/deserialization.
     *
     * @readonly
     */
    this.type = "Curve";
    /**
     * This value determines the amount of divisions when calculating the
     * cumulative segment lengths of a curve via {@link Curve#getLengths}. To ensure
     * precision when using methods like {@link Curve#getSpacedPoints}, it is
     * recommended to increase the value of this property if the curve is very large.
     *
     * @default 200
     */
    this.arcLengthDivisions = 200;
    /**
     * Must be set to `true` if the curve parameters have changed.
     *
     * @default false
     */
    this.needsUpdate = false;
    /**
     * An internal cache that holds precomputed curve length values.
     *
     * @private
     * @default null
     */
    this.cacheArcLengths = null;
  }
  /**
   * This method returns a vector in 2D or 3D space (depending on the curve definition)
   * for the given interpolation factor.
   *
   * @abstract
   * @param t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve. It can be a 2D or 3D vector depending on the curve definition.
   */
  getPoint(t: number, optionalTarget?: NonNullable<T>): T;
  getPoint(/* t, optionalTarget */): any {
    warn("Curve: .getPoint() not implemented.");
  }
  /**
   * This method returns a vector in 2D or 3D space (depending on the curve definition)
   * for the given interpolation factor. Unlike {@link Curve#getPoint}, this method honors the length
   * of the curve which equidistant samples.
   *
   * @param u - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The position on the curve. It can be a 2D or 3D vector depending on the curve definition.
   */
  getPointAt(u: number, optionalTarget?: NonNullable<T>): T {
    const t = this.getUtoTmapping(u);
    return this.getPoint(t, optionalTarget);
  }
  /**
   * This method samples the curve via {@link Curve#getPoint} and returns an array of points representing
   * the curve shape.
   *
   * @param [divisions=5] - The number of divisions.
   * @return An array holding the sampled curve values. The number of points is `divisions + 1`.
   */
  getPoints(divisions: number = 5): T[] {
    const points: any[] = [];
    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPoint(d / divisions));
    }
    return points;
  }
  // Get sequence of points using getPointAt( u )
  /**
   * This method samples the curve via {@link Curve#getPointAt} and returns an array of points representing
   * the curve shape. Unlike {@link Curve#getPoints}, this method returns equi-spaced points across the entire
   * curve.
   *
   * @param [divisions=5] - The number of divisions.
   * @return An array holding the sampled curve values. The number of points is `divisions + 1`.
   */
  getSpacedPoints(divisions: number = 5): T[] {
    const points: any[] = [];
    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPointAt(d / divisions));
    }
    return points;
  }
  /**
   * Returns the total arc length of the curve.
   *
   * @return The length of the curve.
   */
  getLength(): number {
    const lengths = this.getLengths();
    return lengths[lengths.length - 1];
  }
  /**
   * Returns an array of cumulative segment lengths of the curve.
   *
   * @param [divisions=this.arcLengthDivisions] - The number of divisions.
   * @return An array holding the cumulative segment lengths.
   */
  getLengths(divisions: number = this.arcLengthDivisions): number[] {
    if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
      return this.cacheArcLengths;
    }
    this.needsUpdate = false;
    const cache: any[] = [];
    let current: any,
      last = this.getPoint(0)!;
    let sum = 0;
    cache.push(0);
    for (let p = 1; p <= divisions; p++) {
      current = this.getPoint(p / divisions);
      sum += current.distanceTo(last);
      cache.push(sum);
      last = current;
    }
    this.cacheArcLengths = cache;
    return cache; // { sums: cache, sum: sum }; Sum is in the last element.
  }
  /**
   * Update the cumulative segment distance cache. The method must be called
   * every time curve parameters are changed. If an updated curve is part of a
   * composed curve like {@link CurvePath}, this method must be called on the
   * composed curve, too.
   */
  updateArcLengths() {
    this.needsUpdate = true;
    this.getLengths();
  }
  /**
   * Given an interpolation factor in the range `[0,1]`, this method returns an updated
   * interpolation factor in the same range that can be ued to sample equidistant points
   * from a curve.
   *
   * @param u - The interpolation factor.
   * @param distance - An optional distance on the curve.
   * @return The updated interpolation factor.
   */
  getUtoTmapping(u: number, distance?: number | null): number;
  getUtoTmapping(u: number, distance: any = null): number {
    const arcLengths = this.getLengths();
    let i = 0;
    const il = arcLengths.length;
    let targetArcLength: any; // The targeted u distance value to get
    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }
    // binary search for the index with largest value smaller than target u distance
    let low = 0,
      high = il - 1,
      comparison: any;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats
      comparison = arcLengths[i] - targetArcLength;
      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;
        // DONE
      }
    }
    i = high;
    if (arcLengths[i] === targetArcLength) {
      return i / (il - 1);
    }
    // we could get finer grain at lengths, or use simple interpolation between two points
    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];
    const segmentLength = lengthAfter - lengthBefore;
    // determine where we are between the 'before' and 'after' points
    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
    // add that fractional amount to t
    const t = (i + segmentFraction) / (il - 1);
    return t;
  }
  /**
   * Returns a unit vector tangent for the given interpolation factor.
   * If the derived curve does not implement its tangent derivation,
   * two points a small delta apart will be used to find its gradient
   * which seems to give a reasonable approximation.
   *
   * @param t - The interpolation factor.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The tangent vector.
   */
  getTangent(t: number, optionalTarget?: NonNullable<T>): NonNullable<T> {
    const delta = 0.0001;
    let t1 = t - delta;
    let t2 = t + delta;
    // Capping in case of danger
    if (t1 < 0) t1 = 0;
    if (t2 > 1) t2 = 1;
    const pt1 = this.getPoint(t1)!;
    const pt2 = this.getPoint(t2)!;
    const tangent = optionalTarget || ((pt1 as any).isVector2 ? new Vector2() : new Vector3());
    tangent
      .copy(pt2 as Vector2 & Vector3)
      .sub(pt1 as Vector2 & Vector3)
      .normalize();
    return tangent as NonNullable<T>;
  }
  /**
   * Same as {@link Curve#getTangent} but with equidistant samples.
   *
   * @param u - The interpolation factor.
   * @param [optionalTarget] - The optional target vector the result is written to.
   * @return The tangent vector.
   * @see {@link Curve#getPointAt}
   */
  getTangentAt(u: number, optionalTarget?: NonNullable<T>): NonNullable<T> {
    const t = this.getUtoTmapping(u);
    return this.getTangent(t, optionalTarget);
  }
  /**
   * Generates the Frenet Frames. Requires a curve definition in 3D space. Used
   * in geometries like {@link TubeGeometry} or {@link ExtrudeGeometry}.
   *
   * @param segments - The number of segments.
   * @param [closed=false] - Whether the curve is closed or not.
   * @return The Frenet Frames.
   */
  computeFrenetFrames(
    segments: number,
    closed: boolean = false,
  ): { tangents: Vector3[]; normals: Vector3[]; binormals: Vector3[] } {
    // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf
    const normal = new Vector3();
    const tangents: any[] = [];
    const normals: any[] = [];
    const binormals: any[] = [];
    const vec = new Vector3();
    const mat = new Matrix4();
    // compute the tangent vectors for each segment on the curve
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      tangents[i] = this.getTangentAt(u, new Vector3() as unknown as NonNullable<T>);
    }
    // select an initial normal vector perpendicular to the first tangent vector,
    // and in the direction of the minimum tangent xyz component
    normals[0] = new Vector3();
    binormals[0] = new Vector3();
    let min = Number.MAX_VALUE;
    const tx = Math.abs(tangents[0].x);
    const ty = Math.abs(tangents[0].y);
    const tz = Math.abs((tangents[0] as any).z);
    if (tx <= min) {
      min = tx;
      normal.set(1, 0, 0);
    }
    if (ty <= min) {
      min = ty;
      normal.set(0, 1, 0);
    }
    if (tz <= min) {
      normal.set(0, 0, 1);
    }
    vec.crossVectors(tangents[0], normal).normalize();
    normals[0].crossVectors(tangents[0], vec);
    binormals[0].crossVectors(tangents[0], normals[0]);
    // compute the slowly-varying normal and binormal vectors for each segment on the curve
    for (let i = 1; i <= segments; i++) {
      normals[i] = normals[i - 1].clone();
      binormals[i] = binormals[i - 1].clone();
      vec.crossVectors(tangents[i - 1], tangents[i]);
      if (vec.length() > Number.EPSILON) {
        vec.normalize();
        const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors
        normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
      }
      binormals[i].crossVectors(tangents[i], normals[i]);
    }
    // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same
    if (closed === true) {
      let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
      theta /= segments;
      if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
        theta = -theta;
      }
      for (let i = 1; i <= segments; i++) {
        // twist a little...
        normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
        binormals[i].crossVectors(tangents[i], normals[i]);
      }
    }
    return {
      tangents: tangents,
      normals: normals,
      binormals: binormals,
    };
  }
  /**
   * Returns a new curve with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the values of the given curve to this instance.
   *
   * @param source - The curve to copy.
   * @return A reference to this curve.
   */
  copy(source: this): this {
    this.arcLengthDivisions = source.arcLengthDivisions;
    this.cacheArcLengths = null;
    return this;
  }
  /**
   * Serializes the curve into JSON.
   *
   * @return A JSON object representing the serialized curve.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(): CurveJSON {
    const data: any = {
      metadata: {
        version: 4.7,
        type: "Curve",
        generator: "Curve.toJSON",
      },
    };
    (data as any).arcLengthDivisions = this.arcLengthDivisions;
    (data as any).type = this.type;
    return data;
  }
  /**
   * Deserializes the curve from the given JSON.
   *
   * @param json - The JSON holding the serialized curve.
   * @return A reference to this curve.
   */
  fromJSON(json: CurveJSON, createCurve?: CurveFactory<NonNullable<T>>): this;
  fromJSON(json: CurveJSON): this {
    this.arcLengthDivisions = json.arcLengthDivisions;
    this.cacheArcLengths = null;
    return this;
  }
}
