import type { BufferAttribute } from "../../core/BufferAttribute";
import type { BufferGeometry } from "../../core/BufferGeometry";
import { GLBufferAttribute } from "../../core/GLBufferAttribute";
import type { InterleavedBufferAttribute } from "../../core/InterleavedBufferAttribute";
import type { Color } from "../../math/Color";
import { Triangle } from "../../math/Triangle";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import type { Mesh } from "../../objects/Mesh";

type Attribute = BufferAttribute | InterleavedBufferAttribute;

const _face = /*@__PURE__*/ new Triangle();
const _color = /*@__PURE__*/ new Vector3();
const _uva = /*@__PURE__*/ new Vector2();
const _uvb = /*@__PURE__*/ new Vector2();
const _uvc = /*@__PURE__*/ new Vector2();

/** Returns a CPU-readable attribute; GPU-only buffers cannot be sampled. */
function readAttribute(geometry: BufferGeometry, name: string): Attribute | undefined {
  const attribute = geometry.getAttribute(name);
  return attribute instanceof GLBufferAttribute ? undefined : attribute;
}

/**
 * Utility class for sampling weighted random points on the surface of a mesh.
 *
 * Building the sampler is a one-time O(n) operation. Once built, any number of
 * random samples may be selected in O(logn) time. Memory usage is O(n).
 *
 * References:
 * - {@link http://www.joesfer.com/?p=84}
 * - {@link https://stackoverflow.com/a/4322940/1314762}
 *
 * ```ts
 * import { MeshSurfaceSampler } from 'ek3d/addons/math/MeshSurfaceSampler';
 * import { SphereGeometry } from 'ek3d/geometries/SphereGeometry';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Matrix4 } from 'ek3d/math/Matrix4';
 * import { Vector3 } from 'ek3d/math/Vector3';
 * import { InstancedMesh } from 'ek3d/objects/InstancedMesh';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const surfaceMesh = new Mesh( new SphereGeometry(), new MeshBasicMaterial() );
 * const sampleGeometry = new SphereGeometry( 0.01 );
 * const sampleMaterial = new MeshBasicMaterial();
 * const scene = new Scene();
 *
 * const sampler = new MeshSurfaceSampler( surfaceMesh )
 * 	.setWeightAttribute( null )
 * 	.build();
 *
 * const mesh = new InstancedMesh( sampleGeometry, sampleMaterial, 100 );
 *
 * const position = new Vector3();
 * const matrix = new Matrix4();
 *
 * for ( let i = 0; i < 100; i ++ ) {
 *
 * 	sampler.sample( position );
 * 	matrix.makeTranslation( position.x, position.y, position.z );
 * 	mesh.setMatrixAt( i, matrix );
 *
 * }
 *
 * scene.add( mesh );
 * ```
 *
 */
export class MeshSurfaceSampler {
  geometry: BufferGeometry;
  randomFunction: () => number;

  indexAttribute: BufferAttribute | null;
  positionAttribute: Attribute;
  normalAttribute: Attribute | undefined;
  colorAttribute: Attribute | undefined;
  uvAttribute: Attribute | undefined;
  weightAttribute: Attribute | null;

  distribution: Float32Array | null;

  /**
   * Constructs a mesh surface sampler.
   *
   * @param mesh - Surface mesh from which to sample.
   */
  constructor(mesh: Mesh) {
    const positionAttribute = readAttribute(mesh.geometry, "position");
    if (positionAttribute === undefined) {
      throw new Error("MeshSurfaceSampler: the geometry needs a CPU-readable position attribute.");
    }

    this.geometry = mesh.geometry;
    this.randomFunction = Math.random;

    this.indexAttribute = this.geometry.index;
    this.positionAttribute = positionAttribute;
    this.normalAttribute = readAttribute(this.geometry, "normal");
    this.colorAttribute = readAttribute(this.geometry, "color");
    this.uvAttribute = readAttribute(this.geometry, "uv");
    this.weightAttribute = null;

    this.distribution = null;
  }

