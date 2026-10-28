import { BufferGeometry } from "./BufferGeometry";
/**
 * An instanced version of a geometry.
 */
export class InstancedBufferGeometry extends BufferGeometry {
  isInstancedBufferGeometry: boolean;

  instanceCount: number;

  /**
   * Constructs a new instanced buffer geometry.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isInstancedBufferGeometry = true;
    this.type = "InstancedBufferGeometry";
    /**
     * The instance count.
     *
     * @default Infinity
     */
    this.instanceCount = Infinity;
  }
  copy(source: InstancedBufferGeometry) {
    super.copy(source);
    this.instanceCount = source.instanceCount;
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.instanceCount = this.instanceCount;
    data.isInstancedBufferGeometry = true;
    return data;
  }
}
