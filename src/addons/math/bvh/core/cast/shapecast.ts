import { Box3 } from "../../../../../math/Box3";
import type { BVH } from "../BVH";
import { CONTAINED, UINT32_PER_NODE } from "../Constants";
import { arrayToBox } from "../../utils/ArrayBoxUtilities";
import { PrimitivePool } from "../../utils/PrimitivePool";
import { COUNT, OFFSET, LEFT_NODE, RIGHT_NODE, IS_LEAF, BOUNDING_DATA_INDEX } from "../utils/nodeBufferUtils";
import { BufferStack } from "../utils/BufferStack";

let _box1: Box3, _box2: Box3;
const boxStack: Box3[] = [];
const boxPool = /* @__PURE__ */ new PrimitivePool(() => new Box3());

export type BoundsCallback = (
  box: Box3,
  isLeaf: boolean,
  score: number | undefined,
  depth: number,
  nodeIndex: number,
) => boolean | number;
export type RangeCallback = (
  offset: number,
  count: number,
  contained: boolean,
  depth: number,
  nodeIndex: number,
  box: Box3,
) => boolean | void;
export type BoundsTraverseOrder = (box: Box3) => number;

export function shapecast(
  bvh: BVH,
  root: number,
  intersectsBounds: BoundsCallback,
  intersectsRange: RangeCallback,
  boundsTraverseOrder: BoundsTraverseOrder | null | undefined,
  nodeOffset: number,
) {
  // setup
  _box1 = boxPool.getPrimitive();
  _box2 = boxPool.getPrimitive();
  boxStack.push(_box1, _box2);
  BufferStack.setBuffer(bvh._roots[root]);

  const result = shapecastTraverse(0, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset);

  // cleanup
  BufferStack.clearBuffer();
  boxPool.releasePrimitive(_box1);
  boxPool.releasePrimitive(_box2);
  boxStack.pop();
  boxStack.pop();

  const length = boxStack.length;
  if (length > 0) {
    _box2 = boxStack[length - 1];
    _box1 = boxStack[length - 2];
  }

  return result;
}

function shapecastTraverse(
  nodeIndex32: number,
  intersectsBoundsFunc: BoundsCallback,
  intersectsRangeFunc: RangeCallback,
  nodeScoreFunc: BoundsTraverseOrder | null | undefined = null,
  nodeIndexOffset = 0, // offset for unique node identifier
  depth = 0,
): boolean | void {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;

  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);
    arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array, _box1);
    return intersectsRangeFunc(offset, count, false, depth, nodeIndexOffset + nodeIndex32 / UINT32_PER_NODE, _box1);
  } else {
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array);
    let c1 = left;
    let c2 = right;

    let score1, score2;
    let box1, box2;
    if (nodeScoreFunc) {
      box1 = _box1;
      box2 = _box2;

      // bounding data is not offset
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array, box1);
      arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array, box2);

      score1 = nodeScoreFunc(box1);
      score2 = nodeScoreFunc(box2);

      if (score2 < score1) {
        c1 = right;
        c2 = left;

        const temp = score1;
        score1 = score2;
        score2 = temp;

        box1 = box2;
        // box2 is always set before use below
      }
    }

    // Check box 1 intersection
    if (!box1) {
      box1 = _box1;
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array, box1);
    }

    const isC1Leaf = IS_LEAF(c1 * 2, uint16Array);
    const c1Intersection = intersectsBoundsFunc(
      box1,
      isC1Leaf,
      score1,
      depth + 1,
      nodeIndexOffset + c1 / UINT32_PER_NODE,
    );

    let c1StopTraversal;
    if (c1Intersection === CONTAINED) {
      const offset = getLeftOffset(c1);
      const end = getRightEndOffset(c1);
      const count = end - offset;

      c1StopTraversal = intersectsRangeFunc(
        offset,
        count,
        true,
        depth + 1,
        nodeIndexOffset + c1 / UINT32_PER_NODE,
        box1,
      );
    } else {
      c1StopTraversal =
        c1Intersection &&
        shapecastTraverse(c1, intersectsBoundsFunc, intersectsRangeFunc, nodeScoreFunc, nodeIndexOffset, depth + 1);
    }

    if (c1StopTraversal) return true;

    // Check box 2 intersection
    // cached box2 will have been overwritten by previous traversal
    box2 = _box2;
    arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array, box2);

    const isC2Leaf = IS_LEAF(c2 * 2, uint16Array);
    const c2Intersection = intersectsBoundsFunc(
      box2,
      isC2Leaf,
      score2,
      depth + 1,
      nodeIndexOffset + c2 / UINT32_PER_NODE,
    );

    let c2StopTraversal;
    if (c2Intersection === CONTAINED) {
      const offset = getLeftOffset(c2);
      const end = getRightEndOffset(c2);
      const count = end - offset;

      c2StopTraversal = intersectsRangeFunc(
        offset,
        count,
        true,
        depth + 1,
        nodeIndexOffset + c2 / UINT32_PER_NODE,
        box2,
      );
    } else {
      c2StopTraversal =
        c2Intersection &&
        shapecastTraverse(c2, intersectsBoundsFunc, intersectsRangeFunc, nodeScoreFunc, nodeIndexOffset, depth + 1);
    }

    if (c2StopTraversal) return true;

    return false;

    // Define these inside the function so it has access to the local variables needed
    // when converting to the buffer equivalents
    function getLeftOffset(nodeIndex32: number) {
      const { uint16Array, uint32Array } = BufferStack;
      let nodeIndex16 = nodeIndex32 * 2;

      // traverse until we find a leaf
      while (!IS_LEAF(nodeIndex16, uint16Array)) {
        nodeIndex32 = LEFT_NODE(nodeIndex32);
        nodeIndex16 = nodeIndex32 * 2;
      }

      return OFFSET(nodeIndex32, uint32Array);
    }

    function getRightEndOffset(nodeIndex32: number) {
      const { uint16Array, uint32Array } = BufferStack;
      let nodeIndex16 = nodeIndex32 * 2;

      // traverse until we find a leaf
      while (!IS_LEAF(nodeIndex16, uint16Array)) {
        // adjust offset to point to the right node
        nodeIndex32 = RIGHT_NODE(nodeIndex32, uint32Array);
        nodeIndex16 = nodeIndex32 * 2;
      }

      // return the end offset of the triangle range
      return OFFSET(nodeIndex32, uint32Array) + COUNT(nodeIndex16, uint16Array);
    }
  }
}
