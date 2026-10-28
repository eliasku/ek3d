import { GL } from "../../GL";
import { TextureType } from "../../constants";
export function WebGLBindingStates(gl?: any, attributes?: any) {
  const maxVertexAttributes = gl.getParameter(GL.MAX_VERTEX_ATTRIBS);
  const bindingStates: any = {};
  const defaultState = createBindingState(null);
  let currentState = defaultState;
  let forceUpdate = false;
  function setup(object?: any, material?: any, program?: any, geometry?: any, index?: any) {
    let updateBuffers = false;
    const state = getBindingState(object, geometry, program, material);
    if (currentState !== state) {
      currentState = state;
      bindVertexArrayObject(currentState.object);
    }
    updateBuffers = needsUpdate(object, geometry, program, index);
    if (updateBuffers) saveCache(object, geometry, program, index);
    if (index !== null) {
      attributes.update(index, GL.ELEMENT_ARRAY_BUFFER);
    }
    if (updateBuffers || forceUpdate) {
      forceUpdate = false;
      setupVertexAttributes(object, material, program, geometry);
      if (index !== null) {
        gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, attributes.get(index).buffer);
      }
    }
  }
  function createVertexArrayObject() {
    return gl.createVertexArray();
  }
  function bindVertexArrayObject(vao?: any) {
    return gl.bindVertexArray(vao);
  }
  function deleteVertexArrayObject(vao?: any) {
    return gl.deleteVertexArray(vao);
  }
  function getBindingState(object?: any, geometry?: any, program?: any, material?: any) {
    const wireframe = material.wireframe === true;
    let objectMap = (bindingStates as any)[geometry.id];
    if (objectMap === undefined) {
      objectMap = {};
      (bindingStates as any)[geometry.id] = objectMap;
    }
    // Each InstancedMesh requires unique binding states because it contains instanced attributes.
    const objectId = object.isInstancedMesh === true ? object.id : 0;
    let programMap = objectMap[objectId];
    if (programMap === undefined) {
      programMap = {};
      objectMap[objectId] = programMap;
    }
    let stateMap = programMap[program.id];
    if (stateMap === undefined) {
      stateMap = {};
      programMap[program.id] = stateMap;
    }
    let state = stateMap[wireframe as any];
    if (state === undefined) {
      state = createBindingState(createVertexArrayObject());
      stateMap[wireframe as any] = state;
    }
    return state;
  }
  function createBindingState(vao?: any) {
    const newAttributes: any[] = [];
    const enabledAttributes: any[] = [];
    const attributeDivisors: any[] = [];
    for (let i = 0; i < maxVertexAttributes; i++) {
      newAttributes[i] = 0;
      enabledAttributes[i] = 0;
      attributeDivisors[i] = 0;
    }
    return {
      // for backward compatibility on non-VAO support browser
      geometry: null,
      program: null,
      wireframe: false,
      newAttributes: newAttributes,
      enabledAttributes: enabledAttributes,
      attributeDivisors: attributeDivisors,
      object: vao,
      attributes: {},
      index: null,
    };
  }
  function needsUpdate(object?: any, geometry?: any, program?: any, index?: any) {
    const cachedAttributes = currentState.attributes;
    const geometryAttributes = geometry.attributes;
    let attributesNum = 0;
    const programAttributes = program.getAttributes();
    for (const name in programAttributes) {
      const programAttribute = programAttributes[name];
      if (programAttribute.location >= 0) {
        const cachedAttribute = (cachedAttributes as any)[name];
        let geometryAttribute = geometryAttributes[name];
        if (geometryAttribute === undefined) {
          if (name === "instanceMatrix" && object.instanceMatrix) geometryAttribute = object.instanceMatrix;
          if (name === "instanceColor" && object.instanceColor) geometryAttribute = object.instanceColor;
        }
        if (cachedAttribute === undefined) return true;
        if (cachedAttribute.attribute !== geometryAttribute) return true;
        if (geometryAttribute && cachedAttribute.data !== geometryAttribute.data) return true;
        attributesNum++;
      }
    }
    if ((currentState as any).attributesNum !== attributesNum) return true;
    if (currentState.index !== index) return true;
    return false;
  }
  function saveCache(object?: any, geometry?: any, program?: any, index?: any) {
    const cache: any = {};
    const attributes = geometry.attributes;
    let attributesNum = 0;
    const programAttributes = program.getAttributes();
    for (const name in programAttributes) {
      const programAttribute = programAttributes[name];
      if (programAttribute.location >= 0) {
        let attribute = attributes[name];
        if (attribute === undefined) {
          if (name === "instanceMatrix" && object.instanceMatrix) attribute = object.instanceMatrix;
          if (name === "instanceColor" && object.instanceColor) attribute = object.instanceColor;
        }
        const data: any = {};
        data.attribute = attribute;
        if (attribute && attribute.data) {
          (data as any).data = attribute.data;
        }
        (cache as any)[name] = data;
        attributesNum++;
      }
    }
    currentState.attributes = cache;
    (currentState as any).attributesNum = attributesNum;
    currentState.index = index;
  }
  function initAttributes() {
    const newAttributes = currentState.newAttributes;
    for (let i = 0, il = newAttributes.length; i < il; i++) {
      newAttributes[i] = 0;
    }
  }
  function enableAttribute(attribute?: any) {
    enableAttributeAndDivisor(attribute, 0);
  }
  function enableAttributeAndDivisor(attribute?: any, meshPerAttribute?: any) {
    const newAttributes = currentState.newAttributes;
    const enabledAttributes = currentState.enabledAttributes;
    const attributeDivisors = currentState.attributeDivisors;
    newAttributes[attribute] = 1;
    if (enabledAttributes[attribute] === 0) {
      gl.enableVertexAttribArray(attribute);
      enabledAttributes[attribute] = 1;
    }
    if (attributeDivisors[attribute] !== meshPerAttribute) {
      gl.vertexAttribDivisor(attribute, meshPerAttribute);
      attributeDivisors[attribute] = meshPerAttribute;
    }
  }
  function disableUnusedAttributes() {
    const newAttributes = currentState.newAttributes;
    const enabledAttributes = currentState.enabledAttributes;
    for (let i = 0, il = enabledAttributes.length; i < il; i++) {
      if (enabledAttributes[i] !== newAttributes[i]) {
        gl.disableVertexAttribArray(i);
        enabledAttributes[i] = 0;
      }
    }
  }
  function vertexAttribPointer(
    index?: any,
    size?: any,
    type?: any,
    normalized?: any,
    stride?: any,
    offset?: any,
    integer?: any,
  ) {
    if (integer === true) {
      gl.vertexAttribIPointer(index, size, type, stride, offset);
    } else {
      gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
    }
  }
  function setupVertexAttributes(object?: any, material?: any, program?: any, geometry?: any) {
    initAttributes();
    const geometryAttributes = geometry.attributes;
    const programAttributes = program.getAttributes();
    const materialDefaultAttributeValues = material.defaultAttributeValues;
    for (const name in programAttributes) {
      const programAttribute = programAttributes[name];
      if (programAttribute.location >= 0) {
        let geometryAttribute = geometryAttributes[name];
        if (geometryAttribute === undefined) {
          if (name === "instanceMatrix" && object.instanceMatrix) geometryAttribute = object.instanceMatrix;
          if (name === "instanceColor" && object.instanceColor) geometryAttribute = object.instanceColor;
        }
        if (geometryAttribute !== undefined) {
          const normalized = geometryAttribute.normalized;
          const size = geometryAttribute.itemSize;
          const attribute = attributes.get(geometryAttribute);
          // TODO Attribute may not be available on context restore
          if (attribute === undefined) continue;
          const buffer = attribute.buffer;
          const type = attribute.type;
          const bytesPerElement = attribute.bytesPerElement;
          // check for integer attributes
          const integer = type === GL.INT || type === GL.UNSIGNED_INT || geometryAttribute.gpuType === TextureType.Int;
          if (geometryAttribute.isInterleavedBufferAttribute) {
            // interleaved attributes can also view a buffer attribute, e.g. the columns of instance matrices
            const data = geometryAttribute.data;
            const stride = data.isInterleavedBuffer === true ? data.stride : data.itemSize;
            const offset = geometryAttribute.offset;
            if (data.isInstancedInterleavedBuffer || data.isInstancedBufferAttribute) {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                enableAttributeAndDivisor(programAttribute.location + i, data.meshPerAttribute);
              }
              if (object.isInstancedMesh !== true && geometry._maxInstanceCount === undefined) {
                geometry._maxInstanceCount = data.meshPerAttribute * data.count;
              }
            } else {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                enableAttribute(programAttribute.location + i);
              }
            }
            gl.bindBuffer(GL.ARRAY_BUFFER, buffer);
            for (let i = 0; i < programAttribute.locationSize; i++) {
              vertexAttribPointer(
                programAttribute.location + i,
                size / programAttribute.locationSize,
                type,
                normalized,
                stride * bytesPerElement,
                (offset + (size / programAttribute.locationSize) * i) * bytesPerElement,
                integer,
              );
            }
          } else {
            if (geometryAttribute.isInstancedBufferAttribute) {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                enableAttributeAndDivisor(programAttribute.location + i, geometryAttribute.meshPerAttribute);
              }
              if (object.isInstancedMesh !== true && geometry._maxInstanceCount === undefined) {
                geometry._maxInstanceCount = geometryAttribute.meshPerAttribute * geometryAttribute.count;
              }
            } else {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                enableAttribute(programAttribute.location + i);
              }
            }
            gl.bindBuffer(GL.ARRAY_BUFFER, buffer);
            for (let i = 0; i < programAttribute.locationSize; i++) {
              vertexAttribPointer(
                programAttribute.location + i,
                size / programAttribute.locationSize,
                type,
                normalized,
                size * bytesPerElement,
                (size / programAttribute.locationSize) * i * bytesPerElement,
                integer,
              );
            }
          }
        } else if (materialDefaultAttributeValues !== undefined) {
          const value = materialDefaultAttributeValues[name];
          if (value !== undefined) {
            switch (value.length) {
              case 2:
                gl.vertexAttrib2fv(programAttribute.location, value);
                break;
              case 3:
                gl.vertexAttrib3fv(programAttribute.location, value);
                break;
              case 4:
                gl.vertexAttrib4fv(programAttribute.location, value);
                break;
              default:
                gl.vertexAttrib1fv(programAttribute.location, value);
            }
          }
        }
      }
    }
    disableUnusedAttributes();
  }
  function dispose() {
    reset();
    for (const geometryId in bindingStates) {
      const objectMap = (bindingStates as any)[geometryId];
      for (const objectId in objectMap) {
        const programMap = objectMap[objectId];
        for (const programId in programMap) {
          const stateMap = programMap[programId];
          for (const wireframe in stateMap) {
            deleteVertexArrayObject(stateMap[wireframe].object);
            delete stateMap[wireframe];
          }
          delete programMap[programId];
        }
      }
      delete (bindingStates as any)[geometryId];
    }
  }
  function releaseStatesOfGeometry(geometry?: any) {
    if ((bindingStates as any)[geometry.id] === undefined) return;
    const objectMap = (bindingStates as any)[geometry.id];
    for (const objectId in objectMap) {
      const programMap = objectMap[objectId];
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
    }
    delete (bindingStates as any)[geometry.id];
  }
  function releaseStatesOfProgram(program?: any) {
    for (const geometryId in bindingStates) {
      const objectMap = (bindingStates as any)[geometryId];
      for (const objectId in objectMap) {
        const programMap = objectMap[objectId];
        if (programMap[program.id] === undefined) continue;
        const stateMap = programMap[program.id];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[program.id];
      }
    }
  }
  function releaseStatesOfObject(object?: any) {
    for (const geometryId in bindingStates) {
      const objectMap = (bindingStates as any)[geometryId];
      const objectId = object.isInstancedMesh === true ? object.id : 0;
      const programMap = objectMap[objectId];
      if (programMap === undefined) continue;
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
      delete objectMap[objectId];
      if (Object.keys(objectMap).length === 0) {
        delete (bindingStates as any)[geometryId];
      }
    }
  }
  function reset() {
    resetDefaultState();
    forceUpdate = true;
    if (currentState === defaultState) return;
    currentState = defaultState;
    bindVertexArrayObject(currentState.object);
  }
  // for backward-compatibility
  function resetDefaultState() {
    defaultState.geometry = null;
    defaultState.program = null;
    defaultState.wireframe = false;
  }
  return {
    setup: setup,
    reset: reset,
    resetDefaultState: resetDefaultState,
    dispose: dispose,
    releaseStatesOfGeometry: releaseStatesOfGeometry,
    releaseStatesOfObject: releaseStatesOfObject,
    releaseStatesOfProgram: releaseStatesOfProgram,
    initAttributes: initAttributes,
    enableAttribute: enableAttribute,
    disableUnusedAttributes: disableUnusedAttributes,
  };
}
