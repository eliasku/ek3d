import { GL } from "../../GL";
import { warn } from "../../utils";
import type { Color } from "../../math/Color";
import type { Vector2 } from "../../math/Vector2";
import type { Vector3 } from "../../math/Vector3";
import type { Vector4 } from "../../math/Vector4";
import type { Matrix3 } from "../../math/Matrix3";
import type { Matrix4 } from "../../math/Matrix4";
import type { Uniform } from "../../core/Uniform";
import type { UniformsGroup } from "../../core/UniformsGroup";
import type { DataTextureImageData } from "../../textures/DataTexture";
import type { WebGLCapabilitiesState } from "./WebGLCapabilities";
import type { WebGLInfoState } from "./WebGLInfo";
import type { WebGLProgramInfo } from "./WebGLProgram";
import type { WebGLState } from "./WebGLState";
import type { Texture } from "../../textures/Texture";

type BufferedUniform = Uniform & {
  __data?: Float32Array | Int32Array | Uint32Array;
  __offset?: number;
};

type BufferedUniformsGroup = UniformsGroup & {
  __size?: number;
  __cache?: Record<string, unknown>;
};

export class WebGLUniformsGroups {
  private buffers: Record<string, WebGLBuffer | null> = {};
  private groups: Record<string, UniformsGroup> = {};
  private updateList: Record<string, number> = {};

  constructor(
    private gl: WebGL2RenderingContext,
    private info: WebGLInfoState,
    capabilities: WebGLCapabilitiesState,
    private state: WebGLState,
  ) {
    this.onUniformsGroupsDispose = this.onUniformsGroupsDispose.bind(this);
    this.bind = this.bind.bind(this);
    this.update = this.update.bind(this);
    this.dispose = this.dispose.bind(this);
  }

  bind(uniformsGroup: UniformsGroup, program: WebGLProgramInfo) {
    const webglProgram = program.program;
    this.state.uniformBlockBinding(uniformsGroup, webglProgram, this.buffers[uniformsGroup.id]);
  }

  update(uniformsGroup: UniformsGroup, program: WebGLProgramInfo) {
    let buffer = this.buffers[uniformsGroup.id];
    if (buffer === undefined) {
      this.prepareUniformsGroup(uniformsGroup);
      buffer = this.createBuffer(uniformsGroup);
      this.buffers[uniformsGroup.id] = buffer;
      uniformsGroup.addEventListener("dispose", this.onUniformsGroupsDispose);
      this.groups[uniformsGroup.id] = uniformsGroup;
    }
    // ensure to update the binding points/block indices mapping for this program
    const webglProgram = program.program;
    this.state.updateUBOMapping(uniformsGroup, webglProgram);
    // update UBO once per frame
    const frame = this.info.render.frame;
    if (this.updateList[uniformsGroup.id] !== frame) {
      this.updateBufferData(uniformsGroup);
      this.updateList[uniformsGroup.id] = frame;
    }
  }

  private createBuffer(uniformsGroup: BufferedUniformsGroup) {
    const buffer = this.gl.createBuffer();
    const size = uniformsGroup.__size!;
    const usage = uniformsGroup.usage;
    this.gl.bindBuffer(GL.UNIFORM_BUFFER, buffer);
    this.gl.bufferData(GL.UNIFORM_BUFFER, size, usage);
    this.gl.bindBuffer(GL.UNIFORM_BUFFER, null);
    return buffer;
  }

  private updateBufferData(uniformsGroup: BufferedUniformsGroup) {
    const buffer = this.buffers[uniformsGroup.id];
    const uniforms = uniformsGroup.uniforms;
    const cache = uniformsGroup.__cache!;
    this.gl.bindBuffer(GL.UNIFORM_BUFFER, buffer);
    for (let i = 0, il = uniforms.length; i < il; i++) {
      const uniformItem = uniforms[i];
      if (Array.isArray(uniformItem)) {
        for (let j = 0, jl = uniformItem.length; j < jl; j++) {
          this.updateUniform(uniformItem[j], i, j, cache);
        }
      } else {
        this.updateUniform(uniformItem, i, 0, cache);
      }
    }
    this.gl.bindBuffer(GL.UNIFORM_BUFFER, null);
  }

  private updateUniform(uniform: BufferedUniform, index: number, indexArray: number, cache: Record<string, unknown>) {
    if (this.hasUniformChanged(uniform, index, indexArray, cache) === true) {
      const offset = uniform.__offset!;
      const value = uniform.value;
      if (Array.isArray(value)) {
        let arrayOffset = 0;
        for (let k = 0; k < value.length; k++) {
          const val = value[k];
          const info = this.getUniformSize(val, true);
          this.writeUniformValue(val, uniform.__data!, arrayOffset);
          arrayOffset += info.storage / Float32Array.BYTES_PER_ELEMENT;
        }
      } else {
        this.writeUniformValue(value, uniform.__data!, 0);
      }
      this.gl.bufferSubData(GL.UNIFORM_BUFFER, offset, uniform.__data!);
    }
  }

