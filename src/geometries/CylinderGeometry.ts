import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector3 } from "../math/Vector3";
import { Vector2 } from "../math/Vector2";
/**
 * A geometry class for representing a cylinder.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { CylinderGeometry } from 'ek3d/geometries/CylinderGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new CylinderGeometry( 5, 5, 20, 32 );
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const cylinder = new Mesh( geometry, material );
 * scene.add( cylinder );
 * ```
 *
 * @demo scenes/geometry-browser.html#CylinderGeometry
 */
export class CylinderGeometry extends BufferGeometry {
  parameters: {
    radiusTop?: number;
    radiusBottom?: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
    thetaStart: number;
    thetaLength: number;
  };

  /**
   * Constructs a new cylinder geometry.
   *
   * @param [radiusTop=1] - Radius of the cylinder at the top.
   * @param [radiusBottom=1] - Radius of the cylinder at the bottom.
   * @param [height=1] - Height of the cylinder.
   * @param [radialSegments=32] - Number of segmented faces around the circumference of the cylinder.
   * @param [heightSegments=1] - Number of rows of faces along the height of the cylinder.
   * @param [openEnded=false] - Whether the base of the cylinder is open or capped.
   * @param [thetaStart=0] - Start angle for first segment, in radians.
   * @param [thetaLength=Math.PI*2] - The central angle, often called theta, of the circular sector, in radians.
   * The default value results in a complete cylinder.
   */
  constructor(
    radiusTop: number = 1,
    radiusBottom: number = 1,
    height: number = 1,
    radialSegments: number = 32,
    heightSegments: number = 1,
    openEnded: boolean = false,
    thetaStart: number = 0,
    thetaLength: number = Math.PI * 2,
  ) {
    super();
    this.type = "CylinderGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      radiusTop: radiusTop,
      radiusBottom: radiusBottom,
      height: height,
      radialSegments: radialSegments,
      heightSegments: heightSegments,
      openEnded: openEnded,
      thetaStart: thetaStart,
      thetaLength: thetaLength,
    };
    radialSegments = Math.floor(radialSegments);
    heightSegments = Math.floor(heightSegments);
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // helper variables
    let index = 0;
    const indexArray: any[] = [];
    const halfHeight = height / 2;
    let groupStart = 0;
    const generateTorso = () => {
      const normal = new Vector3();
      const vertex = new Vector3();
      let groupCount = 0;
      // this will be used to calculate the normal
      const slope = (radiusBottom - radiusTop) / height;
      // generate vertices, normals and uvs
      for (let y = 0; y <= heightSegments; y++) {
        const indexRow: any[] = [];
        const v = y / heightSegments;
        // calculate the radius of the current row
        const radius = v * (radiusBottom - radiusTop) + radiusTop;
        for (let x = 0; x <= radialSegments; x++) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          // vertex
          vertex.x = radius * sinTheta;
          vertex.y = -v * height + halfHeight;
          vertex.z = radius * cosTheta;
          vertices.push(vertex.x, vertex.y, vertex.z);
          // normal
          normal.set(sinTheta, slope, cosTheta).normalize();
          normals.push(normal.x, normal.y, normal.z);
          // uv
          uvs.push(u, 1 - v);
          // save index of vertex in respective row
          indexRow.push(index++);
        }
        // now save vertices of the row in our index array
        indexArray.push(indexRow);
      }
      // generate indices
      for (let x = 0; x < radialSegments; x++) {
        for (let y = 0; y < heightSegments; y++) {
          // we use the index array to access the correct indices
          const a = indexArray[y][x];
          const b = indexArray[y + 1][x];
          const c = indexArray[y + 1][x + 1];
          const d = indexArray[y][x + 1];
          // faces
          if (radiusTop > 0 || y !== 0) {
            indices.push(a, b, d);
            groupCount += 3;
          }
          if (radiusBottom > 0 || y !== heightSegments - 1) {
            indices.push(b, c, d);
            groupCount += 3;
          }
        }
      }
      // add a group to the geometry. this will ensure multi material support
      this.addGroup(groupStart, groupCount, 0);
      // calculate new start value for groups
      groupStart += groupCount;
    };
    const generateCap = (top?: any) => {
      // save the index of the first center vertex
      const centerIndexStart = index;
      const uv = new Vector2();
      const vertex = new Vector3();
      let groupCount = 0;
      const radius = top === true ? radiusTop : radiusBottom;
      const sign = top === true ? 1 : -1;
      // first we generate the center vertex data of the cap.
      // because the geometry needs one set of uvs per face,
      // we must generate a center vertex per face/segment
      for (let x = 1; x <= radialSegments; x++) {
        // vertex
        vertices.push(0, halfHeight * sign, 0);
        // normal
        normals.push(0, sign, 0);
        // uv
        uvs.push(0.5, 0.5);
        // increase index
        index++;
      }
      // save the index of the last center vertex
      const centerIndexEnd = index;
      // now we generate the surrounding vertices, normals and uvs
      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * thetaLength + thetaStart;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        // vertex
        vertex.x = radius * sinTheta;
        vertex.y = halfHeight * sign;
        vertex.z = radius * cosTheta;
        vertices.push(vertex.x, vertex.y, vertex.z);
        // normal
        normals.push(0, sign, 0);
        // uv
        uv.x = cosTheta * 0.5 + 0.5;
        uv.y = sinTheta * 0.5 * sign + 0.5;
        uvs.push(uv.x, uv.y);
        // increase index
        index++;
      }
      // generate indices
      for (let x = 0; x < radialSegments; x++) {
        const c = centerIndexStart + x;
        const i = centerIndexEnd + x;
        if (top === true) {
          // face top
          indices.push(i, i + 1, c);
        } else {
          // face bottom
          indices.push(i + 1, i, c);
        }
        groupCount += 3;
      }
      // add a group to the geometry. this will ensure multi material support
      this.addGroup(groupStart, groupCount, top === true ? 1 : 2);
      // calculate new start value for groups
      groupStart += groupCount;
    };
    // generate geometry
    generateTorso();
    if (openEnded === false) {
      if (radiusTop > 0) generateCap(true);
      if (radiusBottom > 0) generateCap(false);
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
  static fromJSON(data: Partial<CylinderGeometry["parameters"]>): CylinderGeometry {
    return new CylinderGeometry(
      data.radiusTop,
      data.radiusBottom,
      data.height,
      data.radialSegments,
      data.heightSegments,
      data.openEnded,
      data.thetaStart,
      data.thetaLength,
    );
  }
}
