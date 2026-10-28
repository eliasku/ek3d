import { Side } from "../../../../../constants";
import type { MeshBVH } from "../MeshBVH";
import type { Ray } from "../../../../../math/Ray";
import type { Material } from "../../../../../materials/Material";
import type { RayIntersection as Intersection } from "../../utils/ThreeRayIntersectUtilities";
import { intersectsNodeBounds } from "../utils/intersectUtils";
import { IS_LEAF, OFFSET, COUNT, LEFT_NODE, RIGHT_NODE } from "../utils/nodeBufferUtils";
import { BufferStack } from "../utils/BufferStack";
import { intersectTris_indirect } from "../utils/iterationUtils_indirect.generated";

/******************************************************/
/* This file is generated from "raycast.template.js". */
/******************************************************/

export function raycast_indirect(
  bvh: MeshBVH,
  root: number,
  materialOrSide: Material | Material[] | Side,
  ray: Ray,
  intersects: Intersection[],
  near: number,
  far: number,
) {
  BufferStack.setBuffer(bvh._roots[root]);
  _raycast(0, bvh, materialOrSide, ray, intersects, near, far);
  BufferStack.clearBuffer();
}

function _raycast(
  nodeIndex32: number,
  bvh: MeshBVH,
  materialOrSide: Material | Material[] | Side,
  ray: Ray,
  intersects: Intersection[],
  near: number,
  far: number,
): void {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  const nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);

    intersectTris_indirect(bvh, materialOrSide, ray, offset, count, intersects, near, far);
  } else {
    const leftIndex = LEFT_NODE(nodeIndex32);
    if (intersectsNodeBounds(leftIndex, float32Array, ray, near, far)) {
      _raycast(leftIndex, bvh, materialOrSide, ray, intersects, near, far);
    }

    const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array);
    if (intersectsNodeBounds(rightIndex, float32Array, ray, near, far)) {
      _raycast(rightIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
  }
}
