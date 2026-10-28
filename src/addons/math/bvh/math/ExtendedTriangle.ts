import { Triangle } from "../../../../math/Triangle";
import { Vector3 } from "../../../../math/Vector3";
import { Vector2 } from "../../../../math/Vector2";
import { Line3 } from "../../../../math/Line3";
import { Plane } from "../../../../math/Plane";
import type { Sphere } from "../../../../math/Sphere";
import { SeparatingAxisBounds } from "./SeparatingAxisBounds";
import { closestPointsSegmentToSegment, sphereIntersectTriangle } from "./MathUtilities";

const componentKeys = ["x", "y", "z"] as const;
const ZERO_EPSILON = 1e-15;
const ZERO_EPSILON_SQR = ZERO_EPSILON * ZERO_EPSILON;
function isNearZero(value: number) {
  return Math.abs(value) < ZERO_EPSILON;
}

/**
 * An extended version of three' Triangle class. A variety of derivative values are cached on
 * the object to accelerate the intersection functions. `.needsUpdate` must be set to true when
 * modifying the triangle parameters.
 */
export class ExtendedTriangle extends Triangle {
  isExtendedTriangle: boolean;
  satAxes: Vector3[];
  satBounds: SeparatingAxisBounds[];
  points: Vector3[];
  plane: Plane;
  isDegenerateIntoSegment: boolean;
  isDegenerateIntoPoint: boolean;
  degenerateSegment: Line3;
  needsUpdate: boolean;

  constructor(...args: ConstructorParameters<typeof Triangle>) {
    super(...args);

    this.isExtendedTriangle = true;
    this.satAxes = Array.from({ length: 4 }, () => new Vector3());
    this.satBounds = Array.from({ length: 4 }, () => new SeparatingAxisBounds());
    this.points = [this.a, this.b, this.c];
    this.plane = new Plane();
    this.isDegenerateIntoSegment = false;
    this.isDegenerateIntoPoint = false;
    this.degenerateSegment = new Line3();

    /**
     * Indicates that the triangle fields have changed so cached variables to accelerate other
     * function execution can be updated. Must be set to true after modifying the triangle
     * `a`, `b`, `c` fields.
     */
    this.needsUpdate = true;
  }

  /**
   * Returns whether the triangle intersects the given sphere.
   */
  intersectsSphere(sphere: Sphere) {
    return sphereIntersectTriangle(sphere, this);
  }

  update() {
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const points = this.points;

    const satAxes = this.satAxes;
    const satBounds = this.satBounds;

    const axis0 = satAxes[0];
    const sab0 = satBounds[0];
    this.getNormal(axis0);
    sab0.setFromPoints(axis0, points);

    const axis1 = satAxes[1];
    const sab1 = satBounds[1];
    axis1.subVectors(a, b);
    sab1.setFromPoints(axis1, points);

    const axis2 = satAxes[2];
    const sab2 = satBounds[2];
    axis2.subVectors(b, c);
    sab2.setFromPoints(axis2, points);

    const axis3 = satAxes[3];
    const sab3 = satBounds[3];
    axis3.subVectors(c, a);
    sab3.setFromPoints(axis3, points);

    const lengthAB = axis1.length();
    const lengthBC = axis2.length();
    const lengthCA = axis3.length();

    this.isDegenerateIntoPoint = false;
    this.isDegenerateIntoSegment = false;

    if (lengthAB < ZERO_EPSILON) {
      if (lengthBC < ZERO_EPSILON || lengthCA < ZERO_EPSILON) {
        this.isDegenerateIntoPoint = true;
      } else {
        this.isDegenerateIntoSegment = true;
        this.degenerateSegment.start.copy(a);
        this.degenerateSegment.end.copy(c);
      }
    } else if (lengthBC < ZERO_EPSILON) {
      if (lengthCA < ZERO_EPSILON) {
        this.isDegenerateIntoPoint = true;
      } else {
        this.isDegenerateIntoSegment = true;
        this.degenerateSegment.start.copy(b);
        this.degenerateSegment.end.copy(a);
      }
    } else if (lengthCA < ZERO_EPSILON) {
      this.isDegenerateIntoSegment = true;
      this.degenerateSegment.start.copy(c);
      this.degenerateSegment.end.copy(b);
    }

    this.plane.setFromNormalAndCoplanarPoint(axis0, a);

    this.needsUpdate = false;
  }

