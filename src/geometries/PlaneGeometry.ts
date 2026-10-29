import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
/**
 * A geometry class for representing a plane.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { PlaneGeometry } from 'ek3d/geometries/PlaneGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Side } from 'ek3d/constants';
 *
 * const scene = new Scene();
 *
 * const geometry = new PlaneGeometry( 1, 1 );
 * const material = new MeshBasicMaterial( { color: 0xffff00, side: Side.Double } );
 * const plane = new Mesh( geometry, material );
 * scene.add( plane );
 * ```
 *
 * @demo scenes/geometry-browser.html#PlaneGeometry
 */
export class PlaneGeometry extends BufferGeometry {
  parameters: { width: number; height: number; widthSegments: number; heightSegments: number };

  /**
   * Constructs a new plane geometry.
   *
   * @param [width=1] - The width along the X axis.
   * @param [height=1] - The height along the Y axis
   * @param [widthSegments=1] - The number of segments along the X axis.
   * @param [heightSegments=1] - The number of segments along the Y axis.
   */
  constructor(width: number = 1, height: number = 1, widthSegments: number = 1, heightSegments: number = 1) {
    super();
    this.type = "PlaneGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      width: width,
      height: height,
      widthSegments: widthSegments,
      heightSegments: heightSegments,
    };
    const width_half = width / 2;
    const height_half = height / 2;
    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segment_width = width / gridX;
    const segment_height = height / gridY;
    //
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segment_height - height_half;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segment_width - width_half;
        vertices.push(x, -y, 0);
        normals.push(0, 0, 1);
        uvs.push(ix / gridX);
        uvs.push(1 - iy / gridY);
      }
    }
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d = ix + 1 + gridX1 * iy;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
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
  static fromJSON(data: Partial<PlaneGeometry["parameters"]>): PlaneGeometry {
    return new PlaneGeometry(data.width, data.height, data.widthSegments, data.heightSegments);
  }
}
