import type { Vector3 } from "./Vector3";
import { clamp } from "./MathUtils";
/**
 * This class can be used to represent points in 3D space as
 * [Spherical coordinates](https://en.wikipedia.org/wiki/Spherical_coordinate_system).
 */
export class Spherical {
  radius: number;
  phi: number;
  theta: number;

  /**
   * Constructs a new spherical.
   *
   * @param [radius=1] - The radius, or the Euclidean distance (straight-line distance) from the point to the origin.
   * @param [phi=0] - The polar angle in radians from the y (up) axis.
   * @param [theta=0] - The equator/azimuthal angle in radians around the y (up) axis.
   */
  constructor(radius: number = 1, phi: number = 0, theta: number = 0) {
    /**
     * The radius, or the Euclidean distance (straight-line distance) from the point to the origin.
     *
     * @default 1
     */
    this.radius = radius;
    /**
     * The polar angle in radians from the y (up) axis.
     *
     * @default 0
     */
    this.phi = phi;
    /**
     * The equator/azimuthal angle in radians around the y (up) axis.
     *
     * @default 0
     */
    this.theta = theta;
  }
  /**
   * Sets the spherical components by copying the given values.
   *
   * @param radius - The radius.
   * @param phi - The polar angle.
   * @param theta - The azimuthal angle.
   * @return A reference to this spherical.
   */
  set(radius: number, phi: number, theta: number): Spherical {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
    return this;
  }
  /**
   * Copies the values of the given spherical to this instance.
   *
   * @param other - The spherical to copy.
   * @return A reference to this spherical.
   */
  copy(other: Spherical): Spherical {
    this.radius = other.radius;
    this.phi = other.phi;
    this.theta = other.theta;
    return this;
  }
  /**
   * Restricts the polar angle [page:.phi phi] to be between `0.000001` and pi -
   * `0.000001`.
   *
   * @return A reference to this spherical.
   */
  makeSafe(): Spherical {
    const EPS = 0.000001;
    this.phi = clamp(this.phi, EPS, Math.PI - EPS);
    return this;
  }
  /**
   * Sets the spherical components from the given vector which is assumed to hold
   * Cartesian coordinates.
   *
   * @param v - The vector to set.
   * @return A reference to this spherical.
   */
  setFromVector3(v: Vector3): Spherical {
    return this.setFromCartesianCoords(v.x, v.y, v.z);
  }
  /**
   * Sets the spherical components from the given Cartesian coordinates.
   *
   * @param x - The x value.
   * @param y - The y value.
   * @param z - The z value.
   * @return A reference to this spherical.
   */
  setFromCartesianCoords(x: number, y: number, z: number): Spherical {
    this.radius = Math.sqrt(x * x + y * y + z * z);
    if (this.radius === 0) {
      this.theta = 0;
      this.phi = 0;
    } else {
      this.theta = Math.atan2(x, z);
      this.phi = Math.acos(clamp(y / this.radius, -1, 1));
    }
    return this;
  }
  /**
   * Returns a new spherical with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Spherical {
    return new (this.constructor as any)().copy(this);
  }
}
