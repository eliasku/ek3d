import { Vector3 } from "./Vector3";
/**
 * Represents a third-order spherical harmonics (SH). Light probes use this class
 * to encode lighting information.
 *
 * - Primary reference: {@link https://graphics.stanford.edu/papers/envmap/envmap.pdf}
 * - Secondary reference: {@link https://www.ppsloan.org/publications/StupidSH36.pdf}
 */
export class SphericalHarmonics3 {
  isSphericalHarmonics3: boolean;
  coefficients: Vector3[];

  /**
   * Constructs a new spherical harmonics.
   */
  constructor() {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isSphericalHarmonics3 = true;
    /**
     * An array holding the (9) SH coefficients.
     *
     */
    this.coefficients = [];
    for (let i = 0; i < 9; i++) {
      this.coefficients.push(new Vector3());
    }
  }
  /**
   * Sets the given SH coefficients to this instance by copying
   * the values.
   *
   * @param coefficients - The SH coefficients.
   * @return A reference to this spherical harmonics.
   */
  set(coefficients: Vector3[]): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].copy(coefficients[i]);
    }
    return this;
  }
  /**
   * Sets all SH coefficients to `0`.
   *
   * @return A reference to this spherical harmonics.
   */
  zero(): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].set(0, 0, 0);
    }
    return this;
  }
  /**
   * Returns the radiance in the direction of the given normal.
   *
   * @param normal - The normal vector (assumed to be unit length)
   * @param target - The target vector that is used to store the method's result.
   * @return The radiance.
   */
  getAt(normal: Vector3, target: Vector3): Vector3 {
    // normal is assumed to be unit length
    const x = normal.x,
      y = normal.y,
      z = normal.z;
    const coeff = this.coefficients;
    // band 0
    target.copy(coeff[0]).multiplyScalar(0.282095);
    // band 1
    target.addScaledVector(coeff[1], 0.488603 * y);
    target.addScaledVector(coeff[2], 0.488603 * z);
    target.addScaledVector(coeff[3], 0.488603 * x);
    // band 2
    target.addScaledVector(coeff[4], 1.092548 * (x * y));
    target.addScaledVector(coeff[5], 1.092548 * (y * z));
    target.addScaledVector(coeff[6], 0.315392 * (3.0 * z * z - 1.0));
    target.addScaledVector(coeff[7], 1.092548 * (x * z));
    target.addScaledVector(coeff[8], 0.546274 * (x * x - y * y));
    return target;
  }
  /**
   * Returns the irradiance (radiance convolved with cosine lobe) in the
   * direction of the given normal.
   *
   * @param normal - The normal vector (assumed to be unit length)
   * @param target - The target vector that is used to store the method's result.
   * @return The irradiance.
   */
  getIrradianceAt(normal: Vector3, target: Vector3): Vector3 {
    // normal is assumed to be unit length
    const x = normal.x,
      y = normal.y,
      z = normal.z;
    const coeff = this.coefficients;
    // band 0
    target.copy(coeff[0]).multiplyScalar(0.886227); // π * 0.282095
    // band 1
    target.addScaledVector(coeff[1], 2.0 * 0.511664 * y); // ( 2 * π / 3 ) * 0.488603
    target.addScaledVector(coeff[2], 2.0 * 0.511664 * z);
    target.addScaledVector(coeff[3], 2.0 * 0.511664 * x);
    // band 2
    target.addScaledVector(coeff[4], 2.0 * 0.429043 * x * y); // ( π / 4 ) * 1.092548
    target.addScaledVector(coeff[5], 2.0 * 0.429043 * y * z);
    target.addScaledVector(coeff[6], 0.743125 * z * z - 0.247708); // ( π / 4 ) * 0.315392 * 3
    target.addScaledVector(coeff[7], 2.0 * 0.429043 * x * z);
    target.addScaledVector(coeff[8], 0.429043 * (x * x - y * y)); // ( π / 4 ) * 0.546274
    return target;
  }
  /**
   * Adds the given SH to this instance.
   *
   * @param sh - The SH to add.
   * @return A reference to this spherical harmonics.
   */
  add(sh: SphericalHarmonics3): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].add(sh.coefficients[i]);
    }
    return this;
  }
  /**
   * A convenience method for performing {@link SphericalHarmonics3#add} and
   * {@link SphericalHarmonics3#scale} at once.
   *
   * @param sh - The SH to add.
   * @param s - The scale factor.
   * @return A reference to this spherical harmonics.
   */
  addScaledSH(sh: SphericalHarmonics3, s: number): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].addScaledVector(sh.coefficients[i], s);
    }
    return this;
  }
  /**
   * Scales this SH by the given scale factor.
   *
   * @param s - The scale factor.
   * @return A reference to this spherical harmonics.
   */
  scale(s: number): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].multiplyScalar(s);
    }
    return this;
  }
  /**
   * Linear interpolates between the given SH and this instance by the given
   * alpha factor.
   *
   * @param sh - The SH to interpolate with.
   * @param alpha - The alpha factor.
   * @return A reference to this spherical harmonics.
   */
  lerp(sh: SphericalHarmonics3, alpha: number): this {
    for (let i = 0; i < 9; i++) {
      this.coefficients[i].lerp(sh.coefficients[i], alpha);
    }
    return this;
  }
  /**
   * Returns `true` if this spherical harmonics is equal with the given one.
   *
   * @param sh - The spherical harmonics to test for equality.
   * @return Whether this spherical harmonics is equal with the given one.
   */
  equals(sh: SphericalHarmonics3): boolean {
    for (let i = 0; i < 9; i++) {
      if (!this.coefficients[i].equals(sh.coefficients[i])) {
        return false;
      }
    }
    return true;
  }
  /**
   * Copies the values of the given spherical harmonics to this instance.
   *
   * @param sh - The spherical harmonics to copy.
   * @return A reference to this spherical harmonics.
   */
  copy(sh: SphericalHarmonics3): this {
    return this.set(sh.coefficients);
  }
  /**
   * Returns a new spherical harmonics with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Sets the SH coefficients of this instance from the given array.
   *
   * @param array - An array holding the SH coefficients.
   * @param [offset=0] - The array offset where to start copying.
   * @return A clone of this instance.
   */
  fromArray(array: ArrayLike<number>, offset: number = 0): this {
    const coefficients = this.coefficients;
    for (let i = 0; i < 9; i++) {
      coefficients[i].fromArray(array, offset + i * 3);
    }
    return this;
  }
  /**
   * Returns an array with the SH coefficients, or copies them into the provided
   * array. The coefficients are represented as numbers.
   *
   * @param [array=[]] - The target array.
   * @param [offset=0] - The array offset where to start copying.
   * @return An array with flat SH coefficients.
   */
  toArray(array?: number[], offset?: number): number[];
  toArray<
    T extends
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array,
  >(array: T, offset?: number): T;
  toArray(
    array:
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array = [],
    offset: number = 0,
  ):
    | number[]
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array {
    const coefficients = this.coefficients;
    for (let i = 0; i < 9; i++) {
      coefficients[i].toArray(array, offset + i * 3);
    }
    return array;
  }
  /**
   * Computes the SH basis for the given normal vector.
   *
   * @param normal - The normal.
   * @param shBasis - The target array holding the SH basis.
   */
  static getBasisAt(
    normal: Vector3,
    shBasis:
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array,
  ): void;
  static getBasisAt(normal: Vector3, shBasis?: any) {
    // normal is assumed to be unit length
    const x = normal.x,
      y = normal.y,
      z = normal.z;
    // band 0
    shBasis[0] = 0.282095;
    // band 1
    shBasis[1] = 0.488603 * y;
    shBasis[2] = 0.488603 * z;
    shBasis[3] = 0.488603 * x;
    // band 2
    shBasis[4] = 1.092548 * x * y;
    shBasis[5] = 1.092548 * y * z;
    shBasis[6] = 0.315392 * (3 * z * z - 1);
    shBasis[7] = 1.092548 * x * z;
    shBasis[8] = 0.546274 * (x * x - y * y);
  }
}