  private writeUniformValue(value: unknown, data: Float32Array | Int32Array | Uint32Array, offset: number) {
    // TODO add integer vector and struct support
    if (typeof value === "number" || typeof value === "boolean") {
      data[offset] = value as number;
    } else if ((value as Matrix3).isMatrix3) {
      // manually converting 3x3 to 3x4
      data[offset] = (value as Matrix3).elements[0];
      data[offset + 1] = (value as Matrix3).elements[1];
      data[offset + 2] = (value as Matrix3).elements[2];
      data[offset + 3] = 0;
      data[offset + 4] = (value as Matrix3).elements[3];
      data[offset + 5] = (value as Matrix3).elements[4];
      data[offset + 6] = (value as Matrix3).elements[5];
      data[offset + 7] = 0;
      data[offset + 8] = (value as Matrix3).elements[6];
      data[offset + 9] = (value as Matrix3).elements[7];
      data[offset + 10] = (value as Matrix3).elements[8];
      data[offset + 11] = 0;
    } else if (ArrayBuffer.isView(value)) {
      // copy the buffer data using "set"
      data.set((value as NonNullable<DataTextureImageData>).subarray(0, data.length - offset), offset);
    } else if ((value as Color).isColor) {
      (value as Color).toArray(data, offset);
    } else if ((value as Vector2).isVector2) {
      (value as Vector2).toArray(data, offset);
    } else if ((value as Vector3).isVector3) {
      (value as Vector3).toArray(data, offset);
    } else if ((value as Vector4).isVector4) {
      (value as Vector4).toArray(data, offset);
    } else if ((value as Matrix4).isMatrix4) {
      (value as Matrix4).toArray(data, offset);
    } else {
      // Custom uniform values supply their own array serialization.
      const uniformValue = value as { toArray(data: Float32Array | Int32Array | Uint32Array, offset: number): void };
      uniformValue.toArray(data, offset);
    }
  }

  private hasUniformChanged(uniform: Uniform, index: number, indexArray: number, cache: Record<string, unknown>) {
    const value = uniform.value;
    const indexString = index + "_" + indexArray;
    if (Array.isArray(value)) {
      // arrays are cached per element
      if (cache[indexString] === undefined) cache[indexString] = [];
      const cachedArray = cache[indexString] as Record<string, unknown>;
      let changed = false;
      for (let k = 0; k < value.length; k++) {
        if (this.hasValueChanged(value[k], cachedArray, k) === true) changed = true;
      }
      return changed;
    }
    return this.hasValueChanged(value, cache, indexString);
  }

  private hasValueChanged(value: unknown, cache: Record<string, unknown>, key: string | number) {
    if (cache[key] === undefined) {
      // cache entry does not exist so far
      if (typeof value === "number" || typeof value === "boolean") {
        cache[key] = value;
      } else if (ArrayBuffer.isView(value)) {
        cache[key] = (value as NonNullable<DataTextureImageData>).slice();
      } else if ((value as Color).isColor) {
        cache[key] = (value as Color).clone();
      } else if ((value as Vector2).isVector2) {
        cache[key] = (value as Vector2).clone();
      } else if ((value as Vector3).isVector3) {
        cache[key] = (value as Vector3).clone();
      } else if ((value as Vector4).isVector4) {
        cache[key] = (value as Vector4).clone();
      } else if ((value as Matrix3).isMatrix3) {
        cache[key] = (value as Matrix3).clone();
      } else if ((value as Matrix4).isMatrix4) {
        cache[key] = (value as Matrix4).clone();
      } else {
        // Custom uniform values supply their own cache cloning.
        const cloneable = value as { clone(): unknown };
        cache[key] = cloneable.clone();
      }
      return true;
    } else {
      const cachedObject = cache[key];
      // compare current value with cached entry
      if (typeof value === "number" || typeof value === "boolean") {
        if (cachedObject !== value) {
          cache[key] = value;
          return true;
        }
      } else if (ArrayBuffer.isView(value)) {
        // always update the array buffers
        return true;
      } else if ((cachedObject as Color).isColor) {
        if ((cachedObject as Color).equals(value as Color) === false) {
          (cachedObject as Color).copy(value as Color);
          return true;
        }
      } else if ((cachedObject as Vector2).isVector2) {
        if ((cachedObject as Vector2).equals(value as Vector2) === false) {
          (cachedObject as Vector2).copy(value as Vector2);
          return true;
        }
      } else if ((cachedObject as Vector3).isVector3) {
        if ((cachedObject as Vector3).equals(value as Vector3) === false) {
          (cachedObject as Vector3).copy(value as Vector3);
          return true;
        }
      } else if ((cachedObject as Vector4).isVector4) {
        if ((cachedObject as Vector4).equals(value as Vector4) === false) {
          (cachedObject as Vector4).copy(value as Vector4);
          return true;
        }
      } else if ((cachedObject as Matrix3).isMatrix3) {
        if ((cachedObject as Matrix3).equals(value as Matrix3) === false) {
          (cachedObject as Matrix3).copy(value as Matrix3);
          return true;
        }
      } else if ((cachedObject as Matrix4).isMatrix4) {
        if ((cachedObject as Matrix4).equals(value as Matrix4) === false) {
          (cachedObject as Matrix4).copy(value as Matrix4);
          return true;
        }
      } else {
        // Custom cached values retain the clone's equality/copy protocol.
        const cachedValue = cachedObject as { equals(value: unknown): boolean; copy(value: unknown): unknown };
        if (cachedValue.equals(value) === false) {
          cachedValue.copy(value);
          return true;
        }
      }
    }
    return false;
  }

