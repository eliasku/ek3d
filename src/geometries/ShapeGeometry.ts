import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Shape } from "../extras/core/Shape";
import { ShapeUtils } from "../extras/ShapeUtils";
import { Vector2 } from "../math/Vector2";

export interface ShapeGeometryJSON {
  shapes: string[];
  curveSegments?: number;
}
/**
 * Creates an one-sided polygonal geometry from one or more path shapes.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Shape } from 'ek3d/extras/core/Shape';
 * import { ShapeGeometry } from 'ek3d/geometries/ShapeGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { DoubleSide } from 'ek3d/constants';
 *
 * const scene = new Scene();
 *
 * const arcShape = new Shape();
 * arcShape.moveTo( 5, 1 );
 * arcShape.absarc( 1, 1, 4, 0, Math.PI * 2, false );
 *
 * const geometry = new ShapeGeometry( arcShape );
 * const material = new MeshBasicMaterial( { color: 0x00ff00, side: DoubleSide } );
 * const mesh = new Mesh( geometry, material ) ;
 * scene.add( mesh );
 * ```
 *
 * @demo scenes/geometry-browser.html#ShapeGeometry
 */
export class ShapeGeometry extends BufferGeometry {
  parameters: { shapes: Shape | Shape[]; curveSegments: number };

  /**
   * Constructs a new shape geometry.
   *
   * @param [shapes] - A shape or an array of shapes.
   * @param [curveSegments=12] - Number of segments per shape.
   */
  constructor(
    shapes: Shape | Shape[] = new Shape([new Vector2(0, 0.5), new Vector2(-0.5, -0.5), new Vector2(0.5, -0.5)]),
    curveSegments: number = 12,
  ) {
    super();
    this.type = "ShapeGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      shapes: shapes,
      curveSegments: curveSegments,
    };
    // buffers
    const indices: any[] = [];
    const vertices: any[] = [];
    const normals: any[] = [];
    const uvs: any[] = [];
    // helper variables
    let groupStart = 0;
    let groupCount = 0;
    // allow single and array values for "shapes" parameter
    if (Array.isArray(shapes) === false) {
      addShape(shapes);
    } else {
      for (let i = 0; i < shapes.length; i++) {
        addShape(shapes[i]);
        this.addGroup(groupStart, groupCount, i); // enables MultiMaterial support
        groupStart += groupCount;
        groupCount = 0;
      }
    }
    // build geometry
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    // helper functions
    function addShape(shape: Shape) {
      const indexOffset = vertices.length / 3;
      const points = shape.extractPoints(curveSegments);
      let shapeVertices = points.shape;
      const shapeHoles = points.holes;
      // check direction of vertices
      if (ShapeUtils.isClockWise(shapeVertices) === false) {
        shapeVertices = shapeVertices.reverse();
      }
      for (let i = 0, l = shapeHoles.length; i < l; i++) {
        const shapeHole = shapeHoles[i];
        if (ShapeUtils.isClockWise(shapeHole) === true) {
          shapeHoles[i] = shapeHole.reverse();
        }
      }
      const faces = ShapeUtils.triangulateShape(shapeVertices, shapeHoles);
      // join vertices of inner and outer paths to a single array
      for (let i = 0, l = shapeHoles.length; i < l; i++) {
        const shapeHole = shapeHoles[i];
        shapeVertices = shapeVertices.concat(shapeHole);
      }
      // vertices, normals, uvs
      for (let i = 0, l = shapeVertices.length; i < l; i++) {
        const vertex = shapeVertices[i];
        vertices.push(vertex.x, vertex.y, 0);
        normals.push(0, 0, 1);
        uvs.push(vertex.x, vertex.y); // world uvs
      }
      // indices
      for (let i = 0, l = faces.length; i < l; i++) {
        const face = faces[i];
        const a = face[0] + indexOffset;
        const b = face[1] + indexOffset;
        const c = face[2] + indexOffset;
        indices.push(a, b, c);
        groupCount += 3;
      }
    }
  }
  copy(source: this) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  toJSON(): ShapeGeometryJSON {
    const data = super.toJSON();
    const shapes = this.parameters.shapes;
    return toJSON(shapes, data);
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @param shapes - An array of shapes.
   * @return A new instance.
   */
  static fromJSON(data: ShapeGeometryJSON, shapes: Record<string, Shape>): ShapeGeometry {
    const geometryShapes: any[] = [];
    for (let j = 0, jl = data.shapes.length; j < jl; j++) {
      const shape = shapes[data.shapes[j]];
      geometryShapes.push(shape);
    }
    return new ShapeGeometry(geometryShapes, data.curveSegments);
  }
}
function toJSON(shapes?: any, data?: any) {
  data.shapes = [];
  if (Array.isArray(shapes)) {
    for (let i = 0, l = shapes.length; i < l; i++) {
      const shape = shapes[i];
      data.shapes.push(shape.uuid);
    }
  } else {
    data.shapes.push(shapes.uuid);
  }
  return data;
}
