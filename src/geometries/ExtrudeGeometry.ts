import type { Curve } from "../extras/core/Curve";
import type { CurveFactory } from "../extras/core/Curve";
import type { CurveJSON } from "../extras/core/Curve";
import { BufferGeometry } from "../core/BufferGeometry";
import { Float32BufferAttribute } from "../core/BufferAttribute";
import { Vector2 } from "../math/Vector2";
import { Vector3 } from "../math/Vector3";
import { Shape } from "../extras/core/Shape";
import { ShapeUtils } from "../extras/ShapeUtils";
import { error } from "../utils";

/**
 * Represents the `options` type of the geometry's constructor.
 * - `curveSegments=12`: Number of points on the curves.
 * - `steps=1`: Number of points used for subdividing segments along the depth of the extruded spline.
 * - `depth=1`: Depth to extrude the shape.
 * - `bevelEnabled=true`: Whether to beveling to the shape or not.
 * - `bevelThickness=0.2`: How deep into the original shape the bevel goes.
 * - `bevelSize=bevelThickness-0.1`: Distance from the shape outline that the bevel extends.
 * - `bevelOffset=0`: Distance from the shape outline that the bevel starts.
 * - `bevelSegments=3`: Number of bevel layers.
 * - `extrudePath=null`: A 3D spline path along which the shape should be extruded. Bevels not supported for path extrusion.
 * - `UVGenerator`: An object that provides UV generator functions for custom UV generation.
 */
export interface ExtrudeGeometryOptions {
  curveSegments?: number;
  steps?: number;
  depth?: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  bevelOffset?: number;
  bevelSegments?: number;
  extrudePath?: Curve<Vector3 | null>;
  UVGenerator?: {
    generateTopUV(
      geometry: ExtrudeGeometry,
      vertices: number[],
      indexA: number,
      indexB: number,
      indexC: number,
    ): Vector2[];
    generateSideWallUV(
      geometry: ExtrudeGeometry,
      vertices: number[],
      indexA: number,
      indexB: number,
      indexC: number,
      indexD: number,
    ): Vector2[];
  };
}
export interface ExtrudeGeometryJSON {
  shapes: string[];
  options: Omit<ExtrudeGeometryOptions, "extrudePath"> & { extrudePath?: CurveJSON };
}
/**
 * Creates extruded geometry from a path shape.
 *
 * ```typescript
 * import { Scene } from 'ek3d/scenes/Scene';
 * import { Shape } from 'ek3d/extras/core/Shape';
 * import { ExtrudeGeometry } from 'ek3d/geometries/ExtrudeGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Mesh } from 'ek3d/objects/Mesh';
 *
 * const scene = new Scene();
 *
 * const length = 12, width = 8;
 *
 * const shape = new Shape();
 * shape.moveTo( 0,0 );
 * shape.lineTo( 0, width );
 * shape.lineTo( length, width );
 * shape.lineTo( length, 0 );
 * shape.lineTo( 0, 0 );
 *
 * const geometry = new ExtrudeGeometry( shape );
 * const material = new MeshBasicMaterial( { color: 0x00ff00 } );
 * const mesh = new Mesh( geometry, material ) ;
 * scene.add( mesh );
 * ```
 *
 * @demo scenes/geometry-browser.html#ExtrudeGeometry
 */
export class ExtrudeGeometry extends BufferGeometry {
  parameters: { shapes: Shape | Shape[]; options: ExtrudeGeometryOptions };

