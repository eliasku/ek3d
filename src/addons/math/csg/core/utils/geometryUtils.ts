import { BufferAttribute } from "../../../../../core/BufferAttribute";
import type { BufferGeometry } from "../../../../../core/BufferGeometry";

export function areSharedArrayBuffersSupported() {
  return typeof SharedArrayBuffer !== "undefined";
}

export function convertToSharedArrayBuffer<T extends BufferAttribute["array"]>(array: T): T {
  if (array.buffer instanceof SharedArrayBuffer) {
    return array;
  }

  const cons = array.constructor as { new (buffer: SharedArrayBuffer): T };
  const buffer = array.buffer;
  const sharedBuffer = new SharedArrayBuffer(buffer.byteLength);

  const uintArray = new Uint8Array(buffer);
  const sharedUintArray = new Uint8Array(sharedBuffer);
  sharedUintArray.set(uintArray, 0);

  return new cons(sharedBuffer);
}

export function getIndexArray(
  vertexCount: number,
  BufferConstructor: ArrayBufferConstructor | SharedArrayBufferConstructor = ArrayBuffer,
) {
  if (vertexCount > 65535) {
    return new Uint32Array(new BufferConstructor(4 * vertexCount));
  } else {
    return new Uint16Array(new BufferConstructor(2 * vertexCount));
  }
}

export function ensureIndex(geo: BufferGeometry, options: { useSharedArrayBuffer?: boolean }) {
  if (!geo.index) {
    const vertexCount = geo.attributes.position.count;
    const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
    const index = getIndexArray(vertexCount, BufferConstructor);
    geo.setIndex(new BufferAttribute(index, 1));

    for (let i = 0; i < vertexCount; i++) {
      index[i] = i;
    }
  }
}

export function getVertexCount(geo: BufferGeometry) {
  return geo.index ? geo.index.count : geo.attributes.position.count;
}

export function getTriCount(geo: BufferGeometry) {
  return getVertexCount(geo) / 3;
}