  closestPointToSegment(segment: Line3, target1: Vector3 | null = null, target2: Vector3 | null = null) {
    const { start, end } = segment;
    const points = this.points;
    let distSq;
    let closestDistanceSq = Infinity;

    // check the triangle edges
    for (let i = 0; i < 3; i++) {
      const nexti = (i + 1) % 3;
      _closestPointToSegment_edge.start.copy(points[i]);
      _closestPointToSegment_edge.end.copy(points[nexti]);

      closestPointsSegmentToSegment(
        _closestPointToSegment_edge,
        segment,
        _closestPointToSegment_point1,
        _closestPointToSegment_point2,
      );

      distSq = _closestPointToSegment_point1.distanceToSquared(_closestPointToSegment_point2);
      if (distSq < closestDistanceSq) {
        closestDistanceSq = distSq;
        if (target1) target1.copy(_closestPointToSegment_point1);
        if (target2) target2.copy(_closestPointToSegment_point2);
      }
    }

    // check end points
    this.closestPointToPoint(start, _closestPointToSegment_point1);
    distSq = start.distanceToSquared(_closestPointToSegment_point1);
    if (distSq < closestDistanceSq) {
      closestDistanceSq = distSq;
      if (target1) target1.copy(_closestPointToSegment_point1);
      if (target2) target2.copy(start);
    }

    this.closestPointToPoint(end, _closestPointToSegment_point1);
    distSq = end.distanceToSquared(_closestPointToSegment_point1);
    if (distSq < closestDistanceSq) {
      closestDistanceSq = distSq;
      if (target1) target1.copy(_closestPointToSegment_point1);
      if (target2) target2.copy(end);
    }

    return Math.sqrt(closestDistanceSq);
  }

