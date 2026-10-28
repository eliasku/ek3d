import { Triangle } from "../../../../../math/Triangle";
import type { Line3 } from "../../../../../math/Line3";
import { setDebugContext } from "../operations/operationsUtils";

class TriangleIntersectData {
  triangle: Triangle;
  intersects: Record<string, Triangle>;

  constructor(tri: Triangle) {
    this.triangle = new Triangle().copy(tri);
    this.intersects = {};
  }

  addTriangle(index: number, tri: Triangle): void {
    this.intersects[index] = new Triangle().copy(tri);
  }

  getIntersectArray(): Triangle[] {
    const array: Triangle[] = [];
    const { intersects } = this;
    for (const key in intersects) {
      array.push(intersects[key]);
    }
    return array;
  }
}

class TriangleIntersectionSets {
  data: Record<string, TriangleIntersectData>;

  constructor() {
    this.data = {};
  }

  addTriangleIntersection(ia: number, triA: Triangle, ib: number, triB: Triangle): void {
    const { data } = this;
    if (!data[ia]) {
      data[ia] = new TriangleIntersectData(triA);
    }
    data[ia].addTriangle(ib, triB);
  }

  getTrianglesAsArray(id: number | null = null): Triangle[] {
    const { data } = this;
    const arr: Triangle[] = [];
    if (id !== null) {
      if (id in data) {
        arr.push(data[id].triangle);
      }
    } else {
      for (const key in data) {
        arr.push(data[key].triangle);
      }
    }
    return arr;
  }

  getTriangleIndices(): number[] {
    return Object.keys(this.data).map((i) => parseInt(i));
  }

  getIntersectionIndices(id: number): number[] {
    const { data } = this;
    if (!data[id]) {
      return [];
    }
    return Object.keys(data[id].intersects).map((i) => parseInt(i));
  }

  getIntersectionsAsArray(id: number | null = null, id2: number | null = null): Triangle[] {
    const { data } = this;
    const triSet = new Set<string>();
    const arr: Triangle[] = [];
    const addTriangles = (key: string | number): void => {
      if (!data[key]) return;
      if (id2 !== null) {
        if (data[key].intersects[id2]) {
          arr.push(data[key].intersects[id2]);
        }
      } else {
        const intersects = data[key].intersects;
        for (const key2 in intersects) {
          if (!triSet.has(key2)) {
            triSet.add(key2);
            arr.push(intersects[key2]);
          }
        }
      }
    };
    if (id !== null) {
      addTriangles(id);
    } else {
      for (const key in data) {
        addTriangles(key);
      }
    }
    return arr;
  }

  reset(): void {
    this.data = {};
  }
}

export class OperationDebugData {
  enabled: boolean;
  triangleIntersectsA: TriangleIntersectionSets;
  triangleIntersectsB: TriangleIntersectionSets;
  intersectionEdges: Line3[];

  constructor() {
    this.enabled = false;
    this.triangleIntersectsA = new TriangleIntersectionSets();
    this.triangleIntersectsB = new TriangleIntersectionSets();
    this.intersectionEdges = [];
  }

  addIntersectingTriangles(ia: number, triA: Triangle, ib: number, triB: Triangle): void {
    this.triangleIntersectsA.addTriangleIntersection(ia, triA, ib, triB);
    this.triangleIntersectsB.addTriangleIntersection(ib, triB, ia, triA);
  }

  addEdge(edge: Line3): void {
    this.intersectionEdges.push(edge.clone());
  }

  reset(): void {
    this.triangleIntersectsA.reset();
    this.triangleIntersectsB.reset();
    this.intersectionEdges = [];
  }

  init(): void {
    if (this.enabled) {
      this.reset();
      setDebugContext(this);
    }
  }

  complete(): void {
    if (this.enabled) {
      setDebugContext(null);
    }
  }
}
