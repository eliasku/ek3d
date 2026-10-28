import type { Uniform } from "./Uniform";
import { EventDispatcher } from "./EventDispatcher";
import { StaticDrawUsage } from "../constants";
let _id = 0;
/**
 * A class for managing multiple uniforms in a single group. The renderer will process
 * such a definition as a single UBO.
 *
 * Since this class can only be used in context of {@link ShaderMaterial}, it is only supported
 * in {@link WebGLRenderer}.
 *
 */
export class UniformsGroup extends EventDispatcher {
  isUniformsGroup: boolean;
  name: string;
  usage: number;
  uniforms: (Uniform | Uniform[])[];
  id!: number;

  /**
   * Constructs a new uniforms group.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isUniformsGroup = true;
    /**
     * The ID of the 3D object.
     *
     * @name UniformsGroup#id
     * @readonly
     */
    Object.defineProperty(this, "id", { enumerable: false, configurable: false, writable: false, value: _id++ });
    /**
     * The name of the uniforms group.
     *
     */
    this.name = "";
    /**
     * The buffer usage.
     *
     * @default StaticDrawUsage
     */
    this.usage = StaticDrawUsage;
    /**
     * An array holding the uniforms.
     *
     */
    this.uniforms = [];
  }
  /**
   * Adds the given uniform to this uniforms group.
   *
   * @param uniform - The uniform to add.
   * @return A reference to this uniforms group.
   */
  add(uniform: Uniform | Uniform[]): UniformsGroup;
  add(uniform?: any): UniformsGroup {
    this.uniforms.push(uniform);
    return this;
  }
  /**
   * Removes the given uniform from this uniforms group.
   *
   * @param uniform - The uniform to remove.
   * @return A reference to this uniforms group.
   */
  remove(uniform: Uniform | Uniform[]): UniformsGroup;
  remove(uniform?: any): UniformsGroup {
    const index = this.uniforms.indexOf(uniform);
    if (index !== -1) this.uniforms.splice(index, 1);
    return this;
  }
  /**
   * Sets the name of this uniforms group.
   *
   * @param name - The name to set.
   * @return A reference to this uniforms group.
   */
  setName(name: string): UniformsGroup {
    this.name = name;
    return this;
  }
  /**
   * Sets the usage of this uniforms group.
   *
   * @param value - The usage to set.
   * @return A reference to this uniforms group.
   */
  setUsage(value: number): UniformsGroup {
    this.usage = value;
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * @fires Texture#dispose
   */
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  /**
   * Copies the values of the given uniforms group to this instance.
   *
   * @param source - The uniforms group to copy.
   * @return A reference to this uniforms group.
   */
  copy(source: UniformsGroup): UniformsGroup {
    this.name = source.name;
    this.usage = source.usage;
    const uniformsSource = source.uniforms;
    this.uniforms.length = 0;
    for (let i = 0, l = uniformsSource.length; i < l; i++) {
      const uniform = uniformsSource[i];
      if (Array.isArray(uniform)) {
        this.uniforms.push(uniform.map((u?: any) => u.clone()));
      } else {
        this.uniforms.push(uniform.clone());
      }
    }
    return this;
  }
  /**
   * Returns a new uniforms group with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): UniformsGroup {
    return new (this.constructor as any)().copy(this);
  }
}