  /**
   * Specifies a vertex attribute to be used as a weight when sampling from the surface.
   * Faces with higher weights are more likely to be sampled, and those with weights of
   * zero will not be sampled at all. For vector attributes, only .x is used in sampling.
   *
   * If no weight attribute is selected, sampling is randomly distributed by area.
   *
   * @param name - The attribute name.
   * @return A reference to this sampler.
   */
  setWeightAttribute(name: string | null): this {
    this.weightAttribute = name ? (readAttribute(this.geometry, name) ?? null) : null;

    return this;
  }

  /**
   * Processes the input geometry and prepares to return samples. Any configuration of the
   * geometry or sampler must occur before this method is called. Time complexity is O(n)
   * for a surface with n faces.
   *
   * @return A reference to this sampler.
   */
  build(): this {
    const indexAttribute = this.indexAttribute;
    const positionAttribute = this.positionAttribute;
    const weightAttribute = this.weightAttribute;

    const totalFaces = indexAttribute ? indexAttribute.count / 3 : positionAttribute.count / 3;
    const faceWeights = new Float32Array(totalFaces);

    // Accumulate weights for each mesh face.

    for (let i = 0; i < totalFaces; i++) {
      let faceWeight = 1;

      let i0 = 3 * i;
      let i1 = 3 * i + 1;
      let i2 = 3 * i + 2;

      if (indexAttribute) {
        i0 = indexAttribute.getX(i0);
        i1 = indexAttribute.getX(i1);
        i2 = indexAttribute.getX(i2);
      }

      if (weightAttribute) {
        faceWeight = weightAttribute.getX(i0) + weightAttribute.getX(i1) + weightAttribute.getX(i2);
      }

      _face.a.fromBufferAttribute(positionAttribute, i0);
      _face.b.fromBufferAttribute(positionAttribute, i1);
      _face.c.fromBufferAttribute(positionAttribute, i2);
      faceWeight *= _face.getArea();

      faceWeights[i] = faceWeight;
    }

    // Store cumulative total face weights in an array, where weight index
    // corresponds to face index.

    const distribution = new Float32Array(totalFaces);
    let cumulativeTotal = 0;

    for (let i = 0; i < totalFaces; i++) {
      cumulativeTotal += faceWeights[i];
      distribution[i] = cumulativeTotal;
    }

    this.distribution = distribution;
    return this;
  }

  /**
   * Allows to set a custom random number generator. Default is `Math.random()`.
   *
   * @param randomFunction - A random number generator.
   * @return A reference to this sampler.
   */
  setRandomGenerator(randomFunction: () => number): this {
    this.randomFunction = randomFunction;
    return this;
  }

  /**
   * Selects a random point on the surface of the input geometry, returning the
   * position and optionally the normal vector, color and UV Coordinate at that point.
   * Time complexity is O(log n) for a surface with n faces.
   *
   * @param targetPosition - The target object holding the sampled position.
   * @param targetNormal - The target object holding the sampled normal.
   * @param targetColor - The target object holding the sampled color.
   * @param targetUV - The target object holding the sampled uv coordinates.
   * @return A reference to this sampler.
   */
  sample(targetPosition: Vector3, targetNormal?: Vector3, targetColor?: Color, targetUV?: Vector2): this {
    const faceIndex = this._sampleFaceIndex();
    return this._sampleFace(faceIndex, targetPosition, targetNormal, targetColor, targetUV);
  }

  /**
   * Picks the face index according to the cumulative area distribution.
   *
   * @return The sampled face index.
   */
  _sampleFaceIndex(): number {
    const distribution = this.distribution;
    if (distribution === null) {
      throw new Error("MeshSurfaceSampler: call build() before sampling.");
    }

    if (distribution.length === 0) throw new Error("MeshSurfaceSampler: the geometry has no faces to sample.");

    const cumulativeTotal = distribution[distribution.length - 1];
    return this._binarySearch(this.randomFunction() * cumulativeTotal);
  }

