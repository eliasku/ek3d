import { GL } from "../../GL";
import type { BufferAttribute, Float16BufferAttribute } from "../../core/BufferAttribute";
import type { GLBufferAttribute } from "../../core/GLBufferAttribute";
import type { InterleavedBuffer } from "../../core/InterleavedBuffer";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";

type Attribute = BufferAttribute | GLBufferAttribute | InterleavedBuffer | InterleavedBufferAttribute;

export interface AttributeBuffer {
  buffer: WebGLBuffer | null;
  type: number;
  bytesPerElement: number;
  version: number;
  size?: number;
}
export class WebGLAttributes {
  private gl: WebGL2RenderingContext;
  private buffers: WeakMap<Attribute, AttributeBuffer> = new WeakMap();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.get = this.get.bind(this);
    this.remove = this.remove.bind(this);
    this.update = this.update.bind(this);
  }
  private createBuffer(attribute: BufferAttribute | InterleavedBuffer, bufferType: number): AttributeBuffer {
    const array = attribute.array;
    const usage = attribute.usage;
    const size = array.byteLength;
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(bufferType, buffer);
    this.gl.bufferData(bufferType, array, usage);
    const uploadable: { onUploadCallback(): void } = attribute;
    uploadable.onUploadCallback();
    let type: number;
    if (array instanceof Float32Array) {
      type = GL.FLOAT;
    } else if (typeof Float16Array !== "undefined" && array instanceof Float16Array) {
      type = GL.HALF_FLOAT;
    } else if (array instanceof Uint16Array) {
      if ((attribute as Float16BufferAttribute).isFloat16BufferAttribute) {
        type = GL.HALF_FLOAT;
      } else {
        type = GL.UNSIGNED_SHORT;
      }
    } else if (array instanceof Int16Array) {
      type = GL.SHORT;
    } else if (array instanceof Uint32Array) {
      type = GL.UNSIGNED_INT;
    } else if (array instanceof Int32Array) {
      type = GL.INT;
    } else if (array instanceof Int8Array) {
      type = GL.BYTE;
    } else if (array instanceof Uint8Array) {
      type = GL.UNSIGNED_BYTE;
    } else if (array instanceof Uint8ClampedArray) {
      type = GL.UNSIGNED_BYTE;
    } else {
      throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: " + array);
    }
    return {
      buffer: buffer,
      type: type,
      bytesPerElement: array.BYTES_PER_ELEMENT,
      version: attribute.version,
      size: size,
    };
  }
  private updateBuffer(
    buffer: WebGLBuffer | null,
    attribute: BufferAttribute | InterleavedBuffer,
    bufferType: number,
  ): void {
    const array = attribute.array;
    const updateRanges = attribute.updateRanges;
    this.gl.bindBuffer(bufferType, buffer);
    if (updateRanges.length === 0) {
      // Not using update ranges
      this.gl.bufferSubData(bufferType, 0, array);
    } else {
      // Before applying update ranges, we merge any adjacent / overlapping
      // ranges to reduce load on `gl.bufferSubData`. Empirically, this has led
      // to performance improvements for applications which make heavy use of
      // update ranges. Likely due to GPU command overhead.
      //
      // Note that to reduce garbage collection between frames, we merge the
      // update ranges in-place. This is safe because this method will clear the
      // update ranges once updated.
      updateRanges.sort((a, b) => a.start - b.start);
      // To merge the update ranges in-place, we work from left to right in the
      // existing updateRanges array, merging ranges. This may result in a final
      // array which is smaller than the original. This index tracks the last
      // index representing a merged range, any data after this index can be
      // trimmed once the merge algorithm is completed.
      let mergeIndex = 0;
      for (let i = 1; i < updateRanges.length; i++) {
        const previousRange = updateRanges[mergeIndex];
        const range = updateRanges[i];
        // We add one here to merge adjacent ranges. This is safe because ranges
        // operate over positive integers.
        if (range.start <= previousRange.start + previousRange.count + 1) {
          previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
        } else {
          ++mergeIndex;
          updateRanges[mergeIndex] = range;
        }
      }
      // Trim the array to only contain the merged ranges.
      updateRanges.length = mergeIndex + 1;
      for (let i = 0, l = updateRanges.length; i < l; i++) {
        const range = updateRanges[i];
        this.gl.bufferSubData(bufferType, range.start * array.BYTES_PER_ELEMENT, array, range.start, range.count);
      }
      attribute.clearUpdateRanges();
    }
    const uploadable: { onUploadCallback(): void } = attribute;
    uploadable.onUploadCallback();
  }
  get(attribute: Attribute): AttributeBuffer | undefined {
    if ((attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute)
      attribute = (attribute as InterleavedBufferAttribute).data;
    return this.buffers.get(attribute);
  }
  remove(attribute: Attribute): void {
    if ((attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute)
      attribute = (attribute as InterleavedBufferAttribute).data;
    const data = this.buffers.get(attribute);
    if (data) {
      this.gl.deleteBuffer(data.buffer);
      this.buffers.delete(attribute);
    }
  }
  update(attribute: Attribute, bufferType: number): void {
    if ((attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute)
      attribute = (attribute as InterleavedBufferAttribute).data;
    if ((attribute as GLBufferAttribute).isGLBufferAttribute) {
      const glAttribute = attribute as GLBufferAttribute;
      const cached = this.buffers.get(attribute);
      if (!cached || cached.version < glAttribute.version) {
        this.buffers.set(attribute, {
          buffer: glAttribute.buffer,
          type: glAttribute.type,
          bytesPerElement: glAttribute.elementSize,
          version: glAttribute.version,
        });
      }
      return;
    }
    const bufferAttribute = attribute as BufferAttribute | InterleavedBuffer;
    const data = this.buffers.get(attribute);
    if (data === undefined) {
      this.buffers.set(attribute, this.createBuffer(bufferAttribute, bufferType));
    } else if (data.version < bufferAttribute.version) {
      if (data.size !== bufferAttribute.array.byteLength) {
        throw new Error(
          "THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.",
        );
      }
      this.updateBuffer(data.buffer, bufferAttribute, bufferType);
      data.version = bufferAttribute.version;
    }
  }
}
