import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector3 } from "../math/Vector3";
/**
 * A geometry class for a rectangular cuboid with a given width, height, and depth.
 * On creation, the cuboid is centred on the origin, with each edge parallel to one
 * of the axes.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new BoxGeometry( 1, 1, 1 );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const cube = new Mesh( geometry, material );
 * scene.add( cube );
 * ```
 *
 * @demo scenes/geometry-browser.html#BoxGeometry
 */
export class BoxGeometry extends BufferGeometry {
  parameters: {
    width: number;
    height: number;
    depth: number;
    widthSegments: number;
    heightSegments: number;
    depthSegments: number;
  };

  /**
   * Constructs a new box geometry.
   *
   * @param [width=1] - The width. That is, the length of the edges parallel to the X axis.
   * @param [height=1] - The height. That is, the length of the edges parallel to the Y axis.
   * @param [depth=1] - The depth. That is, the length of the edges parallel to the Z axis.
   * @param [widthSegments=1] - Number of segmented rectangular faces along the width of the sides.
   * @param [heightSegments=1] - Number of segmented rectangular faces along the height of the sides.
   * @param [depthSegments=1] - Number of segmented rectangular faces along the depth of the sides.
   */
  constructor(
    width: number = 1,
    height: number = 1,
    depth: number = 1,
    widthSegments: number = 1,
    heightSegments: number = 1,
    depthSegments: number = 1,
  ) {
    super();
    this.type = "BoxGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      width: width,
      height: height,
      depth: depth,
      widthSegments: widthSegments,
      heightSegments: heightSegments,
      depthSegments: depthSegments,
    };
    // segments
    widthSegments = Math.floor(widthSegments);
    heightSegments = Math.floor(heightSegments);
    depthSegments = Math.floor(depthSegments);
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // helper variables
    let numberOfVertices = 0;
    let groupStart = 0;
    const buildPlane = (
      u: "x" | "y" | "z",
      v: "x" | "y" | "z",
      w: "x" | "y" | "z",
      udir: any,
      vdir: any,
      width: any,
      height: any,
      depth: any,
      gridX: any,
      gridY: any,
      materialIndex?: any,
    ) => {
      const segmentWidth = width / gridX;
      const segmentHeight = height / gridY;
      const widthHalf = width / 2;
      const heightHalf = height / 2;
      const depthHalf = depth / 2;
      const gridX1 = gridX + 1;
      const gridY1 = gridY + 1;
      let vertexCounter = 0;
      let groupCount = 0;
      const vector = new Vector3();
      // generate vertices, normals and uvs
      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segmentHeight - heightHalf;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segmentWidth - widthHalf;
          // set values to correct vector component
          (vector as any)[u] = x * udir;
          (vector as any)[v] = y * vdir;
          (vector as any)[w] = depthHalf;
          // now apply vector to vertex buffer
          vertices.push(vector.x, vector.y, vector.z);
          // set values to correct vector component
          (vector as any)[u] = 0;
          (vector as any)[v] = 0;
          (vector as any)[w] = depth > 0 ? 1 : -1;
          // now apply vector to normal buffer
          normals.push(vector.x, vector.y, vector.z);
          // uvs
          uvs.push(ix / gridX);
          uvs.push(1 - iy / gridY);
          // counters
          vertexCounter += 1;
        }
      }
      // indices
      // 1. you need three indices to draw a single face
      // 2. a single segment consists of two faces
      // 3. so we need to generate six (2*3) indices per segment
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = numberOfVertices + ix + gridX1 * iy;
          const b = numberOfVertices + ix + gridX1 * (iy + 1);
          const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
          const d = numberOfVertices + (ix + 1) + gridX1 * iy;
          // faces
          indices.push(a, b, d);
          indices.push(b, c, d);
          // increase counter
          groupCount += 6;
        }
      }
      // add a group to the geometry. this will ensure multi material support
      this.addGroup(groupStart, groupCount, materialIndex);
      // calculate new start value for groups
      groupStart += groupCount;
      // update total number of vertices
      numberOfVertices += vertexCounter;
    };
    // build each side of the box geometry
    buildPlane("z", "y", "x", -1, -1, depth, height, width, depthSegments, heightSegments, 0); // px
    buildPlane("z", "y", "x", 1, -1, depth, height, -width, depthSegments, heightSegments, 1); // nx
    buildPlane("x", "z", "y", 1, 1, width, depth, height, widthSegments, depthSegments, 2); // py
    buildPlane("x", "z", "y", 1, -1, width, depth, -height, widthSegments, depthSegments, 3); // ny
    buildPlane("x", "y", "z", 1, -1, width, height, depth, widthSegments, heightSegments, 4); // pz
    buildPlane("x", "y", "z", -1, -1, width, height, -depth, widthSegments, heightSegments, 5); // nz
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
  static fromJSON(data: Partial<BoxGeometry["parameters"]>): BoxGeometry {
    return new BoxGeometry(
      data.width,
      data.height,
      data.depth,
      data.widthSegments,
      data.heightSegments,
      data.depthSegments,
    );
  }
}
