import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { DEG2RAD } from "../math/MathUtils";
import { Triangle } from "../math/Triangle";
import { Vector3 } from "../math/Vector3";
const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _normal = /*@__PURE__*/ new Vector3();
const _triangle = /*@__PURE__*/ new Triangle();
/**
 * Can be used as a helper object to view the edges of a geometry.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { EdgesGeometry } from 'ek3d/geometries/EdgesGeometry';
 * import { LineSegments } from 'ek3d/objects/LineSegments';
 * import { LineBasicMaterial } from 'ek3d/materials/LineBasicMaterial';
 *
 * const scene = new Scene();
 *
 * const geometry = new BoxGeometry();
 * const edges = new EdgesGeometry( geometry );
 * const line = new LineSegments( edges, new LineBasicMaterial() );
 * scene.add( line );
 * ```
 *
 * Note: It is not yet possible to serialize/deserialize instances of this class.
 *
 */
export class EdgesGeometry extends BufferGeometry {
  parameters: { geometry: BufferGeometry | null; thresholdAngle: number };

  /**
   * Constructs a new edges geometry.
   *
   * @param [geometry=null] - The geometry.
   * @param [thresholdAngle=1] - An edge is only rendered if the angle (in degrees)
   * between the face normals of the adjoining faces exceeds this value.
   */
  constructor(geometry: BufferGeometry | null = null, thresholdAngle: number = 1) {
    super();
    this.type = "EdgesGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      geometry: geometry,
      thresholdAngle: thresholdAngle,
    };
    if (geometry !== null) {
      const precisionPoints = 4;
      const precision = Math.pow(10, precisionPoints);
      const thresholdDot = Math.cos(DEG2RAD * thresholdAngle);
      const indexAttr = geometry.getIndex();
      const positionAttr = geometry.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute;
      const indexCount = indexAttr ? indexAttr.count : positionAttr.count;
      const indexArr = [0, 0, 0];
      const vertKeys: ("a" | "b" | "c")[] = ["a", "b", "c"];
      const hashes = Array<string>(3);
      const edgeData = new Map<any, any>();
      const vertices: any[] = [];
      for (let i = 0; i < indexCount; i += 3) {
        if (indexAttr) {
          indexArr[0] = indexAttr.getX(i);
          indexArr[1] = indexAttr.getX(i + 1);
          indexArr[2] = indexAttr.getX(i + 2);
        } else {
          indexArr[0] = i;
          indexArr[1] = i + 1;
          indexArr[2] = i + 2;
        }
        const { a, b, c } = _triangle;
        a.fromBufferAttribute(positionAttr, indexArr[0]);
        b.fromBufferAttribute(positionAttr, indexArr[1]);
        c.fromBufferAttribute(positionAttr, indexArr[2]);
        _triangle.getNormal(_normal);
        // create hashes for the edge from the vertices
        hashes[0] = `${Math.round(a.x * precision)},${Math.round(a.y * precision)},${Math.round(a.z * precision)}`;
        hashes[1] = `${Math.round(b.x * precision)},${Math.round(b.y * precision)},${Math.round(b.z * precision)}`;
        hashes[2] = `${Math.round(c.x * precision)},${Math.round(c.y * precision)},${Math.round(c.z * precision)}`;
        // skip degenerate triangles
        if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
          continue;
        }
        // iterate over every edge
        for (let j = 0; j < 3; j++) {
          // get the first and next vertex making up the edge
          const jNext = (j + 1) % 3;
          const vecHash0 = hashes[j];
          const vecHash1 = hashes[jNext];
          const v0 = (_triangle as any)[vertKeys[j]];
          const v1 = (_triangle as any)[vertKeys[jNext]];
          const hash = `${vecHash0}_${vecHash1}`;
          const reverseHash = `${vecHash1}_${vecHash0}`;
          const sibling = edgeData.get(reverseHash);
          if (sibling) {
            // if we found a sibling edge add it into the vertex array if
            // it meets the angle threshold and delete the edge from the map.
            if (_normal.dot(sibling.normal) <= thresholdDot) {
              vertices.push(v0.x, v0.y, v0.z);
              vertices.push(v1.x, v1.y, v1.z);
            }
            edgeData.set(reverseHash, null);
          } else if (!edgeData.has(hash)) {
            // if we've already got an edge here then skip adding a new one
            edgeData.set(hash, {
              index0: indexArr[j],
              index1: indexArr[jNext],
              normal: _normal.clone(),
            });
          }
        }
      }
      // iterate over all remaining, unmatched edges and add them to the vertex array
      for (const edge of edgeData.values()) {
        if (edge) {
          const { index0, index1 } = edge;
          _v0.fromBufferAttribute(positionAttr, index0);
          _v1.fromBufferAttribute(positionAttr, index1);
          vertices.push(_v0.x, _v0.y, _v0.z);
          vertices.push(_v1.x, _v1.y, _v1.z);
        }
      }
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    }
  }
  copy(source: this) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
}
