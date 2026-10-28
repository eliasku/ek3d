import { Group } from "../../../../objects/Group";
import { Mesh } from "../../../../objects/Mesh";
import { LineSegments } from "../../../../objects/LineSegments";
import { LineBasicMaterial } from "../../../../materials/LineBasicMaterial";
import { MeshPhongMaterial } from "../../../../materials/MeshPhongMaterial";
import { BufferGeometry } from "../../../../core/BufferGeometry";
import { BufferAttribute } from "../../../../core/BufferAttribute";
import type { Triangle } from "../../../../math/Triangle";

export class TriangleSetHelper extends Group {
  _mesh: Mesh<MeshPhongMaterial>;
  _lines: LineSegments<LineBasicMaterial>;

  get color() {
    return this._mesh.material.color;
  }

  get side() {
    return this._mesh.material.side;
  }

  set side(v) {
    this._mesh.material.side = v;
  }

  constructor(triangles: Triangle[] = []) {
    super();

    const geometry = new BufferGeometry();
    const lineGeom = new BufferGeometry();
    this._mesh = new Mesh<MeshPhongMaterial>(
      geometry,
      new MeshPhongMaterial({
        flatShading: true,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    this._lines = new LineSegments<LineBasicMaterial>(lineGeom, new LineBasicMaterial());
    this._mesh.material.color = this._lines.material.color;

    this._lines.frustumCulled = false;
    this._mesh.frustumCulled = false;

    this.add(this._lines, this._mesh);

    this.setTriangles(triangles);
  }

  setTriangles(triangles: Triangle[]) {
    const triPositions = new Float32Array(3 * 3 * triangles.length);
    const linePositions = new Float32Array(6 * 3 * triangles.length);
    for (let i = 0, l = triangles.length; i < l; i++) {
      const i9 = 9 * i;
      const i18 = 18 * i;
      const tri = triangles[i];

      tri.a.toArray(triPositions, i9 + 0);
      tri.b.toArray(triPositions, i9 + 3);
      tri.c.toArray(triPositions, i9 + 6);

      tri.a.toArray(linePositions, i18 + 0);
      tri.b.toArray(linePositions, i18 + 3);

      tri.b.toArray(linePositions, i18 + 6);
      tri.c.toArray(linePositions, i18 + 9);

      tri.c.toArray(linePositions, i18 + 12);
      tri.a.toArray(linePositions, i18 + 15);
    }

    this._mesh.geometry.dispose();
    this._mesh.geometry.setAttribute("position", new BufferAttribute(triPositions, 3));

    this._lines.geometry.dispose();
    this._lines.geometry.setAttribute("position", new BufferAttribute(linePositions, 3));
  }
}