  intersectsTriangle(otherTriangle: Triangle, target: Line3 | null = null, suppressLog = false) {
    if (this.needsUpdate) {
      this.update();
    }

    let other: ExtendedTriangle;
    if (isExtendedTriangle(otherTriangle)) {
      other = otherTriangle;
      if (other.needsUpdate) other.update();
    } else {
      _intersectsTriangle_saTri2.copy(otherTriangle);
      _intersectsTriangle_saTri2.update();
      other = _intersectsTriangle_saTri2;
    }

    const res = _intersectsTriangle_handleDegenerateCases(this, other, target, suppressLog);
    if (res !== undefined) {
      return res;
    }

    const plane1 = this.plane;
    const plane2 = other.plane;

    let a1Dist = plane2.distanceToPoint(this.a);
    let b1Dist = plane2.distanceToPoint(this.b);
    let c1Dist = plane2.distanceToPoint(this.c);

    if (isNearZero(a1Dist)) a1Dist = 0;

    if (isNearZero(b1Dist)) b1Dist = 0;

    if (isNearZero(c1Dist)) c1Dist = 0;

    const a1b1Dist = a1Dist * b1Dist;
    const a1c1Dist = a1Dist * c1Dist;
    if (a1b1Dist > 0 && a1c1Dist > 0) {
      return false;
    }

    let a2Dist = plane1.distanceToPoint(other.a);
    let b2Dist = plane1.distanceToPoint(other.b);
    let c2Dist = plane1.distanceToPoint(other.c);

    if (isNearZero(a2Dist)) a2Dist = 0;

    if (isNearZero(b2Dist)) b2Dist = 0;

    if (isNearZero(c2Dist)) c2Dist = 0;

    const a2b2Dist = a2Dist * b2Dist;
    const a2c2Dist = a2Dist * c2Dist;
    if (a2b2Dist > 0 && a2c2Dist > 0) {
      return false;
    }

    _intersectsTriangle_dir1.copy(plane1.normal);
    _intersectsTriangle_dir2.copy(plane2.normal);
    const intersectionLine = _intersectsTriangle_dir1.cross(_intersectsTriangle_dir2);

    let componentIndex = 0;
    let maxComponent = Math.abs(intersectionLine.x);
    const comp1 = Math.abs(intersectionLine.y);
    if (comp1 > maxComponent) {
      maxComponent = comp1;
      componentIndex = 1;
    }

    const comp2 = Math.abs(intersectionLine.z);
    if (comp2 > maxComponent) {
      componentIndex = 2;
    }

    const key = componentKeys[componentIndex];
    const a1Proj = this.a[key];
    const b1Proj = this.b[key];
    const c1Proj = this.c[key];

    const a2Proj = other.a[key];
    const b2Proj = other.b[key];
    const c2Proj = other.c[key];

    if (
      _intersectsTriangle_findIntersectionLineBounds(
        this,
        a1Proj,
        b1Proj,
        c1Proj,
        a1b1Dist,
        a1c1Dist,
        a1Dist,
        b1Dist,
        c1Dist,
        _intersectsTriangle_bounds1,
        _intersectsTriangle_edge1,
      )
    ) {
      return _intersectsTriangle_coplanarIntersectsTriangle(this, other, target, suppressLog);
    }

    if (
      _intersectsTriangle_findIntersectionLineBounds(
        other,
        a2Proj,
        b2Proj,
        c2Proj,
        a2b2Dist,
        a2c2Dist,
        a2Dist,
        b2Dist,
        c2Dist,
        _intersectsTriangle_bounds2,
        _intersectsTriangle_edge2,
      )
    ) {
      return _intersectsTriangle_coplanarIntersectsTriangle(this, other, target, suppressLog);
    }

    if (_intersectsTriangle_bounds1.y < _intersectsTriangle_bounds1.x) {
      const tmp = _intersectsTriangle_bounds1.y;
      _intersectsTriangle_bounds1.y = _intersectsTriangle_bounds1.x;
      _intersectsTriangle_bounds1.x = tmp;

      _intersectsTriangle_tempPoint.copy(_intersectsTriangle_edge1.start);
      _intersectsTriangle_edge1.start.copy(_intersectsTriangle_edge1.end);
      _intersectsTriangle_edge1.end.copy(_intersectsTriangle_tempPoint);
    }

    if (_intersectsTriangle_bounds2.y < _intersectsTriangle_bounds2.x) {
      const tmp = _intersectsTriangle_bounds2.y;
      _intersectsTriangle_bounds2.y = _intersectsTriangle_bounds2.x;
      _intersectsTriangle_bounds2.x = tmp;

      _intersectsTriangle_tempPoint.copy(_intersectsTriangle_edge2.start);
      _intersectsTriangle_edge2.start.copy(_intersectsTriangle_edge2.end);
      _intersectsTriangle_edge2.end.copy(_intersectsTriangle_tempPoint);
    }

    if (
      _intersectsTriangle_bounds1.y < _intersectsTriangle_bounds2.x ||
      _intersectsTriangle_bounds2.y < _intersectsTriangle_bounds1.x
    ) {
      return false;
    }

    if (target) {
      if (_intersectsTriangle_bounds2.x > _intersectsTriangle_bounds1.x) {
        target.start.copy(_intersectsTriangle_edge2.start);
      } else {
        target.start.copy(_intersectsTriangle_edge1.start);
      }

      if (_intersectsTriangle_bounds2.y < _intersectsTriangle_bounds1.y) {
        target.end.copy(_intersectsTriangle_edge2.end);
      } else {
        target.end.copy(_intersectsTriangle_edge1.end);
      }
    }

    return true;
  }

  distanceToPoint(point: Vector3) {
    this.closestPointToPoint(point, _distanceToPoint_target);
    return point.distanceTo(_distanceToPoint_target);
  }

  distanceToTriangle(other: Triangle, target1: Vector3 | null = null, target2: Vector3 | null = null) {
    const lineTarget = target1 || target2 ? _distanceToTriangle_line1 : null;
    // `intersectsTriangle` returns a zero-length segment for coplanar
    // intersecting triangles, which is fine for our purposes here. We
    // don't need the segment itself in this function. So we can suppress
    // the warning about coplanar triangles.
    if (this.intersectsTriangle(other, lineTarget, true)) {
      if (lineTarget) {
        if (target1) lineTarget.getCenter(target1);
        if (target2) lineTarget.getCenter(target2);
      }

      return 0;
    }

    let closestDistanceSq = Infinity;

    // check all point distances
    for (let i = 0; i < 3; i++) {
      let dist;
      const field = _distanceToTriangle_cornerFields[i];
      const otherVec = other[field];
      this.closestPointToPoint(otherVec, _distanceToTriangle_point);

      dist = otherVec.distanceToSquared(_distanceToTriangle_point);

      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1) target1.copy(_distanceToTriangle_point);
        if (target2) target2.copy(otherVec);
      }

      const thisVec = this[field];
      other.closestPointToPoint(thisVec, _distanceToTriangle_point);