  /**
   * Finds the first face whose cumulative weight exceeds `x`.
   *
   * @param x - The weight to search for.
   * @return The face index.
   */
  _binarySearch(x: number): number {
    const distribution = this.distribution as Float32Array;
    let start = 0;
    let end = distribution.length - 1;

    let index = -1;

    while (start <= end) {
      const mid = Math.ceil((start + end) / 2);

      if (mid === 0 || (distribution[mid - 1] <= x && distribution[mid] > x)) {
        index = mid;

        break;
      } else if (x < distribution[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }

    return index;
  }

  /**
   * Interpolates position, normal, color and uv on the given face.
   *
   * @param faceIndex - The face to sample.
   * @param targetPosition - The target object holding the sampled position.
   * @param targetNormal - The target object holding the sampled normal.
   * @param targetColor - The target object holding the sampled color.
   * @param targetUV - The target object holding the sampled uv coordinates.
   * @return A reference to this sampler.
   */
  _sampleFace(
    faceIndex: number,
    targetPosition: Vector3,
    targetNormal?: Vector3,
    targetColor?: Color,
    targetUV?: Vector2,
  ): this {
    let u = this.randomFunction();
    let v = this.randomFunction();

    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }

    // get the vertex attribute indices
    const indexAttribute = this.indexAttribute;
    let i0 = faceIndex * 3;
    let i1 = faceIndex * 3 + 1;
    let i2 = faceIndex * 3 + 2;
    if (indexAttribute) {
      i0 = indexAttribute.getX(i0);
      i1 = indexAttribute.getX(i1);
      i2 = indexAttribute.getX(i2);
    }

    _face.a.fromBufferAttribute(this.positionAttribute, i0);
    _face.b.fromBufferAttribute(this.positionAttribute, i1);
    _face.c.fromBufferAttribute(this.positionAttribute, i2);

    targetPosition
      .set(0, 0, 0)
      .addScaledVector(_face.a, u)
      .addScaledVector(_face.b, v)
      .addScaledVector(_face.c, 1 - (u + v));

    if (targetNormal !== undefined) {
      if (this.normalAttribute !== undefined) {
        _face.a.fromBufferAttribute(this.normalAttribute, i0);
        _face.b.fromBufferAttribute(this.normalAttribute, i1);
        _face.c.fromBufferAttribute(this.normalAttribute, i2);
        targetNormal
          .set(0, 0, 0)
          .addScaledVector(_face.a, u)
          .addScaledVector(_face.b, v)
          .addScaledVector(_face.c, 1 - (u + v))
          .normalize();
      } else {
        _face.getNormal(targetNormal);
      }
    }

    if (targetColor !== undefined && this.colorAttribute !== undefined) {
      _face.a.fromBufferAttribute(this.colorAttribute, i0);
      _face.b.fromBufferAttribute(this.colorAttribute, i1);
      _face.c.fromBufferAttribute(this.colorAttribute, i2);

      _color
        .set(0, 0, 0)
        .addScaledVector(_face.a, u)
        .addScaledVector(_face.b, v)
        .addScaledVector(_face.c, 1 - (u + v));

      targetColor.r = _color.x;
      targetColor.g = _color.y;
      targetColor.b = _color.z;
    }

    if (targetUV !== undefined && this.uvAttribute !== undefined) {
      _uva.fromBufferAttribute(this.uvAttribute, i0);
      _uvb.fromBufferAttribute(this.uvAttribute, i1);
      _uvc.fromBufferAttribute(this.uvAttribute, i2);
      targetUV
        .set(0, 0)
        .addScaledVector(_uva, u)
        .addScaledVector(_uvb, v)
        .addScaledVector(_uvc, 1 - (u + v));
    }

    return this;
  }
}
