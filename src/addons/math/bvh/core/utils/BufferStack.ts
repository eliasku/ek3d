export class BufferStackClass {
  float32Array: Float32Array = null!;
  uint16Array: Uint16Array = null!;
  uint32Array: Uint32Array = null!;
  private stack: ArrayBufferLike[] = [];
  private prevBuffer: ArrayBufferLike | null = null;

  setBuffer(buffer: ArrayBufferLike): void {
    if (this.prevBuffer) this.stack.push(this.prevBuffer);
    this.prevBuffer = buffer;
    this.float32Array = new Float32Array(buffer);
    this.uint16Array = new Uint16Array(buffer);
    this.uint32Array = new Uint32Array(buffer);
  }

  clearBuffer(): void {
    this.prevBuffer = null;
    this.float32Array = null!;
    this.uint16Array = null!;
    this.uint32Array = null!;
    if (this.stack.length !== 0) this.setBuffer(this.stack.pop()!);
  }
}

export const BufferStack = new BufferStackClass();
