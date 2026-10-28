import type { AnimationClip } from "../animation/AnimationClip";
import type { BufferGeometry } from "./BufferGeometry";
import type { Camera } from "../cameras/Camera";
import type { Intersection } from "./Raycaster";
import type { Material } from "../materials/Material";
import type { Raycaster } from "./Raycaster";
import type { WebGLRenderer } from "../renderers/WebGLRenderer";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { Matrix4 } from "../math/Matrix4";
import { EventDispatcher } from "./EventDispatcher";
import { Euler } from "../math/Euler";
import { Layers } from "./Layers";
import { Matrix3 } from "../math/Matrix3";
import { generateUUID } from "../math/MathUtils";
import { error } from "../utils";
let _object3DId = 0;
const _v1 = /*@__PURE__*/ new Vector3();
const _q1 = /*@__PURE__*/ new Quaternion();
const _m1 = /*@__PURE__*/ new Matrix4();
const _target = /*@__PURE__*/ new Vector3();
const _position = /*@__PURE__*/ new Vector3();
const _scale = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0);
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0);
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1);
/**
 * Fires when the object has been added to its parent object.
 *
 * @event Object3D#added
 */
const _addedEvent = { type: "added" };
/**
 * Fires when the object has been removed from its parent object.
 *
 * @event Object3D#removed
 */
const _removedEvent = { type: "removed" };
/**
 * Fires when a new child object has been added.
 *
 * @event Object3D#childadded
 */
const _childaddedEvent: any = { type: "childadded", child: null };
/**
 * Fires when a child object has been removed.
 *
 * @event Object3D#childremoved
 */
const _childremovedEvent: any = { type: "childremoved", child: null };
/**
 * This is the base class for most objects in three.js and provides a set of
 * properties and methods for manipulating objects in 3D space.
 *
 */
export class Object3D<TChild extends Object3D<any> = Object3D<any>> extends EventDispatcher {
  isObject3D: boolean;
  uuid: string;
  name: string;
  type: string;
  parent: Object3D | null;
  children: TChild[];
  up: Vector3;
  matrix: Matrix4;
  matrixWorld: Matrix4;
  matrixAutoUpdate: boolean;
  matrixWorldAutoUpdate: boolean;
  matrixWorldNeedsUpdate: boolean;
  layers: Layers;
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  frustumCulled: boolean;
  renderOrder: number;
  animations: AnimationClip[];
  customDepthMaterial: Material | undefined;
  customDistanceMaterial: Material | undefined;
  userData: any;
  pivot: Vector3 | null;
  id!: number;
  position!: Vector3;
  rotation!: Euler;
  quaternion!: Quaternion;
  scale!: Vector3;
  modelViewMatrix!: Matrix4;
  normalMatrix!: Matrix3;
  static DEFAULT_UP: Vector3;
  static DEFAULT_MATRIX_AUTO_UPDATE: boolean;
  static DEFAULT_MATRIX_WORLD_AUTO_UPDATE: boolean;

