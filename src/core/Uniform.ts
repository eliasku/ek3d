/**
 * Represents a uniform which is a global shader variable. They are passed to shader programs.
 *
 * When declaring a uniform of a {@link ShaderMaterial}, it is declared by value or by object.
 * ```typescript
 * import { Uniform } from 'ek3d/core/Uniform';
 * import { Vector2 } from 'ek3d/math/Vector2';
 *
 * const uniforms = {
 * 	time: { value: 1.0 },
 * 	resolution: new Uniform( new Vector2() )
 * };
 * ```
 * Since this class can only be used in context of {@link ShaderMaterial}, it is only supported
 * in {@link WebGLRenderer}.
 */
export class Uniform<T = unknown> {
  value: T;
  type?: "float" | "int" | "uint";

  /**
   * Constructs a new uniform.
   *
   * @param value - The uniform value.
   */
  constructor(value: T) {
    /**
     * The uniform value.
     *
     */
    this.value = value;
  }
  /**
   * Returns a new uniform with copied values from this instance.
   * If the value has a `clone()` method, the value is cloned as well.
   *
   * @return A clone of this instance.
   */
  clone(): Uniform<T> {
    return new Uniform(
      (this.value as T & { clone(): T }).clone === undefined ? this.value : (this.value as T & { clone(): T }).clone(),
    );
  }
}
