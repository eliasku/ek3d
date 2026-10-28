import { CoordinateSystem } from "../constants";
import { Matrix4 } from "../math/Matrix4";
import { Object3D } from "../core/Object3D";
import { Vector3 } from "../math/Vector3";
import { Quaternion } from "../math/Quaternion";
const _position = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
const _scale = /*@__PURE__*/ new Vector3();
/**
 * Abstract base class for cameras. This class should always be inherited
 * when you build a new camera.
 *
 * @abstract
 */
export class Camera extends Object3D {
  isCamera: boolean;

  matrixWorldInverse: Matrix4;
  projectionMatrix: Matrix4;
  projectionMatrixInverse: Matrix4;
  coordinateSystem: CoordinateSystem;
  _reversedDepth: boolean;
  isPerspectiveCamera?: boolean;

  /**
   * Constructs a new camera.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isCamera = true;
    this.type = "Camera";
    /**
     * The inverse of the camera's world matrix.
     *
     */
    this.matrixWorldInverse = new Matrix4();
    /**
     * The camera's projection matrix.
     *
     */
    this.projectionMatrix = new Matrix4();
    /**
     * The inverse of the camera's projection matrix.
     *
     */
    this.projectionMatrixInverse = new Matrix4();
    /**
     * The coordinate system in which the camera is used.
     *
     */
    this.coordinateSystem = CoordinateSystem.WebGL;
    this._reversedDepth = false;
  }
  /**
   * The flag that indicates whether the camera uses a reversed depth buffer.
   *
   * @default false
   */
  get reversedDepth() {
    return this._reversedDepth;
  }
  copy(source: any, recursive?: any): this {
    super.copy(source, recursive);
    this.matrixWorldInverse.copy(source.matrixWorldInverse);
    this.projectionMatrix.copy(source.projectionMatrix);
    this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
    this.coordinateSystem = source.coordinateSystem;
    return this;
  }
  /**
   * Returns a vector representing the ("look") direction of the 3D object in world space.
   *
   * This method is overwritten since cameras have a different forward vector compared to other
   * 3D objects. A camera looks down its local, negative z-axis by default.
   *
   * @param target - The target vector the result is stored to.
   * @return The 3D object's direction in world space.
   */
  getWorldDirection(target: Vector3): Vector3 {
    return super.getWorldDirection(target).negate();
  }
  updateMatrixWorld(force?: any) {
    super.updateMatrixWorld(force);
    // exclude scale from view matrix to be glTF conform
    this.matrixWorld.decompose(_position, _quaternion, _scale);
    if (_scale.x === 1 && _scale.y === 1 && _scale.z === 1) {
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    } else {
      this.matrixWorldInverse.compose(_position, _quaternion, _scale.set(1, 1, 1)).invert();
    }
  }
  updateWorldMatrix(updateParents: any, updateChildren?: any, force: boolean = false) {
    super.updateWorldMatrix(updateParents, updateChildren, force);
    // exclude scale from view matrix to be glTF conform
    this.matrixWorld.decompose(_position, _quaternion, _scale);
    if (_scale.x === 1 && _scale.y === 1 && _scale.z === 1) {
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    } else {
      this.matrixWorldInverse.compose(_position, _quaternion, _scale.set(1, 1, 1)).invert();
    }
  }
  clone(_recursive?: boolean): this {
    return new (this.constructor as any)().copy(this);
  }
}
