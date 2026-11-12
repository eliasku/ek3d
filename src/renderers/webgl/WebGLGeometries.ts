import { GL } from "../../GL";
import { Uint16BufferAttribute, Uint32BufferAttribute } from "../../core/BufferAttribute";
import type { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { InstancedBufferGeometry } from "../../core/InstancedBufferGeometry";
import type { WebGLInfoState } from "./WebGLInfo";
import type { WebGLAttributes } from "./WebGLAttributes";
import type { WebGLBindingStates } from "./WebGLBindingStates";

export class WebGLGeometries {
  private attributes: WebGLAttributes;
  private info: WebGLInfoState;
  private bindingStates: WebGLBindingStates;
  private geometries: Record<string, WeakRef<BufferGeometry>>;
  private wireframeAttributes: WeakMap<BufferGeometry, Uint16BufferAttribute | Uint32BufferAttribute>;
  private registry: FinalizationRegistry<number>;

  constructor(
    gl: WebGL2RenderingContext,
    attributes: WebGLAttributes,
    info: WebGLInfoState,
    bindingStates: WebGLBindingStates,
  ) {
    this.attributes = attributes;
    this.info = info;
    this.bindingStates = bindingStates;
    this.geometries = {};
    this.wireframeAttributes = new WeakMap();
    this.registry = new FinalizationRegistry(this.onGeometryFinalized.bind(this));
    this.get = this.get.bind(this);
    this.update = this.update.bind(this);
    this.getWireframeAttribute = this.getWireframeAttribute.bind(this);
    this.dispose = this.dispose.bind(this);
    this.onGeometryDispose = this.onGeometryDispose.bind(this);
  }
  private onGeometryFinalized(id: number): void {
    delete this.geometries[id];
  }
  private onGeometryDispose(event: { target: BufferGeometry }): void {
    this.destroyGeometry(event.target);
  }
  private destroyGeometry(geometry: BufferGeometry): void {
    if (geometry.index !== null) {
      this.attributes.remove(geometry.index);
    }
    for (const name in geometry.attributes) {
      this.attributes.remove(geometry.attributes[name]);
    }
    geometry.removeEventListener("dispose", this.onGeometryDispose);
    delete this.geometries[geometry.id];
    this.registry.unregister(geometry);
    const attribute = this.wireframeAttributes.get(geometry);
    if (attribute) {
      this.attributes.remove(attribute);
      this.wireframeAttributes.delete(geometry);
    }
    this.bindingStates.releaseStatesOfGeometry(geometry);
    if ((geometry as InstancedBufferGeometry).isInstancedBufferGeometry === true) {
      delete (geometry as BufferGeometry & { _maxInstanceCount?: number })._maxInstanceCount;
    }
    //
    this.info.memory.geometries--;
  }
  get<T extends BufferGeometry>(object: object, geometry: T): T {
    if (this.geometries[geometry.id] !== undefined) return geometry;
    geometry.addEventListener("dispose", this.onGeometryDispose);
    this.geometries[geometry.id] = new WeakRef(geometry);
    this.registry.register(geometry, geometry.id, geometry);
    this.info.memory.geometries++;
    return geometry;
  }
  update(geometry: BufferGeometry): void {
    const geometryAttributes = geometry.attributes;
    // Updating index buffer in VAO now. See WebGLBindingStates.
    for (const name in geometryAttributes) {
      this.attributes.update(geometryAttributes[name], GL.ARRAY_BUFFER);
    }
  }
  private updateWireframeAttribute(geometry: BufferGeometry): void {
    const geometryIndex = geometry.index;
    const geometryPosition = geometry.attributes.position;
    let version = 0;
    if (geometryPosition === undefined) {
      return;
    }
    const count =
      geometryIndex !== null ? geometryIndex.array.length : (geometryPosition as BufferAttribute).array.length / 3 - 1;
    // check whether a 32 bit or 16 bit buffer is required to store the indices
    // account for PRIMITIVE_RESTART_FIXED_INDEX, #24565
    const IndexBufferAttribute = geometryPosition.count >= 65535 ? Uint32BufferAttribute : Uint16BufferAttribute;
    const attribute = new IndexBufferAttribute(Math.ceil(count / 3) * 6, 1);
    const indices = attribute.array;
    if (geometryIndex !== null) {
      const array = geometryIndex.array;
      version = geometryIndex.version;
      for (let i = 0, j = 0; i < count; i += 3) {
        const a = array[i + 0];
        const b = array[i + 1];
        const c = array[i + 2];
        indices[j++] = a;
        indices[j++] = b;
        indices[j++] = b;
        indices[j++] = c;
        indices[j++] = c;
        indices[j++] = a;
      }
    } else {
      version = (geometryPosition as BufferAttribute).version;
      for (let i = 0, j = 0; i < count; i += 3) {
        const a = i + 0;
        const b = i + 1;
        const c = i + 2;
        indices[j++] = a;
        indices[j++] = b;
        indices[j++] = b;
        indices[j++] = c;
        indices[j++] = c;
        indices[j++] = a;
      }
    }
    attribute.version = version;
    // Updating index buffer in VAO now. See WebGLBindingStates
    //
    const previousAttribute = this.wireframeAttributes.get(geometry);
    if (previousAttribute) this.attributes.remove(previousAttribute);
    //
    this.wireframeAttributes.set(geometry, attribute);
  }
  getWireframeAttribute(geometry: BufferGeometry): Uint16BufferAttribute | Uint32BufferAttribute | undefined {
    const currentAttribute = this.wireframeAttributes.get(geometry);
    if (currentAttribute) {
      const geometryIndex = geometry.index;
      if (geometryIndex !== null) {
        // if the attribute is obsolete, create a new one
        if (currentAttribute.version < geometryIndex.version) {
          this.updateWireframeAttribute(geometry);
        }
      }
    } else {
      this.updateWireframeAttribute(geometry);
    }
    return this.wireframeAttributes.get(geometry);
  }
  dispose(): void {
    for (const id in this.geometries) {
      const geometry = this.geometries[id].deref();
      if (geometry !== undefined) this.destroyGeometry(geometry);
    }
  }
}
