import type { BufferAttribute } from "../../../../core/BufferAttribute";
import { Box3 } from "../../../../math/Box3";
import type { Matrix4 } from "../../../../math/Matrix4";
import { BYTES_PER_NODE, UINT32_PER_NODE, DEFAULT_OPTIONS, FLOAT32_EPSILON, type BVHOptions } from "./Constants";
import { arrayToBox } from "../utils/ArrayBoxUtilities";
import { IS_LEAF, LEFT_NODE, RIGHT_NODE, SPLIT_AXIS, COUNT, OFFSET } from "./utils/nodeBufferUtils";
import { buildPackedTree } from "./build/buildTree";
import type { PrimitiveBounds } from "./build/computeBoundsUtils";
import type { PrimitiveRange } from "./build/geometryUtils";
import {
  shapecast as traverseShape,
  type BoundsCallback,
  type RangeCallback,
  type BoundsTraverseOrder,
} from "./cast/shapecast";
import { bvhcast as traverseBVH, type BVHCastRangeCallback } from "./cast/bvhcast";

const tempBox = new Box3();
const tempBuffer = new Float32Array(6);

export interface ShapeCallbacks {
  intersectsBounds: BoundsCallback;
  intersectsRange?: RangeCallback;
  boundsTraverseOrder?: BoundsTraverseOrder;
}

export abstract class BVH {
  _roots: ArrayBufferLike[] = [];
  _indirectBuffer: Uint16Array | Uint32Array | null = null;
  abstract get primitiveBuffer(): BufferAttribute["array"];
  abstract get primitiveBufferStride(): number;
  abstract getRootRanges(range: { start: number; count: number } | null): PrimitiveRange[];
  abstract writePrimitiveBounds(index: number, buffer: Float32Array, offset: number): void;

  init(options: Partial<BVHOptions>): void {
    buildPackedTree(this, { ...DEFAULT_OPTIONS, ...options });
  }

  writePrimitiveRangeBounds(offset: number, count: number, target: Float32Array, base: number): Float32Array {
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (let i = offset; i < offset + count; i++) {
      this.writePrimitiveBounds(i, tempBuffer, 0);
      minX = Math.min(minX, tempBuffer[0]);
      minY = Math.min(minY, tempBuffer[1]);
      minZ = Math.min(minZ, tempBuffer[2]);
      maxX = Math.max(maxX, tempBuffer[3]);
      maxY = Math.max(maxY, tempBuffer[4]);
      maxZ = Math.max(maxZ, tempBuffer[5]);
    }
    target[base] = minX;
    target[base + 1] = minY;
    target[base + 2] = minZ;
    target[base + 3] = maxX;
    target[base + 4] = maxY;
    target[base + 5] = maxZ;
    return target;
  }

  computePrimitiveBounds(offset: number, count: number, target: PrimitiveBounds): PrimitiveBounds {
    for (let i = offset; i < offset + count; i++) {
      this.writePrimitiveBounds(i, tempBuffer, 0);
      const base = (i - (target.offset || 0)) * 6;
      for (let axis = 0; axis < 3; axis++) {
        const lo = tempBuffer[axis],
          hi = tempBuffer[axis + 3];
        const center = (lo + hi) / 2,
          half = (hi - lo) / 2;
        target[base + axis * 2] = center;
        target[base + axis * 2 + 1] = half + (Math.abs(center) + half) * FLOAT32_EPSILON;
      }
    }
    return target;
  }

  shiftPrimitiveOffsets(offset: number): void {
    if (this._indirectBuffer) {
      for (let i = 0; i < this._indirectBuffer.length; i++) this._indirectBuffer[i] += offset;
      return;
    }
    for (const root of this._roots) {
      const u32 = new Uint32Array(root),
        u16 = new Uint16Array(root);
      for (let node = 0; node < root.byteLength / BYTES_PER_NODE; node++) {
        const i = UINT32_PER_NODE * node;
        if (IS_LEAF(i * 2, u16)) u32[i + 6] += offset;
      }
    }
  }

  traverse(
    callback: (
      depth: number,
      leaf: boolean,
      bounds: Float32Array,
      offsetOrAxis: number,
      count?: number,
    ) => boolean | void,
    rootIndex = 0,
  ): void {
    const buffer = this._roots[rootIndex];
    const u32 = new Uint32Array(buffer),
      u16 = new Uint16Array(buffer);
    function visit(index: number, depth: number): void {
      const leaf = IS_LEAF(index * 2, u16);
      const bounds = new Float32Array(buffer, index * 4, 6);
      if (leaf) callback(depth, true, bounds, u32[index + 6], u16[index * 2 + 14]);
      else if (!callback(depth, false, bounds, SPLIT_AXIS(index, u32))) {
        visit(LEFT_NODE(index), depth + 1);
        visit(RIGHT_NODE(index, u32), depth + 1);
      }
    }
    visit(0, 0);
  }

  refit(): void {
    for (const buffer of this._roots) {
      const u32 = new Uint32Array(buffer),
        u16 = new Uint16Array(buffer),
        f32 = new Float32Array(buffer);
      for (let node = buffer.byteLength / BYTES_PER_NODE - 1; node >= 0; node--) {
        const i = node * UINT32_PER_NODE;
        if (IS_LEAF(i * 2, u16)) {
          this.writePrimitiveRangeBounds(OFFSET(i, u32), COUNT(i * 2, u16), tempBuffer, 0);
          f32.set(tempBuffer, i);
        } else {
          const left = LEFT_NODE(i),
            right = RIGHT_NODE(i, u32);
          for (let axis = 0; axis < 3; axis++) {
            f32[i + axis] = Math.min(f32[left + axis], f32[right + axis]);
            f32[i + axis + 3] = Math.max(f32[left + axis + 3], f32[right + axis + 3]);
          }
        }
      }
    }
  }

  getBoundingBox(target: Box3): Box3 {
    target.makeEmpty();
    for (const buffer of this._roots) target.union(arrayToBox(0, new Float32Array(buffer), tempBox));
    return target;
  }

  shapecast(callbacks: ShapeCallbacks): boolean {
    const range = callbacks.intersectsRange ?? ((_offset, _count, contained) => contained);
    let nodeOffset = 0;
    for (let i = 0; i < this._roots.length; i++) {
      if (traverseShape(this, i, callbacks.intersectsBounds, range, callbacks.boundsTraverseOrder, nodeOffset))
        return true;
      nodeOffset += this._roots[i].byteLength / BYTES_PER_NODE;
    }
    return false;
  }

  bvhcast(other: BVH, matrix: Matrix4, callbacks: { intersectsRanges: BVHCastRangeCallback }): boolean {
    return traverseBVH(this, other, matrix, callbacks.intersectsRanges) ?? false;
  }
}
