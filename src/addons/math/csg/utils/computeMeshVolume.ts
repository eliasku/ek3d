import { Vector3 } from "../../../../math/Vector3";
import { Triangle } from "../../../../math/Triangle";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import type { BufferAttribute } from "../../../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../../../core/InterleavedBufferAttribute";
import type { Matrix4 } from "../../../../math/Matrix4";
import type { Mesh } from "../../../../objects/Mesh";
import { getTriCount } from "../core/utils/geometryUtils";

// https://stackoverflow.com/questions/1406029/how-to-calculate-the-volume-of-a-3d-mesh-object-the-surface-of-which-is-made-up
const _tri = new Triangle();
const _normal = new Vector3();
const _relPoint = new Vector3();
export function computeMeshVolume(mesh: Mesh | BufferGeometry) {
  // grab the matrix and the geometry
  let geometry;
  let matrix;
  if (mesh instanceof BufferGeometry) {
    geometry = mesh;
    matrix = null;
  } else {
    geometry = mesh.geometry;
    matrix = Math.abs(mesh.matrixWorld.determinant() - 1.0) < 1e-15 ? null : mesh.matrixWorld;
  }

  // determine the number of relevant draw range elements to use
  const index = geometry.index;
  const pos = geometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
  const drawRange = geometry.drawRange;
  const triCount = Math.min(getTriCount(geometry), drawRange.count / 3);

  // get a point relative to the position of the geometry to avoid floating point error
  _tri.setFromAttributeAndIndices(pos, 0, 1, 2);
  applyMatrix4ToTri(_tri, matrix);
  _tri.getNormal(_normal);
  _tri.getMidpoint(_relPoint).add(_normal);

  // iterate over all triangles
  let volume = 0;
  const startIndex = drawRange.start / 3;
  for (let i = startIndex, l = startIndex + triCount; i < l; i++) {
    let i0 = 3 * i + 0;
    let i1 = 3 * i + 1;
    let i2 = 3 * i + 2;
    if (index) {
      i0 = index.getX(i0);
      i1 = index.getX(i1);
      i2 = index.getX(i2);
    }

    // get the triangle
    _tri.setFromAttributeAndIndices(pos, i0, i1, i2);
    applyMatrix4ToTri(_tri, matrix);
    subVectorFromTri(_tri, _relPoint);

    // add the signed volume
    volume += signedVolumeOfTriangle(_tri.a, _tri.b, _tri.c);
  }

  return Math.abs(volume);
}

function signedVolumeOfTriangle(p1: Vector3, p2: Vector3, p3: Vector3) {
  const v321 = p3.x * p2.y * p1.z;
  const v231 = p2.x * p3.y * p1.z;
  const v312 = p3.x * p1.y * p2.z;
  const v132 = p1.x * p3.y * p2.z;
  const v213 = p2.x * p1.y * p3.z;
  const v123 = p1.x * p2.y * p3.z;
  return (1 / 6) * (-v321 + v231 + v312 - v132 - v213 + v123);
}

function subVectorFromTri(tri: Triangle, pos: Vector3) {
  tri.a.sub(pos);
  tri.b.sub(pos);
  tri.c.sub(pos);
}

function applyMatrix4ToTri(tri: Triangle, mat: Matrix4 | null = null) {
  if (mat !== null) {
    tri.a.applyMatrix4(mat);
    tri.b.applyMatrix4(mat);
    tri.c.applyMatrix4(mat);
  }
}
