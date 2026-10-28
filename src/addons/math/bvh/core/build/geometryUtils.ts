import { BufferAttribute } from "../../../../../core/BufferAttribute";
import type { BufferGeometry } from "../../../../../core/BufferGeometry";

export interface PrimitiveRange {
  offset: number;
  count: number;
}

export function getVertexCount(geometry: BufferGeometry): number {
  return geometry.index ? geometry.index.count : geometry.attributes.position.count;
}

export function getTriCount(geometry: BufferGeometry): number {
  return getVertexCount(geometry) / 3;
}

export function getIndexArray(
  vertexCount: number,
  BufferConstructor: ArrayBufferConstructor | SharedArrayBufferConstructor = ArrayBuffer,
): Uint16Array | Uint32Array {
  return vertexCount > 65535
    ? new Uint32Array(new BufferConstructor(4 * vertexCount))
    : new Uint16Array(new BufferConstructor(2 * vertexCount));
}

export function ensureIndex(geometry: BufferGeometry, options: { useSharedArrayBuffer?: boolean }): void {
  if (!geometry.index) {
    const vertexCount = geometry.attributes.position.count;
    const index = getIndexArray(vertexCount, options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer);
    geometry.setIndex(new BufferAttribute(index, 1));
    for (let i = 0; i < vertexCount; i++) index[i] = i;
  }
}

export function getRootPrimitiveRanges(
  geometry: BufferGeometry,
  range: { start: number; count: number } | null,
  stride: number,
): PrimitiveRange[] {
  const primitiveCount = getVertexCount(geometry) / stride;
  const drawRange = range ?? geometry.drawRange;
  const offset = Math.max(0, drawRange.start / stride);
  const count = Math.min(primitiveCount, (drawRange.start + drawRange.count) / stride) - offset;
  const fullRange = { offset: Math.floor(offset), count: Math.floor(count) };
  if (geometry.groups.length === 0) return [fullRange];

  const start = fullRange.offset;
  const end = start + fullRange.count;
  const events: { pos: number; isStart: boolean }[] = [];
  for (const group of geometry.groups) {
    const groupStart = group.start / stride;
    const groupCount = group.count / stride;
    const groupEnd = groupStart + (Number.isFinite(groupCount) ? groupCount : primitiveCount - groupStart);
    if (groupStart < end && groupEnd > start) {
      events.push({ pos: Math.max(start, groupStart), isStart: true });
      events.push({ pos: Math.min(end, groupEnd), isStart: false });
    }
  }
  events.sort((a, b) => a.pos - b.pos || (a.isStart ? 1 : -1));
  const ranges: PrimitiveRange[] = [];
  let activeGroups = 0;
  let lastPos = 0;
  for (const event of events) {
    if (activeGroups !== 0 && event.pos !== lastPos) ranges.push({ offset: lastPos, count: event.pos - lastPos });
    activeGroups += event.isStart ? 1 : -1;
    lastPos = event.pos;
  }
  return ranges;
}
