import type { BufferAttribute } from "../../../../../core/BufferAttribute";
import type { PrimitiveBounds } from "./computeBoundsUtils";

export function partition(
  buffer: BufferAttribute["array"],
  stride: number,
  primitiveBounds: PrimitiveBounds,
  offset: number,
  count: number,
  split: { axis: number; pos: number },
): number {
  let left = offset;
  let right = offset + count - 1;
  const axisOffset = split.axis * 2;
  const boundsOffset = primitiveBounds.offset || 0;
  while (true) {
    while (left <= right && primitiveBounds[(left - boundsOffset) * 6 + axisOffset] < split.pos) left++;
    while (left <= right && primitiveBounds[(right - boundsOffset) * 6 + axisOffset] >= split.pos) right--;
    if (left >= right) return left;
    for (let i = 0; i < stride; i++) {
      const value = buffer[left * stride + i];
      buffer[left * stride + i] = buffer[right * stride + i];
      buffer[right * stride + i] = value;
    }
    for (let i = 0; i < 6; i++) {
      const l = (left - boundsOffset) * 6 + i;
      const r = (right - boundsOffset) * 6 + i;
      const value = primitiveBounds[l];
      primitiveBounds[l] = primitiveBounds[r];
      primitiveBounds[r] = value;
    }
    left++;
    right--;
  }
}
