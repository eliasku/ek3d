import { LineSegments } from "../../../../objects/LineSegments";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import { LineBasicMaterial } from "../../../../materials/LineBasicMaterial";
import type { Line3 } from "../../../../math/Line3";

export class EdgesHelper extends LineSegments<LineBasicMaterial> {
  get color() {
    return this.material.color;
  }

  constructor(edges: Line3[] = []) {
    super(new BufferGeometry(), new LineBasicMaterial());
    this.frustumCulled = false;
    this.setEdges(edges);
  }

  setEdges(edges: Line3[]) {
    const { geometry } = this;
    const points = edges.flatMap((e) => [e.start, e.end]);
    geometry.dispose();
    geometry.deleteAttribute("position");
    geometry.setFromPoints(points);
  }
}
