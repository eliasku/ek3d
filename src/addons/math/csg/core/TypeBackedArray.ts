import { areSharedArrayBuffersSupported } from "./utils/geometryUtils";

export type NumericArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
export interface NumericArrayConstructor {
  new (buffer: ArrayBufferLike): NumericArray;
  readonly BYTES_PER_ELEMENT: number;
}

function ceilToFourByteStride(byteLength: number): number {
  byteLength = ~~byteLength;
  return byteLength + 4 - (byteLength % 4);
}

export class TypeBackedArray {
  expansionFactor: number;
  type: NumericArrayConstructor;
  length: number;
  array: NumericArray;

  constructor(type: NumericArrayConstructor, initialSize = 500) {
    this.expansionFactor = 1.5;
    this.type = type;
    this.length = 0;
    const bufferType = areSharedArrayBuffersSupported() ? SharedArrayBuffer : ArrayBuffer;
    this.array = new type(new bufferType(ceilToFourByteStride(initialSize * type.BYTES_PER_ELEMENT)));
  }

  setType(type: NumericArrayConstructor): void {
    if (type === this.type) return;
    if (this.length !== 0)
      throw new Error("TypeBackedArray: Cannot change the type while there is used data in the buffer.");
    this.array = new type(this.array.buffer);
    this.type = type;
  }

  setSize(size: number): void {
    if (size === this.array.length) return;
    const type = this.type;
    const bufferType = areSharedArrayBuffersSupported() ? SharedArrayBuffer : ArrayBuffer;
    const newArray = new type(new bufferType(ceilToFourByteStride(size * type.BYTES_PER_ELEMENT)));
    newArray.set(this.array, 0);
    this.array = newArray;
  }

  expand(): void {
    this.setSize(this.array.length * this.expansionFactor);
  }

  push(...args: number[]): void {
    let { array, length } = this;
    if (length + args.length > array.length) {
      this.expand();
      array = this.array;
    }
    for (let i = 0; i < args.length; i++) array[length + i] = args[i];
    this.length += args.length;
  }

  clear(): void {
    this.length = 0;
  }
}