      dist = thisVec.distanceToSquared(_distanceToTriangle_point);

      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1) target1.copy(thisVec);
        if (target2) target2.copy(_distanceToTriangle_point);
      }
    }

    for (let i = 0; i < 3; i++) {
      const f11 = _distanceToTriangle_cornerFields[i];
      const f12 = _distanceToTriangle_cornerFields[(i + 1) % 3];
      _distanceToTriangle_line1.set(this[f11], this[f12]);
      for (let i2 = 0; i2 < 3; i2++) {
        const f21 = _distanceToTriangle_cornerFields[i2];
        const f22 = _distanceToTriangle_cornerFields[(i2 + 1) % 3];
        _distanceToTriangle_line2.set(other[f21], other[f22]);

        closestPointsSegmentToSegment(
          _distanceToTriangle_line1,
          _distanceToTriangle_line2,
          _distanceToTriangle_point,
          _distanceToTriangle_point2,
        );

        const dist = _distanceToTriangle_point.distanceToSquared(_distanceToTriangle_point2);
        if (dist < closestDistanceSq) {
          closestDistanceSq = dist;
          if (target1) target1.copy(_distanceToTriangle_point);
          if (target2) target2.copy(_distanceToTriangle_point2);
        }
      }
    }

    return Math.sqrt(closestDistanceSq);
  }
}

const _closestPointToSegment_point1 = /* @__PURE__ */ new Vector3();
const _closestPointToSegment_point2 = /* @__PURE__ */ new Vector3();
const _closestPointToSegment_edge = /* @__PURE__ */ new Line3();

const _intersectsTriangle_saTri2 = /* @__PURE__ */ new ExtendedTriangle();
const _intersectsTriangle_cachedSatBounds = /* @__PURE__ */ new SeparatingAxisBounds();
const _intersectsTriangle_cachedSatBounds2 = /* @__PURE__ */ new SeparatingAxisBounds();
const _intersectsTriangle_tmpVec = /* @__PURE__ */ new Vector3();
const _intersectsTriangle_dir1 = /* @__PURE__ */ new Vector3();
const _intersectsTriangle_dir2 = /* @__PURE__ */ new Vector3();
const _intersectsTriangle_tempDir = /* @__PURE__ */ new Vector3();
const _intersectsTriangle_edge1 = /* @__PURE__ */ new Line3();
const _intersectsTriangle_edge2 = /* @__PURE__ */ new Line3();
const _intersectsTriangle_tempPoint = /* @__PURE__ */ new Vector3();
const _intersectsTriangle_bounds1 = /* @__PURE__ */ new Vector2();
const _intersectsTriangle_bounds2 = /* @__PURE__ */ new Vector2();

function _intersectsTriangle_coplanarIntersectsTriangle(
  self: ExtendedTriangle,
  other: ExtendedTriangle,
  target: Line3 | null,
  suppressLog: boolean,
) {
  // Perform separating axis intersection test only for coplanar triangles
  // There should be at least one non-degenerate triangle when calling this
  // Otherwise we won't know the plane normal
  const planeNormal = _intersectsTriangle_tmpVec;
  if (!self.isDegenerateIntoPoint && !self.isDegenerateIntoSegment) {
    planeNormal.copy(self.plane.normal);
  } else {
    planeNormal.copy(other.plane.normal);
  }

  const satBounds1 = self.satBounds;
  const satAxes1 = self.satAxes;
  for (let i = 1; i < 4; i++) {
    const sb = satBounds1[i];
    const sa = satAxes1[i];
    _intersectsTriangle_cachedSatBounds.setFromPoints(sa, other.points);
    if (sb.isSeparated(_intersectsTriangle_cachedSatBounds)) return false;

    _intersectsTriangle_tempDir.copy(planeNormal).cross(sa);
    _intersectsTriangle_cachedSatBounds.setFromPoints(_intersectsTriangle_tempDir, self.points);
    _intersectsTriangle_cachedSatBounds2.setFromPoints(_intersectsTriangle_tempDir, other.points);
    if (_intersectsTriangle_cachedSatBounds.isSeparated(_intersectsTriangle_cachedSatBounds2)) return false;
  }

  const satBounds2 = other.satBounds;
  const satAxes2 = other.satAxes;
  for (let i = 1; i < 4; i++) {
    const sb = satBounds2[i];
    const sa = satAxes2[i];
    _intersectsTriangle_cachedSatBounds.setFromPoints(sa, self.points);
    if (sb.isSeparated(_intersectsTriangle_cachedSatBounds)) return false;

    _intersectsTriangle_tempDir.crossVectors(planeNormal, sa);
    _intersectsTriangle_cachedSatBounds.setFromPoints(_intersectsTriangle_tempDir, self.points);
    _intersectsTriangle_cachedSatBounds2.setFromPoints(_intersectsTriangle_tempDir, other.points);
    if (_intersectsTriangle_cachedSatBounds.isSeparated(_intersectsTriangle_cachedSatBounds2)) return false;
  }

  if (target) {
    // TODO find two points that intersect on the edges and make that the result
    if (!suppressLog) {
      console.warn(
        "ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0.",
      );
    }

    target.start.set(0, 0, 0);
    target.end.set(0, 0, 0);
  }

  return true;
}

