import { Vector3 } from "../../../../math/Vector3";
import { Matrix4 } from "../../../../math/Matrix4";
import { Line3 } from "../../../../math/Line3";
import type { Box3 } from "../../../../math/Box3";
import type { Triangle } from "../../../../math/Triangle";
import { SeparatingAxisBounds } from "./SeparatingAxisBounds";
import { ExtendedTriangle } from "./ExtendedTriangle";
import { closestPointsSegmentToSegment } from "./MathUtilities";

/**
 * An oriented version of three' Box3 class. A variety of derivative values are cached on the
 * object to accelerate the intersection functions. `.needsUpdate` must be set to true when
 * modifying the box parameters.
 *
 */
export class OrientedBox {
  isOrientedBox: boolean;
  min: Vector3;
  max: Vector3;
  matrix: Matrix4;
  invMatrix: Matrix4;
  points: Vector3[];
  satAxes: Vector3[];
  satBounds: SeparatingAxisBounds[];
  alignedSatBounds: SeparatingAxisBounds[];
  needsUpdate: boolean;

  constructor(min?: Vector3, max?: Vector3, matrix?: Matrix4) {
    this.isOrientedBox = true;

    this.min = new Vector3();

    this.max = new Vector3();

    /**
     * Matrix transformation applied to the box.
     */
    this.matrix = new Matrix4();
    this.invMatrix = new Matrix4();
    this.points = Array.from({ length: 8 }, () => new Vector3());
    this.satAxes = Array.from({ length: 3 }, () => new Vector3());
    this.satBounds = Array.from({ length: 3 }, () => new SeparatingAxisBounds());
    this.alignedSatBounds = Array.from({ length: 3 }, () => new SeparatingAxisBounds());
    /**
     * Indicates that the bounding box fields have changed so cached variables to accelerate
     * other function execution can be updated. Must be set to true after modifying the
     * oriented box `min`, `max`, `matrix` fields.
     */
    this.needsUpdate = false;

    if (min) this.min.copy(min);
    if (max) this.max.copy(max);
    if (matrix) this.matrix.copy(matrix);
  }

  /**
   * Sets the oriented box parameters.
   */
  set(min: Vector3, max: Vector3, matrix: Matrix4) {
    this.min.copy(min);
    this.max.copy(max);
    this.matrix.copy(matrix);
    this.needsUpdate = true;
  }

  copy(other: OrientedBox) {
    this.min.copy(other.min);
    this.max.copy(other.max);
    this.matrix.copy(other.matrix);
    this.needsUpdate = true;
  }

