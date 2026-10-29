import { CylinderGeometry } from "./CylinderGeometry";
/**
 * A geometry class for representing a cone.
 *
 * ```ts
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { ConeGeometry } from 'ek3d/geometries/ConeGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const geometry = new ConeGeometry( 5, 20, 32 );
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const cone = new Mesh(geometry, material );
 * scene.add( cone );
 * ```
 *
 * @demo scenes/geometry-browser.html#ConeGeometry
 */
export class ConeGeometry extends CylinderGeometry {
  parameters: {
    radius: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
    openEnded: boolean;
    thetaStart: number;
    thetaLength: number;
  };

  /**
   * Constructs a new cone geometry.
   *
   * @param [radius=1] - Radius of the cone base.
   * @param [height=1] - Height of the cone.
   * @param [radialSegments=32] - Number of segmented faces around the circumference of the cone.
   * @param [heightSegments=1] - Number of rows of faces along the height of the cone.
   * @param [openEnded=false] - Whether the base of the cone is open or capped.
   * @param [thetaStart=0] - Start angle for first segment, in radians.
   * @param [thetaLength=Math.PI*2] - The central angle, often called theta, of the circular sector, in radians.
   * The default value results in a complete cone.
   */
  constructor(
    radius: number = 1,
    height: number = 1,
    radialSegments: number = 32,
    heightSegments: number = 1,
    openEnded: boolean = false,
    thetaStart: number = 0,
    thetaLength: number = Math.PI * 2,
  ) {
    super(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
    this.type = "ConeGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      radius: radius,
      height: height,
      radialSegments: radialSegments,
      heightSegments: heightSegments,
      openEnded: openEnded,
      thetaStart: thetaStart,
      thetaLength: thetaLength,
    };
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @return A new instance.
   */
  static fromJSON(data: Partial<ConeGeometry["parameters"]>): ConeGeometry {
    return new ConeGeometry(
      data.radius,
      data.height,
      data.radialSegments,
      data.heightSegments,
      data.openEnded,
      data.thetaStart,
      data.thetaLength,
    );
  }
}
