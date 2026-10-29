import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { BufferGeometry } from "../core/BufferGeometry";
import type { Frustum } from "../math/Frustum";
import type { FrustumArray } from "../math/FrustumArray";
import type { Intersection } from "../core/Raycaster";
import type { Material } from "../materials/Material";
import type { Raycaster } from "../core/Raycaster";
import { Vector3 } from "../math/Vector3";
import { Vector2 } from "../math/Vector2";
import { Sphere } from "../math/Sphere";
import { Ray } from "../math/Ray";
import { Matrix4 } from "../math/Matrix4";
import { Object3D } from "../core/Object3D";
import { Triangle } from "../math/Triangle";
import { Side } from "../constants";
const _inverseMatrix = /*@__PURE__*/ new Matrix4();
const _ray = /*@__PURE__*/ new Ray();
const _sphere = /*@__PURE__*/ new Sphere();
const _sphereHitAt = /*@__PURE__*/ new Vector3();
const _vA = /*@__PURE__*/ new Vector3();
const _vB = /*@__PURE__*/ new Vector3();
const _vC = /*@__PURE__*/ new Vector3();
const _tempA = /*@__PURE__*/ new Vector3();
const _morphA = /*@__PURE__*/ new Vector3();
const _intersectionPoint = /*@__PURE__*/ new Vector3();
const _intersectionPointWorld = /*@__PURE__*/ new Vector3();
/**
 * Class representing triangular polygon mesh based objects.
 *
 * ```ts
 * import { BoxGeometry } from 'ek3d/geometries/BoxGeometry';
 * import { Mesh } from 'ek3d/objects/Mesh';
 * import { MeshBasicMaterial } from 'ek3d/materials/MeshBasicMaterial';
 * import { Scene } from 'ek3d/scenes/Scene';
 *
 * const scene = new Scene();
 *
 * const geometry = new BoxGeometry( 1, 1, 1 );
 * const material = new MeshBasicMaterial( { color: 0xffff00 } );
 * const mesh = new Mesh( geometry, material );
 * scene.add( mesh );
 * ```
 *
 */
export class Mesh<TMaterial extends Material | Material[] = Material | Material[]> extends Object3D {
  isMesh: boolean;

  geometry: BufferGeometry;
  material: TMaterial;
  morphTargetDictionary: Record<string, number> | undefined;
  morphTargetInfluences: number[] | undefined;

