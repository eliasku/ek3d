import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
/**
 * A class for generating a two-dimensional ring geometry.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { RingGeometry } from 'ek3d/geometries/RingGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Side } from 'ek3d/constants';
 *
 * const scene = new Scene();
 *
 * const geometry = new RingGeometry( 1, 5, 32 );
 * const material = new MeshBasicMaterial( { color: 0xffff00, side: Side.Double } );
 * const mesh = new Mesh( geometry, material );
 * scene.add( mesh );
 * ```
 *
 * @demo scenes/geometry-browser.html#RingGeometry
 */
export class RingGeometry extends BufferGeometry {
  parameters: {
    innerRadius: number;
    outerRadius: number;
    thetaSegments: number;
    phiSegments: number;
    thetaStart: number;
    thetaLength: number;
  };

  /**
   * Constructs a new ring geometry.
   *
   * @param [innerRadius=0.5] - The inner radius of the ring.
   * @param [outerRadius=1] - The outer radius of the ring.
   * @param [thetaSegments=32] - Number of segments. A higher number means the ring will be more round. Minimum is `3`.
   * @param [phiSegments=1] - Number of segments per ring segment. Minimum is `1`.
   * @param [thetaStart=0] - Starting angle in radians.
   * @param [thetaLength=Math.PI*2] - Central angle in radians.
   */
  constructor(
    innerRadius: number = 0.5,
    outerRadius: number = 1,
    thetaSegments: number = 32,
    phiSegments: number = 1,
    thetaStart: number = 0,
    thetaLength: number = Math.PI * 2,
  ) {
    super();
    this.type = "RingGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      innerRadius: innerRadius,
      outerRadius: outerRadius,
      thetaSegments: thetaSegments,
      phiSegments: phiSegments,
      thetaStart: thetaStart,
      thetaLength: thetaLength,
    };
    thetaSegments = Math.max(3, thetaSegments);
    phiSegments = Math.max(1, phiSegments);
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // some helper variables
    let radius = innerRadius;
    const radiusStep = (outerRadius - innerRadius) / phiSegments;
    const vertex = new Vector3();
    const uv = new Vector2();
    // generate vertices, normals and uvs
    for (let j = 0; j <= phiSegments; j++) {
      for (let i = 0; i <= thetaSegments; i++) {
        // values are generate from the inside of the ring to the outside
        const segment = thetaStart + (i / thetaSegments) * thetaLength;
        // vertex
        vertex.x = radius * Math.cos(segment);
        vertex.y = radius * Math.sin(segment);
        vertices.push(vertex.x, vertex.y, vertex.z);
        // normal
        normals.push(0, 0, 1);
        // uv
        uv.x = (vertex.x / outerRadius + 1) / 2;
        uv.y = (vertex.y / outerRadius + 1) / 2;
        uvs.push(uv.x, uv.y);
      }
      // increase the radius for next row of vertices
      radius += radiusStep;
    }
    // indices
    for (let j = 0; j < phiSegments; j++) {
      const thetaSegmentLevel = j * (thetaSegments + 1);
      for (let i = 0; i < thetaSegments; i++) {
        const segment = i + thetaSegmentLevel;
        const a = segment;
        const b = segment + thetaSegments + 1;
        const c = segment + thetaSegments + 2;
        const d = segment + 1;
        // faces
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
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
  static fromJSON(data: Partial<RingGeometry["parameters"]>): RingGeometry {
    return new RingGeometry(
      data.innerRadius,
      data.outerRadius,
      data.thetaSegments,
      data.phiSegments,
      data.thetaStart,
      data.thetaLength,
    );
  }
}
