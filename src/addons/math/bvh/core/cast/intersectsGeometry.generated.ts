import { Box3 } from "../../../../../math/Box3";
import { Matrix4 } from "../../../../../math/Matrix4";
import type { BufferGeometry } from "../../../../../core/BufferGeometry";
import type { MeshBVH, BVHGeometry } from "../MeshBVH";
import { OrientedBox } from "../../math/OrientedBox";
import { ExtendedTriangle } from "../../math/ExtendedTriangle";
import { setTriangle } from "../../utils/TriangleUtilities";
import { arrayToBox } from "../../utils/ArrayBoxUtilities";
import { IS_LEAF, OFFSET, COUNT, BOUNDING_DATA_INDEX, LEFT_NODE, RIGHT_NODE } from "../utils/nodeBufferUtils";
import { BufferStack } from "../utils/BufferStack";
import { getTriCount } from "../build/geometryUtils";

/*****************************************************************/
/* This file is generated from "intersectsGeometry.template.js". */
/*****************************************************************/

const boundingBox = /* @__PURE__ */ new Box3();
const triangle = /* @__PURE__ */ new ExtendedTriangle();
const triangle2 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat = /* @__PURE__ */ new Matrix4();

const obb = /* @__PURE__ */ new OrientedBox();
const obb2 = /* @__PURE__ */ new OrientedBox();

export function intersectsGeometry(bvh: MeshBVH, root: number, otherGeometry: BufferGeometry, geometryToBvh: Matrix4) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _intersectsGeometry(0, bvh, otherGeometry, geometryToBvh);
  BufferStack.clearBuffer();

  return result;
}

function _intersectsGeometry(
  nodeIndex32: number,
  bvh: MeshBVH,
  otherGeometry: BufferGeometry,
  geometryToBvh: Matrix4,
  cachedObb: OrientedBox | null = null,
): boolean | undefined {
  const { float32Array, uint16Array, uint32Array } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;

  if (cachedObb === null) {
    if (!otherGeometry.boundingBox) {
      otherGeometry.computeBoundingBox();
    }

    obb.set(otherGeometry.boundingBox!.min, otherGeometry.boundingBox!.max, geometryToBvh);
    cachedObb = obb;
  }

  const isLeaf = IS_LEAF(nodeIndex16, uint16Array);
  if (isLeaf) {
    const thisGeometry = bvh.geometry;
    const thisIndex = thisGeometry.index;
    const thisPos = thisGeometry.attributes.position as Parameters<typeof setTriangle>[3];

    const otherIndex = otherGeometry.index;
    const otherPos = otherGeometry.attributes.position as Parameters<typeof setTriangle>[3];

    const offset = OFFSET(nodeIndex32, uint32Array);
    const count = COUNT(nodeIndex16, uint16Array);

    // get the inverse of the geometry matrix so we can transform our triangles into the
    // geometry space we're trying to test. We assume there are fewer triangles being checked
    // here.
    invertedMat.copy(geometryToBvh).invert();

    const otherTree = (otherGeometry as BVHGeometry).boundsTree;
    if (otherTree) {
      // if there's a bounds tree
      const boundsIndex = BOUNDING_DATA_INDEX(nodeIndex32);
      obb2.min.fromArray(float32Array, boundsIndex);
      obb2.max.fromArray(float32Array, boundsIndex + 3);
      obb2.matrix.copy(invertedMat);
      obb2.needsUpdate = true;

      // TODO: use a triangle iteration function here
      const res = otherTree.shapecast({
        intersectsBounds: (box) => obb2.intersectsBox(box),

        intersectsTriangle: (tri) => {
          tri.a.applyMatrix4(geometryToBvh);
          tri.b.applyMatrix4(geometryToBvh);
          tri.c.applyMatrix4(geometryToBvh);
          tri.needsUpdate = true;

          for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
            // this triangle needs to be transformed into the current BVH coordinate frame
            setTriangle(triangle2, i, thisIndex, thisPos);
            triangle2.needsUpdate = true;
            if (tri.intersectsTriangle(triangle2)) {
              return true;
            }
          }

          return false;
        },
      });

      return res;
    } else {
      // if we're just dealing with raw geometry
      const otherTriangleCount = getTriCount(otherGeometry);

      for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
        // this triangle needs to be transformed into the current BVH coordinate frame
        setTriangle(triangle, i, thisIndex, thisPos);

        triangle.a.applyMatrix4(invertedMat);
        triangle.b.applyMatrix4(invertedMat);
        triangle.c.applyMatrix4(invertedMat);
        triangle.needsUpdate = true;

        for (let i2 = 0, l2 = otherTriangleCount * 3; i2 < l2; i2 += 3) {
          setTriangle(triangle2, i2, otherIndex, otherPos);
          triangle2.needsUpdate = true;

          if (triangle.intersectsTriangle(triangle2)) {
            return true;
          }
        }
      }
    }
  } else {
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array);

    arrayToBox(BOUNDING_DATA_INDEX(left), float32Array, boundingBox);
    const leftIntersection =
      cachedObb.intersectsBox(boundingBox) && _intersectsGeometry(left, bvh, otherGeometry, geometryToBvh, cachedObb);

    if (leftIntersection) return true;

    arrayToBox(BOUNDING_DATA_INDEX(right), float32Array, boundingBox);
    const rightIntersection =
      cachedObb.intersectsBox(boundingBox) && _intersectsGeometry(right, bvh, otherGeometry, geometryToBvh, cachedObb);

    if (rightIntersection) return true;

    return false;
  }
}