  /**
   * Constructs a new extrude geometry.
   *
   * @param [shapes] - A shape or an array of shapes.
   * @param [options] - The extrude settings.
   */
  constructor(
    shapes: Shape | Shape[] = new Shape([
      new Vector2(0.5, 0.5),
      new Vector2(-0.5, 0.5),
      new Vector2(-0.5, -0.5),
      new Vector2(0.5, -0.5),
    ]),
    options: ExtrudeGeometryOptions = {},
  ) {
    super();
    this.type = "ExtrudeGeometry";
    /**
     * Holds the constructor parameters that have been
     * used to generate the geometry. Any modification
     * after instantiation does not change the geometry.
     *
     */
    this.parameters = {
      shapes: shapes,
      options: options,
    };
    shapes = Array.isArray(shapes) ? shapes : [shapes];
    const verticesArray: any[] = [];
    const uvArray: any[] = [];
    for (let i = 0, l = shapes.length; i < l; i++) {
      const shape = shapes[i];
      addShape(shape, this);
    }
    // build geometry
    this.setAttribute("position", new Float32BufferAttribute(verticesArray, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvArray, 2));
    this.computeVertexNormals();
    // functions
    function addShape(shape: Shape, geometry: ExtrudeGeometry) {
      const placeholder: any[] = [];
      // options
      const curveSegments = (options as any).curveSegments !== undefined ? (options as any).curveSegments : 12;
      const steps = (options as any).steps !== undefined ? (options as any).steps : 1;
      const depth = (options as any).depth !== undefined ? (options as any).depth : 1;
      let bevelEnabled = (options as any).bevelEnabled !== undefined ? (options as any).bevelEnabled : true;
      let bevelThickness = (options as any).bevelThickness !== undefined ? (options as any).bevelThickness : 0.2;
      let bevelSize = (options as any).bevelSize !== undefined ? (options as any).bevelSize : bevelThickness - 0.1;
      let bevelOffset = (options as any).bevelOffset !== undefined ? (options as any).bevelOffset : 0;
      let bevelSegments = (options as any).bevelSegments !== undefined ? (options as any).bevelSegments : 3;
      const extrudePath = (options as any).extrudePath;
      const uvgen = (options as any).UVGenerator !== undefined ? (options as any).UVGenerator : WorldUVGenerator;
      //
      let extrudePts: any,
        extrudeByPath = false;
      let splineTube: any, binormal: any, normal: any, position2: any;
      if (extrudePath) {
        extrudePts = extrudePath.getSpacedPoints(steps);
        extrudeByPath = true;
        bevelEnabled = false; // bevels not supported for path extrusion
        // SETUP TNB variables
        const isClosed = extrudePath.isCatmullRomCurve3 ? extrudePath.closed : false;
        splineTube = extrudePath.computeFrenetFrames(steps, isClosed);
        // log(splineTube, 'splineTube', splineTube.normals.length, 'steps', steps, 'extrudePts', extrudePts.length);
        binormal = new Vector3();
        normal = new Vector3();
        position2 = new Vector3();
      }
      // Safeguards if bevels are not enabled
      if (!bevelEnabled) {
        bevelSegments = 0;
        bevelThickness = 0;
        bevelSize = 0;
        bevelOffset = 0;
      }
      // Variables initialization
      const shapePoints = shape.extractPoints(curveSegments);
      let vertices = shapePoints.shape;
      const holes = shapePoints.holes;
      const reverse = !ShapeUtils.isClockWise(vertices);
      if (reverse) {
        vertices = vertices.reverse();
        // Maybe we should also check if holes are in the opposite direction, just to be safe ...
        for (let h = 0, hl = holes.length; h < hl; h++) {
          const ahole = holes[h];
          if (ShapeUtils.isClockWise(ahole)) {
            holes[h] = ahole.reverse();
          }
        }
      }
      /**Merges index-adjacent points that are within a threshold distance of each other. Array is modified in-place. Threshold distance is empirical, and scaled based on the magnitude of point coordinates.
       * @param points
       */
      function mergeOverlappingPoints(points: Vector2[]) {
        const THRESHOLD = 1e-10;
        const THRESHOLD_SQ = THRESHOLD * THRESHOLD;
        let prevPos = points[0];
        for (let i = 1; i <= points.length; i++) {
          const currentIndex = i % points.length;
          const currentPos = points[currentIndex];
          const dx = currentPos.x - prevPos.x;
          const dy = currentPos.y - prevPos.y;
          const distSq = dx * dx + dy * dy;
          const scalingFactorSqrt = Math.max(
            Math.abs(currentPos.x),
            Math.abs(currentPos.y),
            Math.abs(prevPos.x),
            Math.abs(prevPos.y),
          );
          const thresholdSqScaled = THRESHOLD_SQ * scalingFactorSqrt * scalingFactorSqrt;
          if (distSq <= thresholdSqScaled) {
            points.splice(currentIndex, 1);
            i--;
            continue;
          }
          prevPos = currentPos;
        }
      }
      mergeOverlappingPoints(vertices);
      holes.forEach(mergeOverlappingPoints);
      const numHoles = holes.length;
      /* Vertices */
      const contour = vertices; // vertices has all points but contour has only points of circumference
      for (let h = 0; h < numHoles; h++) {
        const ahole = holes[h];
        vertices = vertices.concat(ahole);
      }
      function scalePt2(pt: any, vec: any, size?: any) {
        if (!vec) error("ExtrudeGeometry: vec does not exist");
        return pt.clone().addScaledVector(vec, size);
      }
      const vlen = vertices.length;
      // Find directions for point movement
      function getBevelVec(inPt: any, inPrev: any, inNext?: any) {
        // computes for inPt the corresponding point inPt' on a new contour
        //   shifted by 1 unit (length of normalized vector) to the left
        // if we walk along contour clockwise, this new contour is outside the old one
        //
        // inPt' is the intersection of the two lines parallel to the two
        //  adjacent edges of inPt at a distance of 1 unit on the left side.
        let v_trans_x: any, v_trans_y: any, shrink_by: any; // resulting translation vector for inPt
        // good reading for geometry algorithms (here: line-line intersection)
        // http://geomalgorithms.com/a05-_intersect-1.html
        const v_prev_x = inPt.x - inPrev.x,
          v_prev_y = inPt.y - inPrev.y;
        const v_next_x = inNext.x - inPt.x,
          v_next_y = inNext.y - inPt.y;
        const v_prev_lensq = v_prev_x * v_prev_x + v_prev_y * v_prev_y;
        // check for collinear edges
        const collinear0 = v_prev_x * v_next_y - v_prev_y * v_next_x;
        if (Math.abs(collinear0) > Number.EPSILON) {
          // not collinear
          // length of vectors for normalizing
          const v_prev_len = Math.sqrt(v_prev_lensq);
          const v_next_len = Math.sqrt(v_next_x * v_next_x + v_next_y * v_next_y);
          // shift adjacent points by unit vectors to the left
          const ptPrevShift_x = inPrev.x - v_prev_y / v_prev_len;
          const ptPrevShift_y = inPrev.y + v_prev_x / v_prev_len;
          const ptNextShift_x = inNext.x - v_next_y / v_next_len;
          const ptNextShift_y = inNext.y + v_next_x / v_next_len;
          // scaling factor for v_prev to intersection point
          const sf =
            ((ptNextShift_x - ptPrevShift_x) * v_next_y - (ptNextShift_y - ptPrevShift_y) * v_next_x) /
            (v_prev_x * v_next_y - v_prev_y * v_next_x);
          // vector from inPt to intersection point
          v_trans_x = ptPrevShift_x + v_prev_x * sf - inPt.x;
          v_trans_y = ptPrevShift_y + v_prev_y * sf - inPt.y;
          // Don't normalize!, otherwise sharp corners become ugly
          //  but prevent crazy spikes
          const v_trans_lensq = v_trans_x * v_trans_x + v_trans_y * v_trans_y;
          if (v_trans_lensq <= 2) {
            return new Vector2(v_trans_x, v_trans_y);
          } else {
            shrink_by = Math.sqrt(v_trans_lensq / 2);
          }
        } else {
          // handle special case of collinear edges
          let direction_eq = false; // assumes: opposite
          if (v_prev_x > Number.EPSILON) {
            if (v_next_x > Number.EPSILON) {
              direction_eq = true;
            }
          } else {
            if (v_prev_x < -Number.EPSILON) {
              if (v_next_x < -Number.EPSILON) {
                direction_eq = true;
              }
            } else {
              if (Math.sign(v_prev_y) === Math.sign(v_next_y)) {
                direction_eq = true;
              }
            }
          }
          if (direction_eq) {
            // log("Warning: lines are a straight sequence");
            v_trans_x = -v_prev_y;
            v_trans_y = v_prev_x;
            shrink_by = Math.sqrt(v_prev_lensq);
          } else {
            // log("Warning: lines are a straight spike");
            v_trans_x = v_prev_x;
            v_trans_y = v_prev_y;
            shrink_by = Math.sqrt(v_prev_lensq / 2);
          }
        }
        return new Vector2(v_trans_x / shrink_by, v_trans_y / shrink_by);
      }
      const contourMovements: any[] = [];
      for (let i = 0, il = contour.length, j = il - 1, k = i + 1; i < il; i++, j++, k++) {
        if (j === il) j = 0;
        if (k === il) k = 0;
        //  (j)---(i)---(k)
        // log('i,j,k', i, j , k)
        contourMovements[i] = getBevelVec(contour[i], contour[j], contour[k]);
      }
      const holesMovements: any[] = [];
      let oneHoleMovements: any,
        verticesMovements = contourMovements.concat();
      for (let h = 0, hl = numHoles; h < hl; h++) {
        const ahole = holes[h];
        oneHoleMovements = [];
        for (let i = 0, il = ahole.length, j = il - 1, k = i + 1; i < il; i++, j++, k++) {
          if (j === il) j = 0;
          if (k === il) k = 0;
          //  (j)---(i)---(k)
          oneHoleMovements[i] = getBevelVec(ahole[i], ahole[j], ahole[k]);
        }
        holesMovements.push(oneHoleMovements);
        verticesMovements = verticesMovements.concat(oneHoleMovements);
      }
      let faces: any;
      if (bevelSegments === 0) {
        faces = ShapeUtils.triangulateShape(contour, holes);
      } else {
        const contractedContourVertices: any[] = [];
        const expandedHoleVertices: any[] = [];
        // Loop bevelSegments, 1 for the front, 1 for the back
        for (let b = 0; b < bevelSegments; b++) {
          //for ( b = bevelSegments; b > 0; b -- ) {
          const t = b / bevelSegments;
          const z = bevelThickness * Math.cos((t * Math.PI) / 2);
          const bs = bevelSize * Math.sin((t * Math.PI) / 2) + bevelOffset;
          // contract shape
          for (let i = 0, il = contour.length; i < il; i++) {
            const vert = scalePt2(contour[i], contourMovements[i], bs);
            v(vert.x, vert.y, -z);
            if (t === 0) contractedContourVertices.push(vert);
          }
          // expand holes
          for (let h = 0, hl = numHoles; h < hl; h++) {
            const ahole = holes[h];
            oneHoleMovements = holesMovements[h];
            const oneHoleVertices: any[] = [];
            for (let i = 0, il = ahole.length; i < il; i++) {
              const vert = scalePt2(ahole[i], oneHoleMovements[i], bs);
              v(vert.x, vert.y, -z);
              if (t === 0) oneHoleVertices.push(vert);
            }
            if (t === 0) expandedHoleVertices.push(oneHoleVertices);
          }
        }
        faces = ShapeUtils.triangulateShape(contractedContourVertices, expandedHoleVertices);
      }
      const flen = faces.length;
      const bs = bevelSize + bevelOffset;
      // Back facing vertices
      for (let i = 0; i < vlen; i++) {
        const vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
        if (!extrudeByPath) {
          v(vert.x, vert.y, 0);
        } else {
          // v( vert.x, vert.y + extrudePts[ 0 ].y, extrudePts[ 0 ].x );
          normal.copy(splineTube.normals[0]).multiplyScalar(vert.x);
          binormal.copy(splineTube.binormals[0]).multiplyScalar(vert.y);
          position2.copy(extrudePts[0]).add(normal).add(binormal);
          v(position2.x, position2.y, position2.z);
        }
      }
      // Add stepped vertices...
      // Including front facing vertices
      for (let s = 1; s <= steps; s++) {
        for (let i = 0; i < vlen; i++) {
          const vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
          if (!extrudeByPath) {
            v(vert.x, vert.y, (depth / steps) * s);
          } else {
            // v( vert.x, vert.y + extrudePts[ s - 1 ].y, extrudePts[ s - 1 ].x );
            normal.copy(splineTube.normals[s]).multiplyScalar(vert.x);
            binormal.copy(splineTube.binormals[s]).multiplyScalar(vert.y);
            position2.copy(extrudePts[s]).add(normal).add(binormal);
            v(position2.x, position2.y, position2.z);
          }
        }
      }
      // Add bevel segments planes
      //for ( b = 1; b <= bevelSegments; b ++ ) {
      for (let b = bevelSegments - 1; b >= 0; b--) {
        const t = b / bevelSegments;
        const z = bevelThickness * Math.cos((t * Math.PI) / 2);
        const bs = bevelSize * Math.sin((t * Math.PI) / 2) + bevelOffset;
        // contract shape
        for (let i = 0, il = contour.length; i < il; i++) {
          const vert = scalePt2(contour[i], contourMovements[i], bs);
          v(vert.x, vert.y, depth + z);
        }
        // expand holes
        for (let h = 0, hl = holes.length; h < hl; h++) {
          const ahole = holes[h];
          oneHoleMovements = holesMovements[h];
          for (let i = 0, il = ahole.length; i < il; i++) {
            const vert = scalePt2(ahole[i], oneHoleMovements[i], bs);
            if (!extrudeByPath) {
              v(vert.x, vert.y, depth + z);
            } else {
              v(vert.x, vert.y + extrudePts[steps - 1].y, extrudePts[steps - 1].x + z);
            }
          }
        }
      }
      /* Faces */
      // Top and bottom faces
      buildLidFaces();
      // Sides faces
      buildSideFaces();
      /////  Internal functions
      function buildLidFaces() {
        const start = verticesArray.length / 3;
        if (bevelEnabled) {
          let layer = 0; // steps + 1
          let offset = vlen * layer;
          // Bottom faces
          for (let i = 0; i < flen; i++) {
            const face = faces[i];
            f3(face[2] + offset, face[1] + offset, face[0] + offset);
          }
          layer = steps + bevelSegments * 2;
          offset = vlen * layer;
          // Top faces
          for (let i = 0; i < flen; i++) {
            const face = faces[i];
            f3(face[0] + offset, face[1] + offset, face[2] + offset);
          }
        } else {
          // Bottom faces
          for (let i = 0; i < flen; i++) {
            const face = faces[i];
            f3(face[2], face[1], face[0]);
          }
          // Top faces
          for (let i = 0; i < flen; i++) {
            const face = faces[i];
            f3(face[0] + vlen * steps, face[1] + vlen * steps, face[2] + vlen * steps);
          }
        }
        geometry.addGroup(start, verticesArray.length / 3 - start, 0);
      }
      // Create faces for the z-sides of the shape
      function buildSideFaces() {
        const start = verticesArray.length / 3;
        let layeroffset = 0;
        sidewalls(contour, layeroffset);
        layeroffset += contour.length;
        for (let h = 0, hl = holes.length; h < hl; h++) {
          const ahole = holes[h];
          sidewalls(ahole, layeroffset);
          //, true
          layeroffset += ahole.length;
        }
        geometry.addGroup(start, verticesArray.length / 3 - start, 1);
      }
      function sidewalls(contour: any, layeroffset?: any) {
        let i = contour.length;
        while (--i >= 0) {
          const j = i;
          let k = i - 1;
          if (k < 0) k = contour.length - 1;
          //log('b', i,j, i-1, k,vertices.length);
          for (let s = 0, sl = steps + bevelSegments * 2; s < sl; s++) {
            const slen1 = vlen * s;
            const slen2 = vlen * (s + 1);
            const a = layeroffset + j + slen1,
              b = layeroffset + k + slen1,
              c = layeroffset + k + slen2,
              d = layeroffset + j + slen2;
            f4(a, b, c, d);
          }
        }
      }
      function v(x: any, y: any, z?: any) {
        placeholder.push(x);
        placeholder.push(y);
        placeholder.push(z);
      }
      function f3(a: any, b: any, c?: any) {
        addVertex(a);
        addVertex(b);
        addVertex(c);
        const nextIndex = verticesArray.length / 3;
        const uvs = uvgen.generateTopUV(geometry, verticesArray, nextIndex - 3, nextIndex - 2, nextIndex - 1);
        addUV(uvs[0]);
        addUV(uvs[1]);
        addUV(uvs[2]);
      }
      function f4(a: any, b: any, c: any, d?: any) {
        addVertex(a);
        addVertex(b);
        addVertex(d);
        addVertex(b);
        addVertex(c);
        addVertex(d);
        const nextIndex = verticesArray.length / 3;
        const uvs = uvgen.generateSideWallUV(
          geometry,
          verticesArray,
          nextIndex - 6,
          nextIndex - 3,
          nextIndex - 2,
          nextIndex - 1,
        );
        addUV(uvs[0]);
        addUV(uvs[1]);
        addUV(uvs[3]);
        addUV(uvs[1]);
        addUV(uvs[2]);
        addUV(uvs[3]);
      }
      function addVertex(index?: any) {
        verticesArray.push(placeholder[index * 3 + 0]);
        verticesArray.push(placeholder[index * 3 + 1]);
        verticesArray.push(placeholder[index * 3 + 2]);
      }
      function addUV(vector2?: any) {
        uvArray.push(vector2.x);
        uvArray.push(vector2.y);
      }
    }
  }
  copy(source: this) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  toJSON(): ExtrudeGeometryJSON {
    const data = super.toJSON();
    const shapes = this.parameters.shapes;
    const options = this.parameters.options;
    return toJSON(shapes, options, data);
  }
  /**
   * Factory method for creating an instance of this class from the given
   * JSON object.
   *
   * @param data - A JSON object representing the serialized geometry.
   * @param shapes - An array of shapes.
   * @return A new instance.
   */
  static fromJSON(
    data: ExtrudeGeometryJSON,
    shapes: Record<string, Shape>,
    createCurve: CurveFactory<Vector3>,
  ): ExtrudeGeometry;
  static fromJSON(data: any, shapes: Record<string, Shape>, createCurve: CurveFactory<Vector3>): ExtrudeGeometry {
    const geometryShapes: any[] = [];
    for (let j = 0, jl = data.shapes.length; j < jl; j++) {
      const shape = shapes[data.shapes[j]];
      geometryShapes.push(shape);
    }
    const extrudePath = data.options.extrudePath;
    if (extrudePath !== undefined) {
      data.options.extrudePath = createCurve(extrudePath);
    }
    return new ExtrudeGeometry(geometryShapes, data.options);
  }
}
const WorldUVGenerator = {
  generateTopUV: function (geometry?: any, vertices?: any, indexA?: any, indexB?: any, indexC?: any) {
    const a_x = vertices[indexA * 3];
    const a_y = vertices[indexA * 3 + 1];
    const b_x = vertices[indexB * 3];
    const b_y = vertices[indexB * 3 + 1];
    const c_x = vertices[indexC * 3];
    const c_y = vertices[indexC * 3 + 1];
    return [new Vector2(a_x, a_y), new Vector2(b_x, b_y), new Vector2(c_x, c_y)];
  },
  generateSideWallUV: function (
    geometry?: any,
    vertices?: any,
    indexA?: any,
    indexB?: any,
    indexC?: any,
    indexD?: any,
  ) {
    const a_x = vertices[indexA * 3];
    const a_y = vertices[indexA * 3 + 1];
    const a_z = vertices[indexA * 3 + 2];
    const b_x = vertices[indexB * 3];
    const b_y = vertices[indexB * 3 + 1];
    const b_z = vertices[indexB * 3 + 2];
    const c_x = vertices[indexC * 3];
    const c_y = vertices[indexC * 3 + 1];
    const c_z = vertices[indexC * 3 + 2];
    const d_x = vertices[indexD * 3];
    const d_y = vertices[indexD * 3 + 1];
    const d_z = vertices[indexD * 3 + 2];
    if (Math.abs(a_y - b_y) < Math.abs(a_x - b_x)) {
      return [
        new Vector2(a_x, 1 - a_z),
        new Vector2(b_x, 1 - b_z),
        new Vector2(c_x, 1 - c_z),
        new Vector2(d_x, 1 - d_z),
      ];
    } else {
      return [
        new Vector2(a_y, 1 - a_z),
        new Vector2(b_y, 1 - b_z),
        new Vector2(c_y, 1 - c_z),
        new Vector2(d_y, 1 - d_z),
      ];
    }
  },
};
function toJSON(shapes?: any, options?: any, data?: any) {
  data.shapes = [];
  if (Array.isArray(shapes)) {
    for (let i = 0, l = shapes.length; i < l; i++) {
      const shape = shapes[i];
      data.shapes.push(shape.uuid);
    }
  } else {
    data.shapes.push(shapes.uuid);
  }
  data.options = Object.assign({}, options);
  if (options.extrudePath !== undefined) data.options.extrudePath = options.extrudePath.toJSON();
  return data;
}
