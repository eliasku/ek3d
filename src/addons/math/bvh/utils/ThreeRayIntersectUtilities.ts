import { Vector3 } from "../../../../math/Vector3";
import { Vector2 } from "../../../../math/Vector2";
import { Triangle } from "../../../../math/Triangle";
import { DoubleSide, BackSide } from "../../../../constants";
import type { BufferGeometry } from "../../../../core/BufferGeometry";
import type { BufferAttribute } from "../../../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../../../core/InterleavedBufferAttribute";
import type { Ray } from "../../../../math/Ray";
import type { Material } from "../../../../materials/Material";
type Attribute = BufferAttribute | InterleavedBufferAttribute;
export interface RayIntersection {
  distance: number;
  point: Vector3;
  face: { a: number; b: number; c: number; normal: Vector3; materialIndex: number };
  faceIndex: number;
  uv?: Vector2;
  uv1?: Vector2;
  normal?: Vector3;
  barycoord?: Vector3;
}
type PartialHit = Omit<RayIntersection, "face" | "faceIndex"> & Partial<Pick<RayIntersection, "face" | "faceIndex">>;

// Ripped and modified From THREE.js Mesh raycast
// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L115
const _vA = /* @__PURE__ */ new Vector3();
const _vB = /* @__PURE__ */ new Vector3();
const _vC = /* @__PURE__ */ new Vector3();

const _uvA = /* @__PURE__ */ new Vector2();
const _uvB = /* @__PURE__ */ new Vector2();
const _uvC = /* @__PURE__ */ new Vector2();

const _normalA = /* @__PURE__ */ new Vector3();
const _normalB = /* @__PURE__ */ new Vector3();
const _normalC = /* @__PURE__ */ new Vector3();

const _intersectionPoint = /* @__PURE__ */ new Vector3();
function checkIntersection(
  ray: Ray,
  pA: Vector3,
  pB: Vector3,
  pC: Vector3,
  point: Vector3,
  side: number,
  near: number,
  far: number,
): PartialHit | null {
  let intersect;
  if (side === BackSide) {
    intersect = ray.intersectTriangle(pC, pB, pA, true, point);
  } else {
    intersect = ray.intersectTriangle(pA, pB, pC, side !== DoubleSide, point);
  }

  if (intersect === null) return null;

  const distance = ray.origin.distanceTo(point);

  if (distance < near || distance > far) return null;

  return {
    distance: distance,
    point: point.clone(),
  };
}

function checkBufferGeometryIntersection(
  ray: Ray,
  position: Attribute,
  normal: Attribute | undefined,
  uv: Attribute | undefined,
  uv1: Attribute | undefined,
  a: number,
  b: number,
  c: number,
  side: number,
  near: number,
  far: number,
): RayIntersection | null {
  _vA.fromBufferAttribute(position, a);
  _vB.fromBufferAttribute(position, b);
  _vC.fromBufferAttribute(position, c);

  const intersection = checkIntersection(ray, _vA, _vB, _vC, _intersectionPoint, side, near, far);

  if (intersection) {
    if (uv) {
      _uvA.fromBufferAttribute(uv, a);
      _uvB.fromBufferAttribute(uv, b);
      _uvC.fromBufferAttribute(uv, c);

      intersection.uv = new Vector2();
      Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, intersection.uv);
    }

    if (uv1) {
      _uvA.fromBufferAttribute(uv1, a);
      _uvB.fromBufferAttribute(uv1, b);
      _uvC.fromBufferAttribute(uv1, c);

      intersection.uv1 = new Vector2();
      Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, intersection.uv1);
    }

    if (normal) {
      _normalA.fromBufferAttribute(normal, a);
      _normalB.fromBufferAttribute(normal, b);
      _normalC.fromBufferAttribute(normal, c);

      intersection.normal = new Vector3();
      Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _normalA, _normalB, _normalC, intersection.normal);
      if (intersection.normal.dot(ray.direction) > 0) {
        intersection.normal.multiplyScalar(-1);
      }
    }

    const face = {
      a: a,
      b: b,
      c: c,
      normal: new Vector3(),
      materialIndex: 0,
    };

    Triangle.getNormal(_vA, _vB, _vC, face.normal);

    intersection.face = face;
    intersection.faceIndex = a;

    const barycoord = new Vector3();
    Triangle.getBarycoord(_intersectionPoint, _vA, _vB, _vC, barycoord);
    intersection.barycoord = barycoord;
  }

  return intersection as RayIntersection | null;
}

function getSide(materialOrSide: Material | number) {
  return typeof materialOrSide === "number" ? materialOrSide : materialOrSide.side;
}

// https://github.com/mrdoob/three.js/blob/0aa87c999fe61e216c1133fba7a95772b503eddf/src/objects/Mesh.js#L258
export function intersectTri(
  geometry: BufferGeometry,
  materialOrSide: Material | Material[] | number,
  ray: Ray,
  tri: number,
  intersections: RayIntersection[] | null,
  near: number,
  far: number,
) {
  const triOffset = tri * 3;
  let a = triOffset + 0;
  let b = triOffset + 1;
  let c = triOffset + 2;

  const { index, groups } = geometry;
  if (index) {
    a = index.getX(a);
    b = index.getX(b);
    c = index.getX(c);
  }

  const { position, normal, uv, uv1 } = geometry.attributes as Record<string, Attribute>;
  if (Array.isArray(materialOrSide)) {
    // check which groups a triangle is present in and run the intersections
    // TODO: we shouldn't need to run and intersection test multiple times
    const firstIndex = tri * 3;
    for (let i = 0, l = groups.length; i < l; i++) {
      const { start, count, materialIndex } = groups[i];
      if (firstIndex >= start && firstIndex < start + count) {
        const side = getSide(materialOrSide[materialIndex]);
        const intersection = checkBufferGeometryIntersection(ray, position, normal, uv, uv1, a, b, c, side, near, far);
        if (intersection) {
          intersection.faceIndex = tri;
          intersection.face.materialIndex = materialIndex;

          if (intersections) {
            intersections.push(intersection);
          } else {
            return intersection;
          }
        }
      }
    }
  } else {
    // run the intersection for the single material
    const side = getSide(materialOrSide);
    const intersection = checkBufferGeometryIntersection(ray, position, normal, uv, uv1, a, b, c, side, near, far);
    if (intersection) {
      intersection.faceIndex = tri;
      intersection.face.materialIndex = 0;

      if (intersections) {
        intersections.push(intersection);
      } else {
        return intersection;
      }
    }
  }

  return null;
}