  update() {
    const matrix = this.matrix;
    const min = this.min;
    const max = this.max;

    const points = this.points;
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          const i = ((1 << 0) * x) | ((1 << 1) * y) | ((1 << 2) * z);
          const v = points[i];
          v.x = x ? max.x : min.x;
          v.y = y ? max.y : min.y;
          v.z = z ? max.z : min.z;

          v.applyMatrix4(matrix);
        }
      }
    }

    const satBounds = this.satBounds;
    const satAxes = this.satAxes;
    const minVec = points[0];
    for (let i = 0; i < 3; i++) {
      const axis = satAxes[i];
      const sb = satBounds[i];
      const index = 1 << i;
      const pi = points[index];

      axis.subVectors(minVec, pi);
      sb.setFromPoints(axis, points);
    }

    const alignedSatBounds = this.alignedSatBounds;
    alignedSatBounds[0].setFromPointsField(points, "x");
    alignedSatBounds[1].setFromPointsField(points, "y");
    alignedSatBounds[2].setFromPointsField(points, "z");

    this.invMatrix.copy(this.matrix).invert();
    this.needsUpdate = false;
  }

  intersectsBox(box: Box3) {
    // TODO: should this be doing SAT against the AABB?
    if (this.needsUpdate) {
      this.update();
    }

    const min = box.min;
    const max = box.max;
    const satBounds = this.satBounds;
    const satAxes = this.satAxes;
    const alignedSatBounds = this.alignedSatBounds;

    _intersectsBox_aabbBounds.min = min.x;
    _intersectsBox_aabbBounds.max = max.x;
    if (alignedSatBounds[0].isSeparated(_intersectsBox_aabbBounds)) return false;

    _intersectsBox_aabbBounds.min = min.y;
    _intersectsBox_aabbBounds.max = max.y;
    if (alignedSatBounds[1].isSeparated(_intersectsBox_aabbBounds)) return false;

    _intersectsBox_aabbBounds.min = min.z;
    _intersectsBox_aabbBounds.max = max.z;
    if (alignedSatBounds[2].isSeparated(_intersectsBox_aabbBounds)) return false;

    for (let i = 0; i < 3; i++) {
      const axis = satAxes[i];
      const sb = satBounds[i];
      _intersectsBox_aabbBounds.setFromBox(axis, box);
      if (sb.isSeparated(_intersectsBox_aabbBounds)) return false;
    }

    return true;
  }

  intersectsTriangle(inputTriangle: Triangle) {
    if (this.needsUpdate) {
      this.update();
    }

    let triangle: ExtendedTriangle;
    if (isExtendedTriangle(inputTriangle)) {
      triangle = inputTriangle;
      if (triangle.needsUpdate) triangle.update();
    } else {
      _intersectsTriangle_saTri.copy(inputTriangle);
      _intersectsTriangle_saTri.update();
      triangle = _intersectsTriangle_saTri;
    }

    const satBounds = this.satBounds;
    const satAxes = this.satAxes;

    _intersectsTriangle_pointsArr[0] = triangle.a;
    _intersectsTriangle_pointsArr[1] = triangle.b;
    _intersectsTriangle_pointsArr[2] = triangle.c;

    for (let i = 0; i < 3; i++) {
      const sb = satBounds[i];
      const sa = satAxes[i];
      _intersectsTriangle_cachedSatBounds.setFromPoints(sa, _intersectsTriangle_pointsArr);
      if (sb.isSeparated(_intersectsTriangle_cachedSatBounds)) return false;
    }

    const triSatBounds = triangle.satBounds;
    const triSatAxes = triangle.satAxes;
    const points = this.points;
    for (let i = 0; i < 3; i++) {
      const sb = triSatBounds[i];
      const sa = triSatAxes[i];
      _intersectsTriangle_cachedSatBounds.setFromPoints(sa, points);
      if (sb.isSeparated(_intersectsTriangle_cachedSatBounds)) return false;
    }

    // check crossed axes
    for (let i = 0; i < 3; i++) {
      const sa1 = satAxes[i];
      for (let i2 = 0; i2 < 4; i2++) {
        const sa2 = triSatAxes[i2];
        _intersectsTriangle_cachedAxis.crossVectors(sa1, sa2);
        _intersectsTriangle_cachedSatBounds.setFromPoints(
          _intersectsTriangle_cachedAxis,
          _intersectsTriangle_pointsArr,
        );
        _intersectsTriangle_cachedSatBounds2.setFromPoints(_intersectsTriangle_cachedAxis, points);
        if (_intersectsTriangle_cachedSatBounds.isSeparated(_intersectsTriangle_cachedSatBounds2)) return false;
      }
    }

    return true;
  }

  closestPointToPoint(point: Vector3, target1: Vector3) {
    if (this.needsUpdate) {
      this.update();
    }

    target1.copy(point).applyMatrix4(this.invMatrix).clamp(this.min, this.max).applyMatrix4(this.matrix);

    return target1;
  }

  distanceToPoint(point: Vector3) {
    this.closestPointToPoint(point, _distanceToPoint_target);
    return point.distanceTo(_distanceToPoint_target);
  }

  distanceToBox(box: Box3, threshold = 0, target1: Vector3 | null = null, target2: Vector3 | null = null) {
    if (this.needsUpdate) {
      this.update();
    }

    if (this.intersectsBox(box)) {
      if (target1 || target2) {
        box.getCenter(_distanceToBox_point2);
        this.closestPointToPoint(_distanceToBox_point2, _distanceToBox_point1);
        box.clampPoint(_distanceToBox_point1, _distanceToBox_point2);

        if (target1) target1.copy(_distanceToBox_point1);
        if (target2) target2.copy(_distanceToBox_point2);
      }

      return 0;
    }

    const threshold2 = threshold * threshold;
    const min = box.min;
    const max = box.max;
    const points = this.points;

    // iterate over every edge and compare distances
    let closestDistanceSq = Infinity;

    // check over all these points
    for (let i = 0; i < 8; i++) {
      const p = points[i];
      _distanceToBox_point2.copy(p).clamp(min, max);

      const dist = p.distanceToSquared(_distanceToBox_point2);
      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1) target1.copy(p);
        if (target2) target2.copy(_distanceToBox_point2);

        if (dist < threshold2) return Math.sqrt(dist);
      }
    }

    // generate and check all line segment distances
    let count = 0;
    for (let i = 0; i < 3; i++) {
      for (let i1 = 0; i1 <= 1; i1++) {
        for (let i2 = 0; i2 <= 1; i2++) {
          const nextIndex = (i + 1) % 3;
          const nextIndex2 = (i + 2) % 3;

          // get obb line segments
          const index = (i1 << nextIndex) | (i2 << nextIndex2);
          const index2 = (1 << i) | (i1 << nextIndex) | (i2 << nextIndex2);
          const p1 = points[index];
          const p2 = points[index2];
          const line1 = _distanceToBox_segments1[count];
          line1.set(p1, p2);

          // get aabb line segments
          const f1 = _distanceToBox_xyzFields[i];
          const f2 = _distanceToBox_xyzFields[nextIndex];
          const f3 = _distanceToBox_xyzFields[nextIndex2];
          const line2 = _distanceToBox_segments2[count];
          const start = line2.start;
          const end = line2.end;

          start[f1] = min[f1];
          start[f2] = i1 ? min[f2] : max[f2];
          start[f3] = i2 ? min[f3] : max[f2];

          end[f1] = max[f1];
          end[f2] = i1 ? min[f2] : max[f2];
          end[f3] = i2 ? min[f3] : max[f2];

          count++;
        }
      }
    }

    // check all the other boxes point
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          _distanceToBox_point2.x = x ? max.x : min.x;
          _distanceToBox_point2.y = y ? max.y : min.y;
          _distanceToBox_point2.z = z ? max.z : min.z;

          this.closestPointToPoint(_distanceToBox_point2, _distanceToBox_point1);
          const dist = _distanceToBox_point2.distanceToSquared(_distanceToBox_point1);
          if (dist < closestDistanceSq) {
            closestDistanceSq = dist;
            if (target1) target1.copy(_distanceToBox_point1);
            if (target2) target2.copy(_distanceToBox_point2);

            if (dist < threshold2) return Math.sqrt(dist);
          }
        }
      }
    }

    for (let i = 0; i < 12; i++) {
      const l1 = _distanceToBox_segments1[i];
      for (let i2 = 0; i2 < 12; i2++) {
        const l2 = _distanceToBox_segments2[i2];
        closestPointsSegmentToSegment(l1, l2, _distanceToBox_point1, _distanceToBox_point2);
        const dist = _distanceToBox_point1.distanceToSquared(_distanceToBox_point2);
        if (dist < closestDistanceSq) {
          closestDistanceSq = dist;
          if (target1) target1.copy(_distanceToBox_point1);
          if (target2) target2.copy(_distanceToBox_point2);

          if (dist < threshold2) return Math.sqrt(dist);
        }
      }
    }

    return Math.sqrt(closestDistanceSq);
  }
}