  private prepareUniformsGroup(uniformsGroup: BufferedUniformsGroup) {
    // determine total buffer size according to the STD140 layout
    // Hint: STD140 is the only supported layout in WebGL 2
    const uniforms = uniformsGroup.uniforms;
    let offset = 0; // global buffer offset in bytes
    const chunkSize = 16; // size of a chunk in bytes
    for (let i = 0, l = uniforms.length; i < l; i++) {
      const uniformArray = (Array.isArray(uniforms[i]) ? uniforms[i] : [uniforms[i]]) as BufferedUniform[];
      for (let j = 0, jl = uniformArray.length; j < jl; j++) {
        const uniform = uniformArray[j];
        const values = Array.isArray(uniform.value) ? uniform.value : [uniform.value];
        // arrays of uniforms and uniforms with array values both represent GLSL arrays
        const isArray = Array.isArray(uniforms[i]) || Array.isArray(uniform.value);
        let start = offset;
        for (let k = 0, kl = values.length; k < kl; k++) {
          const value = values[k];
          const info = this.getUniformSize(value, isArray);
          const chunkOffset = offset % chunkSize; // offset in the current chunk
          const chunkPadding = chunkOffset % info.boundary; // required padding to match boundary
          const chunkStart = chunkOffset + chunkPadding; // the start position in the current chunk for the data
          offset += chunkPadding;
          // Check for chunk overflow
          if (chunkStart !== 0 && chunkSize - chunkStart < info.storage) {
            // Add padding and adjust offset
            offset += chunkSize - chunkStart;
          }
          if (k === 0) start = offset;
          // Update the global offset
          offset += info.storage;
        }
        // the following two properties will be used for partial buffer updates
        const ArrayType = uniform.type === "int" ? Int32Array : uniform.type === "uint" ? Uint32Array : Float32Array;
        uniform.__data = new ArrayType((offset - start) / Float32Array.BYTES_PER_ELEMENT);
        uniform.__offset = start;
      }
    }
    // ensure correct final padding
    const chunkOffset = offset % chunkSize;
    if (chunkOffset > 0) offset += chunkSize - chunkOffset;
    //
    uniformsGroup.__size = offset;
    uniformsGroup.__cache = {};
    return this;
  }

  private getUniformSize(value: unknown, isArrayElement: boolean) {
    const info = {
      boundary: 0, // bytes
      storage: 0, // bytes
    };
    // determine sizes according to STD140
    if (typeof value === "number" || typeof value === "boolean") {
      // float/int/bool
      info.boundary = 4;
      info.storage = 4;
    } else if ((value as Vector2).isVector2) {
      // vec2
      info.boundary = 8;
      info.storage = 8;
    } else if ((value as Vector3).isVector3 || (value as Color).isColor) {
      // vec3
      info.boundary = 16;
      info.storage = 12; // evil: vec3 must start on a 16-byte boundary but it only consumes 12 bytes
    } else if ((value as Vector4).isVector4) {
      // vec4
      info.boundary = 16;
      info.storage = 16;
    } else if ((value as Matrix3).isMatrix3) {
      // mat3 (in STD140 a 3x3 matrix is represented as 3x4)
      info.boundary = 16;
      info.storage = 48;
    } else if ((value as Matrix4).isMatrix4) {
      // mat4
      info.boundary = 16;
      info.storage = 64;
    } else if ((value as Texture).isTexture) {
      warn("WebGLRenderer: Texture samplers can not be part of an uniforms group.");
    } else if (ArrayBuffer.isView(value)) {
      info.boundary = 16;
      info.storage = value.byteLength;
    } else {
      warn("WebGLRenderer: Unsupported uniform value type.", value);
    }
    if (isArrayElement === true) {
      // the alignment and stride of array elements are rounded up to the size of a vec4
      info.boundary = 16;
      info.storage = Math.ceil(info.storage / 16) * 16;
    }
    return info;
  }

  private onUniformsGroupsDispose(event: { target: UniformsGroup }) {
    const uniformsGroup = event.target;
    uniformsGroup.removeEventListener("dispose", this.onUniformsGroupsDispose);
    delete this.groups[uniformsGroup.id];
    this.gl.deleteBuffer(this.buffers[uniformsGroup.id]);
    delete this.buffers[uniformsGroup.id];
    delete this.updateList[uniformsGroup.id];
  }

  dispose() {
    for (const id in this.buffers) {
      this.groups[id].removeEventListener("dispose", this.onUniformsGroupsDispose);
      this.gl.deleteBuffer(this.buffers[id]);
    }
    this.buffers = {};
    this.groups = {};
    this.updateList = {};
  }
}
