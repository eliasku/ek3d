import { BufferGeometry } from "../../../../core/BufferGeometry";
import type { Mesh } from "../../../../objects/Mesh";
import { HalfEdgeMap } from "../core/HalfEdgeMap";

export function isWaterTight(input: BufferGeometry | Mesh) {
  const geometry = input instanceof BufferGeometry ? input : input.geometry;

  const halfEdgeMap = new HalfEdgeMap();
  halfEdgeMap.matchDisjointEdges = true;
  halfEdgeMap.updateFrom(geometry);
  return halfEdgeMap.unmatchedEdges === 0;
}
