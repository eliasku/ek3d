import type { Ray } from "../../../../../math/Ray";

const DIST_EPSILON = 1e-5;
const ANGLE_EPSILON = 1e-4;

export class RaySet {
  _rays: Ray[];

  constructor() {
    this._rays = [];
  }

  addRay(ray: Ray) {
    this._rays.push(ray);
  }

  findClosestRay(ray: Ray) {
    const rays = this._rays;
    const inv = ray.clone();
    inv.direction.multiplyScalar(-1);

    let bestScore = Infinity;
    let bestRay: Ray | null = null;
    for (let i = 0, l = rays.length; i < l; i++) {
      const r = rays[i];
      if (skipRay(r, ray) && skipRay(r, inv)) {
        continue;
      }

      const rayScore = scoreRays(r, ray);
      const invScore = scoreRays(r, inv);
      const score = Math.min(rayScore, invScore);
      if (score < bestScore) {
        bestScore = score;
        bestRay = r;
      }
    }

    return bestRay;

    function skipRay(r0: Ray, r1: Ray) {
      const distOutOfThreshold = r0.origin.distanceTo(r1.origin) > DIST_EPSILON;
      const angleOutOfThreshold = r0.direction.angleTo(r1.direction) > ANGLE_EPSILON;
      return angleOutOfThreshold || distOutOfThreshold;
    }

    function scoreRays(r0: Ray, r1: Ray) {
      const originDistance = r0.origin.distanceTo(r1.origin);
      const angleDistance = r0.direction.angleTo(r1.direction);
      return originDistance / DIST_EPSILON + angleDistance / ANGLE_EPSILON;
    }
  }
}