const _intersectsBox_aabbBounds = /* @__PURE__ */ new SeparatingAxisBounds();

const _intersectsTriangle_saTri = /* @__PURE__ */ new ExtendedTriangle();
const _intersectsTriangle_pointsArr: Vector3[] = [];
_intersectsTriangle_pointsArr.length = 3;
const _intersectsTriangle_cachedSatBounds = /* @__PURE__ */ new SeparatingAxisBounds();
const _intersectsTriangle_cachedSatBounds2 = /* @__PURE__ */ new SeparatingAxisBounds();
const _intersectsTriangle_cachedAxis = /* @__PURE__ */ new Vector3();

const _distanceToPoint_target = new Vector3();

const _distanceToBox_xyzFields = ["x", "y", "z"] as const;
const _distanceToBox_segments1 = Array.from({ length: 12 }, () => new Line3());
const _distanceToBox_segments2 = Array.from({ length: 12 }, () => new Line3());

const _distanceToBox_point1 = /* @__PURE__ */ new Vector3();
const _distanceToBox_point2 = /* @__PURE__ */ new Vector3();

function isExtendedTriangle(triangle: Triangle): triangle is ExtendedTriangle {
  return "isExtendedTriangle" in triangle && Boolean(triangle.isExtendedTriangle);
}
