import type { ArrayCamera } from "../cameras/ArrayCamera";
import type { Box3 } from "./Box3";
import type { Object3D } from "../core/Object3D";
import type { Sphere } from "./Sphere";
import type { Sprite } from "../objects/Sprite";
import type { Vector3 } from "./Vector3";
import { WebGLCoordinateSystem } from "../constants";
import { Frustum } from "./Frustum";
import { Matrix4 } from "./Matrix4";
const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
/**
 * FrustumArray is used to determine if an object is visible in at least one camera
 * from an array of cameras. This is particularly useful for multi-view renderers.
 */
export class FrustumArray {
  coordinateSystem: number;
  _frustums: Frustum[];
  _count: number;

  /**
   * Constructs a new frustum array.
   *
   */
  constructor() {
    /**
     * The coordinate system to use.
     *
     * @default WebGLCoordinateSystem
     */
    this.coordinateSystem = WebGLCoordinateSystem;
    /**
     * A pool of frustum instances. It may hold more entries than are
     * currently in use; surplus instances are kept for reuse to avoid
     * reallocating when array cameras of different lengths are rendered.
     *
     * @private
     */
    this._frustums = [];
    /**
     * The number of frustums in {@link FrustumArray#_frustums} that are currently
     * in use.
     *
     * @private
     * @default 0
     */
    this._count = 0;
  }
  /**
   * Computes and caches a frustum for each camera of the given array camera.
   *
   * @param cameraArray - The array camera whose sub-cameras define the frustums.
   * @return A reference to this frustum array.
   */
  setFromArrayCamera(cameraArray: ArrayCamera): FrustumArray {
    const cameras = cameraArray.cameras;
    const frustums = this._frustums;
    for (let i = 0; i < cameras.length; i++) {
      const camera = cameras[i];
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (frustums[i] === undefined) frustums[i] = new Frustum();
      frustums[i].setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);
    }
    this._count = cameras.length;
    return this;
  }
  /**
   * Returns the cached frustum for the sub-camera at the given index.
   *
   * @param index - The sub-camera index.
   * @return The cached frustum.
   */
  getFrustum(index: number): Frustum | undefined {
    return this._frustums[index];
  }
  /**
   * Returns `true` if the 3D object's bounding sphere is intersecting any cached frustum.
   *
   * {@link FrustumArray#setFromArrayCamera} must be called once per render before this method.
   *
   * @param object - The 3D object to test.
   * @return Whether the 3D object is visible in any camera.
   */
  intersectsObject(object: Object3D): boolean {
    const frustums = this._frustums;
    for (let i = 0; i < this._count; i++) {
      if (frustums[i].intersectsObject(object)) return true;
    }
    return false;
  }
  /**
   * Returns `true` if the given sprite is intersecting any cached frustum.
   *
   * {@link FrustumArray#setFromArrayCamera} must be called once per render before this method.
   *
   * @param sprite - The sprite to test.
   * @return Whether the sprite is visible in any camera.
   */
  intersectsSprite(sprite: Sprite): boolean {
    const frustums = this._frustums;
    for (let i = 0; i < this._count; i++) {
      if (frustums[i].intersectsSprite(sprite)) return true;
    }
    return false;
  }
  /**
   * Returns `true` if the given bounding sphere is intersecting any cached frustum.
   *
   * {@link FrustumArray#setFromArrayCamera} must be called once per render before this method.
   *
   * @param sphere - The bounding sphere to test.
   * @return Whether the sphere is visible in any camera.
   */
  intersectsSphere(sphere: Sphere): boolean {
    const frustums = this._frustums;
    for (let i = 0; i < this._count; i++) {
      if (frustums[i].intersectsSphere(sphere)) return true;
    }
    return false;
  }
  /**
   * Returns `true` if the given bounding box is intersecting any cached frustum.
   *
   * {@link FrustumArray#setFromArrayCamera} must be called once per render before this method.
   *
   * @param box - The bounding box to test.
   * @return Whether the box is visible in any camera.
   */
  intersectsBox(box: Box3): boolean {
    const frustums = this._frustums;
    for (let i = 0; i < this._count; i++) {
      if (frustums[i].intersectsBox(box)) return true;
    }
    return false;
  }
  /**
   * Returns `true` if the given point lies within any cached frustum.
   *
   * {@link FrustumArray#setFromArrayCamera} must be called once per render before this method.
   *
   * @param point - The point to test.
   * @return Whether the point is visible in any camera.
   */
  containsPoint(point: Vector3): boolean {
    const frustums = this._frustums;
    for (let i = 0; i < this._count; i++) {
      if (frustums[i].containsPoint(point)) return true;
    }
    return false;
  }
  /**
   * Copies the values of the given frustum array to this instance.
   *
   * @param source - The frustum array to copy.
   * @return A reference to this frustum array.
   */
  copy(source: FrustumArray): FrustumArray {
    this.coordinateSystem = source.coordinateSystem;
    const frustums = this._frustums;
    const sourceFrustums = source._frustums;
    for (let i = 0; i < source._count; i++) {
      if (frustums[i] === undefined) frustums[i] = new Frustum();
      frustums[i].copy(sourceFrustums[i]);
    }
    this._count = source._count;
    return this;
  }
  /**
   * Returns a new frustum array with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): FrustumArray {
    return new FrustumArray().copy(this);
  }
}
