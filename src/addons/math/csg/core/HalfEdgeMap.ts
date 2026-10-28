import { Vector2 } from "../../../../math/Vector2";
import { Vector3 } from "../../../../math/Vector3";
import { Vector4 } from "../../../../math/Vector4";
import type { BufferGeometry } from "../../../../core/BufferGeometry";
import type { BufferAttribute } from "../../../../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../../../../core/InterleavedBufferAttribute";
import { hashNumber, hashVertex2, hashVertex3, hashVertex4 } from "./utils/hashUtils";
import { getTriCount } from "./utils/geometryUtils";
import { computeDisjointEdges } from "./utils/computeDisjointEdges";
import type { DisjointEdgesResult } from "./utils/computeDisjointEdges";

const vec2 = new Vector2();
const vec3 = new Vector3();
const vec4 = new Vector4();
const hashes = ["", "", ""];

export class HalfEdgeMap {
  data: Int32Array | null = null;
  disjointConnections: DisjointEdgesResult["disjointConnectivityMap"] | null = null;
  unmatchedDisjointEdges: DisjointEdgesResult["fragmentMap"] | null = null;
  unmatchedEdges: number = -1;
  matchedEdges: number = -1;
  useDrawRange: boolean = true;
  useAllAttributes: boolean = false;
  matchDisjointEdges: boolean = false;
  degenerateEpsilon: number = 1e-8;

  getSiblingTriangleIndex(triIndex: number, edgeIndex: number): number {
    const otherIndex = this.data![triIndex * 3 + edgeIndex];
    return otherIndex === -1 ? -1 : ~~(otherIndex / 3);
  }

  getSiblingEdgeIndex(triIndex: number, edgeIndex: number): number {
    const otherIndex = this.data![triIndex * 3 + edgeIndex];
    return otherIndex === -1 ? -1 : otherIndex % 3;
  }

  getDisjointSiblingTriangleIndices(triIndex: number, edgeIndex: number): number[] {
    const arr = this.disjointConnections!.get(triIndex * 3 + edgeIndex);
    return arr ? arr.map((i) => ~~(i / 3)) : [];
  }

  getDisjointSiblingEdgeIndices(triIndex: number, edgeIndex: number): number[] {
    const arr = this.disjointConnections!.get(triIndex * 3 + edgeIndex);
    return arr ? arr.map((i) => i % 3) : [];
  }

  isFullyConnected(): boolean {
    return this.unmatchedEdges === 0;
  }

  updateFrom(geometry: BufferGeometry): void {
    const { useAllAttributes, useDrawRange, matchDisjointEdges, degenerateEpsilon } = this;
    const hashFunction = useAllAttributes ? hashAllAttributes : hashPositionAttribute;
    const map = new Map<string, number>();
    const { attributes } = geometry;
    const attrKeys = useAllAttributes ? Object.keys(attributes) : [];
    const indexAttr = geometry.index;
    const posAttr = attributes.position as BufferAttribute | InterleavedBufferAttribute;
    let triCount = getTriCount(geometry);
    const maxTriCount = triCount;
    let offset = 0;
    if (useDrawRange) {
      offset = geometry.drawRange.start;
      if (geometry.drawRange.count !== Infinity) triCount = ~~(geometry.drawRange.count / 3);
    }
    let data = this.data;
    if (!data || data.length < 3 * maxTriCount) data = new Int32Array(3 * maxTriCount);
    data.fill(-1);
    let matchedEdges = 0;
    const unmatchedSet = new Set<number>();
    for (let i = offset, l = triCount * 3 + offset; i < l; i += 3) {
      for (let e = 0; e < 3; e++) {
        const vertexIndex = indexAttr ? indexAttr.getX(i + e) : i + e;
        hashes[e] = hashFunction(vertexIndex);
      }
      for (let e = 0; e < 3; e++) {
        const vh0 = hashes[e];
        const vh1 = hashes[(e + 1) % 3];
        const reverseHash = `${vh1}_${vh0}`;
        const otherIndex = map.get(reverseHash);
        if (otherIndex !== undefined) {
          const index = i + e;
          data[index] = otherIndex;
          data[otherIndex] = index;
          map.delete(reverseHash);
          matchedEdges += 2;
          unmatchedSet.delete(otherIndex);
        } else {
          const index = i + e;
          map.set(`${vh0}_${vh1}`, index);
          unmatchedSet.add(index);
        }
      }
    }
    if (matchDisjointEdges) {
      const { fragmentMap, disjointConnectivityMap } = computeDisjointEdges(geometry, unmatchedSet, degenerateEpsilon);
      unmatchedSet.clear();
      fragmentMap.forEach(({ forward, reverse }) => {
        forward.forEach(({ index }) => unmatchedSet.add(index));
        reverse.forEach(({ index }) => unmatchedSet.add(index));
      });
      this.unmatchedDisjointEdges = fragmentMap;
      this.disjointConnections = disjointConnectivityMap;
      matchedEdges = triCount * 3 - unmatchedSet.size;
    }
    this.matchedEdges = matchedEdges;
    this.unmatchedEdges = unmatchedSet.size;
    this.data = data;

    function hashPositionAttribute(i: number): string {
      return hashVertex3(vec3.fromBufferAttribute(posAttr, i));
    }
    function hashAllAttributes(i: number): string {
      let result = "";
      for (const key of attrKeys) {
        const attr = attributes[key] as BufferAttribute | InterleavedBufferAttribute;
        let str: string | number | undefined;
        switch (attr.itemSize) {
          case 1:
            str = hashNumber(attr.getX(i));
            break;
          case 2:
            str = hashVertex2(vec2.fromBufferAttribute(attr, i));
            break;
          case 3:
            str = hashVertex3(vec3.fromBufferAttribute(attr, i));
            break;
          case 4:
            str = hashVertex4(vec4.fromBufferAttribute(attr, i));
            break;
        }
        if (result !== "") result += "|";
        result += str;
      }
      return result;
    }
  }
}
