import type { Object3D } from "../../../../core/Object3D";
import type { Raycaster, Intersection } from "../../../../core/Raycaster";

// Converts a local-space BVH hit to a world-space raycaster intersection.
export function convertRaycastIntersect<T extends Omit<Intersection, "object">>(
  hit: T | null,
  object: Object3D,
  raycaster: Raycaster,
): (T & Intersection) | null {
  if (hit === null) return null;
  hit.point.applyMatrix4(object.matrixWorld);
  hit.distance = hit.point.distanceTo(raycaster.ray.origin);
  return Object.assign(hit, { object });
}
