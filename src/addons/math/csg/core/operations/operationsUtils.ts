import { Ray } from "../../../../../math/Ray";
import { Matrix4 } from "../../../../../math/Matrix4";
import { Line3 } from "../../../../../math/Line3";
import { DoubleSide } from "../../../../../constants";
import type { Triangle } from "../../../../../math/Triangle";
import type { MeshBVH } from "../../../bvh/core/MeshBVH";
import type { Brush, CSGGeometry } from "../Brush";
import type { CSGOperation } from "../constants";
import type { OperationDebugData } from "../debug/OperationDebugData";
import { IntersectionMap } from "../IntersectionMap";
import {
  ADDITION,
  SUBTRACTION,
  REVERSE_SUBTRACTION,
  INTERSECTION,
  DIFFERENCE,
  HOLLOW_SUBTRACTION,
  HOLLOW_INTERSECTION,
} from "../constants";
import { isTriDegenerate } from "../utils/triangleUtils";
import { getCoplanarIntersectionEdges, isTriangleCoplanar } from "../utils/intersectionUtils";
import { Pool } from "../utils/Pool";

const _ray = new Ray();
const _matrix = new Matrix4();
const _edge = new Line3();
const _coplanarEdges: Line3[] = [];
const _edgePool = new Pool(() => new Line3());

export const BACK_SIDE = -1;
export const FRONT_SIDE = 1;
export const COPLANAR_OPPOSITE = -2;
export const COPLANAR_ALIGNED = 2;

export const INVERT_TRI = 0;
export const ADD_TRI = 1;
export const SKIP_TRI = 2;

let _debugContext: OperationDebugData | null = null;
export function setDebugContext(debugData: OperationDebugData | null) {
  _debugContext = debugData;
}

export function getHitSide(tri: Triangle, bvh: MeshBVH, matrix: Matrix4 | null = null) {
  tri.getMidpoint(_ray.origin);
  tri.getNormal(_ray.direction);

  if (matrix) {
    _ray.origin.applyMatrix4(matrix);
    _ray.direction.transformDirection(matrix);
  }

  const hit = bvh.raycastFirst(_ray, DoubleSide);
  const hitBackSide = Boolean(hit && _ray.direction.dot(hit.face!.normal) > 0);
  return hitBackSide ? BACK_SIDE : FRONT_SIDE;
}

// returns the intersected triangles and returns objects mapping triangle indices to
// the other triangles intersected
export function collectIntersectingTriangles(a: Brush, b: Brush) {
  const aGeometry = a.geometry as CSGGeometry;
  const bGeometry = b.geometry as CSGGeometry;
  const aBVH = aGeometry.boundsTree!;
  const bBVH = bGeometry.boundsTree!;
  const aIntersections = new IntersectionMap();
  const bIntersections = new IntersectionMap();

  _edgePool.clear();

  _matrix.copy(a.matrixWorld).invert().multiply(b.matrixWorld);

  aBVH.bvhcast(bBVH, _matrix, {
    intersectsTriangles(triangleA, triangleB, ia, ib) {
      if (!isTriDegenerate(triangleA) && !isTriDegenerate(triangleB)) {
        // due to floating point error it's possible that we can have two overlapping, coplanar triangles
        // that are a _tiny_ fraction of a value away from each other. If we find that case then check the
        // distance between triangles and if it's small enough consider them intersecting.
        const coplanarCount = isTriangleCoplanar(triangleA, triangleB)
          ? getCoplanarIntersectionEdges(triangleA, triangleB, _coplanarEdges)
          : 0;
        const isCoplanarIntersection = coplanarCount > 2;
        const intersected = isCoplanarIntersection || triangleA.intersectsTriangle(triangleB, _edge, true);
        if (intersected) {
          const va = aBVH.resolveTriangleIndex(ia);
          const vb = bBVH.resolveTriangleIndex(ib);
          aIntersections.add(va, vb, isCoplanarIntersection);
          bIntersections.add(vb, va, isCoplanarIntersection);

          // cache intersection edges in geometry A's local frame
          if (isCoplanarIntersection) {
            // coplanar
            const count = getCoplanarIntersectionEdges(triangleA, triangleB, _coplanarEdges);
            for (let i = 0; i < count; i++) {
              const e = _edgePool.getInstance().copy(_coplanarEdges[i]);
              aIntersections.addIntersectionEdge(va, e);
              bIntersections.addIntersectionEdge(vb, e);
            }
          } else {
            // non-coplanar
            const ea = _edgePool.getInstance().copy(_edge);
            const eb = _edgePool.getInstance().copy(_edge);
            aIntersections.addIntersectionEdge(va, ea);
            bIntersections.addIntersectionEdge(vb, eb);
          }

          if (_debugContext) {
            _debugContext.addEdge(_edge);
            _debugContext.addIntersectingTriangles(ia, triangleA, ib, triangleB);
          }
        }
      }

      return false;
    },
  });

  return { aIntersections, bIntersections };
}

// Returns the triangle to add when performing an operation
export function getOperationAction(operation: CSGOperation, hitSide: number, invert = false) {
  switch (operation) {
    case ADDITION:
      if (hitSide === FRONT_SIDE || (hitSide === COPLANAR_ALIGNED && !invert)) {
        return ADD_TRI;
      }

      break;
    case SUBTRACTION:
      if (invert) {
        if (hitSide === BACK_SIDE) {
          return INVERT_TRI;
        }
      } else {
        if (hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE) {
          return ADD_TRI;
        }
      }

      break;
    case REVERSE_SUBTRACTION:
      if (invert) {
        if (hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE) {
          return ADD_TRI;
        }
      } else {
        if (hitSide === BACK_SIDE) {
          return INVERT_TRI;
        }
      }

      break;
    case DIFFERENCE:
      if (hitSide === BACK_SIDE) {
        return INVERT_TRI;
      } else if (hitSide === FRONT_SIDE) {
        return ADD_TRI;
      }

      break;
    case INTERSECTION:
      if (hitSide === BACK_SIDE || (hitSide === COPLANAR_ALIGNED && !invert)) {
        return ADD_TRI;
      }

      break;

    case HOLLOW_SUBTRACTION:
      if (!invert && (hitSide === FRONT_SIDE || hitSide === COPLANAR_OPPOSITE)) {
        return ADD_TRI;
      }

      break;
    case HOLLOW_INTERSECTION:
      if (!invert && (hitSide === BACK_SIDE || hitSide === COPLANAR_ALIGNED)) {
        return ADD_TRI;
      }

      break;
    default:
      throw new Error(`Unrecognized CSG operation enum "${String(operation)}".`);
  }

  return SKIP_TRI;
}
