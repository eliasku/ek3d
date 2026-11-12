import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Vector3 } from "../../math/Vector3";

export type ParametricGeometryFunc = (u: number, v: number, target: Vector3) => void;

/**
 * Generates a geometry based on a parametric surface.
 *
 * ```typescript
 * import { ParametricGeometry } from 'ek3d/addons/geometries/ParametricGeometry';
 * import { klein } from 'ek3d/addons/geometries/ParametricFunctions';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const geometry = new ParametricGeometry( klein, 25, 25 );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const mesh = new Mesh( geometry, material );
 * ```
 */
export class ParametricGeometry extends BufferGeometry {
  /** Constructor parameters; modifying them does not change the geometry. */
  parameters: { func: ParametricGeometryFunc; slices: number; stacks: number };

  constructor(
    func: ParametricGeometryFunc = (u, v, target) => target.set(u, v, Math.cos(u) * Math.sin(v)),
    slices: number = 8,
    stacks: number = 8,
  ) {
    super();
    this.type = "ParametricGeometry";
    this.parameters = { func, slices, stacks };

    const indices: number[] = [],
      vertices: number[] = [],
      normals: number[] = [],
      uvs: number[] = [];
    const EPS = 0.00001;
    const normal = new Vector3();
    const p0 = new Vector3(),
      p1 = new Vector3();
    const pu = new Vector3(),
      pv = new Vector3();
    const sliceCount = slices + 1;

    for (let i = 0; i <= stacks; i++) {
      const v = i / stacks;
      for (let j = 0; j <= slices; j++) {
        const u = j / slices;
        func(u, v, p0);
        vertices.push(p0.x, p0.y, p0.z);
        if (u - EPS >= 0) {
          func(u - EPS, v, p1);
          pu.subVectors(p0, p1);
        } else {
          func(u + EPS, v, p1);
          pu.subVectors(p1, p0);
        }
        if (v - EPS >= 0) {
          func(u, v - EPS, p1);
          pv.subVectors(p0, p1);
        } else {
          func(u, v + EPS, p1);
          pv.subVectors(p1, p0);
        }
        normal.crossVectors(pu, pv).normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(u, v);
      }
    }
    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * sliceCount + j;
        const b = i * sliceCount + j + 1;
        const c = (i + 1) * sliceCount + j + 1;
        const d = (i + 1) * sliceCount + j;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }

  override copy(source: this): this {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
}
