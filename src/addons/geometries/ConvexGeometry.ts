import { BufferGeometry } from "../../core/BufferGeometry";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { Vector3 } from "../../math/Vector3";
import { ConvexHull } from "../math/ConvexHull";

/** Generates a convex hull from points in 3D space. */
export class ConvexGeometry extends BufferGeometry {
  constructor(points: Vector3[] = []) {
    super();
    const vertices: number[] = [];
    const normals: number[] = [];
    for (const face of new ConvexHull().setFromPoints(points).faces) {
      let edge = face.edge;
      do {
        const point = edge.head().point;
        vertices.push(point.x, point.y, point.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        edge = edge.next;
      } while (edge !== face.edge);
    }
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  }
}