  /**
   * Constructs a new mesh.
   *
   * @param [geometry] - The mesh geometry.
   * @param [material] - The mesh material.
   */
  constructor(geometry: BufferGeometry, material: NoInfer<TMaterial>) {
    super();
    if (geometry === undefined || material === undefined)
      throw new Error("Mesh requires explicit geometry and material.");
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isMesh = true;
    this.type = "Mesh";
    /**
     * The mesh geometry.
     *
     */
    this.geometry = geometry;
    /**
     * The mesh material.
     *
     * @default MeshBasicMaterial
     */
    this.material = material;
    /**
     * A dictionary representing the morph targets in the geometry. The key is the
     * morph targets name, the value its attribute index. This member is `undefined`
     * by default and only set when morph targets are detected in the geometry.
     *
     * @default undefined
     */
    this.morphTargetDictionary = undefined;
    /**
     * An array of weights typically in the range `[0,1]` that specify how much of the morph
     * is applied. This member is `undefined` by default and only set when morph targets are
     * detected in the geometry.
     *
     * @default undefined
     */
    this.morphTargetInfluences = undefined;
    this.updateMorphTargets();
  }
  clone(recursive: boolean = true): this {
    return new (this.constructor as any)(this.geometry, this.material).copy(this, recursive);
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    if (source.morphTargetInfluences !== undefined) {
      this.morphTargetInfluences = source.morphTargetInfluences.slice();
    } else {
      this.morphTargetInfluences = undefined;
    }
    if (source.morphTargetDictionary !== undefined) {
      this.morphTargetDictionary = Object.assign({}, source.morphTargetDictionary);
    } else {
      this.morphTargetDictionary = undefined;
    }
    this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
    this.geometry = source.geometry;
    return this;
  }
  /**
   * Sets the values of {@link Mesh#morphTargetDictionary} and {@link Mesh#morphTargetInfluences}
   * to make sure existing morph targets can influence this 3D object.
   */
  updateMorphTargets() {
    const geometry = this.geometry;
    const morphAttributes = geometry.morphAttributes;
    const keys = Object.keys(morphAttributes);
    if (keys.length > 0) {
      const morphAttribute = morphAttributes[keys[0]];
      if (morphAttribute !== undefined) {
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
          const name = morphAttribute[m].name || String(m);
          this.morphTargetInfluences.push(0);
          this.morphTargetDictionary[name] = m;
        }
      }
    }
  }
  /**
   * Returns the local-space position of the vertex at the given index, taking into
   * account the current animation state of both morph targets and skinning.
   *
   * @param index - The vertex index.
   * @param target - The target object that is used to store the method's result.
   * @return The vertex position in local space.
   */
  getVertexPosition(index: number, target: Vector3): Vector3 {
    const geometry = this.geometry;
    const position = geometry.attributes.position as BufferAttribute | InterleavedBufferAttribute;
    const morphPosition = geometry.morphAttributes.position;
    const morphTargetsRelative = geometry.morphTargetsRelative;
    target.fromBufferAttribute(position, index);
    const morphInfluences = this.morphTargetInfluences;
    if (morphPosition && morphInfluences) {
      _morphA.set(0, 0, 0);
      for (let i = 0, il = morphPosition.length; i < il; i++) {
        const influence = morphInfluences[i];
        const morphAttribute = morphPosition[i];
        if (influence === 0) continue;
        _tempA.fromBufferAttribute(morphAttribute, index);
        if (morphTargetsRelative) {
          _morphA.addScaledVector(_tempA, influence);
        } else {
          _morphA.addScaledVector(_tempA.sub(target), influence);
        }
      }
      target.add(_morphA);
    }
    return target;
  }
  /**
   * Returns `true` if this mesh intersects the given frustum.
   *
   * @param frustum - The frustum to test.
   * @return Whether this mesh intersects the given frustum or not.
   */
  intersectsFrustum(frustum: Frustum | FrustumArray): boolean;
  intersectsFrustum(frustum?: any): boolean {
    return frustum.intersectsObject(this);
  }
  /**
   * Computes intersection points between a casted ray and this line.
   *
   * @param raycaster - The raycaster.
   * @param intersects - The target array that holds the intersection points.
   */
  raycast(raycaster: Raycaster, intersects: Intersection[]) {
    const geometry = this.geometry;
    const material = this.material;
    const matrixWorld = this.matrixWorld;
    if (material === undefined) return;
    // test with bounding sphere in world space
    if (geometry.boundingSphere! === null) geometry.computeBoundingSphere();
    _sphere.copy(geometry.boundingSphere!);
    _sphere.applyMatrix4(matrixWorld);
    // check distance from ray origin to bounding sphere
    _ray.copy(raycaster.ray).recast(raycaster.near);
    if (_sphere.containsPoint(_ray.origin) === false) {
      if (_ray.intersectSphere(_sphere, _sphereHitAt) === null) return;
      if (_ray.origin.distanceToSquared(_sphereHitAt) > (raycaster.far - raycaster.near) ** 2) return;
    }
    // convert ray to local space of mesh
    _inverseMatrix.copy(matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    // test with bounding box in local space
    if (geometry.boundingBox !== null) {
      if (_ray.intersectsBox(geometry.boundingBox) === false) return;
    }
    // test for intersections with geometry
    this._computeIntersections(raycaster, intersects, _ray);
  }
  _computeIntersections(raycaster: any, intersects: any, rayLocalSpace?: any) {
    let intersection: any;
    const geometry = this.geometry;
    const material = this.material;
    const index = geometry.index;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const uv1 = geometry.attributes.uv1;
    const normal = geometry.attributes.normal;
    const groups = geometry.groups;
    const drawRange = geometry.drawRange;
    if (index !== null) {
      // indexed buffer geometry
      if (Array.isArray(material)) {
        for (let i = 0, il = groups.length; i < il; i++) {
          const group = groups[i];
          const groupMaterial = material[group.materialIndex];
          const start = Math.max(group.start, drawRange.start);
          const end = Math.min(index.count, Math.min(group.start + group.count, drawRange.start + drawRange.count));
          for (let j = start, jl = end; j < jl; j += 3) {
            const a = index.getX(j);
            const b = index.getX(j + 1);
            const c = index.getX(j + 2);
            intersection = checkGeometryIntersection(
              this,
              groupMaterial,
              raycaster,
              rayLocalSpace,
              uv,
              uv1,
              normal,
              a,
              b,
              c,
            );
            if (intersection) {
              (intersection as any).faceIndex = Math.floor(j / 3); // triangle number in indexed buffer semantics
              (intersection as any).face.materialIndex = group.materialIndex;
              intersects.push(intersection);
            }
          }
        }
      } else {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(index.count, drawRange.start + drawRange.count);
        for (let i = start, il = end; i < il; i += 3) {
          const a = index.getX(i);
          const b = index.getX(i + 1);
          const c = index.getX(i + 2);
          intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
          if (intersection) {
            (intersection as any).faceIndex = Math.floor(i / 3); // triangle number in indexed buffer semantics
            intersects.push(intersection);
          }
        }
      }
    } else if (position !== undefined) {
      // non-indexed buffer geometry
      if (Array.isArray(material)) {
        for (let i = 0, il = groups.length; i < il; i++) {
          const group = groups[i];
          const groupMaterial = material[group.materialIndex];
          const start = Math.max(group.start, drawRange.start);
          const end = Math.min(position.count, Math.min(group.start + group.count, drawRange.start + drawRange.count));
          for (let j = start, jl = end; j < jl; j += 3) {
            const a = j;
            const b = j + 1;
            const c = j + 2;
            intersection = checkGeometryIntersection(
              this,
              groupMaterial,
              raycaster,
              rayLocalSpace,
              uv,
              uv1,
              normal,
              a,
              b,
              c,
            );
            if (intersection) {
              (intersection as any).faceIndex = Math.floor(j / 3); // triangle number in non-indexed buffer semantics
              (intersection as any).face.materialIndex = group.materialIndex;
              intersects.push(intersection);
            }
          }
        }
      } else {
        const start = Math.max(0, drawRange.start);
        const end = Math.min(position.count, drawRange.start + drawRange.count);
        for (let i = start, il = end; i < il; i += 3) {
          const a = i;
          const b = i + 1;
          const c = i + 2;
          intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
          if (intersection) {
            (intersection as any).faceIndex = Math.floor(i / 3); // triangle number in non-indexed buffer semantics
            intersects.push(intersection);
          }
        }
      }
    }
  }
}
function checkIntersection(
  object?: any,
  material?: any,
  raycaster?: any,
  ray?: any,
  pA?: any,
  pB?: any,
  pC?: any,
  point?: any,
) {
  let intersect: any;
  if (material.side === Side.Back) {
    intersect = ray.intersectTriangle(pC, pB, pA, true, point);
  } else {
    intersect = ray.intersectTriangle(pA, pB, pC, material.side === Side.Front, point);
  }
  if (intersect === null) return null;
  _intersectionPointWorld.copy(point);
  _intersectionPointWorld.applyMatrix4(object.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
  if (distance < raycaster.near || distance > raycaster.far) return null;
  return {
    distance: distance,
    point: _intersectionPointWorld.clone(),
    object: object,
  };
}
function checkGeometryIntersection(
  object?: any,
  material?: any,
  raycaster?: any,
  ray?: any,
  uv?: any,
  uv1?: any,
  normal?: any,
  a?: any,
  b?: any,
  c?: any,
) {
  object.getVertexPosition(a, _vA);
  object.getVertexPosition(b, _vB);
  object.getVertexPosition(c, _vC);
  const intersection = checkIntersection(object, material, raycaster, ray, _vA, _vB, _vC, _intersectionPoint);
  if (intersection) {
    const barycoord = new Vector3();
    Triangle.getBarycoord(_intersectionPoint, _vA, _vB, _vC, barycoord);
    if (uv) {
      (intersection as any).uv = Triangle.getInterpolatedAttribute(uv, a, b, c, barycoord, new Vector2());
    }
    if (uv1) {
      (intersection as any).uv1 = Triangle.getInterpolatedAttribute(uv1, a, b, c, barycoord, new Vector2());
    }
    if (normal) {
      (intersection as any).normal = Triangle.getInterpolatedAttribute(normal, a, b, c, barycoord, new Vector3());
      if ((intersection as any).normal.dot(ray.direction) > 0) {
        (intersection as any).normal.multiplyScalar(-1);
      }
    }
    const face: any = {
      a: a,
      b: b,
      c: c,
      normal: new Vector3(),
      materialIndex: 0,
    };
    Triangle.getNormal(_vA, _vB, _vC, face.normal);
    (intersection as any).face = face;
    (intersection as any).barycoord = barycoord;
  }
  return intersection;
}
