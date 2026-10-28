import type { Vector2 } from "../../../../../math/Vector2";
import type { Vector3 } from "../../../../../math/Vector3";
import type { Vector4 } from "../../../../../math/Vector4";
import type { Ray } from "../../../../../math/Ray";

const HASH_WIDTH = 1e-6;
const HASH_HALF_WIDTH = HASH_WIDTH * 0.5;
const HASH_MULTIPLIER = Math.pow(10, -Math.log10(HASH_WIDTH));
const HASH_ADDITION = HASH_HALF_WIDTH * HASH_MULTIPLIER;
export function hashNumber(v: number) {
  return ~~(v * HASH_MULTIPLIER + HASH_ADDITION);
}

export function hashVertex2(v: Vector2) {
  return `${hashNumber(v.x)},${hashNumber(v.y)}`;
}

export function hashVertex3(v: Vector3) {
  return `${hashNumber(v.x)},${hashNumber(v.y)},${hashNumber(v.z)}`;
}

export function hashVertex4(v: Vector4) {
  return `${hashNumber(v.x)},${hashNumber(v.y)},${hashNumber(v.z)},${hashNumber(v.w)}`;
}

export function hashRay(r: Ray) {
  return `${hashVertex3(r.origin)}-${hashVertex3(r.direction)}`;
}

export function toNormalizedRay(v0: Vector3, v1: Vector3, target: Ray) {
  // get a normalized direction
  target.direction.subVectors(v1, v0).normalize();

  // project the origin onto the perpendicular plane that
  // passes through 0, 0, 0
  const scalar = v0.dot(target.direction);
  target.origin.copy(v0).addScaledVector(target.direction, -scalar);

  return target;
}
