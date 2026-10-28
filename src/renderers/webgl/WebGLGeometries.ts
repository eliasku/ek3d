import { GL } from "../../GL";
import { Uint16BufferAttribute, Uint32BufferAttribute } from "../../core/BufferAttribute";
export function WebGLGeometries(gl?: any, attributes?: any, info?: any, bindingStates?: any) {
  const geometries: any = {};
  const wireframeAttributes = new WeakMap<any, any>();
  const registry = new FinalizationRegistry((id?: any) => delete (geometries as any)[id]);
  function onGeometryDispose(event?: any) {
    destroyGeometry(event.target);
  }
  function destroyGeometry(geometry?: any) {
    if (geometry.index !== null) {
      attributes.remove(geometry.index);
    }
    for (const name in geometry.attributes) {
      attributes.remove(geometry.attributes[name]);
    }
    geometry.removeEventListener("dispose", onGeometryDispose);
    delete (geometries as any)[geometry.id];
    registry.unregister(geometry);
    const attribute = wireframeAttributes.get(geometry);
    if (attribute) {
      attributes.remove(attribute);
      wireframeAttributes.delete(geometry);
    }
    bindingStates.releaseStatesOfGeometry(geometry);
    if (geometry.isInstancedBufferGeometry === true) {
      delete geometry._maxInstanceCount;
    }
    //
    info.memory.geometries--;
  }
  function get(object?: any, geometry?: any) {
    if ((geometries as any)[geometry.id] !== undefined) return geometry;
    geometry.addEventListener("dispose", onGeometryDispose);
    (geometries as any)[geometry.id] = new WeakRef(geometry);
    registry.register(geometry, geometry.id, geometry);
    info.memory.geometries++;
    return geometry;
  }
  function update(geometry?: any) {
    const geometryAttributes = geometry.attributes;
    // Updating index buffer in VAO now. See WebGLBindingStates.
    for (const name in geometryAttributes) {
      attributes.update(geometryAttributes[name], GL.ARRAY_BUFFER);
    }
  }
  function updateWireframeAttribute(geometry?: any) {
    const geometryIndex = geometry.index;
    const geometryPosition = geometry.attributes.position;
    let version = 0;
    if (geometryPosition === undefined) {
      return;
    }
    const count = geometryIndex !== null ? geometryIndex.array.length : geometryPosition.array.length / 3 - 1;
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
      version = geometryPosition.version;
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
    const previousAttribute = wireframeAttributes.get(geometry);
    if (previousAttribute) attributes.remove(previousAttribute);
    //
    wireframeAttributes.set(geometry, attribute);
  }
  function getWireframeAttribute(geometry?: any) {
    const currentAttribute = wireframeAttributes.get(geometry);
    if (currentAttribute) {
      const geometryIndex = geometry.index;
      if (geometryIndex !== null) {
        // if the attribute is obsolete, create a new one
        if (currentAttribute.version < geometryIndex.version) {
          updateWireframeAttribute(geometry);
        }
      }
    } else {
      updateWireframeAttribute(geometry);
    }
    return wireframeAttributes.get(geometry);
  }
  function dispose() {
    for (const id in geometries) {
      const geometry = (geometries as any)[id].deref();
      if (geometry !== undefined) destroyGeometry(geometry);
    }
  }
  return {
    get: get,
    update: update,
    getWireframeAttribute: getWireframeAttribute,
    dispose: dispose,
  };
}