function _intersectsTriangle_findSingleBounds(
  a: Vector3,
  b: Vector3,
  c: Vector3,
  aProj: number,
  bProj: number,
  cProj: number,
  aDist: number,
  bDist: number,
  cDist: number,
  bounds: Vector2,
  edge: Line3,
) {
  let t = aDist / (aDist - bDist);
  bounds.x = aProj + (bProj - aProj) * t;
  edge.start.subVectors(b, a).multiplyScalar(t).add(a);

  t = aDist / (aDist - cDist);
  bounds.y = aProj + (cProj - aProj) * t;
  edge.end.subVectors(c, a).multiplyScalar(t).add(a);
}

/**
 * Calculates intersection segment of a triangle with intersection line.
 * Intersection line is snapped to its biggest component.
 * And triangle points are passed as a projection on that component.
 */
function _intersectsTriangle_findIntersectionLineBounds(
  self: ExtendedTriangle,
  aProj: number,
  bProj: number,
  cProj: number,
  abDist: number,
  acDist: number,
  aDist: number,
  bDist: number,
  cDist: number,
  bounds: Vector2,
  edge: Line3,
) {
  if (abDist > 0) {
    // then bcDist < 0
    _intersectsTriangle_findSingleBounds(
      self.c,
      self.a,
      self.b,
      cProj,
      aProj,
      bProj,
      cDist,
      aDist,
      bDist,
      bounds,
      edge,
    );
  } else if (acDist > 0) {
    _intersectsTriangle_findSingleBounds(
      self.b,
      self.a,
      self.c,
      bProj,
      aProj,
      cProj,
      bDist,
      aDist,
      cDist,
      bounds,
      edge,
    );
  } else if (bDist * cDist > 0 || aDist != 0) {
    _intersectsTriangle_findSingleBounds(
      self.a,
      self.b,
      self.c,
      aProj,
      bProj,
      cProj,
      aDist,
      bDist,
      cDist,
      bounds,
      edge,
    );
  } else if (bDist != 0) {
    _intersectsTriangle_findSingleBounds(
      self.b,
      self.a,
      self.c,
      bProj,
      aProj,
      cProj,
      bDist,
      aDist,
      cDist,
      bounds,
      edge,
    );
  } else if (cDist != 0) {
    _intersectsTriangle_findSingleBounds(
      self.c,
      self.a,
      self.b,
      cProj,
      aProj,
      bProj,
      cDist,
      aDist,
      bDist,
      bounds,
      edge,
    );
  } else {
    return true;
  }

  return false;
}

function _intersectsTriangle_intersectTriangleSegment(
  triangle: ExtendedTriangle,
  degenerateTriangle: ExtendedTriangle,
  target: Line3 | null,
  suppressLog: boolean,
) {
  const segment = degenerateTriangle.degenerateSegment;
  const startDist = triangle.plane.distanceToPoint(segment.start);
  const endDist = triangle.plane.distanceToPoint(segment.end);
  if (isNearZero(startDist)) {
    if (isNearZero(endDist)) {
      return _intersectsTriangle_coplanarIntersectsTriangle(triangle, degenerateTriangle, target, suppressLog);
    } else {
      // Is this fine to modify target even if there might be no intersection?
      if (target) {
        target.start.copy(segment.start);
        target.end.copy(segment.start);
      }

      return triangle.containsPoint(segment.start);
    }
  } else if (isNearZero(endDist)) {
    if (target) {
      target.start.copy(segment.end);
      target.end.copy(segment.end);
    }

    return triangle.containsPoint(segment.end);
  } else {
    if (triangle.plane.intersectLine(segment, _intersectsTriangle_tmpVec) != null) {
      if (target) {
        target.start.copy(_intersectsTriangle_tmpVec);
        target.end.copy(_intersectsTriangle_tmpVec);
      }

      return triangle.containsPoint(_intersectsTriangle_tmpVec);
    } else {
      return false;
    }
  }
}

