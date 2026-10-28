import { Vector3 } from "../../../../math/Vector3";
import type { Box3 } from "../../../../math/Box3";

export class SeparatingAxisBounds {
  min: number;
  max: number;

  constructor() {
    this.min = Infinity;
    this.max = -Infinity;
  }

  setFromPointsField(points: Vector3[], field: "x" | "y" | "z") {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = p[field];
      min = val < min ? val : min;
      max = val > max ? val : max;
    }

    this.min = min;
    this.max = max;
  }

  setFromPoints(axis: Vector3, points: Vector3[]) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = axis.dot(p);
      min = val < min ? val : min;
      max = val > max ? val : max;
    }

    this.min = min;
    this.max = max;
  }

  isSeparated(other: SeparatingAxisBounds) {
    return this.min > other.max || other.min > this.max;
  }

  setFromBox(axis: Vector3, box: Box3) {
    const boxMin = box.min;
    const boxMax = box.max;
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          _setFromBox_p.x = boxMin.x * x + boxMax.x * (1 - x);
          _setFromBox_p.y = boxMin.y * y + boxMax.y * (1 - y);
          _setFromBox_p.z = boxMin.z * z + boxMax.z * (1 - z);

          const val = axis.dot(_setFromBox_p);
          min = Math.min(val, min);
          max = Math.max(val, max);
        }
      }
    }

    this.min = min;
    this.max = max;
  }
}

const _setFromBox_p = /* @__PURE__ */ new Vector3();

export const areIntersecting = (function () {
  const cacheSatBounds = /* @__PURE__ */ new SeparatingAxisBounds();
  return function areIntersecting(
    shape1: { points: Vector3[]; satAxes: Vector3[]; satBounds: SeparatingAxisBounds[] },
    shape2: { points: Vector3[]; satAxes: Vector3[]; satBounds: SeparatingAxisBounds[] },
  ) {
    const points1 = shape1.points;
    const satAxes1 = shape1.satAxes;
    const satBounds1 = shape1.satBounds;

    const points2 = shape2.points;
    const satAxes2 = shape2.satAxes;
    const satBounds2 = shape2.satBounds;

    // check axes of the first shape
    for (let i = 0; i < 3; i++) {
      const sb = satBounds1[i];
      const sa = satAxes1[i];
      cacheSatBounds.setFromPoints(sa, points2);
      if (sb.isSeparated(cacheSatBounds)) return false;
    }

    // check axes of the second shape
    for (let i = 0; i < 3; i++) {
      const sb = satBounds2[i];
      const sa = satAxes2[i];
      cacheSatBounds.setFromPoints(sa, points1);
      if (sb.isSeparated(cacheSatBounds)) return false;
    }
  };
})();
