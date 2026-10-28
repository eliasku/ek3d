import { PolyhedronGeometry } from "./PolyhedronGeometry";
/**
 * A geometry class for representing an octahedron.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { OctahedronGeometry } from 'ek3d/geometries/OctahedronGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new OctahedronGeometry();
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const octahedron = new Mesh( geometry, material );
 * scene.add( octahedron );
 * ```
 *
 * @demo scenes/geometry-browser.html#OctahedronGeometry
 */
export class OctahedronGeometry extends PolyhedronGeometry {
  parameters: { radius: number; detail: number };

  /**
   * Constructs a new octahedron geometry.
   *
   * @param [radius=1] - Radius of the octahedron.
   * @param [detail=0] - Setting this to a value greater than `0` adds vertices making it no longer a octahedron.
   */
  constructor(radius: number = 1, detail: number = 0) {
    const vertices = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
    const indices = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];
    super(vertices, indices, radius, detail);
    this.type = "OctahedronGeometry";
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
  static fromJSON(data: Partial<OctahedronGeometry["parameters"]>): OctahedronGeometry {
    return new OctahedronGeometry(data.radius, data.detail);
  }
}
