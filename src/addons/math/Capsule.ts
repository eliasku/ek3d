import { Vector3 } from "../../math/Vector3";
import type { Box3 } from "../../math/Box3";

/**
 * A capsule is essentially a cylinder with hemispherical caps at both ends.
 * It can be thought of as a swept sphere, where a sphere is moved along a line segment.
 *
 * Capsules are often used as bounding volumes (next to AABBs and bounding spheres).
 *
 */
export class Capsule {
  start: Vector3;
  end: Vector3;
  radius: number;

  /**
   * Constructs a new capsule.
   *
   * @param [start] - The start vector.
   * @param [end] - The end vector.
   * @param [radius=1] - The capsule's radius.
   */
  constructor(start = new Vector3(0, 0, 0), end = new Vector3(0, 1, 0), radius = 1) {
    /**
     * The start vector.
     *
     */
    this.start = start;

    /**
     * The end vector.
     *
     */
    this.end = end;

    /**
     * The capsule's radius.
     *
     * @default 1
     */
    this.radius = radius;
  }

  /**
   * Returns a new capsule with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone() {
    return new (this.constructor as new () => this)().copy(this);
  }

  /**
   * Sets the capsule components to the given values.
   * Please note that this method only copies the values from the given objects.
   *
   * @param start - The start vector.
   * @param end - The end vector
   * @param radius - The capsule's radius.
   * @return A reference to this capsule.
   */
  set(start: Vector3, end: Vector3, radius: number) {
    this.start.copy(start);
    this.end.copy(end);
    this.radius = radius;

    return this;
  }

  /**
   * Copies the values of the given capsule to this instance.
   *
   * @param capsule - The capsule to copy.
   * @return A reference to this capsule.
   */
  copy(capsule: Capsule) {
    this.start.copy(capsule.start);
    this.end.copy(capsule.end);
    this.radius = capsule.radius;

    return this;
  }

  /**
   * Returns the center point of this capsule.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The center point.
   */
  getCenter(target: Vector3) {
    return target.copy(this.end).add(this.start).multiplyScalar(0.5);
  }

  /**
   * Adds the given offset to this capsule, effectively moving it in 3D space.
   *
   * @param v - The offset that should be used to translate the capsule.
   * @return A reference to this capsule.
   */
  translate(v: Vector3) {
    this.start.add(v);
    this.end.add(v);

    return this;
  }

  /**
   * Returns `true` if the given bounding box intersects with this capsule.
   *
   * @param box - The bounding box to test.
   * @return Whether the given bounding box intersects with this capsule.
   */
  intersectsBox(box: Box3) {
    return (
      checkAABBAxis(
        this.start.x,
        this.start.y,
        this.end.x,
        this.end.y,
        box.min.x,
        box.max.x,
        box.min.y,
        box.max.y,
        this.radius,
      ) &&
      checkAABBAxis(
        this.start.x,
        this.start.z,
        this.end.x,
        this.end.z,
        box.min.x,
        box.max.x,
        box.min.z,
        box.max.z,
        this.radius,
      ) &&
      checkAABBAxis(
        this.start.y,
        this.start.z,
        this.end.y,
        this.end.z,
        box.min.y,
        box.max.y,
        box.min.z,
        box.max.z,
        this.radius,
      )
    );
  }
}

function checkAABBAxis(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  minx: number,
  maxx: number,
  miny: number,
  maxy: number,
  radius: number,
) {
  return (
    (minx - p1x < radius || minx - p2x < radius) &&
    (p1x - maxx < radius || p2x - maxx < radius) &&
    (miny - p1y < radius || miny - p2y < radius) &&
    (p1y - maxy < radius || p2y - maxy < radius)
  );
}
