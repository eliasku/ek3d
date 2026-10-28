import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Matrix4 } from "./Matrix4";
import type { Object3D } from "../core/Object3D";
import type { Plane } from "./Plane";
import type { Sphere } from "./Sphere";
import type { Triangle } from "./Triangle";
import { Vector3 } from "./Vector3";
/**
 * Represents an axis-aligned bounding box (AABB) in 3D space.
 */
export class Box3 {
  isBox3: boolean;
  min: Vector3;
  max: Vector3;

  /**
   * Constructs a new bounding box.
   *
   * @param [min=(Infinity,Infinity,Infinity)] - A vector representing the lower boundary of the box.
   * @param [max=(-Infinity,-Infinity,-Infinity)] - A vector representing the upper boundary of the box.
   */
  constructor(
    min: Vector3 = new Vector3(+Infinity, +Infinity, +Infinity),
    max: Vector3 = new Vector3(-Infinity, -Infinity, -Infinity),
  ) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isBox3 = true;
    /**
     * The lower boundary of the box.
     *
     */
    this.min = min;
    /**
     * The upper boundary of the box.
     *
     */
    this.max = max;
  }
  /**
   * Sets the lower and upper boundaries of this box.
   * Please note that this method only copies the values from the given objects.
   *
   * @param min - The lower boundary of the box.
   * @param max - The upper boundary of the box.
   * @return A reference to this bounding box.
   */
  set(min: Vector3, max: Vector3): Box3 {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }
  /**
   * Sets the upper and lower bounds of this box so it encloses the position data
   * in the given array.
   *
   * @param array - An array holding 3D position data.
   * @return A reference to this bounding box.
   */
  setFromArray(array: number[]): Box3 {
    this.makeEmpty();
    for (let i = 0, il = array.length; i < il; i += 3) {
      this.expandByPoint(_vector.fromArray(array, i));
    }
    return this;
  }
  /**
   * Sets the upper and lower bounds of this box so it encloses the position data
   * in the given buffer attribute.
   *
   * @param attribute - A buffer attribute holding 3D position data.
   * @return A reference to this bounding box.
   */
  setFromBufferAttribute(attribute: BufferAttribute | InterleavedBufferAttribute): Box3;
  setFromBufferAttribute(attribute?: any): Box3 {
    this.makeEmpty();
    for (let i = 0, il = attribute.count; i < il; i++) {
      this.expandByPoint(_vector.fromBufferAttribute(attribute, i));
    }
    return this;
  }
  /**
   * Sets the upper and lower bounds of this box so it encloses the position data
   * in the given array.
   *
   * @param points - An array holding 3D position data as instances of {@link Vector3}.
   * @return A reference to this bounding box.
   */
  setFromPoints(points: Vector3[]): Box3 {
    this.makeEmpty();
    for (let i = 0, il = points.length; i < il; i++) {
      this.expandByPoint(points[i]);
    }
    return this;
  }
  /**
   * Centers this box on the given center vector and sets this box's width, height and
   * depth to the given size values.
   *
   * @param center - The center of the box.
   * @param size - The x, y and z dimensions of the box.
   * @return A reference to this bounding box.
   */
  setFromCenterAndSize(center: Vector3, size: Vector3): Box3 {
    const halfSize = _vector.copy(size).multiplyScalar(0.5);
    this.min.copy(center).sub(halfSize);
    this.max.copy(center).add(halfSize);
    return this;
  }
  /**
   * Computes the world-axis-aligned bounding box for the given 3D object
   * (including its children), accounting for the object's, and children's,
   * world transforms. The function may result in a larger box than strictly necessary.
   *
   * Note: To compute the correct bounding box, make sure the given 3D object
   * has an up-to-date world matrix that reflects the current transformation of its
   * ancestor nodes. Call `object.updateWorldMatrix( true, false )` beforehand if
   * you're unsure.
   *
   * @param object - The 3D object to compute the bounding box for.
   * @param [precise=false] - If set to `true`, the method computes the smallest
   * world-axis-aligned bounding box at the expense of more computation.
   * @return A reference to this bounding box.
   */
  setFromObject(object: Object3D, precise: boolean = false): Box3 {
    this.makeEmpty();
    return this.expandByObject(object, precise);
  }
  /**
   * Returns a new box with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Box3 {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the values of the given box to this instance.
   *
   * @param box - The box to copy.
   * @return A reference to this bounding box.
   */
  copy(box: Box3): Box3 {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
  /**
   * Makes this box empty which means in encloses a zero space in 3D.
   *
   * @return A reference to this bounding box.
   */
  makeEmpty(): Box3 {
    this.min.x = this.min.y = this.min.z = +Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  }
  /**
   * Returns true if this box includes zero points within its bounds.
   * Note that a box with equal lower and upper bounds still includes one
   * point, the one both bounds share.
   *
   * @return Whether this box is empty or not.
   */
  isEmpty(): boolean {
    // this is a more robust check for empty than ( volume <= 0 ) because volume can get positive with two negative axes
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }
  /**
   * Returns the center point of this box.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The center point.
   */
  getCenter(target: Vector3): Vector3 {
    return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  /**
   * Returns the dimensions of this box.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The size.
   */
  getSize(target: Vector3): Vector3 {
    return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min);
  }
  /**
   * Expands the boundaries of this box to include the given point.
   *
   * @param point - The point that should be included by the bounding box.
   * @return A reference to this bounding box.
   */
  expandByPoint(point: Vector3): Box3 {
    this.min.min(point);
    this.max.max(point);
    return this;
  }
  /**
   * Expands this box equilaterally by the given vector. The width of this
   * box will be expanded by the x component of the vector in both
   * directions. The height of this box will be expanded by the y component of
   * the vector in both directions. The depth of this box will be
   * expanded by the z component of the vector in both directions.
   *
   * @param vector - The vector that should expand the bounding box.
   * @return A reference to this bounding box.
   */
  expandByVector(vector: Vector3): Box3 {
    this.min.sub(vector);
    this.max.add(vector);
    return this;
  }
  /**
   * Expands each dimension of the box by the given scalar. If negative, the
   * dimensions of the box will be contracted.
   *
   * @param scalar - The scalar value that should expand the bounding box.
   * @return A reference to this bounding box.
   */
  expandByScalar(scalar: number): Box3 {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }
  /**
   * Expands the boundaries of this box to include the given 3D object and
   * its children, accounting for the object's, and children's, world
   * transforms. The function may result in a larger box than strictly
   * necessary (unless the precise parameter is set to true).
   *
   * @param object - The 3D object that should expand the bounding box.
   * @param precise - If set to `true`, the method expands the bounding box
   * as little as necessary at the expense of more computation.
   * @return A reference to this bounding box.
   */
  expandByObject(object: Object3D, precise: boolean = false): Box3 {
    // Computes the world-axis-aligned bounding box of an object (including its children),
    // accounting for both the object's, and children's, world transforms
    object.updateWorldMatrix(false, false);
    const geometry = (object as any).geometry;
    if (geometry !== undefined) {
      const positionAttribute = geometry.getAttribute("position");
      // precise AABB computation based on vertex data requires at least a position attribute.
      // instancing and batching aren't supported so far and use the normal (conservative) code path.
      if (
        precise === true &&
        positionAttribute !== undefined &&
        (object as any).isInstancedMesh !== true &&
        (object as any).isBatchedMesh !== true
      ) {
        for (let i = 0, l = positionAttribute.count; i < l; i++) {
          if ((object as any).isMesh === true) {
            (object as any).getVertexPosition(i, _vector);
          } else {
            _vector.fromBufferAttribute(positionAttribute, i);
          }
          _vector.applyMatrix4(object.matrixWorld);
          this.expandByPoint(_vector);
        }
      } else {
        if ((object as any).boundingBox !== undefined) {
          // object-level bounding box
          if ((object as any).boundingBox === null) {
            (object as any).computeBoundingBox();
          }
          _box.copy((object as any).boundingBox);
        } else {
          // geometry-level bounding box
          if (geometry.boundingBox === null) {
            geometry.computeBoundingBox();
          }
          _box.copy(geometry.boundingBox);
        }
        _box.applyMatrix4(object.matrixWorld);
        this.union(_box);
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      this.expandByObject(children[i], precise);
    }
    return this;
  }
  /**
   * Returns `true` if the given point lies within or on the boundaries of this box.
   *
   * @param point - The point to test.
   * @return Whether the bounding box contains the given point or not.
   */
  containsPoint(point: Vector3): boolean {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y &&
      point.z >= this.min.z &&
      point.z <= this.max.z
    );
  }
  /**
   * Returns `true` if this bounding box includes the entirety of the given bounding box.
   * If this box and the given one are identical, this function also returns `true`.
   *
   * @param box - The bounding box to test.
   * @return Whether the bounding box contains the given bounding box or not.
   */
  containsBox(box: Box3): boolean {
    return (
      this.min.x <= box.min.x &&
      box.max.x <= this.max.x &&
      this.min.y <= box.min.y &&
      box.max.y <= this.max.y &&
      this.min.z <= box.min.z &&
      box.max.z <= this.max.z
    );
  }
  /**
   * Returns a point as a proportion of this box's width, height and depth.
   *
   * @param point - A point in 3D space.
   * @param target - The target vector that is used to store the method's result.
   * @return A point as a proportion of this box's width, height and depth.
   */
  getParameter(point: Vector3, target: Vector3): Vector3 {
    // This can potentially have a divide by zero if the box
    // has a size dimension of 0.
    return target.set(
      (point.x - this.min.x) / (this.max.x - this.min.x),
      (point.y - this.min.y) / (this.max.y - this.min.y),
      (point.z - this.min.z) / (this.max.z - this.min.z),
    );
  }
  /**
   * Returns `true` if the given bounding box intersects with this bounding box.
   *
   * @param box - The bounding box to test.
   * @return Whether the given bounding box intersects with this bounding box.
   */
  intersectsBox(box: Box3): boolean {
    // using 6 splitting planes to rule out intersections.
    return (
      box.max.x >= this.min.x &&
      box.min.x <= this.max.x &&
      box.max.y >= this.min.y &&
      box.min.y <= this.max.y &&
      box.max.z >= this.min.z &&
      box.min.z <= this.max.z
    );
  }
  /**
   * Returns `true` if the given bounding sphere intersects with this bounding box.
   *
   * @param sphere - The bounding sphere to test.
   * @return Whether the given bounding sphere intersects with this bounding box.
   */
  intersectsSphere(sphere: Sphere): boolean {
    // Find the point on the AABB closest to the sphere center.
    this.clampPoint(sphere.center, _vector);
    // If that point is inside the sphere, the AABB and sphere intersect.
    return _vector.distanceToSquared(sphere.center) <= sphere.radius * sphere.radius;
  }
  /**
   * Returns `true` if the given plane intersects with this bounding box.
   *
   * @param plane - The plane to test.
   * @return Whether the given plane intersects with this bounding box.
   */
  intersectsPlane(plane: Plane): boolean {
    // We compute the minimum and maximum dot product values. If those values
    // are on the same side (back or front) of the plane, then there is no intersection.
    let min: any, max: any;
    if (plane.normal.x > 0) {
      min = plane.normal.x * this.min.x;
      max = plane.normal.x * this.max.x;
    } else {
      min = plane.normal.x * this.max.x;
      max = plane.normal.x * this.min.x;
    }
    if (plane.normal.y > 0) {
      min += plane.normal.y * this.min.y;
      max += plane.normal.y * this.max.y;
    } else {
      min += plane.normal.y * this.max.y;
      max += plane.normal.y * this.min.y;
    }
    if (plane.normal.z > 0) {
      min += plane.normal.z * this.min.z;
      max += plane.normal.z * this.max.z;
    } else {
      min += plane.normal.z * this.max.z;
      max += plane.normal.z * this.min.z;
    }
    return min <= -plane.constant && max >= -plane.constant;
  }
  /**
   * Returns `true` if the given triangle intersects with this bounding box.
   *
   * @param triangle - The triangle to test.
   * @return Whether the given triangle intersects with this bounding box.
   */
  intersectsTriangle(triangle: Triangle): boolean {
    if (this.isEmpty()) {
      return false;
    }
    // compute box center and extents
    this.getCenter(_center);
    _extents.subVectors(this.max, _center);
    // translate triangle to aabb origin
    _v0.subVectors(triangle.a, _center);
    _v1.subVectors(triangle.b, _center);
    _v2.subVectors(triangle.c, _center);
    // compute edge vectors for triangle
    _f0.subVectors(_v1, _v0);
    _f1.subVectors(_v2, _v1);
    _f2.subVectors(_v0, _v2);
    // test against axes that are given by cross product combinations of the edges of the triangle and the edges of the aabb
    // make an axis testing of each of the 3 sides of the aabb against each of the 3 sides of the triangle = 9 axis of separation
    // axis_ij = u_i x f_j (u0, u1, u2 = face normals of aabb = x,y,z axes vectors since aabb is axis aligned)
    let axes = [
      0,
      -_f0.z,
      _f0.y,
      0,
      -_f1.z,
      _f1.y,
      0,
      -_f2.z,
      _f2.y,
      _f0.z,
      0,
      -_f0.x,
      _f1.z,
      0,
      -_f1.x,
      _f2.z,
      0,
      -_f2.x,
      -_f0.y,
      _f0.x,
      0,
      -_f1.y,
      _f1.x,
      0,
      -_f2.y,
      _f2.x,
      0,
    ];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) {
      return false;
    }
    // test 3 face normals from the aabb
    axes = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) {
      return false;
    }
    // finally testing the face normal of the triangle
    // use already existing triangle edge vectors here
    _triangleNormal.crossVectors(_f0, _f1);
    axes = [_triangleNormal.x, _triangleNormal.y, _triangleNormal.z];
    return satForAxes(axes, _v0, _v1, _v2, _extents);
  }
  /**
   * Clamps the given point within the bounds of this box.
   *
   * @param point - The point to clamp.
   * @param target - The target vector that is used to store the method's result.
   * @return The clamped point.
   */
  clampPoint(point: Vector3, target: Vector3): Vector3 {
    return target.copy(point).clamp(this.min, this.max);
  }
  /**
   * Returns the euclidean distance from any edge of this box to the specified point. If
   * the given point lies inside of this box, the distance will be `0`.
   *
   * @param point - The point to compute the distance to.
   * @return The euclidean distance.
   */
  distanceToPoint(point: Vector3): number {
    return this.clampPoint(point, _vector).distanceTo(point);
  }
  /**
   * Returns a bounding sphere that encloses this bounding box.
   *
   * @param target - The target sphere that is used to store the method's result.
   * @return The bounding sphere that encloses this bounding box.
   */
  getBoundingSphere(target: Sphere): Sphere {
    if (this.isEmpty()) {
      target.makeEmpty();
    } else {
      this.getCenter(target.center);
      target.radius = this.getSize(_vector).length() * 0.5;
    }
    return target;
  }
  /**
   * Computes the intersection of this bounding box and the given one, setting the upper
   * bound of this box to the lesser of the two boxes' upper bounds and the
   * lower bound of this box to the greater of the two boxes' lower bounds. If
   * there's no overlap, makes this box empty.
   *
   * @param box - The bounding box to intersect with.
   * @return A reference to this bounding box.
   */
  intersect(box: Box3): Box3 {
    this.min.max(box.min);
    this.max.min(box.max);
    // ensure that if there is no overlap, the result is fully empty, not slightly empty with non-inf/+inf values that will cause subsequence intersects to erroneously return valid values.
    if (this.isEmpty()) this.makeEmpty();
    return this;
  }
  /**
   * Computes the union of this box and another and the given one, setting the upper
   * bound of this box to the greater of the two boxes' upper bounds and the
   * lower bound of this box to the lesser of the two boxes' lower bounds.
   *
   * @param box - The bounding box that will be unioned with this instance.
   * @return A reference to this bounding box.
   */
  union(box: Box3): Box3 {
    this.min.min(box.min);
    this.max.max(box.max);
    return this;
  }
  /**
   * Transforms this bounding box by the given 4x4 transformation matrix.
   *
   * @param matrix - The transformation matrix.
   * @return A reference to this bounding box.
   */
  applyMatrix4(matrix: Matrix4): Box3 {
    // transform of empty box is an empty box.
    if (this.isEmpty()) return this;
    // NOTE: I am using a binary pattern to specify all 2^3 combinations below
    _points[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(matrix); // 000
    _points[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(matrix); // 001
    _points[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(matrix); // 010
    _points[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(matrix); // 011
    _points[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(matrix); // 100
    _points[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(matrix); // 101
    _points[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(matrix); // 110
    _points[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(matrix); // 111
    this.setFromPoints(_points);
    return this;
  }
  /**
   * Adds the given offset to both the upper and lower bounds of this bounding box,
   * effectively moving it in 3D space.
   *
   * @param offset - The offset that should be used to translate the bounding box.
   * @return A reference to this bounding box.
   */
  translate(offset: Vector3): Box3 {
    this.min.add(offset);
    this.max.add(offset);
    return this;
  }
  /**
   * Returns `true` if this bounding box is equal with the given one.
   *
   * @param box - The box to test for equality.
   * @return Whether this bounding box is equal with the given one.
   */
  equals(box: Box3): boolean {
    return box.min.equals(this.min) && box.max.equals(this.max);
  }
  /**
   * Returns a serialized structure of the bounding box.
   *
   * @return Serialized structure with fields representing the object state.
   */
  toJSON() {
    return {
      min: this.min.toArray(),
      max: this.max.toArray(),
    };
  }
  /**
   * Returns a serialized structure of the bounding box.
   *
   * @param json - The serialized json to set the box from.
   * @return A reference to this bounding box.
   */
  fromJSON(json?: any): Box3 {
    this.min.fromArray(json.min);
    this.max.fromArray(json.max);
    return this;
  }
}
const _points = [
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
  /*@__PURE__*/ new Vector3(),
];
const _vector = /*@__PURE__*/ new Vector3();
const _box = /*@__PURE__*/ new Box3();
// triangle centered vertices
const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();
// triangle edge vectors
const _f0 = /*@__PURE__*/ new Vector3();
const _f1 = /*@__PURE__*/ new Vector3();
const _f2 = /*@__PURE__*/ new Vector3();
const _center = /*@__PURE__*/ new Vector3();
const _extents = /*@__PURE__*/ new Vector3();
const _triangleNormal = /*@__PURE__*/ new Vector3();
const _testAxis = /*@__PURE__*/ new Vector3();
function satForAxes(axes?: any, v0?: any, v1?: any, v2?: any, extents?: any) {
  for (let i = 0, j = axes.length - 3; i <= j; i += 3) {
    _testAxis.fromArray(axes, i);
    // project the aabb onto the separating axis
    const r = extents.x * Math.abs(_testAxis.x) + extents.y * Math.abs(_testAxis.y) + extents.z * Math.abs(_testAxis.z);
    // project all 3 vertices of the triangle onto the separating axis
    const p0 = v0.dot(_testAxis);
    const p1 = v1.dot(_testAxis);
    const p2 = v2.dot(_testAxis);
    // actual test, basically see if either of the most extreme of the triangle points intersects r
    if (Math.max(-Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) {
      // points of the projected triangle are outside the projected half-length of the aabb
      // the axis is separating and we can exit
      return false;
    }
  }
  return true;
}
