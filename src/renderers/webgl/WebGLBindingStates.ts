import { GL } from "../../GL";
import { TextureType } from "../../constants";
import type { WebGLAttributes } from "./WebGLAttributes";
import type { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import type { InstancedBufferAttribute } from "../../core/InstancedBufferAttribute";
import type { InstancedInterleavedBuffer } from "../../core/InstancedInterleavedBuffer";
import type { InterleavedBuffer } from "../../core/InterleavedBuffer";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Material } from "../../materials/Material";
import type { ShaderMaterial } from "../../materials/ShaderMaterial";
import type { WebGLProgramInfo } from "./WebGLProgram";

type BindingMaterial = Material & Partial<Pick<ShaderMaterial, "wireframe" | "defaultAttributeValues">>;
type BindingProgram = Pick<WebGLProgramInfo, "id" | "getAttributes">;

interface BindingGeometry extends BufferGeometry {
  _maxInstanceCount?: number;
}

interface BindingObject {
  id?: number;
  isInstancedMesh?: boolean;
  instanceMatrix?: InstancedBufferAttribute;
  instanceColor?: InstancedBufferAttribute | null;
}

interface CachedAttribute {
  attribute?: BufferGeometry["attributes"][string];
  data?: BufferAttribute | InterleavedBuffer;
}

