import type { BVH } from "../BVH";
import { BVHNode } from "../BVHNode";
import { BYTES_PER_NODE, type BVHOptions } from "../Constants";
import { getBounds, type PrimitiveBounds } from "./computeBoundsUtils";
import { getOptimalSplit } from "./splitUtils";
import { partition } from "./sortUtils";
import { countNodes, populateBuffer } from "./buildUtils";
import type { PrimitiveRange } from "./geometryUtils";

export function buildTree(
  bvh: BVH,
  primitiveBounds: PrimitiveBounds,
  offset: number,
  count: number,
  options: BVHOptions,
  loadRange: PrimitiveRange,
): BVHNode {
  const { maxDepth, verbose, maxLeafSize, strategy, onProgress } = options;
  const partitionBuffer = bvh.primitiveBuffer;
  const partitionStride = bvh.primitiveBufferStride;
  const centroid = new Float32Array(6);
  let reachedMaxDepth = false;
  const root = new BVHNode();
  getBounds(primitiveBounds, offset, count, root.boundingData, centroid);
  splitNode(root, offset, count, 0);
  return root;

  function splitNode(node: BVHNode, start: number, length: number, depth: number): void {
    if (!reachedMaxDepth && depth >= maxDepth) {
      reachedMaxDepth = true;
      if (verbose)
        console.warn(`BVH: Max depth of ${maxDepth} reached when generating BVH. Consider increasing maxDepth.`);
    }
    if (length <= maxLeafSize || depth >= maxDepth) {
      onProgress?.((start + length - loadRange.offset) / loadRange.count);
      node.offset = start;
      node.count = length;
      return;
    }
    const split = getOptimalSplit(node.boundingData, centroid, primitiveBounds, start, length, strategy);
    const splitOffset =
      split.axis === -1 ? start : partition(partitionBuffer, partitionStride, primitiveBounds, start, length, split);
    if (splitOffset === start || splitOffset === start + length) {
      onProgress?.((start + length - loadRange.offset) / loadRange.count);
      node.offset = start;
      node.count = length;
      return;
    }
    node.splitAxis = split.axis;
    node.left = new BVHNode();
    getBounds(primitiveBounds, start, splitOffset - start, node.left.boundingData, centroid);
    splitNode(node.left, start, splitOffset - start, depth + 1);
    node.right = new BVHNode();
    getBounds(primitiveBounds, splitOffset, start + length - splitOffset, node.right.boundingData, centroid);
    splitNode(node.right, splitOffset, start + length - splitOffset, depth + 1);
  }
}

export function buildPackedTree(bvh: BVH, options: BVHOptions): void {
  const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
  const ranges = bvh.getRootRanges(options.range);
  const first = ranges[0],
    last = ranges[ranges.length - 1];
  const fullRange = { offset: first.offset, count: last.offset + last.count - first.offset };
  const bounds = Object.assign(new Float32Array(6 * fullRange.count), { offset: fullRange.offset });
  bvh.computePrimitiveBounds(fullRange.offset, fullRange.count, bounds);
  bvh._roots = ranges.map((range) => {
    const root = buildTree(bvh, bounds, range.offset, range.count, options, fullRange);
    const buffer = new BufferConstructor(BYTES_PER_NODE * countNodes(root));
    populateBuffer(0, root, buffer);
    return buffer;
  });
}
