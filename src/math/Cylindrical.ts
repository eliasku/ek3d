import type { Vector3 } from "./Vector3";
/**
 * This class can be used to represent points in 3D space as
 * [Cylindrical coordinates](https://en.wikipedia.org/wiki/Cylindrical_coordinate_system).
 */
export class Cylindrical {
  radius: number;
  theta: number;
  y: number;

  /**
   * Constructs a new cylindrical.
   *
   * @param [radius=1] - The distance from the origin to a point in the x-z plane.
   * @param [theta=0] - A counterclockwise angle in the x-z plane measured in radians from the positive z-axis.
   * @param [y=0] - The height above the x-z plane.
   */
  constructor(radius: number = 1, theta: number = 0, y: number = 0) {
    /**
     * The distance from the origin to a point in the x-z plane.
     *
     * @default 1
     */
    this.radius = radius;
    /**
     * A counterclockwise angle in the x-z plane measured in radians from the positive z-axis.
     *
     * @default 0
     */
    this.theta = theta;
    /**
     * The height above the x-z plane.
     *
     * @default 0
     */
    this.y = y;
  }
  /**
   * Sets the cylindrical components by copying the given values.
   *
   * @param radius - The radius.
   * @param theta - The theta angle.
   * @param y - The height value.
   * @return A reference to this cylindrical.
   */
  set(radius: number, theta: number, y: number): Cylindrical {
    this.radius = radius;
    this.theta = theta;
    this.y = y;
    return this;
  }
  /**
   * Copies the values of the given cylindrical to this instance.
   *
   * @param other - The cylindrical to copy.
   * @return A reference to this cylindrical.
   */
  copy(other: Cylindrical): Cylindrical {
    this.radius = other.radius;
    this.theta = other.theta;
    this.y = other.y;
    return this;
  }
  /**
   * Sets the cylindrical components from the given vector which is assumed to hold
   * Cartesian coordinates.
   *
   * @param v - The vector to set.
   * @return A reference to this cylindrical.
   */
  setFromVector3(v: Vector3): Cylindrical {
    return this.setFromCartesianCoords(v.x, v.y, v.z);
  }
  /**
   * Sets the cylindrical components from the given Cartesian coordinates.
   *
   * @param x - The x value.
   * @param y - The x value.
   * @param z - The x value.
   * @return A reference to this cylindrical.
   */
  setFromCartesianCoords(x: number, y: number, z: number): Cylindrical {
    this.radius = Math.sqrt(x * x + z * z);
    this.theta = Math.atan2(x, z);
    this.y = y;
    return this;
  }
  /**
   * Returns a new cylindrical with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Cylindrical {
    return new (this.constructor as any)().copy(this);
  }
}
