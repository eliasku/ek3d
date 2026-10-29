import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector3 } from "../math/Vector3";
/**
 * A geometry class for representing a capsule.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { CapsuleGeometry } from 'ek3d/geometries/CapsuleGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new CapsuleGeometry( 1, 1, 4, 8, 1 );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const capsule = new Mesh( geometry, material );
 * scene.add( capsule );
 * ```
 *
 * @demo scenes/geometry-browser.html#CapsuleGeometry
 */
export class CapsuleGeometry extends BufferGeometry {
  parameters: { radius: number; height: number; capSegments: number; radialSegments: number; heightSegments: number };

  /**
   * Constructs a new capsule geometry.
   *
   * @param [radius=1] - Radius of the capsule.
   * @param [height=1] - Height of the middle section.
   * @param [capSegments=4] - Number of curve segments used to build each cap.
   * @param [radialSegments=8] - Number of segmented faces around the circumference of the capsule. Must be an integer >= 3.
   * @param [heightSegments=1] - Number of rows of faces along the height of the middle section. Must be an integer >= 1.
   */
  constructor(
    radius: number = 1,
    height: number = 1,
    capSegments: number = 4,
    radialSegments: number = 8,
    heightSegments: number = 1,
  ) {
    super();
    this.type = "CapsuleGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      radius: radius,
      height: height,
      capSegments: capSegments,
      radialSegments: radialSegments,
      heightSegments: heightSegments,
    };
    height = Math.max(0, height);
    capSegments = Math.max(1, Math.floor(capSegments));
    radialSegments = Math.max(3, Math.floor(radialSegments));
    heightSegments = Math.max(1, Math.floor(heightSegments));
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // helper variables
    const halfHeight = height / 2;
    const capArcLength = (Math.PI / 2) * radius;
    const cylinderPartLength = height;
    const totalArcLength = 2 * capArcLength + cylinderPartLength;
    const numVerticalSegments = capSegments * 2 + heightSegments;
    const verticesPerRow = radialSegments + 1;
    const normal = new Vector3();
    const vertex = new Vector3();
    // generate vertices, normals, and uvs
    for (let iy = 0; iy <= numVerticalSegments; iy++) {
      let currentArcLength = 0;
      let profileY = 0;
      let profileRadius = 0;
      let normalYComponent = 0;
      if (iy <= capSegments) {
        // bottom cap
        const segmentProgress = iy / capSegments;
        const angle = (segmentProgress * Math.PI) / 2;
        profileY = -halfHeight - radius * Math.cos(angle);
        profileRadius = radius * Math.sin(angle);
        normalYComponent = -radius * Math.cos(angle);
        currentArcLength = segmentProgress * capArcLength;
      } else if (iy <= capSegments + heightSegments) {
        // middle section
        const segmentProgress = (iy - capSegments) / heightSegments;
        profileY = -halfHeight + segmentProgress * height;
        profileRadius = radius;
        normalYComponent = 0;
        currentArcLength = capArcLength + segmentProgress * cylinderPartLength;
      } else {
        // top cap
        const segmentProgress = (iy - capSegments - heightSegments) / capSegments;
        const angle = (segmentProgress * Math.PI) / 2;
        profileY = halfHeight + radius * Math.sin(angle);
        profileRadius = radius * Math.cos(angle);
        normalYComponent = radius * Math.sin(angle);
        currentArcLength = capArcLength + cylinderPartLength + segmentProgress * capArcLength;
      }
      const v = Math.max(0, Math.min(1, currentArcLength / totalArcLength));
      // special case for the poles
      let uOffset = 0;
      if (iy === 0) {
        uOffset = 0.5 / radialSegments;
      } else if (iy === numVerticalSegments) {
        uOffset = -0.5 / radialSegments;
      }
      for (let ix = 0; ix <= radialSegments; ix++) {
        const u = ix / radialSegments;
        const theta = u * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        // vertex
        vertex.x = -profileRadius * cosTheta;
        vertex.y = profileY;
        vertex.z = profileRadius * sinTheta;
        vertices.push(vertex.x, vertex.y, vertex.z);
        // normal
        normal.set(-profileRadius * cosTheta, normalYComponent, profileRadius * sinTheta);
        normal.normalize();
        normals.push(normal.x, normal.y, normal.z);
        // uv
        uvs.push(u + uOffset, v);
      }
      if (iy > 0) {
        const prevIndexRow = (iy - 1) * verticesPerRow;
        for (let ix = 0; ix < radialSegments; ix++) {
          const i1 = prevIndexRow + ix;
          const i2 = prevIndexRow + ix + 1;
          const i3 = iy * verticesPerRow + ix;
          const i4 = iy * verticesPerRow + ix + 1;
          indices.push(i1, i2, i3);
          indices.push(i2, i4, i3);
        }
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
  static fromJSON(data: Partial<CapsuleGeometry["parameters"]>): CapsuleGeometry {
    return new CapsuleGeometry(data.radius, data.height, data.capSegments, data.radialSegments, data.heightSegments);
  }
}
