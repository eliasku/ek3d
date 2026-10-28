import type { Line3 } from "../../../../math/Line3";

export class IntersectionMap {
  coplanarSet: Map<number, Set<number>> = new Map();
  intersectionSet: Map<number, number[]> = new Map();
  edgeSet: Map<number, Set<Line3>> = new Map();
  ids: number[] = [];

  add(id: number, intersectionId: number, coplanar = false): void {
    let intersections = this.intersectionSet.get(id);
    if (!intersections) {
      intersections = [];
      this.intersectionSet.set(id, intersections);
      this.ids.push(id);
    }
    intersections.push(intersectionId);
    if (coplanar) {
      let set = this.coplanarSet.get(id);
      if (!set) {
        set = new Set();
        this.coplanarSet.set(id, set);
      }
      set.add(intersectionId);
    }
  }

  addIntersectionEdge(id: number, edge: Line3): void {
    let edges = this.edgeSet.get(id);
    if (!edges) {
      edges = new Set();
      this.edgeSet.set(id, edges);
    }
    edges.add(edge);
  }

  getIntersectionEdges(id: number): Set<Line3> | null {
    return this.edgeSet.get(id) || null;
  }
}
