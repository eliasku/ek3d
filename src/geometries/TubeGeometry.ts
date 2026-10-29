import type { Curve } from "../extras/core/Curve";
import type { CurveFactory } from "../extras/core/Curve";
import type { CurveJSON } from "../extras/core/Curve";
import { QuadraticBezierCurve3 } from "../extras/curves/QuadraticBezierCurve3";
import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";

export type TubeGeometryJSON = Omit<Partial<TubeGeometry["parameters"]>, "path"> & { path: CurveJSON };
/**
 * Creates a tube that extrudes along a 3D curve.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Curve } from 'ek3d/extras/core/Curve';
 * import { Vector3 } from 'ek3d/math/Vector3';
 * import { TubeGeometry } from 'ek3d/geometries/TubeGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * class CustomSinCurve extends Curve<Vector3> {
 *
 * 	getPoint( t: number, optionalTarget = new Vector3() ) {
 *
 * 		const tx = t * 3 - 1.5;
 * 		const ty = Math.sin( 2 * Math.PI * t );
 * 		const tz = 0;
 *
 * 		return optionalTarget.set( tx, ty, tz );
 * 	}
 *
 * }
 *
 * const path = new CustomSinCurve();
 * const geometry = new TubeGeometry( path, 20, 2, 8, false );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const mesh = new Mesh( geometry, material );
 * scene.add( mesh );
 * ```
 *
 * @demo scenes/geometry-browser.html#TubeGeometry
 */
export class TubeGeometry extends BufferGeometry {
  parameters: {
    path: Curve<Vector3 | null>;
    tubularSegments: number;
    radius: number;
    radialSegments: number;
    closed: boolean;
  };
  tangents: Vector3[];
  normals: Vector3[];
  binormals: Vector3[];

  /**
   * Constructs a new tube geometry.
   *
   * @param [path=QuadraticBezierCurve3] - A 3D curve defining the path of the tube.
   * @param [tubularSegments=64] - The number of segments that make up the tube.
   * @param [radius=1] -The radius of the tube.
   * @param [radialSegments=8] - The number of segments that make up the cross-section.
   * @param [closed=false] - Whether the tube is closed or not.
   */
  constructor(
    path: Curve<Vector3 | null> = new QuadraticBezierCurve3(
      new Vector3(-1, -1, 0),
      new Vector3(-1, 1, 0),
      new Vector3(1, 1, 0),
    ),
    tubularSegments: number = 64,
    radius: number = 1,
    radialSegments: number = 8,
    closed: boolean = false,
  ) {
    super();
    this.type = "TubeGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      path: path,
      tubularSegments: tubularSegments,
      radius: radius,
      radialSegments: radialSegments,
      closed: closed,
    };
    const frames = path.computeFrenetFrames(tubularSegments, closed);
    // expose internals
    this.tangents = frames.tangents;
    this.normals = frames.normals;
    this.binormals = frames.binormals;
    // helper variables
    const vertex = new Vector3();
    const normal = new Vector3();
    const uv = new Vector2();
    let P = new Vector3();
    // buffer
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    const indices: any[] = [];
    // create buffer data
    generateBufferData();
    // build geometry
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    // functions
    function generateBufferData() {
      for (let i = 0; i < tubularSegments; i++) {
        generateSegment(i);
      }
      // if the geometry is not closed, generate the last row of vertices and normals
      // at the regular position on the given path
      //
      // if the geometry is closed, duplicate the first row of vertices and normals (uvs will differ)
      generateSegment(closed === false ? tubularSegments : 0);
      // uvs are generated in a separate function.
      // this makes it easy compute correct values for closed geometries
      generateUVs();
      // finally create faces
      generateIndices();
    }
    function generateSegment(i?: any) {
      // we use getPointAt to sample evenly distributed points from the given path
      P = path.getPointAt(i / tubularSegments, P)!;
      // retrieve corresponding normal and binormal
      const N = frames.normals[i];
      const B = frames.binormals[i];
      // generate normals and vertices for the current segment
      for (let j = 0; j <= radialSegments; j++) {
        const v = (j / radialSegments) * Math.PI * 2;
        const sin = Math.sin(v);
        const cos = -Math.cos(v);
        // normal
        normal.x = cos * N.x + sin * B.x;
        normal.y = cos * N.y + sin * B.y;
        normal.z = cos * N.z + sin * B.z;
        normal.normalize();
        normals.push(normal.x, normal.y, normal.z);
        // vertex
        vertex.x = P.x + radius * normal.x;
        vertex.y = P.y + radius * normal.y;
        vertex.z = P.z + radius * normal.z;
        vertices.push(vertex.x, vertex.y, vertex.z);
      }
    }
    function generateIndices() {
      for (let j = 1; j <= tubularSegments; j++) {
        for (let i = 1; i <= radialSegments; i++) {
          const a = (radialSegments + 1) * (j - 1) + (i - 1);
          const b = (radialSegments + 1) * j + (i - 1);
          const c = (radialSegments + 1) * j + i;
          const d = (radialSegments + 1) * (j - 1) + i;
          // faces
          indices.push(a, b, d);
          indices.push(b, c, d);
        }
      }
    }
    function generateUVs() {
      for (let i = 0; i <= tubularSegments; i++) {
        for (let j = 0; j <= radialSegments; j++) {
          uv.x = i / tubularSegments;
          uv.y = j / radialSegments;
          uvs.push(uv.x, uv.y);
        }
      }
    }
  }
  copy(source: this) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  toJSON(): TubeGeometryJSON {
    const data = super.toJSON();
    data.path = this.parameters.path.toJSON();
    return data;
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @return A new instance.
   */
  static fromJSON(data: TubeGeometryJSON, createCurve: CurveFactory<Vector3>): TubeGeometry {
    // The caller resolves serialized curve types, including custom and composed paths.
    return new TubeGeometry(
      createCurve(data.path),
      data.tubularSegments,
      data.radius,
      data.radialSegments,
      data.closed,
    );
  }
}