  /**
   * Constructs a new 3D object.
   */
  constructor() {
    super();
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isObject3D = true;
    /**
     * The ID of the 3D object.
     *
     * @name Object3D#id
     * @readonly
     */
    Object.defineProperty(this, "id", {
      enumerable: false,
      configurable: false,
      writable: false,
      value: _object3DId++,
    });
    /**
     * The UUID of the 3D object.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    /**
     * The name of the 3D object.
     *
     */
    this.name = "";
    /**
     * The type property is used for detecting the object type
     * in context of serialization/deserialization.
     *
     * @readonly
     */
    this.type = "Object3D";
    /**
     * A reference to the parent object.
     *
     * @default null
     */
    this.parent = null;
    /**
     * An array holding the child 3D objects of this instance.
     *
     */
    this.children = [];
    /**
     * Defines the `up` direction of the 3D object which influences
     * the orientation via methods like {@link Object3D#lookAt}.
     *
     * The default values for all 3D objects is defined by `Object3D.DEFAULT_UP`.
     *
     */
    this.up = Object3D.DEFAULT_UP.clone();
    const position = new Vector3();
    const rotation = new Euler();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    function onRotationChange() {
      quaternion.setFromEuler(rotation, false);
    }
    function onQuaternionChange() {
      rotation.setFromQuaternion(quaternion, undefined, false);
    }
    rotation._onChange(onRotationChange);
    quaternion._onChange(onQuaternionChange);
    Object.defineProperties(this, {
      /**
       * Represents the object's local position.
       *
       * @name Object3D#position
       * @default (0,0,0)
       */
      position: { writable: false, configurable: true, enumerable: true, value: position },
      /**
       * Represents the object's local rotation as Euler angles, in radians.
       *
       * @name Object3D#rotation
       * @default (0,0,0)
       */
      rotation: { writable: false, configurable: true, enumerable: true, value: rotation },
      /**
       * Represents the object's local rotation as Quaternions.
       *
       * @name Object3D#quaternion
       */
      quaternion: { writable: false, configurable: true, enumerable: true, value: quaternion },
      /**
       * Represents the object's local scale.
       *
       * @name Object3D#scale
       * @default (1,1,1)
       */
      scale: { writable: false, configurable: true, enumerable: true, value: scale },
      /**
       * Represents the object's model-view matrix.
       *
       * @name Object3D#modelViewMatrix
       */
      modelViewMatrix: { enumerable: false, configurable: false, writable: false, value: new Matrix4() },
      /**
       * Represents the object's normal matrix.
       *
       * @name Object3D#normalMatrix
       */
      normalMatrix: { enumerable: false, configurable: false, writable: false, value: new Matrix3() },
    });
    /**
     * Represents the object's transformation matrix in local space.
     *
     */
    this.matrix = new Matrix4();
    /**
     * Represents the object's transformation matrix in world space.
     * If the 3D object has no parent, then it's identical to the local transformation matrix
     *
     */
    this.matrixWorld = new Matrix4();
    /**
     * When set to `true`, the engine automatically computes the local matrix from position,
     * rotation and scale every frame. If set to `false`, the app is responsible for recomputing
     * the local matrix by calling `updateMatrix()`.
     *
     * The default values for all 3D objects is defined by `Object3D.DEFAULT_MATRIX_AUTO_UPDATE`.
     *
     * @default true
     */
    this.matrixAutoUpdate = Object3D.DEFAULT_MATRIX_AUTO_UPDATE;
    /**
     * When set to `true`, the engine automatically computes the world matrix from the current local
     * matrix and the object's transformation hierarchy. If set to `false`, the app is responsible for
     * recomputing the world matrix by directly updating the `matrixWorld` property.
     *
     * The default values for all 3D objects is defined by `Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE`.
     *
     * @default true
     */
    this.matrixWorldAutoUpdate = Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE; // checked by the renderer
    /**
     * When set to `true`, it calculates the world matrix in that frame and resets this property
     * to `false`.
     *
     * @default false
     */
    this.matrixWorldNeedsUpdate = false;
    /**
     * The layer membership of the 3D object. The 3D object is only visible if it has
     * at least one layer in common with the camera in use. This property can also be
     * used to filter out unwanted objects in ray-intersection tests when using {@link Raycaster}.
     *
     */
    this.layers = new Layers();
    /**
     * When set to `true`, the 3D object gets rendered.
     *
     * @default true
     */
    this.visible = true;
    /**
     * When set to `true`, the 3D object gets rendered into shadow maps.
     *
     * @default false
     */
    this.castShadow = false;
    /**
     * When set to `true`, the 3D object is affected by shadows in the scene.
     *
     * @default false
     */
    this.receiveShadow = false;
    /**
     * When set to `true`, the 3D object is honored by view frustum culling.
     *
     * @default true
     */
    this.frustumCulled = true;
    /**
     * This value allows the default rendering order of scene graph objects to be
     * overridden although opaque and transparent objects remain sorted independently.
     * When this property is set for an instance of {@link Group},all descendants
     * objects will be sorted and rendered together. Sorting is from lowest to highest
     * render order.
     *
     * @default 0
     */
    this.renderOrder = 0;
    /**
     * An array holding the animation clips of the 3D object.
     *
     */
    this.animations = [];
    /**
     * Custom depth material to be used when rendering to the depth map. Can only be used
     * in context of meshes. When shadow-casting with a {@link DirectionalLight} or {@link SpotLight},
     * if you are modifying vertex positions in the vertex shader you must specify a custom depth
     * material for proper shadows.
     *
     * Only relevant in context of {@link WebGLRenderer}.
     *
     * @default undefined
     */
    this.customDepthMaterial = undefined;
    /**
     * Same as {@link Object3D#customDepthMaterial}, but used with {@link PointLight}.
     *
     * Only relevant in context of {@link WebGLRenderer}.
     *
     * @default undefined
     */
    this.customDistanceMaterial = undefined;
    /**
     * An object that can be used to store custom data about the 3D object. It
     * should not hold references to functions as these will not be cloned.
     *
     */
    this.userData = {};
    /**
     * The pivot point for rotation and scale transformations.
     * When set, rotation and scale are applied around this point
     * instead of the object's origin.
     *
     * @default null
     */
    this.pivot = null;
  }
  /**
   * A callback that is executed immediately before a 3D object is rendered to a shadow map.
   *
   * @param renderer - The renderer.
   * @param object - The 3D object.
   * @param camera - The camera that is used to render the scene.
   * @param shadowCamera - The shadow camera.
   * @param geometry - The 3D object's geometry.
   * @param depthMaterial - The depth material.
   * @param group - The geometry group data.
   */
  onBeforeShadow(
    renderer: WebGLRenderer,
    object: Object3D,
    camera: Camera,
    shadowCamera: Camera,
    geometry: BufferGeometry,
    depthMaterial: Material,
    group: { start: number; count: number; materialIndex?: number } | null,
  ): void;
  onBeforeShadow(/* renderer, object, camera, shadowCamera, geometry, depthMaterial, group */) {}
  /**
   * A callback that is executed immediately after a 3D object is rendered to a shadow map.
   *
   * @param renderer - The renderer.
   * @param object - The 3D object.
   * @param camera - The camera that is used to render the scene.
   * @param shadowCamera - The shadow camera.
   * @param geometry - The 3D object's geometry.
   * @param depthMaterial - The depth material.
   * @param group - The geometry group data.
   */
  onAfterShadow(
    renderer: WebGLRenderer,
    object: Object3D,
    camera: Camera,
    shadowCamera: Camera,
    geometry: BufferGeometry,
    depthMaterial: Material,
    group: { start: number; count: number; materialIndex?: number } | null,
  ): void;
  onAfterShadow(/* renderer, object, camera, shadowCamera, geometry, depthMaterial, group */) {}
  /**
   * A callback that is executed immediately before a 3D object is rendered.
   *
   * @param renderer - The renderer.
   * @param object - The 3D object.
   * @param camera - The camera that is used to render the scene.
   * @param geometry - The 3D object's geometry.
   * @param material - The 3D object's material.
   * @param group - The geometry group data.
   */
  onBeforeRender(...args: any[]): void;
  onBeforeRender(/* renderer, scene, camera, geometry, material, group */) {}
  /**
   * A callback that is executed immediately after a 3D object is rendered.
   *
   * @param renderer - The renderer.
   * @param object - The 3D object.
   * @param camera - The camera that is used to render the scene.
   * @param geometry - The 3D object's geometry.
   * @param material - The 3D object's material.
   * @param group - The geometry group data.
   */
  onAfterRender(...args: any[]): void;
  onAfterRender(/* renderer, scene, camera, geometry, material, group */) {}
  /**
   * Applies the given transformation matrix to the object and updates the object's position,
   * rotation and scale.
   *
   * @param matrix - The transformation matrix.
   */
  applyMatrix4(matrix: Matrix4) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    this.matrix.premultiply(matrix);
    this.matrix.decompose((this as any).position, (this as any).quaternion, (this as any).scale);
    if (this.pivot !== null) {
      // the matrix maps the pivot to position + pivot, see updateMatrix()
      (this as any).position.copy(this.pivot).applyMatrix4(this.matrix).sub(this.pivot);
    }
  }
  /**
   * Applies a rotation represented by given the quaternion to the 3D object.
   *
   * @param q - The quaternion.
   * @return A reference to this instance.
   */
  applyQuaternion(q: Quaternion): Object3D {
    (this as any).quaternion.premultiply(q);
    return this;
  }
  /**
   * Sets the given rotation represented as an axis/angle couple to the 3D object.
   *
   * @param axis - The (normalized) axis vector.
   * @param angle - The angle in radians.
   */
  setRotationFromAxisAngle(axis: Vector3, angle: number) {
    // assumes axis is normalized
    (this as any).quaternion.setFromAxisAngle(axis, angle);
  }
  /**
   * Sets the given rotation represented as Euler angles to the 3D object.
   *
   * @param euler - The Euler angles.
   */
  setRotationFromEuler(euler: Euler) {
    (this as any).quaternion.setFromEuler(euler, true);
  }
  /**
   * Sets the given rotation represented as rotation matrix to the 3D object.
   *
   * @param m - Although a 4x4 matrix is expected, the upper 3x3 portion must be
   * a pure rotation matrix (i.e, unscaled).
   */
  setRotationFromMatrix(m: Matrix4) {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    (this as any).quaternion.setFromRotationMatrix(m);
  }
  /**
   * Sets the given rotation represented as a Quaternion to the 3D object.
   *
   * @param q - The Quaternion
   */
  setRotationFromQuaternion(q: Quaternion) {
    // assumes q is normalized
    (this as any).quaternion.copy(q);
  }
  /**
   * Rotates the 3D object along an axis in local space.
   *
   * @param axis - The (normalized) axis vector.
   * @param angle - The angle in radians.
   * @return A reference to this instance.
   */
  rotateOnAxis(axis: Vector3, angle: number): Object3D {
    // rotate object on axis in object space
    // axis is assumed to be normalized
    _q1.setFromAxisAngle(axis, angle);
    (this as any).quaternion.multiply(_q1);
    return this;
  }
  /**
   * Rotates the 3D object along an axis in world space.
   *
   * @param axis - The (normalized) axis vector.
   * @param angle - The angle in radians.
   * @return A reference to this instance.
   */
  rotateOnWorldAxis(axis: Vector3, angle: number): Object3D {
    // rotate object on axis in world space
    // axis is assumed to be normalized
    // method assumes no rotated parent
    _q1.setFromAxisAngle(axis, angle);
    (this as any).quaternion.premultiply(_q1);
    return this;
  }
  /**
   * Rotates the 3D object around its X axis in local space.
   *
   * @param angle - The angle in radians.
   * @return A reference to this instance.
   */
  rotateX(angle: number): Object3D {
    return this.rotateOnAxis(_xAxis, angle);
  }
  /**
   * Rotates the 3D object around its Y axis in local space.
   *
   * @param angle - The angle in radians.
   * @return A reference to this instance.
   */
  rotateY(angle: number): Object3D {
    return this.rotateOnAxis(_yAxis, angle);
  }
  /**
   * Rotates the 3D object around its Z axis in local space.
   *
   * @param angle - The angle in radians.
   * @return A reference to this instance.
   */
  rotateZ(angle: number): Object3D {
    return this.rotateOnAxis(_zAxis, angle);
  }
  /**
   * Translate the 3D object by a distance along the given axis in local space.
   *
   * @param axis - The (normalized) axis vector.
   * @param distance - The distance in world units.
   * @return A reference to this instance.
   */
  translateOnAxis(axis: Vector3, distance: number): Object3D {
    // translate object by distance along axis in object space
    // axis is assumed to be normalized
    _v1.copy(axis).applyQuaternion((this as any).quaternion);
    (this as any).position.add(_v1.multiplyScalar(distance));
    return this;
  }
  /**
   * Translate the 3D object by a distance along its X-axis in local space.
   *
   * @param distance - The distance in world units.
   * @return A reference to this instance.
   */
  translateX(distance: number): Object3D {
    return this.translateOnAxis(_xAxis, distance);
  }
  /**
   * Translate the 3D object by a distance along its Y-axis in local space.
   *
   * @param distance - The distance in world units.
   * @return A reference to this instance.
   */
  translateY(distance: number): Object3D {
    return this.translateOnAxis(_yAxis, distance);
  }
  /**
   * Translate the 3D object by a distance along its Z-axis in local space.
   *
   * @param distance - The distance in world units.
   * @return A reference to this instance.
   */
  translateZ(distance: number): Object3D {
    return this.translateOnAxis(_zAxis, distance);
  }
  /**
   * Converts the given vector from this 3D object's local space to world space.
   *
   * @param vector - The vector to convert.
   * @return The converted vector.
   */
  localToWorld(vector: Vector3): Vector3 {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(this.matrixWorld);
  }
  /**
   * Converts the given vector from this 3D object's world space to local space.
   *
   * @param vector - The vector to convert.
   * @return The converted vector.
   */
  worldToLocal(vector: Vector3): Vector3 {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(_m1.copy(this.matrixWorld).invert());
  }
  /**
   * Rotates the object to face a point in world space.
   *
   * This method does not support objects having non-uniformly-scaled parent(s).
   *
   * @param x - The x coordinate in world space. Alternatively, a vector representing a position in world space
   * @param [y] - The y coordinate in world space.
   * @param [z] - The z coordinate in world space.
   */
  lookAt(x: number | Vector3, y?: number, z?: number): void;
  lookAt(x?: any, y?: number, z?: number) {
    // This method does not support objects having non-uniformly-scaled parent(s)
    if ((x as any).isVector3) {
      _target.copy(x);
    } else {
      _target.set(x, y!, z!);
    }
    const parent = this.parent;
    this.updateWorldMatrix(true, false);
    _position.setFromMatrixPosition(this.matrixWorld);
    if ((this as any).isCamera || (this as any).isLight) {
      _m1.lookAt(_position, _target, this.up);
    } else {
      _m1.lookAt(_target, _position, this.up);
    }
    (this as any).quaternion.setFromRotationMatrix(_m1);
    if (parent) {
      _m1.extractRotation(parent.matrixWorld);
      _q1.setFromRotationMatrix(_m1);
      (this as any).quaternion.premultiply(_q1.invert());
    }
  }
  /**
   * Adds the given 3D object as a child to this 3D object. An arbitrary number of
   * objects may be added. Any current parent on an object passed in here will be
   * removed, since an object can have at most one parent.
   *
   * @fires Object3D#added
   * @fires Object3D#childadded
   * @param object - The 3D object to add.
   * @return A reference to this instance.
   */
  add(...objects: TChild[]): this;
  add(object?: TChild): Object3D {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.add((arguments as any)[i]);
      }
      return this;
    }
    if (object === (this as Object3D)) {
      error("Object3D.add: object can't be added as a child of itself.", object!);
      return this;
    }
    if (object! && object!.isObject3D) {
      object!.removeFromParent();
      object!.parent = this;
      this.children.push(object!);
      object!.dispatchEvent(_addedEvent);
      _childaddedEvent.child = object!;
      this.dispatchEvent(_childaddedEvent);
      _childaddedEvent.child = null;
    } else {
      error("Object3D.add: object not an instance of THREE.Object3D.", object!);
    }
    return this;
  }
  /**
   * Removes the given 3D object as child from this 3D object.
   * An arbitrary number of objects may be removed.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @param object - The 3D object to remove.
   * @return A reference to this instance.
   */
  remove(...objects: Object3D[]): this;
  remove(object?: Object3D): Object3D {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove((arguments as any)[i]);
      }
      return this;
    }
    const index = this.children.indexOf(object! as TChild);
    if (index !== -1) {
      object!.parent = null;
      this.children.splice(index, 1);
      object!.dispatchEvent(_removedEvent);
      _childremovedEvent.child = object!;
      this.dispatchEvent(_childremovedEvent);
      _childremovedEvent.child = null;
    }
    return this;
  }
  /**
   * Removes this 3D object from its current parent.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @return A reference to this instance.
   */
  removeFromParent(): Object3D {
    const parent = this.parent;
    if (parent !== null) {
      parent.remove(this);
    }
    return this;
  }
  /**
   * Removes all child objects.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @return A reference to this instance.
   */
  clear(): Object3D {
    return this.remove(...this.children);
  }
  /**
   * Adds the given 3D object as a child of this 3D object, while maintaining the object's world
   * transform. This method does not support scene graphs having non-uniformly-scaled nodes(s).
   *
   * @fires Object3D#added
   * @fires Object3D#childadded
   * @param object - The 3D object to attach.
   * @return A reference to this instance.
   */
  attach(object: TChild): Object3D {
    // adds object as a child of this, while maintaining the object's world transform
    // Note: This method does not support scene graphs having non-uniformly-scaled nodes(s)
    this.updateWorldMatrix(true, false);
    _m1.copy(this.matrixWorld).invert();
    if (object.parent !== null) {
      object.parent.updateWorldMatrix(true, false);
      _m1.multiply(object.parent.matrixWorld);
    }
    object.applyMatrix4(_m1);
    object.removeFromParent();
    object.parent = this;
    this.children.push(object);
    object.updateWorldMatrix(false, true);
    object.dispatchEvent(_addedEvent);
    _childaddedEvent.child = object;
    this.dispatchEvent(_childaddedEvent);
    _childaddedEvent.child = null;
    return this;
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching ID.
   *
   * @param id - The id.
   * @return The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectById(id: number): Object3D | undefined {
    return this.getObjectByProperty("id", id);
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching name.
   *
   * @param name - The name.
   * @return The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectByName(name: string): Object3D | undefined {
    return this.getObjectByProperty("name", name);
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching property value.
   *
   * @param name - The name of the property.
   * @param value - The value.
   * @return The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectByProperty(name: string, value?: any): Object3D | undefined {
    if ((this as any)[name] === value) return this;
    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i];
      const object = child.getObjectByProperty(name, value);
      if (object !== undefined) {
        return object;
      }
    }
    return undefined;
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns all 3D objects with a matching property value.
   *
   * @param name - The name of the property.
   * @param value - The value.
   * @param result - The method stores the result in this array.
   * @return The found 3D objects.
   */
  getObjectsByProperty(name: string, value?: any, result: Object3D[] = []): Object3D[] {
    if ((this as any)[name] === value) result.push(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].getObjectsByProperty(name, value, result);
    }
    return result;
  }
  /**
   * Returns a vector representing the position of the 3D object in world space.
   *
   * @param target - The target vector the result is stored to.
   * @return The 3D object's position in world space.
   */
  getWorldPosition(target: Vector3): Vector3 {
    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.matrixWorld);
  }
  /**
   * Returns a Quaternion representing the position of the 3D object in world space.
   *
   * @param target - The target Quaternion the result is stored to.
   * @return The 3D object's rotation in world space.
   */
  getWorldQuaternion(target: Quaternion): Quaternion {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position, target, _scale);
    return target;
  }
  /**
   * Returns a vector representing the scale of the 3D object in world space.
   *
   * @param target - The target vector the result is stored to.
   * @return The 3D object's scale in world space.
   */
  getWorldScale(target: Vector3): Vector3 {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position, _quaternion, target);
    return target;
  }
  /**
   * Returns a vector representing the ("look") direction of the 3D object in world space.
   *
   * @param target - The target vector the result is stored to.
   * @return The 3D object's direction in world space.
   */
  getWorldDirection(target: Vector3): Vector3 {
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    return target.set(e[8], e[9], e[10]).normalize();
  }
  /**
   * Abstract method to get intersections between a casted ray and this
   * 3D object. Renderable 3D objects such as {@link Mesh}, {@link Line} or {@link Points}
   * implement this method in order to use raycasting.
   *
   * @abstract
   * @param raycaster - The raycaster.
   * @param intersects - An array holding the result of the method.
   */
  raycast(raycaster: Raycaster, intersects: Intersection[]): boolean | void;
  raycast(/* raycaster, intersects */) {}
  /**
   * Returns `true` if this 3D object intersects the given frustum. Renderable 3D objects
   * such as {@link Mesh}, {@link Line} or {@link Points} override this method in order
   * to use frustum culling. The default implementation always returns `true`.
   *
   * @param frustum - The frustum to test.
   * @return Whether this 3D object intersects the given frustum or not.
   */
  intersectsFrustum(...args: any[]): boolean;
  intersectsFrustum(/* frustum */): boolean {
    return true;
  }
  /**
   * Executes the callback on this 3D object and all descendants.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param callback - A callback function that allows to process the current 3D object.
   */
  traverse(callback: (...args: any[]) => any) {
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverse(callback);
    }
  }
  /**
   * Like {@link Object3D#traverse}, but the callback will only be executed for visible 3D objects.
   * Descendants of invisible 3D objects are not traversed.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param callback - A callback function that allows to process the current 3D object.
   */
  traverseVisible(callback: (...args: any[]) => any) {
    if (this.visible === false) return;
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverseVisible(callback);
    }
  }
  /**
   * Like {@link Object3D#traverse}, but the callback will only be executed for all ancestors.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param callback - A callback function that allows to process the current 3D object.
   */
  traverseAncestors(callback: (...args: any[]) => any) {
    const parent = this.parent;
    if (parent !== null) {
      callback(parent);
      parent.traverseAncestors(callback);
    }
  }
  /**
   * Updates the transformation matrix in local space by computing it from the current
   * position, rotation and scale values.
   */
  updateMatrix() {
    this.matrix.compose((this as any).position, (this as any).quaternion, (this as any).scale);
    const pivot = this.pivot;
    if (pivot !== null) {
      const px = pivot.x,
        py = pivot.y,
        pz = pivot.z;
      const te = this.matrix.elements;
      te[12] += px - te[0] * px - te[4] * py - te[8] * pz;
      te[13] += py - te[1] * px - te[5] * py - te[9] * pz;
      te[14] += pz - te[2] * px - te[6] * py - te[10] * pz;
    }
    this.matrixWorldNeedsUpdate = true;
  }
  /**
   * Updates the transformation matrix in world space of this 3D objects and its descendants.
   *
   * To ensure correct results, this method also recomputes the 3D object's transformation matrix in
   * local space. The computation of the local and world matrix can be controlled with the
   * {@link Object3D#matrixAutoUpdate} and {@link Object3D#matrixWorldAutoUpdate} flags which are both
   * `true` by default.  Set these flags to `false` if you need more control over the update matrix process.
   *
   * @param [force=false] - When set to `true`, a recomputation of world matrices is forced even
   * when {@link Object3D#matrixWorldNeedsUpdate} is `false`.
   */
  updateMatrixWorld(force?: boolean) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force!) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) {
          this.matrixWorld.copy(this.matrix);
        } else {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        }
      }
      this.matrixWorldNeedsUpdate = false;
      force! = true;
    }
    // make sure descendants are updated if required
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      child.updateMatrixWorld(force!);
    }
  }
  /**
   * An alternative version of {@link Object3D#updateMatrixWorld} with more control over the
   * update of ancestor and descendant nodes.
   *
   * @param [updateParents=false] Whether ancestor nodes should be updated or not.
   * @param [updateChildren=false] Whether descendant nodes should be updated or not.
   * @param [force=false] - When set to `true`, a recomputation of world matrices is forced even
   * when {@link Object3D#matrixWorldNeedsUpdate} is `false`.
   */
  updateWorldMatrix(updateParents?: boolean, updateChildren?: boolean, force: boolean = false) {
    const parent = this.parent;
    if (updateParents! === true && parent !== null) {
      parent.updateWorldMatrix(true, false);
    }
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) {
          this.matrixWorld.copy(this.matrix);
        } else {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        }
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    // make sure descendants are updated
    if (updateChildren! === true) {
      const children = this.children;
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        child.updateWorldMatrix(false, true, force);
      }
    }
  }
  /**
   * Serializes the 3D object into JSON.
   *
   * @param meta - An optional value holding meta information about the serialization.
   * @return A JSON object representing the serialized 3D object.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta?: any) {
    // meta is a string when called from JSON.stringify
    const isRootObject = meta === undefined || typeof meta === "string";
    const output: any = {};
    // meta is a hash used to collect geometries, materials.
    // not providing it implies that this is the root object
    // being serialized.
    if (isRootObject) {
      // initialize meta obj
      meta = {
        geometries: {},
        materials: {},
        textures: {},
        images: {},
        shapes: {},
        skeletons: {},
        animations: {},
      };
      output.metadata = {
        version: 4.7,
        type: "Object",
        generator: "Object3D.toJSON",
      };
    }
    // standard Object3D serialization
    const object: any = {};
    object.uuid = this.uuid;
    object.type = this.type;
    object.name = this.name;
    object.castShadow = this.castShadow;
    object.receiveShadow = this.receiveShadow;
    object.visible = this.visible;
    object.frustumCulled = this.frustumCulled;
    object.renderOrder = this.renderOrder;
    object.matrixAutoUpdate = this.matrixAutoUpdate;
    if (Object.keys(this.userData).length > 0) object.userData = this.userData;
    object.layers = this.layers.mask;
    object.matrix = this.matrix.toArray();
    object.up = this.up.toArray();
    if (this.pivot !== null) object.pivot = this.pivot.toArray();
    if ((this as any).morphTargetDictionary !== undefined)
      object.morphTargetDictionary = Object.assign({}, (this as any).morphTargetDictionary);
    if ((this as any).morphTargetInfluences !== undefined)
      object.morphTargetInfluences = (this as any).morphTargetInfluences.slice();
    // object specific properties
    if ((this as any).isInstancedMesh) {
      object.type = "InstancedMesh";
      object.count = (this as any).count;
      object.instanceMatrix = (this as any).instanceMatrix.toJSON();
      if ((this as any).instanceColor !== null) object.instanceColor = (this as any).instanceColor.toJSON();
    }
    if ((this as any).isBatchedMesh) {
      object.type = "BatchedMesh";
      object.perObjectFrustumCulled = (this as any).perObjectFrustumCulled;
      object.sortObjects = (this as any).sortObjects;
      object.drawRanges = (this as any)._drawRanges;
      object.reservedRanges = (this as any)._reservedRanges;
      object.geometryInfo = (this as any)._geometryInfo.map((info?: any) => ({
        ...info,
        boundingBox: info.boundingBox ? info.boundingBox.toJSON() : undefined,
        boundingSphere: info.boundingSphere ? info.boundingSphere.toJSON() : undefined,
      }));
      object.instanceInfo = (this as any)._instanceInfo.map((info?: any) => ({ ...info }));
      object.availableInstanceIds = (this as any)._availableInstanceIds.slice();
      object.availableGeometryIds = (this as any)._availableGeometryIds.slice();
      object.nextIndexStart = (this as any)._nextIndexStart;
      object.nextVertexStart = (this as any)._nextVertexStart;
      object.geometryCount = (this as any)._geometryCount;
      object.maxInstanceCount = (this as any)._maxInstanceCount;
      object.maxVertexCount = (this as any)._maxVertexCount;
      object.maxIndexCount = (this as any)._maxIndexCount;
      object.geometryInitialized = (this as any)._geometryInitialized;
      object.matricesTexture = (this as any)._matricesTexture.toJSON(meta);
      object.indirectTexture = (this as any)._indirectTexture.toJSON(meta);
      if ((this as any)._colorsTexture !== null) {
        object.colorsTexture = (this as any)._colorsTexture.toJSON(meta);
      }
      if ((this as any).boundingSphere !== null) {
        object.boundingSphere = (this as any).boundingSphere.toJSON();
      }
      if ((this as any).boundingBox !== null) {
        object.boundingBox = (this as any).boundingBox.toJSON();
      }
    }
    //
    function serialize(library: any, element?: any) {
      if (library[element.uuid] === undefined) {
        library[element.uuid] = element.toJSON(meta);
      }
      return element.uuid;
    }
    if ((this as any).isScene) {
      if ((this as any).background) {
        if ((this as any).background.isColor) {
          object.background = (this as any).background.toJSON();
        } else if ((this as any).background.isTexture) {
          object.background = (this as any).background.toJSON(meta).uuid;
        }
      }
      if (
        (this as any).environment &&
        (this as any).environment.isTexture &&
        (this as any).environment.isRenderTargetTexture !== true
      ) {
        object.environment = (this as any).environment.toJSON(meta).uuid;
      }
    } else if ((this as any).isMesh || (this as any).isLine || (this as any).isPoints) {
      object.geometry = serialize(meta.geometries, (this as any).geometry);
      const parameters = (this as any).geometry.parameters;
      if (parameters !== undefined && parameters.shapes !== undefined) {
        const shapes = parameters.shapes;
        if (Array.isArray(shapes)) {
          for (let i = 0, l = shapes.length; i < l; i++) {
            const shape = shapes[i];
            serialize(meta.shapes, shape);
          }
        } else {
          serialize(meta.shapes, shapes);
        }
      }
    }
    if ((this as any).isSkinnedMesh) {
      object.bindMode = (this as any).bindMode;
      object.bindMatrix = (this as any).bindMatrix.toArray();
      if ((this as any).skeleton !== undefined) {
        serialize(meta.skeletons, (this as any).skeleton);
        object.skeleton = (this as any).skeleton.uuid;
      }
    }
    if ((this as any).material !== undefined) {
      if (Array.isArray((this as any).material)) {
        const uuids: any[] = [];
        for (let i = 0, l = (this as any).material.length; i < l; i++) {
          uuids.push(serialize(meta.materials, (this as any).material[i]));
        }
        object.material = uuids;
      } else {
        object.material = serialize(meta.materials, (this as any).material);
      }
    }
    //
    if (this.children.length > 0) {
      object.children = [];
      for (let i = 0; i < this.children.length; i++) {
        object.children.push(this.children[i].toJSON(meta).object);
      }
    }
    //
    if (this.animations.length > 0) {
      object.animations = [];
      for (let i = 0; i < this.animations.length; i++) {
        const animation = this.animations[i];
        object.animations.push(serialize(meta.animations, animation));
      }
    }
    if (isRootObject) {
      const geometries = extractFromCache(meta.geometries);
      const materials = extractFromCache(meta.materials);
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);
      const shapes = extractFromCache(meta.shapes);
      const skeletons = extractFromCache(meta.skeletons);
      const animations = extractFromCache(meta.animations);
      if (geometries.length > 0) output.geometries = geometries;
      if (materials.length > 0) output.materials = materials;
      if (textures.length > 0) output.textures = textures;
      if (images.length > 0) output.images = images;
      if (shapes.length > 0) output.shapes = shapes;
      if (skeletons.length > 0) output.skeletons = skeletons;
      if (animations.length > 0) output.animations = animations;
    }
    output.object = object;
    return output;
    // extract data from the cache hash
    // remove metadata on each item
    // and return as array
    function extractFromCache(cache?: any) {
      const values: any[] = [];
      for (const key in cache) {
        const data = cache[key];
        delete data.metadata;
        values.push(data);
      }
      return values;
    }
  }
  /**
   * Returns a new 3D object with copied values from this instance.
   *
   * @param [recursive=true] - When set to `true`, descendants of the 3D object are also cloned.
   * @return A clone of this instance.
   */
  clone(recursive?: boolean): this {
    return new (this.constructor as any)().copy(this, recursive!);
  }
  /**
   * Copies the values of the given 3D object to this instance.
   *
   * @param source - The 3D object to copy.
   * @param [recursive=true] - When set to `true`, descendants of the 3D object are cloned.
   * @return A reference to this instance.
   */
  copy(source: Object3D<TChild>, recursive: boolean = true): this {
    this.name = source.name;
    this.up.copy(source.up);
    (this as any).position.copy((source as any).position);
    (this as any).rotation.order = (source as any).rotation.order;
    (this as any).quaternion.copy((source as any).quaternion);
    (this as any).scale.copy((source as any).scale);
    this.pivot = source.pivot !== null ? source.pivot.clone() : null;
    this.matrix.copy(source.matrix);
    this.matrixWorld.copy(source.matrixWorld);
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
    this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate;
    this.layers.mask = source.layers.mask;
    this.visible = source.visible;
    this.castShadow = source.castShadow;
    this.receiveShadow = source.receiveShadow;
    this.frustumCulled = source.frustumCulled;
    this.renderOrder = source.renderOrder;
    this.animations = source.animations.slice();
    this.userData = JSON.parse(JSON.stringify(source.userData));
    if (recursive === true) {
      for (let i = 0; i < source.children.length; i++) {
        const child = source.children[i];
        this.add(child.clone());
      }
    }
    return this;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * Geometries, materials and textures are potentially shared with other
   * 3D objects and must be disposed of separately.
   *
   * @fires Object3D#dispose
   */
  dispose() {
    /**
     * Fires when the 3D object has been disposed of.
     *
     * @event Object3D#dispose
     */
    this.dispatchEvent({ type: "dispose" });
  }
}
/**
 * The default up direction for objects, also used as the default
 * position for {@link DirectionalLight} and {@link HemisphereLight}.
 *
 * @static
 * @default (0,1,0)
 */
Object3D.DEFAULT_UP = /*@__PURE__*/ new Vector3(0, 1, 0);
/**
 * The default setting for {@link Object3D#matrixAutoUpdate} for
 * newly created 3D objects.
 *
 * @static
 * @default true
 */
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = true;
/**
 * The default setting for {@link Object3D#matrixWorldAutoUpdate} for
 * newly created 3D objects.
 *
 * @static
 * @default true
 */
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true;
