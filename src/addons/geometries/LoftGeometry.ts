import { BufferGeometry } from "../../core/BufferGeometry";
import { BufferAttribute, Float32BufferAttribute } from "../../core/BufferAttribute";
import { ShapeUtils } from "../../extras/ShapeUtils";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";

const _vector = /*@__PURE__*/ new Vector3();

export class LoftGeometry extends BufferGeometry {
  parameters: { sections: Vector3[][]; closed: boolean; capStart: boolean; capEnd: boolean };

  constructor(sections: Vector3[][] = [], options: { closed?: boolean; capStart?: boolean; capEnd?: boolean } = {}) {
    super();

    this.type = "LoftGeometry";

    const { closed = true, capStart = false, capEnd = false } = options;

    this.parameters = {
      sections: sections,
      closed: closed,
      capStart: capStart,
      capEnd: capEnd,
    };

    const rows = sections.length;

    if (rows < 2) {
      console.error("THREE.LoftGeometry: At least two sections are required.");
      return;
    }

    const columns = sections[0].length;

    for (let i = 1; i < rows; i++) {
      if (sections[i].length !== columns) {
        console.error("THREE.LoftGeometry: All sections must have the same number of points.");
        return;
      }
    }

    // closed sections repeat their first point so the surface can wrap
    // around with continuous uvs

    const pointsPerRow = closed ? columns + 1 : columns;

    // buffers

    const indices: number[] = [];
    const vertices: number[] = [];
    const uvs: number[] = [];

    // uvs follow arc length so uneven sections and points map evenly

    const rowU = [0];

    for (let i = 1; i < rows; i++) {
      let distance = 0;

      for (let j = 0; j < columns; j++) {
        distance += sections[i][j].distanceTo(sections[i - 1][j]);
      }

      rowU.push(rowU[i - 1] + distance / columns);
    }

    const totalU = rowU[rows - 1];

    // generate vertices and uvs

    for (let i = 0; i < rows; i++) {
      const section = sections[i];

      // distance around the section

      const colV = [0];

      for (let j = 1; j < pointsPerRow; j++) {
        colV.push(colV[j - 1] + section[j % columns].distanceTo(section[(j - 1) % columns]));
      }

      const totalV = colV[pointsPerRow - 1];

      for (let j = 0; j < pointsPerRow; j++) {
        const point = section[j % columns];

        vertices.push(point.x, point.y, point.z);
        uvs.push(
          totalU > 0 ? rowU[i] / totalU : i / (rows - 1),
          totalV > 0 ? colV[j] / totalV : j / (pointsPerRow - 1),
        );
      }
    }

    // generate indices

    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < pointsPerRow - 1; j++) {
        const a = i * pointsPerRow + j;
        const b = i * pointsPerRow + j + 1;
        const c = (i + 1) * pointsPerRow + j + 1;
        const d = (i + 1) * pointsPerRow + j;

        // faces one and two

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    // generate caps

    if (capStart === true) generateCap(0);
    if (capEnd === true) generateCap(rows - 1);

    // build geometry

    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    this.computeVertexNormals();

    // the seam vertices of closed sections are duplicated so their computed
    // normals must be averaged to achieve smooth shading across the seam

    if (closed === true) {
      const normals = this.getAttribute("normal") as BufferAttribute;

      for (let i = 0; i < rows; i++) {
        const a = i * pointsPerRow;
        const b = i * pointsPerRow + (pointsPerRow - 1);

        _vector
          .set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b))
          .normalize();

        normals.setXYZ(a, _vector.x, _vector.y, _vector.z);
        normals.setXYZ(b, _vector.x, _vector.y, _vector.z);
      }
    }

    function generateCap(sectionIndex: number) {
      const section = sections[sectionIndex];

      // compute the centroid of the section and the normal of its plane
      // via Newell's method

      const centroid = new Vector3();
      const normal = new Vector3();

      for (let i = 0; i < columns; i++) {
        const p = section[i];
        const q = section[(i + 1) % columns];

        centroid.add(p);

        normal.x += (p.y - q.y) * (p.z + q.z);
        normal.y += (p.z - q.z) * (p.x + q.x);
        normal.z += (p.x - q.x) * (p.y + q.y);
      }

      centroid.divideScalar(columns);
      normal.normalize();

      // make sure the cap faces away from the rest of the surface

      const neighbor = sections[sectionIndex === 0 ? 1 : rows - 2];

      _vector.set(0, 0, 0);

      for (let i = 0; i < columns; i++) _vector.add(neighbor[i]);

      _vector.divideScalar(columns).sub(centroid);

      if (normal.dot(_vector) > 0) normal.negate();

      // project the section onto the cap plane

      const tangent = new Vector3(1, 0, 0);

      if (Math.abs(normal.x) > 0.9) tangent.set(0, 1, 0);

      const bitangent = new Vector3().crossVectors(normal, tangent).normalize();
      tangent.crossVectors(bitangent, normal);

      const contour: Vector2[] = [];
      const points = section.slice();

      for (let i = 0; i < columns; i++) {
        _vector.subVectors(points[i], centroid);
        contour.push(new Vector2(_vector.dot(tangent), _vector.dot(bitangent)));
      }

      // triangulateShape() expects contours in counterclockwise order

      if (ShapeUtils.isClockWise(contour) === true) {
        contour.reverse();
        points.reverse();
      }

      const faces = ShapeUtils.triangulateShape(contour, []);

      // compute the bounding box of the contour for uv generation

      const min = new Vector2(Infinity, Infinity);
      const max = new Vector2(-Infinity, -Infinity);

      for (let i = 0; i < columns; i++) {
        min.min(contour[i]);
        max.max(contour[i]);
      }

      const width = Math.max(max.x - min.x, Number.EPSILON);
      const height = Math.max(max.y - min.y, Number.EPSILON);

      // generate vertices, uvs and indices; cap vertices are not shared
      // with the wall so the cap is flat shaded with a hard edge

      const indexOffset = vertices.length / 3;

      for (let i = 0; i < columns; i++) {
        const point = points[i];

        vertices.push(point.x, point.y, point.z);
        uvs.push((contour[i].x - min.x) / width, (contour[i].y - min.y) / height);
      }

      for (let i = 0; i < faces.length; i++) {
        const face = faces[i];

        indices.push(indexOffset + face[0], indexOffset + face[1], indexOffset + face[2]);
      }
    }
  }

  copy(source: this) {
    super.copy(source);

    this.parameters = Object.assign({}, source.parameters);

    return this;
  }
}
