import { PolyhedronGeometry } from "./PolyhedronGeometry";
/**
 * A geometry class for representing an tetrahedron.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { TetrahedronGeometry } from 'ek3d/geometries/TetrahedronGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new TetrahedronGeometry();
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const tetrahedron = new Mesh( geometry, material );
 * scene.add( tetrahedron );
 * ```
 *
 * @demo scenes/geometry-browser.html#TetrahedronGeometry
 */
export class TetrahedronGeometry extends PolyhedronGeometry {
  parameters: { radius: number; detail: number };

  /**
   * Constructs a new tetrahedron geometry.
   *
   * @param [radius=1] - Radius of the tetrahedron.
   * @param [detail=0] - Setting this to a value greater than `0` adds vertices making it no longer a tetrahedron.
   */
  constructor(radius: number = 1, detail: number = 0) {
    const vertices = [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1];
    const indices = [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1];
    super(vertices, indices, radius, detail);
    this.type = "TetrahedronGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      radius: radius,
      detail: detail,
    };
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @return A new instance.
   */
  static fromJSON(data: Partial<TetrahedronGeometry["parameters"]>): TetrahedronGeometry {
    return new TetrahedronGeometry(data.radius, data.detail);
  }
}
