import type { MeshBVH } from "../MeshBVH";
import type { Ray } from "../../../../../math/Ray";
import type { Material } from "../../../../../materials/Material";
import type { RayIntersection as Intersection } from "../../utils/ThreeRayIntersectUtilities";
import type { ExtendedTriangle } from "../../math/ExtendedTriangle";
import { intersectTri } from "../../utils/ThreeRayIntersectUtilities";
import { setTriangle } from "../../utils/TriangleUtilities";

/*************************************************************/
/* This file is generated from "iterationUtils.template.js". */
/*************************************************************/

export function intersectTris(
  bvh: MeshBVH,
  materialOrSide: Material | Material[] | number,
  ray: Ray,
  offset: number,
  count: number,
  intersections: Intersection[],
  near: number,
  far: number,
) {
  const { geometry, _indirectBuffer } = bvh;
  for (let i = offset, end = offset + count; i < end; i++) {
    intersectTri(geometry, materialOrSide, ray, i, intersections, near, far);
  }
}

export function intersectClosestTri(
  bvh: MeshBVH,
  materialOrSide: Material | Material[] | number,
  ray: Ray,
  offset: number,
  count: number,
  near: number,
  far: number,
): Intersection | null {
  const { geometry, _indirectBuffer } = bvh;
  let dist = Infinity;
  let res = null;
  for (let i = offset, end = offset + count; i < end; i++) {
    let intersection;

    intersection = intersectTri(geometry, materialOrSide, ray, i, null, near, far);

    if (intersection && intersection.distance < dist) {
      res = intersection;
      dist = intersection.distance;
    }
  }

  return res;
}

export function iterateOverTriangles(
  offset: number,
  count: number,
  bvh: MeshBVH,
  intersectsTriangleFunc: (
    triangle: ExtendedTriangle,
    index: number,
    contained: boolean,
    depth: number,
  ) => boolean | void,
  contained: boolean,
  depth: number,
  triangle: ExtendedTriangle,
) {
  const { geometry } = bvh;
  const { index } = geometry;
  const pos = geometry.attributes.position as Parameters<typeof setTriangle>[3];
  for (let i = offset, l = count + offset; i < l; i++) {
    let tri;

    tri = i;

    setTriangle(triangle, tri * 3, index, pos);
    triangle.needsUpdate = true;

    if (intersectsTriangleFunc(triangle, tri, contained, depth)) {
      return true;
    }
  }

  return false;
}
