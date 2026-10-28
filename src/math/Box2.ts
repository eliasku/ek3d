import { Vector2 } from "./Vector2";
const _vector = /*@__PURE__*/ new Vector2();
/**
 * Represents an axis-aligned bounding box (AABB) in 2D space.
 */
export class Box2 {
  isBox2: boolean;
  min: Vector2;
  max: Vector2;

  /**
   * Constructs a new bounding box.
   *
   * @param [min=(Infinity,Infinity)] - A vector representing the lower boundary of the box.
   * @param [max=(-Infinity,-Infinity)] - A vector representing the upper boundary of the box.
   */
  constructor(min: Vector2 = new Vector2(+Infinity, +Infinity), max: Vector2 = new Vector2(-Infinity, -Infinity)) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isBox2 = true;
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
  set(min: Vector2, max: Vector2): Box2 {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }
  /**
   * Sets the upper and lower bounds of this box so it encloses the position data
   * in the given array.
   *
   * @param points - An array holding 2D position data as instances of {@link Vector2}.
   * @return A reference to this bounding box.
   */
  setFromPoints(points: Vector2[]): Box2 {
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
   * @param size - The x and y dimensions of the box.
   * @return A reference to this bounding box.
   */
  setFromCenterAndSize(center: Vector2, size: Vector2): Box2 {
    const halfSize = _vector.copy(size).multiplyScalar(0.5);
    this.min.copy(center).sub(halfSize);
    this.max.copy(center).add(halfSize);
    return this;
  }
  /**
   * Returns a new box with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Box2 {
    return new (this.constructor as any)().copy(this);
  }
  /**
   * Copies the values of the given box to this instance.
   *
   * @param box - The box to copy.
   * @return A reference to this bounding box.
   */
  copy(box: Box2): Box2 {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
  /**
   * Makes this box empty which means in encloses a zero space in 2D.
   *
   * @return A reference to this bounding box.
   */
  makeEmpty(): Box2 {
    this.min.x = this.min.y = +Infinity;
    this.max.x = this.max.y = -Infinity;
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
    return this.max.x < this.min.x || this.max.y < this.min.y;
  }
  /**
   * Returns the center point of this box.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The center point.
   */
  getCenter(target: Vector2): Vector2 {
    return this.isEmpty() ? target.set(0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  /**
   * Returns the dimensions of this box.
   *
   * @param target - The target vector that is used to store the method's result.
   * @return The size.
   */
  getSize(target: Vector2): Vector2 {
    return this.isEmpty() ? target.set(0, 0) : target.subVectors(this.max, this.min);
  }
  /**
   * Expands the boundaries of this box to include the given point.
   *
   * @param point - The point that should be included by the bounding box.
   * @return A reference to this bounding box.
   */
  expandByPoint(point: Vector2): Box2 {
    this.min.min(point);
    this.max.max(point);
    return this;
  }
  /**
   * Expands this box equilaterally by the given vector. The width of this
   * box will be expanded by the x component of the vector in both
   * directions. The height of this box will be expanded by the y component of
   * the vector in both directions.
   *
   * @param vector - The vector that should expand the bounding box.
   * @return A reference to this bounding box.
   */
  expandByVector(vector: Vector2): Box2 {
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
  expandByScalar(scalar: number): Box2 {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }
  /**
   * Returns `true` if the given point lies within or on the boundaries of this box.
   *
   * @param point - The point to test.
   * @return Whether the bounding box contains the given point or not.
   */
  containsPoint(point: Vector2): boolean {
    return point.x >= this.min.x && point.x <= this.max.x && point.y >= this.min.y && point.y <= this.max.y;
  }
  /**
   * Returns `true` if this bounding box includes the entirety of the given bounding box.
   * If this box and the given one are identical, this function also returns `true`.
   *
   * @param box - The bounding box to test.
   * @return Whether the bounding box contains the given bounding box or not.
   */
  containsBox(box: Box2): boolean {
    return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y;
  }
  /**
   * Returns a point as a proportion of this box's width and height.
   *
   * @param point - A point in 2D space.
   * @param target - The target vector that is used to store the method's result.
   * @return A point as a proportion of this box's width and height.
   */
  getParameter(point: Vector2, target: Vector2): Vector2 {
    // This can potentially have a divide by zero if the box
    // has a size dimension of 0.
    return target.set(
      (point.x - this.min.x) / (this.max.x - this.min.x),
      (point.y - this.min.y) / (this.max.y - this.min.y),
    );
  }
  /**
   * Returns `true` if the given bounding box intersects with this bounding box.
   *
   * @param box - The bounding box to test.
   * @return Whether the given bounding box intersects with this bounding box.
   */
  intersectsBox(box: Box2): boolean {
    // using 4 splitting planes to rule out intersections
    return box.max.x >= this.min.x && box.min.x <= this.max.x && box.max.y >= this.min.y && box.min.y <= this.max.y;
  }
  /**
   * Clamps the given point within the bounds of this box.
   *
   * @param point - The point to clamp.
   * @param target - The target vector that is used to store the method's result.
   * @return The clamped point.
   */
  clampPoint(point: Vector2, target: Vector2): Vector2 {
    return target.copy(point).clamp(this.min, this.max);
  }
  /**
   * Returns the euclidean distance from any edge of this box to the specified point. If
   * the given point lies inside of this box, the distance will be `0`.
   *
   * @param point - The point to compute the distance to.
   * @return The euclidean distance.
   */
  distanceToPoint(point: Vector2): number {
    return this.clampPoint(point, _vector).distanceTo(point);
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
  intersect(box: Box2): Box2 {
    this.min.max(box.min);
    this.max.min(box.max);
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
  union(box: Box2): Box2 {
    this.min.min(box.min);
    this.max.max(box.max);
    return this;
  }
  /**
   * Adds the given offset to both the upper and lower bounds of this bounding box,
   * effectively moving it in 2D space.
   *
   * @param offset - The offset that should be used to translate the bounding box.
   * @return A reference to this bounding box.
   */
  translate(offset: Vector2): Box2 {
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
  equals(box: Box2): boolean {
    return box.min.equals(this.min) && box.max.equals(this.max);
  }
}
