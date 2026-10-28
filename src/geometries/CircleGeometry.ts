import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector3 } from "../math/Vector3";
import { Vector2 } from "../math/Vector2";
/**
 * A simple shape of Euclidean geometry. It is constructed from a
 * number of triangular segments that are oriented around a central point and
 * extend as far out as a given radius. It is built counter-clockwise from a
 * start angle and a given central angle. It can also be used to create
 * regular polygons, where the number of segments determines the number of
 * sides.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { CircleGeometry } from 'ek3d/geometries/CircleGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new CircleGeometry( 5, 32 );
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const circle = new Mesh( geometry, material );
 * scene.add( circle )
 * ```
 *
 * @demo scenes/geometry-browser.html#CircleGeometry
 */
export class CircleGeometry extends BufferGeometry {
  parameters: { radius: number; segments: number; thetaStart: number; thetaLength: number };

  /**
   * Constructs a new circle geometry.
   *
   * @param [radius=1] - Radius of the circle.
   * @param [segments=32] - Number of segments (triangles), minimum = `3`.
   * @param [thetaStart=0] - Start angle for first segment in radians.
   * @param [thetaLength=Math.PI*2] - The central angle, often called theta,
   * of the circular sector in radians. The default value results in a complete circle.
   */
  constructor(radius: number = 1, segments: number = 32, thetaStart: number = 0, thetaLength: number = Math.PI * 2) {
    super();
    this.type = "CircleGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      radius: radius,
      segments: segments,
      thetaStart: thetaStart,
      thetaLength: thetaLength,
    };
    segments = Math.max(3, segments);
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // helper variables
    const vertex = new Vector3();
    const uv = new Vector2();
    // center point
    vertices.push(0, 0, 0);
    normals.push(0, 0, 1);
    uvs.push(0.5, 0.5);
    for (let s = 0, i = 3; s <= segments; s++, i += 3) {
      const segment = thetaStart + (s / segments) * thetaLength;
      // vertex
      vertex.x = radius * Math.cos(segment);
      vertex.y = radius * Math.sin(segment);
      vertices.push(vertex.x, vertex.y, vertex.z);
      // normal
      normals.push(0, 0, 1);
      // uvs
      uv.x = (vertices[i] / radius + 1) / 2;
      uv.y = (vertices[i + 1] / radius + 1) / 2;
      uvs.push(uv.x, uv.y);
    }
    // indices
    for (let i = 1; i <= segments; i++) {
      indices.push(i, i + 1, 0);
    }
    // build geometry
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }
  copy(source: this) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @return A new instance.
   */
  static fromJSON(data: Partial<CircleGeometry["parameters"]>): CircleGeometry {
    return new CircleGeometry(data.radius, data.segments, data.thetaStart, data.thetaLength);
  }
}
