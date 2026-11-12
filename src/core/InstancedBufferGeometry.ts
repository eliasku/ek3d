import { BufferGeometry } from "./BufferGeometry";
/**
 * An instanced version of a geometry.
 */
export class InstancedBufferGeometry extends BufferGeometry {
  /**
   * This flag can be used for type testing.
   *
   * @readonly
   * @default true
   */
  isInstancedBufferGeometry: boolean = true;

  /**
   * The instance count.
   *
   * @default Infinity
   */
  instanceCount: number = Infinity;

  /**
   * Constructs a new instanced buffer geometry.
   */
  constructor() {
    super();
    this.type = "InstancedBufferGeometry";
  }
  override clone(): InstancedBufferGeometry {
    return new InstancedBufferGeometry().copy(this);
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
