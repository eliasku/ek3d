export class BVHNode {
  boundingData: Float32Array = new Float32Array(6);
  offset: number | undefined;
  count: number | undefined;
  left: BVHNode | undefined;
  right: BVHNode | undefined;
  splitAxis: number | undefined;
  buffer: ArrayBufferLike | undefined;
}