function _intersectsTriangle_intersectTrianglePoint(
  triangle: ExtendedTriangle,
  degenerateTriangle: ExtendedTriangle,
  target: Line3 | null,
) {
  const point = degenerateTriangle.a;

  if (isNearZero(triangle.plane.distanceToPoint(point)) && triangle.containsPoint(point)) {
    if (target) {
      target.start.copy(point);
      target.end.copy(point);
    }

    return true;
  } else {
    return false;
  }
}

function _intersectsTriangle_intersectSegmentPoint(
  segmentTri: ExtendedTriangle,
  pointTri: ExtendedTriangle,
  target: Line3 | null,
) {
  const segment = segmentTri.degenerateSegment;
  const point = pointTri.a;

  segment.closestPointToPoint(point, true, _intersectsTriangle_tmpVec);

  if (point.distanceToSquared(_intersectsTriangle_tmpVec) < ZERO_EPSILON_SQR) {
    if (target) {
      target.start.copy(point);
      target.end.copy(point);
    }

    return true;
  } else {
    return false;
  }
}

function _intersectsTriangle_handleDegenerateCases(
  self: ExtendedTriangle,
  other: ExtendedTriangle,
  target: Line3 | null,
  suppressLog: boolean,
) {
  if (self.isDegenerateIntoSegment) {
    if (other.isDegenerateIntoSegment) {
      // TODO: replace with Line.distanceSqToLine3 after r179
      const segment1 = self.degenerateSegment;
      const segment2 = other.degenerateSegment;
      const delta1 = _intersectsTriangle_dir1;
      const delta2 = _intersectsTriangle_dir2;
      segment1.delta(delta1);
      segment2.delta(delta2);
      const startDelta = _intersectsTriangle_tmpVec.subVectors(segment2.start, segment1.start);

      const denom = delta1.x * delta2.y - delta1.y * delta2.x;
      if (isNearZero(denom)) {
        return false;
      }

      const t = (startDelta.x * delta2.y - startDelta.y * delta2.x) / denom;
      const u = -(delta1.x * startDelta.y - delta1.y * startDelta.x) / denom;

      if (t < 0 || t > 1 || u < 0 || u > 1) {
        return false;
      }

      const z1 = segment1.start.z + delta1.z * t;
      const z2 = segment2.start.z + delta2.z * u;

      if (isNearZero(z1 - z2)) {
        if (target) {
          target.start.copy(segment1.start).addScaledVector(delta1, t);
          target.end.copy(segment1.start).addScaledVector(delta1, t);
        }

        return true;
      } else {
        return false;
      }
    } else if (other.isDegenerateIntoPoint) {
      return _intersectsTriangle_intersectSegmentPoint(self, other, target);
    } else {
      return _intersectsTriangle_intersectTriangleSegment(other, self, target, suppressLog);
    }
  } else if (self.isDegenerateIntoPoint) {
    if (other.isDegenerateIntoPoint) {
      if (other.a.distanceToSquared(self.a) < ZERO_EPSILON_SQR) {
        if (target) {
          target.start.copy(self.a);
          target.end.copy(self.a);
        }

        return true;
      } else {
        return false;
      }
    } else if (other.isDegenerateIntoSegment) {
      return _intersectsTriangle_intersectSegmentPoint(other, self, target);
    } else {
      return _intersectsTriangle_intersectTrianglePoint(other, self, target);
    }
  } else {
    if (other.isDegenerateIntoPoint) {
      return _intersectsTriangle_intersectTrianglePoint(self, other, target);
    } else if (other.isDegenerateIntoSegment) {
      return _intersectsTriangle_intersectTriangleSegment(self, other, target, suppressLog);
    } /* else this is a general triangle-traingle case, so return undefined */
  }
}

const _distanceToPoint_target = /* @__PURE__ */ new Vector3();

const _distanceToTriangle_point = /* @__PURE__ */ new Vector3();
const _distanceToTriangle_point2 = /* @__PURE__ */ new Vector3();
const _distanceToTriangle_cornerFields = ["a", "b", "c"] as const;
const _distanceToTriangle_line1 = /* @__PURE__ */ new Line3();
const _distanceToTriangle_line2 = /* @__PURE__ */ new Line3();

function isExtendedTriangle(triangle: Triangle): triangle is ExtendedTriangle {
  return "isExtendedTriangle" in triangle && Boolean(triangle.isExtendedTriangle);
}
