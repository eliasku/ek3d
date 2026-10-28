import type { Box3 } from "./Box3";
import type { Matrix4 } from "./Matrix4";
import type { Plane } from "./Plane";
import type { Sphere } from "./Sphere";
import { Vector3 } from "./Vector3";
const _vector = /*@__PURE__*/ new Vector3();
const _segCenter = /*@__PURE__*/ new Vector3();
const _segDir = /*@__PURE__*/ new Vector3();
const _diff = /*@__PURE__*/ new Vector3();
/**
 * A ray that emits from an origin in a certain direction. The class is used by
 * {@link Raycaster} to assist with raycasting. Raycasting is used for
 * mouse picking (working out what objects in the 3D space the mouse is over)
 * amongst other things.
 */
export class Ray {
  origin: Vector3;
  direction: Vector3;

  /**
   * Constructs a new ray.
   *
   * @param [origin=(0,0,0)] - The origin of the ray.
   * @param [direction=(0,0,-1)] - The (normalized) direction of the ray.
   */
  constructor(origin: Vector3 = new Vector3(), direction: Vector3 = new Vector3(0, 0, -1)) {
    /**
     * The origin of the ray.
     *
     */
    this.origin = origin;
    /**
     * The (normalized) direction of the ray.
     *
     */
    this.direction = direction;
  }
  /**
   * Sets the ray's components by copying the given values.
   *
   * @param origin - The origin.
   * @param direction - The direction.
   * @return A reference to this ray.
   */
  set(origin: Vector3, direction: Vector3): Ray {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }
  /**
   * Copies the values of the given ray to this instance.
   *
   * @param ray - The ray to copy.
   * @return A reference to this ray.
   */
  copy(ray: Ray): Ray {
    this.origin.copy(ray.origin);
    this.direction.copy(ray.direction);
    return this;
  }
  /**
   * Returns a vector that is located at a given distance along this ray.
   *
   * @param t - The distance along the ray to retrieve a position for.
   * @param target - The target vector that is used to store the method's result.
   * @return A position on the ray.
   */
  at(t: number, target: Vector3): Vector3 {
    return target.copy(this.origin).addScaledVector(this.direction, t);
  }
  /**
   * Adjusts the direction of the ray to point at the given vector in world space.
   *
   * @param v - The target position.
   * @return A reference to this ray.
   */
  lookAt(v: Vector3): Ray {
    this.direction.copy(v).sub(this.origin).normalize();
    return this;
  }
  /**
   * Shift the origin of this ray along its direction by the given distance.
   *
   * @param t - The distance along the ray to interpolate.
   * @return A reference to this ray.
   */
  recast(t: number): Ray {
    this.origin.copy(this.at(t, _vector));
    return this;
  }
  /**
   * Returns the point along this ray that is closest to the given point.
   *
   * @param point - A point in 3D space to get the closet location on the ray for.
   * @param target - The target vector that is used to store the method's result.
   * @return The closest point on this ray.
   */
  closestPointToPoint(point: Vector3, target: Vector3): Vector3 {
    target.subVectors(point, this.origin);
    const directionDistance = target.dot(this.direction);
    if (directionDistance < 0) {
      return target.copy(this.origin);
    }
    return target.copy(this.origin).addScaledVector(this.direction, directionDistance);
  }
  /**
   * Returns the distance of the closest approach between this ray and the given point.
   *
   * @param point - A point in 3D space to compute the distance to.
   * @return The distance.
   */
  distanceToPoint(point: Vector3): number {
    return Math.sqrt(this.distanceSqToPoint(point));
  }
  /**
   * Returns the squared distance of the closest approach between this ray and the given point.
   *
   * @param point - A point in 3D space to compute the distance to.
   * @return The squared distance.
   */
  distanceSqToPoint(point: Vector3): number {
    const directionDistance = _vector.subVectors(point, this.origin).dot(this.direction);
    // point behind the ray
    if (directionDistance < 0) {
      return this.origin.distanceToSquared(point);
    }
    _vector.copy(this.origin).addScaledVector(this.direction, directionDistance);
    return _vector.distanceToSquared(point);
  }
  /**
   * Returns the squared distance between this ray and the given line segment.
   *
   * @param v0 - The start point of the line segment.
   * @param v1 - The end point of the line segment.
   * @param [optionalPointOnRay] - When provided, it receives the point on this ray that is closest to the segment.
   * @param [optionalPointOnSegment] - When provided, it receives the point on the line segment that is closest to this ray.
   * @return The squared distance.
   */
  distanceSqToSegment(
    v0: Vector3,
    v1: Vector3,
    optionalPointOnRay?: Vector3,
    optionalPointOnSegment?: Vector3,
  ): number {
    // from https://github.com/pmjoniak/GeometricTools/blob/master/GTEngine/Include/Mathematics/GteDistRaySegment.h
    // It returns the min distance between the ray and the segment
    // defined by v0 and v1
    // It can also set two optional targets :
    // - The closest point on the ray
    // - The closest point on the segment
    _segCenter.copy(v0).add(v1).multiplyScalar(0.5);
    _segDir.copy(v1).sub(v0).normalize();
    _diff.copy(this.origin).sub(_segCenter);
    const segExtent = v0.distanceTo(v1) * 0.5;
    const a01 = -this.direction.dot(_segDir);
    const b0 = _diff.dot(this.direction);
    const b1 = -_diff.dot(_segDir);
    const c = _diff.lengthSq();
    const det = Math.abs(1 - a01 * a01);
    let s0: any, s1: any, sqrDist: any, extDet: any;
    if (det > 0) {
      // The ray and segment are not parallel.
      s0 = a01 * b1 - b0;
      s1 = a01 * b0 - b1;
      extDet = segExtent * det;
      if (s0 >= 0) {
        if (s1 >= -extDet) {
          if (s1 <= extDet) {
            // region 0
            // Minimum at interior points of ray and segment.
            const invDet = 1 / det;
            s0 *= invDet;
            s1 *= invDet;
            sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
          } else {
            // region 1
            s1 = segExtent;
            s0 = Math.max(0, -(a01 * s1 + b0));
            sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
          }
        } else {
          // region 5
          s1 = -segExtent;
          s0 = Math.max(0, -(a01 * s1 + b0));
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      } else {
        if (s1 <= -extDet) {
          // region 4
          s0 = Math.max(0, -(-a01 * segExtent + b0));
          s1 = s0 > 0 ? -segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        } else if (s1 <= extDet) {
          // region 3
          s0 = 0;
          s1 = Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = s1 * (s1 + 2 * b1) + c;
        } else {
          // region 2
          s0 = Math.max(0, -(a01 * segExtent + b0));
          s1 = s0 > 0 ? segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      }
    } else {
      // Ray and segment are parallel.
      s1 = a01 > 0 ? -segExtent : segExtent;
      s0 = Math.max(0, -(a01 * s1 + b0));
      sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
    }
    if (optionalPointOnRay) {
      optionalPointOnRay.copy(this.origin).addScaledVector(this.direction, s0);
    }
    if (optionalPointOnSegment) {
      optionalPointOnSegment.copy(_segCenter).addScaledVector(_segDir, s1);
    }
    return sqrDist;
  }
  /**
   * Intersects this ray with the given sphere, returning the intersection
   * point or `null` if there is no intersection.
   *
   * @param sphere - The sphere to intersect.
   * @param target - The target vector that is used to store the method's result.
   * @return The intersection point.
   */
  intersectSphere(sphere: Sphere, target: Vector3): Vector3 | null {
    if (sphere.radius < 0) return null; // handle empty spheres, see #31187
    _vector.subVectors(sphere.center, this.origin);
    const tca = _vector.dot(this.direction);
    const d2 = _vector.dot(_vector) - tca * tca;
    const radius2 = sphere.radius * sphere.radius;
    if (d2 > radius2) return null;
    const thc = Math.sqrt(radius2 - d2);
    // t0 = first intersect point - entrance on front of sphere
    const t0 = tca - thc;
    // t1 = second intersect point - exit point on back of sphere
    const t1 = tca + thc;
    // test to see if t1 is behind the ray - if so, return null
    if (t1 < 0) return null;
    // test to see if t0 is behind the ray:
    // if it is, the ray is inside the sphere, so return the second exit point scaled by t1,
    // in order to always return an intersect point that is in front of the ray.
    if (t0 < 0) return this.at(t1, target);
    // else t0 is in front of the ray, so return the first collision point scaled by t0
    return this.at(t0, target);
  }
  /**
   * Returns `true` if this ray intersects with the given sphere.
   *
   * @param sphere - The sphere to intersect.
   * @return Whether this ray intersects with the given sphere or not.
   */
  intersectsSphere(sphere: Sphere): boolean {
    if (sphere.radius < 0) return false; // handle empty spheres, see #31187
    return this.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius;
  }
  /**
   * Computes the distance from the ray's origin to the given plane. Returns `null` if the ray
   * does not intersect with the plane.
   *
   * @param plane - The plane to compute the distance to.
   * @return Whether this ray intersects with the given sphere or not.
   */
  distanceToPlane(plane: Plane): number | null {
    const denominator = plane.normal.dot(this.direction);
    if (denominator === 0) {
      // line is coplanar, return origin
      if (plane.distanceToPoint(this.origin) === 0) {
        return 0;
      }
      // Null is preferable to undefined since undefined means.... it is undefined
      return null;
    }
    const t = -(this.origin.dot(plane.normal) + plane.constant) / denominator;
    // Return if the ray never intersects the plane
    return t >= 0 ? t : null;
  }
  /**
   * Intersects this ray with the given plane, returning the intersection
   * point or `null` if there is no intersection.
   *
   * @param plane - The plane to intersect.
   * @param target - The target vector that is used to store the method's result.
   * @return The intersection point.
   */
  intersectPlane(plane: Plane, target: Vector3): Vector3 | null {
    const t = this.distanceToPlane(plane);
    if (t === null) {
      return null;
    }
    return this.at(t, target);
  }
  /**
   * Returns `true` if this ray intersects with the given plane.
   *
   * @param plane - The plane to intersect.
   * @return Whether this ray intersects with the given plane or not.
   */
  intersectsPlane(plane: Plane): boolean {
    // check if the ray lies on the plane first
    const distToPoint = plane.distanceToPoint(this.origin);
    if (distToPoint === 0) {
      return true;
    }
    const denominator = plane.normal.dot(this.direction);
    if (denominator * distToPoint < 0) {
      return true;
    }
    // ray origin is behind the plane (and is pointing behind it)
    return false;
  }
  /**
   * Intersects this ray with the given bounding box, returning the intersection
   * point or `null` if there is no intersection.
   *
   * @param box - The box to intersect.
   * @param target - The target vector that is used to store the method's result.
   * @return The intersection point.
   */
  intersectBox(box: Box3, target: Vector3): Vector3 | null {
    let tmin: any, tmax: any, tymin: any, tymax: any, tzmin: any, tzmax: any;
    const invdirx = 1 / this.direction.x,
      invdiry = 1 / this.direction.y,
      invdirz = 1 / this.direction.z;
    const origin = this.origin;
    if (invdirx >= 0) {
      tmin = (box.min.x - origin.x) * invdirx;
      tmax = (box.max.x - origin.x) * invdirx;
    } else {
      tmin = (box.max.x - origin.x) * invdirx;
      tmax = (box.min.x - origin.x) * invdirx;
    }
    if (invdiry >= 0) {
      tymin = (box.min.y - origin.y) * invdiry;
      tymax = (box.max.y - origin.y) * invdiry;
    } else {
      tymin = (box.max.y - origin.y) * invdiry;
      tymax = (box.min.y - origin.y) * invdiry;
    }
    if (tmin > tymax || tymin > tmax) return null;
    if (tymin > tmin || isNaN(tmin)) tmin = tymin;
    if (tymax < tmax || isNaN(tmax)) tmax = tymax;
    if (invdirz >= 0) {
      tzmin = (box.min.z - origin.z) * invdirz;
      tzmax = (box.max.z - origin.z) * invdirz;
    } else {
      tzmin = (box.max.z - origin.z) * invdirz;
      tzmax = (box.min.z - origin.z) * invdirz;
    }
    if (tmin > tzmax || tzmin > tmax) return null;
    if (tzmin > tmin || tmin !== tmin) tmin = tzmin;
    if (tzmax < tmax || tmax !== tmax) tmax = tzmax;
    //return point closest to the ray (positive side)
    if (tmax < 0) return null;
    return this.at(tmin >= 0 ? tmin : tmax, target);
  }
  /**
   * Returns `true` if this ray intersects with the given box.
   *
   * @param box - The box to intersect.
   * @return Whether this ray intersects with the given box or not.
   */
  intersectsBox(box: Box3): boolean {
    return this.intersectBox(box, _vector) !== null;
  }
  /**
   * Intersects this ray with the given triangle, returning the intersection
   * point or `null` if there is no intersection.
   *
   * @param a - The first vertex of the triangle.
   * @param b - The second vertex of the triangle.
   * @param c - The third vertex of the triangle.
   * @param backfaceCulling - Whether to use backface culling or not.
   * @param target - The target vector that is used to store the method's result.
   * @return The intersection point.
   */
  intersectTriangle(a: Vector3, b: Vector3, c: Vector3, backfaceCulling: boolean, target: Vector3): Vector3 | null {
    // Watertight ray/triangle intersection. Reference: Woop, Benthin, Wald,
    // "Watertight Ray/Triangle Intersection", JCGT vol. 2 no. 1 (2013), Appendix A.
    // https://jcgt.org/published/0002/01/05/
    const origin = this.origin;
    const direction = this.direction;
    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;
    // triangle vertices relative to the ray origin
    const aox = a.x - origin.x,
      aoy = a.y - origin.y,
      aoz = a.z - origin.z;
    const box = b.x - origin.x,
      boy = b.y - origin.y,
      boz = b.z - origin.z;
    const cox = c.x - origin.x,
      coy = c.y - origin.y,
      coz = c.z - origin.z;
    // Use the dimension where the ray direction is maximal as the projection
    // axis (kz) and read every component already permuted into (kx, ky, kz).
    // kx and ky are swapped when the direction's kz component is negative, to
    // preserve the winding order of triangles.
    const adx = Math.abs(dx),
      ady = Math.abs(dy),
      adz = Math.abs(dz);
    let dkx: any, dky: any, dkz: any;
    let akx: any, aky: any, akz: any, bkx: any, bky: any, bkz: any, ckx: any, cky: any, ckz: any;
    if (adx >= ady && adx >= adz) {
      dkz = dx;
      akz = aox;
      bkz = box;
      ckz = cox;
      if (dx >= 0) {
        dkx = dy;
        dky = dz;
        akx = aoy;
        aky = aoz;
        bkx = boy;
        bky = boz;
        ckx = coy;
        cky = coz;
      } else {
        dkx = dz;
        dky = dy;
        akx = aoz;
        aky = aoy;
        bkx = boz;
        bky = boy;
        ckx = coz;
        cky = coy;
      }
    } else if (ady >= adz) {
      dkz = dy;
      akz = aoy;
      bkz = boy;
      ckz = coy;
      if (dy >= 0) {
        dkx = dz;
        dky = dx;
        akx = aoz;
        aky = aox;
        bkx = boz;
        bky = box;
        ckx = coz;
        cky = cox;
      } else {
        dkx = dx;
        dky = dz;
        akx = aox;
        aky = aoz;
        bkx = box;
        bky = boz;
        ckx = cox;
        cky = coz;
      }
    } else {
      dkz = dz;
      akz = aoz;
      bkz = boz;
      ckz = coz;
      if (dz >= 0) {
        dkx = dx;
        dky = dy;
        akx = aox;
        aky = aoy;
        bkx = box;
        bky = boy;
        ckx = cox;
        cky = coy;
      } else {
        dkx = dy;
        dky = dx;
        akx = aoy;
        aky = aox;
        bkx = boy;
        bky = box;
        ckx = coy;
        cky = cox;
      }
    }
    // a zero direction has no maximal axis and cannot intersect
    if (dkz === 0) return null;
    // shear constants that align the ray with the +kz axis
    const sx = dkx / dkz,
      sy = dky / dkz,
      sz = 1 / dkz;
    // sheared and scaled vertices
    const ax = akx - sx * akz,
      ay = aky - sy * akz;
    const bx = bkx - sx * bkz,
      by = bky - sy * bkz;
    const cx = ckx - sx * ckz,
      cy = cky - sy * ckz;
    // scaled barycentric coordinates (signed edge functions); the shear makes a
    // shared edge evaluate identically for both adjacent triangles, so the ray
    // can never fall between them
    const u = cx * by - cy * bx;
    const v = ax * cy - ay * cx;
    const w = bx * ay - by * ax;
    if (backfaceCulling) {
      if (u < 0 || v < 0 || w < 0) return null;
    } else {
      if ((u < 0 || v < 0 || w < 0) && (u > 0 || v > 0 || w > 0)) return null;
    }
    const det = u + v + w;
    // ray is co-planar with the triangle
    if (det === 0) return null;
    // scaled hit distance; t = tScaled / det must lie in front of the origin
    const tScaled = sz * (u * akz + v * bkz + w * ckz);
    if (det > 0 ? tScaled < 0 : tScaled > 0) return null;
    return this.at(tScaled / det, target);
  }
  /**
   * Transforms this ray with the given 4x4 transformation matrix.
   *
   * @param matrix4 - The transformation matrix.
   * @return A reference to this ray.
   */
  applyMatrix4(matrix4: Matrix4): Ray {
    this.origin.applyMatrix4(matrix4);
    this.direction.transformDirection(matrix4);
    return this;
  }
  /**
   * Returns `true` if this ray is equal with the given one.
   *
   * @param ray - The ray to test for equality.
   * @return Whether this ray is equal with the given one.
   */
  equals(ray: Ray): boolean {
    return ray.origin.equals(this.origin) && ray.direction.equals(this.direction);
  }
  /**
   * Returns a new ray with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Ray {
    return new (this.constructor as any)().copy(this);
  }
}
