export function isSharedArrayBufferSupported() {
  return typeof SharedArrayBuffer !== "undefined";
}

type NumericArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float16Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;
type BufferType = ArrayBuffer | SharedArrayBuffer;
type BufferConstructor = { new (byteLength: number): BufferType };
export function convertToBufferType<T extends NumericArray | BufferType | null>(
  array: T,
  BufferConstructor: BufferConstructor,
): T {
  if (array === null) return array;
  if (ArrayBuffer.isView(array)) {
    const buffer = array.buffer;
    if (buffer.constructor === BufferConstructor) return array;
    const ArrayConstructor = array.constructor as { new (buffer: BufferType): NumericArray };
    const result = new ArrayConstructor(new BufferConstructor(buffer.byteLength));
    new Uint8Array(result.buffer, result.byteOffset, array.byteLength).set(
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength),
    );
    return result as T;
  }
  if (array.constructor === BufferConstructor) return array;
  const result = new BufferConstructor(array.byteLength);
  new Uint8Array(result).set(new Uint8Array(array));
  return result as T;
}