interface BindingState {
  geometry: null;
  program: null;
  wireframe: boolean;
  newAttributes: number[];
  enabledAttributes: number[];
  attributeDivisors: number[];
  object: WebGLVertexArrayObject | null;
  attributes: Record<string, CachedAttribute>;
  index: BufferAttribute | null;
  attributesNum?: number;
}
function createBindingState(maxVertexAttributes: number, vao: WebGLVertexArrayObject | null): BindingState {
  const newAttributes: number[] = [];
  const enabledAttributes: number[] = [];
  const attributeDivisors: number[] = [];
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
export class WebGLBindingStates {
  private gl: WebGL2RenderingContext;
  private attributes: WebGLAttributes;
  private maxVertexAttributes: number;
  private bindingStates: Record<string, Record<string, Record<string, Record<string, BindingState>>>>;
  private defaultState: BindingState;
  private currentState: BindingState;
  private forceUpdate: boolean;

  constructor(gl: WebGL2RenderingContext, attributes: WebGLAttributes) {
    this.gl = gl;
    this.attributes = attributes;
    this.maxVertexAttributes = this.gl.getParameter(GL.MAX_VERTEX_ATTRIBS);
    this.bindingStates = {};
    this.defaultState = createBindingState(this.maxVertexAttributes, null);
    this.currentState = this.defaultState;
    this.forceUpdate = false;
    this.setup = this.setup.bind(this);
    this.reset = this.reset.bind(this);
    this.resetDefaultState = this.resetDefaultState.bind(this);
    this.dispose = this.dispose.bind(this);
    this.releaseStatesOfGeometry = this.releaseStatesOfGeometry.bind(this);
    this.releaseStatesOfObject = this.releaseStatesOfObject.bind(this);
    this.releaseStatesOfProgram = this.releaseStatesOfProgram.bind(this);
    this.initAttributes = this.initAttributes.bind(this);
    this.enableAttribute = this.enableAttribute.bind(this);
    this.disableUnusedAttributes = this.disableUnusedAttributes.bind(this);
  }
  setup(
    object: BindingObject,
    material: BindingMaterial,
    program: BindingProgram,
    geometry: BindingGeometry,
    index: BufferAttribute | null,
  ): void {
    let updateBuffers = false;
    const state = this.getBindingState(object, geometry, program, material);
    if (this.currentState !== state) {
      this.currentState = state;
      this.bindVertexArrayObject(this.currentState.object);
    }
    updateBuffers = this.needsUpdate(object, geometry, program, index);
    if (updateBuffers) this.saveCache(object, geometry, program, index);
    if (index !== null) {
      this.attributes.update(index, GL.ELEMENT_ARRAY_BUFFER);
    }
    if (updateBuffers || this.forceUpdate) {
      this.forceUpdate = false;
      this.setupVertexAttributes(object, material, program, geometry);
      if (index !== null) {
        this.gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, this.attributes.get(index)!.buffer);
      }
    }
  }
  private createVertexArrayObject(): WebGLVertexArrayObject | null {
    return this.gl.createVertexArray();
  }
  private bindVertexArrayObject(vao: WebGLVertexArrayObject | null): void {
    return this.gl.bindVertexArray(vao);
  }
  private deleteVertexArrayObject(vao: WebGLVertexArrayObject | null): void {
    return this.gl.deleteVertexArray(vao);
  }
  private getBindingState(
    object: BindingObject,
    geometry: BufferGeometry,
    program: BindingProgram,
    material: BindingMaterial,
  ): BindingState {
    const wireframe = material.wireframe === true ? "true" : "false";
    let objectMap = this.bindingStates[geometry.id];
    if (objectMap === undefined) {
      objectMap = {};
      this.bindingStates[geometry.id] = objectMap;
    }
    // Each InstancedMesh requires unique binding states because it contains instanced attributes.
    const objectId = object.isInstancedMesh === true ? object.id! : 0;
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
    let state = stateMap[wireframe];
    if (state === undefined) {
      state = createBindingState(this.maxVertexAttributes, this.createVertexArrayObject());
      stateMap[wireframe] = state;
    }
    return state;
  }
  private needsUpdate(
    object: BindingObject,
    geometry: BufferGeometry,
    program: BindingProgram,
    index: BufferAttribute | null,
  ): boolean {
    const cachedAttributes = this.currentState.attributes;
    const geometryAttributes = geometry.attributes;
    let attributesNum = 0;
    const programAttributes = program.getAttributes();
    for (const name in programAttributes) {
      const programAttribute = programAttributes[name];
      if (programAttribute.location >= 0) {
        const cachedAttribute = cachedAttributes[name];
        let geometryAttribute = geometryAttributes[name];
        if (geometryAttribute === undefined) {
          if (name === "instanceMatrix" && object.instanceMatrix) geometryAttribute = object.instanceMatrix;
          if (name === "instanceColor" && object.instanceColor) geometryAttribute = object.instanceColor;
        }
        if (cachedAttribute === undefined) return true;
        if (cachedAttribute.attribute !== geometryAttribute) return true;
        if (geometryAttribute && cachedAttribute.data !== (geometryAttribute as InterleavedBufferAttribute).data)
          return true;
        attributesNum++;
      }
    }
    if (this.currentState.attributesNum !== attributesNum) return true;
    if (this.currentState.index !== index) return true;
    return false;
  }
  private saveCache(
    object: BindingObject,
    geometry: BufferGeometry,
    program: BindingProgram,
    index: BufferAttribute | null,
  ): void {
    const cache: Record<string, CachedAttribute> = {};
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
        const data: CachedAttribute = {};
        data.attribute = attribute;
        if (attribute && (attribute as InterleavedBufferAttribute).data) {
          data.data = (attribute as InterleavedBufferAttribute).data;
        }
        cache[name] = data;
        attributesNum++;
      }
    }
    this.currentState.attributes = cache;
    this.currentState.attributesNum = attributesNum;
    this.currentState.index = index;
  }
  initAttributes(): void {
    const newAttributes = this.currentState.newAttributes;
    for (let i = 0, il = newAttributes.length; i < il; i++) {
      newAttributes[i] = 0;
    }
  }
  enableAttribute(attribute: number): void {
    this.enableAttributeAndDivisor(attribute, 0);
  }
  private enableAttributeAndDivisor(attribute: number, meshPerAttribute: number): void {
    const newAttributes = this.currentState.newAttributes;
    const enabledAttributes = this.currentState.enabledAttributes;
    const attributeDivisors = this.currentState.attributeDivisors;
    newAttributes[attribute] = 1;
    if (enabledAttributes[attribute] === 0) {
      this.gl.enableVertexAttribArray(attribute);
      enabledAttributes[attribute] = 1;
    }
    if (attributeDivisors[attribute] !== meshPerAttribute) {
      this.gl.vertexAttribDivisor(attribute, meshPerAttribute);
      attributeDivisors[attribute] = meshPerAttribute;
    }
  }
  disableUnusedAttributes(): void {
    const newAttributes = this.currentState.newAttributes;
    const enabledAttributes = this.currentState.enabledAttributes;
    for (let i = 0, il = enabledAttributes.length; i < il; i++) {
      if (enabledAttributes[i] !== newAttributes[i]) {
        this.gl.disableVertexAttribArray(i);
        enabledAttributes[i] = 0;
      }
    }
  }
  private vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    integer: boolean,
  ): void {
    if (integer === true) {
      this.gl.vertexAttribIPointer(index, size, type, stride, offset);
    } else {
      this.gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
    }
  }
  private setupVertexAttributes(
    object: BindingObject,
    material: BindingMaterial,
    program: BindingProgram,
    geometry: BindingGeometry,
  ): void {
    this.initAttributes();
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
          const attribute = this.attributes.get(geometryAttribute);
          // TODO Attribute may not be available on context restore
          if (attribute === undefined) continue;
          const buffer = attribute.buffer;
          const type = attribute.type;
          const bytesPerElement = attribute.bytesPerElement;
          // check for integer attributes
          const integer =
            type === GL.INT ||
            type === GL.UNSIGNED_INT ||
            (geometryAttribute as BufferAttribute).gpuType === TextureType.Int;
          if ((geometryAttribute as InterleavedBufferAttribute).isInterleavedBufferAttribute) {
            // interleaved attributes can also view a buffer attribute, e.g. the columns of instance matrices
            const data = (geometryAttribute as InterleavedBufferAttribute).data as InterleavedBuffer | BufferAttribute;
            const stride =
              (data as InterleavedBuffer).isInterleavedBuffer === true
                ? (data as InterleavedBuffer).stride
                : (data as BufferAttribute).itemSize;
            const offset = (geometryAttribute as InterleavedBufferAttribute).offset;
            if (
              (data as InstancedInterleavedBuffer).isInstancedInterleavedBuffer ||
              (data as InstancedBufferAttribute).isInstancedBufferAttribute
            ) {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                this.enableAttributeAndDivisor(
                  programAttribute.location + i,
                  (data as InstancedInterleavedBuffer | InstancedBufferAttribute).meshPerAttribute,
                );
              }
              if (object.isInstancedMesh !== true && geometry._maxInstanceCount === undefined) {
                geometry._maxInstanceCount =
                  (data as InstancedInterleavedBuffer | InstancedBufferAttribute).meshPerAttribute * data.count;
              }
            } else {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                this.enableAttribute(programAttribute.location + i);
              }
            }
            this.gl.bindBuffer(GL.ARRAY_BUFFER, buffer);
            for (let i = 0; i < programAttribute.locationSize; i++) {
              this.vertexAttribPointer(
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
            if ((geometryAttribute as InstancedBufferAttribute).isInstancedBufferAttribute) {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                this.enableAttributeAndDivisor(
                  programAttribute.location + i,
                  (geometryAttribute as InstancedBufferAttribute).meshPerAttribute,
                );
              }
              if (object.isInstancedMesh !== true && geometry._maxInstanceCount === undefined) {
                geometry._maxInstanceCount =
                  (geometryAttribute as InstancedBufferAttribute).meshPerAttribute * geometryAttribute.count;
              }
            } else {
              for (let i = 0; i < programAttribute.locationSize; i++) {
                this.enableAttribute(programAttribute.location + i);
              }
            }
            this.gl.bindBuffer(GL.ARRAY_BUFFER, buffer);
            for (let i = 0; i < programAttribute.locationSize; i++) {
              this.vertexAttribPointer(
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
                this.gl.vertexAttrib2fv(programAttribute.location, value);
                break;
              case 3:
                this.gl.vertexAttrib3fv(programAttribute.location, value);
                break;
              case 4:
                this.gl.vertexAttrib4fv(programAttribute.location, value);
                break;
              default:
                this.gl.vertexAttrib1fv(programAttribute.location, value);
            }
          }
        }
      }
    }
    this.disableUnusedAttributes();
  }
  dispose(): void {
    this.reset();
    for (const geometryId in this.bindingStates) {
      const objectMap = this.bindingStates[geometryId];
      for (const objectId in objectMap) {
        const programMap = objectMap[objectId];
        for (const programId in programMap) {
          const stateMap = programMap[programId];
          for (const wireframe in stateMap) {
            this.deleteVertexArrayObject(stateMap[wireframe].object);
            delete stateMap[wireframe];
          }
          delete programMap[programId];
        }
      }
      delete this.bindingStates[geometryId];
    }
  }
  releaseStatesOfGeometry(geometry: Pick<BufferGeometry, "id">): void {
    if (this.bindingStates[geometry.id] === undefined) return;
    const objectMap = this.bindingStates[geometry.id];
    for (const objectId in objectMap) {
      const programMap = objectMap[objectId];
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          this.deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
    }
    delete this.bindingStates[geometry.id];
  }
  releaseStatesOfProgram(program: Pick<WebGLProgramInfo, "id">): void {
    for (const geometryId in this.bindingStates) {
      const objectMap = this.bindingStates[geometryId];
      for (const objectId in objectMap) {
        const programMap = objectMap[objectId];
        if (programMap[program.id] === undefined) continue;
        const stateMap = programMap[program.id];
        for (const wireframe in stateMap) {
          this.deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[program.id];
      }
    }
  }
  releaseStatesOfObject(object: BindingObject): void {
    for (const geometryId in this.bindingStates) {
      const objectMap = this.bindingStates[geometryId];
      const objectId = object.isInstancedMesh === true ? object.id! : 0;
      const programMap = objectMap[objectId];
      if (programMap === undefined) continue;
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          this.deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
      delete objectMap[objectId];
      if (Object.keys(objectMap).length === 0) {
        delete this.bindingStates[geometryId];
      }
    }
  }
  reset(): void {
    this.resetDefaultState();
    this.forceUpdate = true;
    if (this.currentState === this.defaultState) return;
    this.currentState = this.defaultState;
    this.bindVertexArrayObject(this.currentState.object);
  }
  resetDefaultState(): void {
    this.defaultState.geometry = null;
    this.defaultState.program = null;
    this.defaultState.wireframe = false;
  }
}
