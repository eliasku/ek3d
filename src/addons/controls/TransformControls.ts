import { DoubleSide } from "../../constants";
import type { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { Float32BufferAttribute } from "../../core/BufferAttribute";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Raycaster } from "../../core/Raycaster";
import type { Intersection } from "../../core/Raycaster";
import { Controls } from "../../extras/Controls";
import { Euler } from "../../math/Euler";
import type { Color } from "../../math/Color";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Vector4 } from "../../math/Vector4";
import { Line } from "../../objects/Line";
import { Mesh } from "../../objects/Mesh";
import { Object3D } from "../../core/Object3D";
import type { Material } from "../../materials/Material";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { BoxGeometry } from "../../geometries/BoxGeometry";
import { CylinderGeometry } from "../../geometries/CylinderGeometry";
import { OctahedronGeometry } from "../../geometries/OctahedronGeometry";
import { PlaneGeometry } from "../../geometries/PlaneGeometry";
import { SphereGeometry } from "../../geometries/SphereGeometry";
import { TorusGeometry } from "../../geometries/TorusGeometry";

const _raycaster = new Raycaster();

const _tempVector = new Vector3();
const _tempVector2 = new Vector3();
const _tempQuaternion = new Quaternion();
const _unit = {
  X: new Vector3(1, 0, 0),
  Y: new Vector3(0, 1, 0),
  Z: new Vector3(0, 0, 1),
};

/**
 * Fires if any type of change (object or property change) is performed. Property changes
 * are separate events you can add event listeners to. The event type is "propertyname-changed".
 */
const _changeEvent = { type: "change" };

/**
 * Fires if a pointer (mouse/touch) becomes active.
 */
const _mouseDownEvent = { type: "mouseDown", mode: null as string | null };

/**
 * Fires if a pointer (mouse/touch) is no longer active.
 */
const _mouseUpEvent = { type: "mouseUp", mode: null as string | null };

/**
 * Fires if the controlled 3D object is changed.
 */
const _objectChangeEvent = { type: "objectChange" };

const _pointerCoords = new Vector2();

/** Feeds the plain pointer object produced by `getPointer` to the raycaster. */
function setPointerFromCamera(pointer: ControlPointer, camera: TransformCamera): void {
  _pointerCoords.x = pointer.x;
  _pointerCoords.y = pointer.y;

  _raycaster.setFromCamera(_pointerCoords, camera);
}

/** Pointer coordinates in normalized device space, plus the initiating mouse button. */
interface ControlPointer {
  x: number;
  y: number;
  button: number;
}

/** The camera types supported by {@link TransformControls}. */
type TransformCamera = PerspectiveCamera | OrthographicCamera;

/** A material carrying lazily cached highlight state used by the gizmo update loop. */
interface HighlightableMaterial extends Material {
  color: Color;
  opacity: number;
  _color?: Color | null;
  _opacity?: number | null;
}

/** A gizmo handle entry: prototype object, optional position, rotation, scale and helper tag. */
type GizmoEntry = [Object3D, number[]?, number[]?, number[]?, string?];

/** A map from axis names to gizmo handle entries. */
type GizmoMap = Record<string, GizmoEntry[]>;

/**
 * This class can be used to transform objects in 3D space by adapting a similar interaction model
 * of DCC tools like Blender. Unlike other controls, it is not intended to transform the scene's camera.
 *
 * `TransformControls` expects that its attached 3D object is part of the scene graph.
 *
 * @augments Controls
 */
export class TransformControls extends Controls<Object3D> {
  /**
   * The camera of the rendered scene.
   */
  camera!: TransformCamera;

  /**
   * The current transformation axis.
   */
  axis!: string | null;

  /**
   * The current transformation mode.
   */
  mode!: "translate" | "rotate" | "scale";

  /**
   * By default, 3D objects are continuously translated. If you set this property to a numeric
   * value (world units), you can define in which steps the 3D object should be translated.
   */
  translationSnap!: number | null;

  /**
   * By default, 3D objects are continuously rotated. If you set this property to a numeric
   * value (radians), you can define in which steps the 3D object should be rotated.
   */
  rotationSnap!: number | null;

  /**
   * By default, 3D objects are continuously scaled. If you set this property to a numeric
   * value, you can define in which steps the 3D object should be scaled.
   */
  scaleSnap!: number | null;

  /**
   * Defines in which coordinate space transformations should be performed.
   */
  space!: "world" | "local";

  /**
   * The size of the helper UI (axes/planes).
   */
  size!: number;

  /**
   * The viewport rectangle, in logical (CSS) pixels with the origin at the lower-left
   * of the canvas. Set this when the renderer uses a sub-canvas viewport so pointer
   * coordinates map to the correct region. If `null`, the full canvas is used.
   *
   * @default null
   */
  viewport: Vector4 | null = null;

  /**
   * Whether dragging is currently performed or not.
   */
  dragging!: boolean;

  /**
   * Whether the x-axis helper should be visible or not.
   */
  showX!: boolean;

  /**
   * Whether the y-axis helper should be visible or not.
   */
  showY!: boolean;

  /**
   * Whether the z-axis helper should be visible or not.
   */
  showZ!: boolean;

  /**
   * Whether the xy-plane helper should be visible or not.
   */
  showXY!: boolean;

  /**
   * Whether the yz-plane helper should be visible or not.
   */
  showYZ!: boolean;

  /**
   * Whether the xz-plane helper should be visible or not.
   */
  showXZ!: boolean;

  /**
   * Whether the xyze rotation helper should be visible or not.
   */
  showXYZE!: boolean;

  /**
   * Whether the e rotation helper should be visible or not.
   */
  showE!: boolean;

  /**
   * The minimum allowed X position during translation.
   */
  minX!: number;

  /**
   * The maximum allowed X position during translation.
   */
  maxX!: number;

  /**
   * The minimum allowed Y position during translation.
   */
  minY!: number;

  /**
   * The maximum allowed Y position during translation.
   */
  maxY!: number;

  /**
   * The minimum allowed Z position during translation.
   */
  minZ!: number;

  /**
   * The maximum allowed Z position during translation.
   */
  maxZ!: number;

  // reusable utility variables

  worldPosition: Vector3 = new Vector3();
  worldPositionStart: Vector3 = new Vector3();
  worldQuaternion: Quaternion = new Quaternion();
  worldQuaternionStart: Quaternion = new Quaternion();
  cameraPosition: Vector3 = new Vector3();
  cameraQuaternion: Quaternion = new Quaternion();
  pointStart: Vector3 = new Vector3();
  pointEnd: Vector3 = new Vector3();
  rotationAxis: Vector3 = new Vector3();
  rotationAngle: number = 0;
  eye: Vector3 = new Vector3();

  _offset: Vector3;
  _startNorm: Vector3;
  _endNorm: Vector3;
  _cameraScale: Vector3;

  _parentPosition: Vector3;
  _parentQuaternion: Quaternion;
  _parentQuaternionInv: Quaternion;
  _parentScale: Vector3;

  _worldScaleStart: Vector3;
  _worldQuaternionInv: Quaternion;
  _worldScale: Vector3;

  _positionStart: Vector3;
  _quaternionStart: Quaternion;
  _scaleStart: Vector3;

  _root: TransformControlsRoot;
  _gizmo: TransformControlsGizmo;
  _plane: TransformControlsPlane;

  _getPointer: (event: PointerEvent) => ControlPointer;
  _onPointerDown: (event: PointerEvent) => void;
  _onPointerHover: (event: PointerEvent) => void;
  _onPointerMove: (event: PointerEvent) => void;
  _onPointerUp: (event: PointerEvent) => void;

  /**
   * Constructs a new controls instance.
   *
   * @param camera - The camera of the rendered scene.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(camera: TransformCamera, domElement: HTMLElement | null = null) {
    super(undefined as unknown as Object3D, domElement);

    const root = new TransformControlsRoot(this);
    this._root = root;

    const gizmo = new TransformControlsGizmo();
    this._gizmo = gizmo;
    root.add(gizmo);

    const plane = new TransformControlsPlane();
    this._plane = plane;
    root.add(plane);

    const scopeProps = this as unknown as Record<string, unknown>;

    // Defined getter, setter and store for a property

    function defineProperty<T>(propName: string, defaultValue: T): void {
      let propValue: T | undefined = defaultValue;

      Object.defineProperty(scopeProps, propName, {
        get(): T {
          return (propValue !== undefined ? propValue : defaultValue) as T;
        },
        set(value: T): void {
          if (propValue !== value) {
            propValue = value;
            (plane as unknown as Record<string, unknown>)[propName] = value;
            (gizmo as unknown as Record<string, unknown>)[propName] = value;

            this.dispatchEvent({ type: propName + "-changed", value });
            this.dispatchEvent(_changeEvent);
          }
        },
      });

      scopeProps[propName] = defaultValue;
      (plane as unknown as Record<string, unknown>)[propName] = defaultValue;
      (gizmo as unknown as Record<string, unknown>)[propName] = defaultValue;
    }

    // Define properties with getters/setter
    // Setting the defined property will automatically trigger change event
    // Defined properties are passed down to gizmo and plane

    defineProperty("camera", camera);
    defineProperty<Object3D | undefined>("object", undefined);
    defineProperty("enabled", true);
    defineProperty("axis", null as string | null);
    defineProperty("mode", "translate" as const);
    defineProperty("translationSnap", null as number | null);
    defineProperty("rotationSnap", null as number | null);
    defineProperty("scaleSnap", null as number | null);
    defineProperty("space", "world" as const);
    defineProperty("size", 1);
    defineProperty("dragging", false);
    defineProperty("showX", true);
    defineProperty("showY", true);
    defineProperty("showZ", true);
    defineProperty("showXY", true);
    defineProperty("showYZ", true);
    defineProperty("showXZ", true);
    defineProperty("showXYZE", true);
    defineProperty("showE", true);
    defineProperty("minX", -Infinity);
    defineProperty("maxX", Infinity);
    defineProperty("minY", -Infinity);
    defineProperty("maxY", Infinity);
    defineProperty("minZ", -Infinity);
    defineProperty("maxZ", Infinity);

    // Reusable utility variables

    const worldPosition = new Vector3();
    const worldPositionStart = new Vector3();
    const worldQuaternion = new Quaternion();
    const worldQuaternionStart = new Quaternion();
    const cameraPosition = new Vector3();
    const cameraQuaternion = new Quaternion();
    const pointStart = new Vector3();
    const pointEnd = new Vector3();
    const rotationAxis = new Vector3();
    const rotationAngle = 0;
    const eye = new Vector3();

    // TODO: remove properties unused in plane and gizmo (upstream note)

    defineProperty("worldPosition", worldPosition);
    defineProperty("worldPositionStart", worldPositionStart);
    defineProperty("worldQuaternion", worldQuaternion);
    defineProperty("worldQuaternionStart", worldQuaternionStart);
    defineProperty("cameraPosition", cameraPosition);
    defineProperty("cameraQuaternion", cameraQuaternion);
    defineProperty("pointStart", pointStart);
    defineProperty("pointEnd", pointEnd);
    defineProperty("rotationAxis", rotationAxis);
    defineProperty("rotationAngle", rotationAngle);
    defineProperty("eye", eye);

    this._offset = new Vector3();
    this._startNorm = new Vector3();
    this._endNorm = new Vector3();
    this._cameraScale = new Vector3();

    this._parentPosition = new Vector3();
    this._parentQuaternion = new Quaternion();
    this._parentQuaternionInv = new Quaternion();
    this._parentScale = new Vector3();

    this._worldScaleStart = new Vector3();
    this._worldQuaternionInv = new Quaternion();
    this._worldScale = new Vector3();

    this._positionStart = new Vector3();
    this._quaternionStart = new Quaternion();
    this._scaleStart = new Vector3();

    this._getPointer = getPointer.bind(this);
    this._onPointerDown = onPointerDown.bind(this);
    this._onPointerHover = onPointerHover.bind(this);
    this._onPointerMove = onPointerMove.bind(this);
    this._onPointerUp = onPointerUp.bind(this);

    if (domElement !== null) {
      this.connect(domElement);
    }
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    this.domElement!.addEventListener("pointerdown", this._onPointerDown);
    this.domElement!.addEventListener("pointermove", this._onPointerHover);
    this.domElement!.addEventListener("pointerup", this._onPointerUp);

    this.domElement!.style.touchAction = "none"; // Disable touch scroll
  }

  override disconnect(): void {
    this.domElement!.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement!.removeEventListener("pointermove", this._onPointerHover);
    this.domElement!.removeEventListener("pointermove", this._onPointerMove);
    this.domElement!.removeEventListener("pointerup", this._onPointerUp);

    this.domElement!.style.touchAction = ""; // Restore touch scroll
  }

  /**
   * Returns the visual representation of the controls. Add the helper to your scene to
   * visually transform the attached 3D object.
   *
   * @return The helper.
   */
  getHelper(): TransformControlsRoot {
    return this._root;
  }

  pointerHover(pointer: ControlPointer | null): void {
    if (this.object === undefined || this.dragging === true) return;

    if (pointer !== null) setPointerFromCamera(pointer, this.camera);

    const intersect = intersectObjectWithRay(this._gizmo.picker[this.mode], _raycaster);

    if (intersect) {
      this.axis = intersect.object.name;
    } else {
      this.axis = null;
    }
  }

  pointerDown(pointer: ControlPointer | null): void {
    if (this.object === undefined || this.dragging === true || (pointer != null && pointer.button !== 0)) return;

    if (this.axis !== null) {
      if (pointer !== null) setPointerFromCamera(pointer, this.camera);

      const planeIntersect = intersectObjectWithRay(this._plane, _raycaster, true);

      if (planeIntersect) {
        this.object.updateMatrixWorld();
        this.object.parent!.updateMatrixWorld();

        this._positionStart.copy(this.object.position);
        this._quaternionStart.copy(this.object.quaternion);
        this._scaleStart.copy(this.object.scale);

        this.object.matrixWorld.decompose(this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart);

        this.pointStart.copy(planeIntersect.point).sub(this.worldPositionStart);
      }

      this.dragging = true;
      _mouseDownEvent.mode = this.mode;
      this.dispatchEvent(_mouseDownEvent);
    }
  }

  pointerMove(pointer: ControlPointer | null): void {
    const axis = this.axis;
    const mode = this.mode;
    const object = this.object;
    let space = this.space;

    if (mode === "scale") {
      space = "local";
    } else if (axis === "E" || axis === "XYZE" || axis === "XYZ") {
      space = "world";
    }

    if (object === undefined || axis === null || this.dragging === false || (pointer !== null && pointer.button !== -1))
      return;

    if (pointer !== null) setPointerFromCamera(pointer, this.camera);

    const planeIntersect = intersectObjectWithRay(this._plane, _raycaster, true);

    if (!planeIntersect) return;

    this.pointEnd.copy(planeIntersect.point).sub(this.worldPositionStart);

    if (mode === "translate") {
      // Apply translate

      this._offset.copy(this.pointEnd).sub(this.pointStart);

      if (space === "local" && axis !== "XYZ") {
        this._offset.applyQuaternion(this._worldQuaternionInv);
      }

      if (axis.indexOf("X") === -1) this._offset.x = 0;
      if (axis.indexOf("Y") === -1) this._offset.y = 0;
      if (axis.indexOf("Z") === -1) this._offset.z = 0;

      if (space === "local" && axis !== "XYZ") {
        this._offset.applyQuaternion(this._quaternionStart).divide(this._parentScale);
      } else {
        this._offset.applyQuaternion(this._parentQuaternionInv).divide(this._parentScale);
      }

      object.position.copy(this._offset).add(this._positionStart);

      // Apply translation snap

      if (this.translationSnap) {
        if (space === "local") {
          object.position.applyQuaternion(_tempQuaternion.copy(this._quaternionStart).invert());

          if (axis.search("X") !== -1) {
            object.position.x = Math.round(object.position.x / this.translationSnap) * this.translationSnap;
          }

          if (axis.search("Y") !== -1) {
            object.position.y = Math.round(object.position.y / this.translationSnap) * this.translationSnap;
          }

          if (axis.search("Z") !== -1) {
            object.position.z = Math.round(object.position.z / this.translationSnap) * this.translationSnap;
          }

          object.position.applyQuaternion(this._quaternionStart);
        }

        if (space === "world") {
          object.getWorldPosition(_tempVector);

          if (axis.search("X") !== -1) {
            _tempVector.x = Math.round(_tempVector.x / this.translationSnap) * this.translationSnap;
          }

          if (axis.search("Y") !== -1) {
            _tempVector.y = Math.round(_tempVector.y / this.translationSnap) * this.translationSnap;
          }

          if (axis.search("Z") !== -1) {
            _tempVector.z = Math.round(_tempVector.z / this.translationSnap) * this.translationSnap;
          }

          object.position.copy(object.parent!.worldToLocal(_tempVector));
        }
      }

      object.position.x = Math.max(this.minX, Math.min(this.maxX, object.position.x));
      object.position.y = Math.max(this.minY, Math.min(this.maxY, object.position.y));
      object.position.z = Math.max(this.minZ, Math.min(this.maxZ, object.position.z));
    } else if (mode === "scale") {
      if (axis.search("XYZ") !== -1) {
        let d = this.pointEnd.length() / this.pointStart.length();

        if (this.pointEnd.dot(this.pointStart) < 0) d *= -1;

        _tempVector2.set(d, d, d);
      } else {
        _tempVector.copy(this.pointStart);
        _tempVector2.copy(this.pointEnd);

        _tempVector.applyQuaternion(this._worldQuaternionInv);
        _tempVector2.applyQuaternion(this._worldQuaternionInv);

        _tempVector2.divide(_tempVector);

        if (axis.search("X") === -1) {
          _tempVector2.x = 1;
        }

        if (axis.search("Y") === -1) {
          _tempVector2.y = 1;
        }

        if (axis.search("Z") === -1) {
          _tempVector2.z = 1;
        }
      }

      // Apply scale
      object.scale.copy(this._scaleStart).multiply(_tempVector2);

      if (this.scaleSnap) {
        if (axis.search("X") !== -1) {
          object.scale.x = Math.round(object.scale.x / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        }

        if (axis.search("Y") !== -1) {
          object.scale.y = Math.round(object.scale.y / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        }

        if (axis.search("Z") !== -1) {
          object.scale.z = Math.round(object.scale.z / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        }
      }
    } else if (mode === "rotate") {
      this._offset.copy(this.pointEnd).sub(this.pointStart);

      const ROTATION_SPEED =
        20 / this.worldPosition.distanceTo(_tempVector.setFromMatrixPosition(this.camera.matrixWorld));

      let inPlaneRotation = false;

      if (axis === "XYZE") {
        this.rotationAxis.copy(this._offset).cross(this.eye).normalize();
        this.rotationAngle = this._offset.dot(_tempVector.copy(this.rotationAxis).cross(this.eye)) * ROTATION_SPEED;
      } else if (axis === "X" || axis === "Y" || axis === "Z") {
        this.rotationAxis.copy(_unit[axis]);

        _tempVector.copy(_unit[axis]);

        if (space === "local") {
          _tempVector.applyQuaternion(this.worldQuaternion);
        }

        _tempVector.cross(this.eye);

        // When _tempVector is 0 after cross with this.eye the vectors are parallel and should use in-plane rotation logic.
        if (_tempVector.length() === 0) {
          inPlaneRotation = true;
        } else {
          this.rotationAngle = this._offset.dot(_tempVector.normalize()) * ROTATION_SPEED;
        }
      }

      if (axis === "E" || inPlaneRotation) {
        this.rotationAxis.copy(this.eye);
        this.rotationAngle = this.pointEnd.angleTo(this.pointStart);

        this._startNorm.copy(this.pointStart).normalize();
        this._endNorm.copy(this.pointEnd).normalize();

        this.rotationAngle *= this._endNorm.cross(this._startNorm).dot(this.eye) < 0 ? 1 : -1;
      }

      // Apply rotation snap

      if (this.rotationSnap)
        this.rotationAngle = Math.round(this.rotationAngle / this.rotationSnap) * this.rotationSnap;

      // Apply rotate
      if (space === "local" && axis !== "E" && axis !== "XYZE") {
        object.quaternion.copy(this._quaternionStart);
        object.quaternion.multiply(_tempQuaternion.setFromAxisAngle(this.rotationAxis, this.rotationAngle)).normalize();
      } else {
        this.rotationAxis.applyQuaternion(this._parentQuaternionInv);
        object.quaternion.copy(_tempQuaternion.setFromAxisAngle(this.rotationAxis, this.rotationAngle));
        object.quaternion.multiply(this._quaternionStart).normalize();
      }
    }

    this.dispatchEvent(_changeEvent);
    this.dispatchEvent(_objectChangeEvent);
  }

  pointerUp(pointer: ControlPointer | null): void {
    if (pointer !== null && pointer.button !== 0) return;

    if (this.dragging && this.axis !== null) {
      _mouseUpEvent.mode = this.mode;
      this.dispatchEvent(_mouseUpEvent);
    }

    this.dragging = false;
    this.axis = null;
  }

  override dispose(): void {
    this.disconnect();

    this._root.dispose();
  }

  override update(): void {}

  /**
   * Sets the 3D object that should be transformed and ensures the controls UI is visible.
   *
   * @param object - The 3D object that should be transformed.
   * @return A reference to this controls.
   */
  attach(object: Object3D): this {
    this.object = object;
    this._root.visible = true;

    return this;
  }

  /**
   * Removes the current 3D object from the controls and makes the helper UI invisible.
   *
   * @return A reference to this controls.
   */
  detach(): this {
    this.object = undefined as unknown as Object3D;
    this.axis = null;

    this._root.visible = false;

    return this;
  }

  /**
   * Resets the object's position, rotation and scale to when the current transform began.
   */
  reset(): void {
    if (!this.enabled) return;

    if (this.dragging && this.object !== undefined) {
      this.object.position.copy(this._positionStart);
      this.object.quaternion.copy(this._quaternionStart);
      this.object.scale.copy(this._scaleStart);

      this.dispatchEvent(_changeEvent);
      this.dispatchEvent(_objectChangeEvent);

      this.pointStart.copy(this.pointEnd);
    }
  }

  /**
   * Returns the raycaster that is used for user interaction. This object is shared between all
   * instances of `TransformControls`.
   *
   * @return The internal raycaster.
   */
  getRaycaster(): Raycaster {
    return _raycaster;
  }

  /**
   * Returns the transformation mode.
   *
   * @return The transformation mode.
   */
  getMode(): "translate" | "rotate" | "scale" {
    return this.mode;
  }

  /**
   * Sets the given transformation mode.
   *
   * @param mode - The transformation mode to set.
   */
  setMode(mode: "translate" | "rotate" | "scale"): void {
    this.mode = mode;
  }

  /**
   * Sets the translation snap.
   *
   * @param translationSnap - The translation snap to set.
   */
  setTranslationSnap(translationSnap: number | null): void {
    this.translationSnap = translationSnap;
  }

  /**
   * Sets the rotation snap.
   *
   * @param rotationSnap - The rotation snap to set.
   */
  setRotationSnap(rotationSnap: number | null): void {
    this.rotationSnap = rotationSnap;
  }

  /**
   * Sets the scale snap.
   *
   * @param scaleSnap - The scale snap to set.
   */
  setScaleSnap(scaleSnap: number | null): void {
    this.scaleSnap = scaleSnap;
  }

  /**
   * Sets the size of the helper UI.
   *
   * @param size - The size to set.
   */
  setSize(size: number): void {
    this.size = size;
  }

  /**
   * Sets the coordinate space in which transformations are applied.
   *
   * @param space - The space to set.
   */
  setSpace(space: "world" | "local"): void {
    this.space = space;
  }

  /**
   * Sets the colors of the control's gizmo.
   *
   * @param xAxis - The x-axis color.
   * @param yAxis - The y-axis color.
   * @param zAxis - The z-axis color.
   * @param active - The color for active elements.
   */
  setColors(xAxis: number | string, yAxis: number | string, zAxis: number | string, active: number | string): void {
    const materialLib = this._gizmo.materialLib;

    materialLib.xAxis.color.set(xAxis);
    materialLib.yAxis.color.set(yAxis);
    materialLib.zAxis.color.set(zAxis);
    materialLib.active.color.set(active);
    materialLib.xAxisTransparent.color.set(xAxis);
    materialLib.yAxisTransparent.color.set(yAxis);
    materialLib.zAxisTransparent.color.set(zAxis);
    materialLib.activeTransparent.color.set(active);

    // update color caches

    if (materialLib.xAxis._color) materialLib.xAxis._color.set(xAxis);
    if (materialLib.yAxis._color) materialLib.yAxis._color.set(yAxis);
    if (materialLib.zAxis._color) materialLib.zAxis._color.set(zAxis);
    if (materialLib.active._color) materialLib.active._color.set(active);
    if (materialLib.xAxisTransparent._color) materialLib.xAxisTransparent._color.set(xAxis);
    if (materialLib.yAxisTransparent._color) materialLib.yAxisTransparent._color.set(yAxis);
    if (materialLib.zAxisTransparent._color) materialLib.zAxisTransparent._color.set(zAxis);
    if (materialLib.activeTransparent._color) materialLib.activeTransparent._color.set(active);
  }
}

// mouse / touch event handlers

function getPointer(this: TransformControls, event: PointerEvent): ControlPointer {
  if (this.domElement!.ownerDocument.pointerLockElement) {
    return {
      x: 0,
      y: 0,
      button: event.button,
    };
  } else {
    const rect = this.domElement!.getBoundingClientRect();
    const viewport = this.viewport;

    let originX: number;
    let originY: number;
    let regionWidth: number;
    let regionHeight: number;

    if (viewport !== null) {
      originX = viewport.x;
      originY = rect.height - viewport.y - viewport.w;
      regionWidth = viewport.z;
      regionHeight = viewport.w;
    } else {
      originX = 0;
      originY = 0;
      regionWidth = rect.width;
      regionHeight = rect.height;
    }

    return {
      x: ((event.clientX - rect.left - originX) / regionWidth) * 2 - 1,
      y: -((event.clientY - rect.top - originY) / regionHeight) * 2 + 1,
      button: event.button,
    };
  }
}

function onPointerHover(this: TransformControls, event: PointerEvent): void {
  if (!this.enabled) return;

  switch (event.pointerType) {
    case "mouse":
    case "pen":
      this.pointerHover(this._getPointer(event));
      break;
  }
}

function onPointerDown(this: TransformControls, event: PointerEvent): void {
  if (!this.enabled) return;

  if (!document.pointerLockElement) {
    this.domElement!.setPointerCapture(event.pointerId);
  }

  this.domElement!.addEventListener("pointermove", this._onPointerMove);

  this.pointerHover(this._getPointer(event));
  this.pointerDown(this._getPointer(event));
}

function onPointerMove(this: TransformControls, event: PointerEvent): void {
  if (!this.enabled) return;

  this.pointerMove(this._getPointer(event));
}

function onPointerUp(this: TransformControls, event: PointerEvent): void {
  if (!this.enabled) return;

  this.domElement!.releasePointerCapture(event.pointerId);

  this.domElement!.removeEventListener("pointermove", this._onPointerMove);

  this.pointerUp(this._getPointer(event));
}

function intersectObjectWithRay(
  object: Object3D,
  raycaster: Raycaster,
  includeInvisible: boolean = false,
): Intersection | false {
  const allIntersections = raycaster.intersectObject(object, true);

  for (let i = 0; i < allIntersections.length; i++) {
    if (allIntersections[i].object.visible || includeInvisible) {
      return allIntersections[i];
    }
  }

  return false;
}

//

// Reusable utility variables

const _tempEuler = new Euler();
const _alignVector = new Vector3(0, 1, 0);
const _zeroVector = new Vector3(0, 0, 0);
const _lookAtMatrix = new Matrix4();
const _tempQuaternion2 = new Quaternion();
const _identityQuaternion = new Quaternion();
const _dirVector = new Vector3();
const _tempMatrix = new Matrix4();

const _unitX = new Vector3(1, 0, 0);
const _unitY = new Vector3(0, 1, 0);
const _unitZ = new Vector3(0, 0, 1);

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();

/** A gizmo handle augmented with the picking tag assigned by `setupGizmo`. */
interface TaggedObject extends Object3D {
  tag: string | undefined;
  material: HighlightableMaterial;
  geometry: BufferGeometry;
}

class TransformControlsRoot extends Object3D {
  isTransformControlsRoot: boolean;

  controls: TransformControls;

  constructor(controls: TransformControls) {
    super();

    this.isTransformControlsRoot = true;

    this.controls = controls;
    this.visible = false;
  }

  // updateMatrixWorld updates key transformation variables

  override updateMatrixWorld(force?: boolean): void {
    const controls = this.controls;

    if (controls.object !== undefined) {
      const attached = controls.object;

      attached.updateMatrixWorld();

      if (attached.parent === null) {
        console.error("TransformControls: The attached 3D object must be a part of the scene graph.");
      } else {
        attached.parent.matrixWorld.decompose(
          controls._parentPosition,
          controls._parentQuaternion,
          controls._parentScale,
        );
      }

      attached.matrixWorld.decompose(controls.worldPosition, controls.worldQuaternion, controls._worldScale);

      controls._parentQuaternionInv.copy(controls._parentQuaternion).invert();
      controls._worldQuaternionInv.copy(controls.worldQuaternion).invert();
    }

    controls.camera.updateMatrixWorld();
    controls.camera.matrixWorld.decompose(controls.cameraPosition, controls.cameraQuaternion, controls._cameraScale);

    if ((controls.camera as OrthographicCamera).isOrthographicCamera) {
      (controls.camera as OrthographicCamera).getWorldDirection(controls.eye).negate();
    } else {
      controls.eye.copy(controls.cameraPosition).sub(controls.worldPosition).normalize();
    }

    // Cancel out the parent's transform so the gizmo stays world-aligned.

    if (this.parent !== null) {
      _tempMatrix.copy(this.parent.matrixWorld).invert();
      _tempMatrix.decompose(this.position, this.quaternion, this.scale);
    }

    super.updateMatrixWorld(force);
  }

  override dispose(): void {
    this.traverse((child: Object3D) => {
      const node = child as TaggedObject;
      if (node.geometry) node.geometry.dispose();
      if (node.material && typeof node.material.dispose === "function") node.material.dispose();
    });
  }
}

class TransformControlsGizmo extends Object3D {
  isTransformControlsGizmo: boolean;

  // control state mirrored from TransformControls via defineProperty
  mode: "translate" | "rotate" | "scale" = "translate";
  space: "world" | "local" = "world";
  axis: string | null = null;
  dragging: boolean = false;
  enabled: boolean = true;
  size: number = 1;
  showX: boolean = true;
  showY: boolean = true;
  showZ: boolean = true;
  showXY: boolean = true;
  showYZ: boolean = true;
  showXZ: boolean = true;
  showXYZE: boolean = true;
  showE: boolean = true;
  camera!: TransformCamera;
  object!: Object3D | undefined;
  worldPosition: Vector3 = new Vector3();
  worldPositionStart: Vector3 = new Vector3();
  worldQuaternion: Quaternion = new Quaternion();
  worldQuaternionStart: Quaternion = new Quaternion();
  cameraPosition: Vector3 = new Vector3();
  cameraQuaternion: Quaternion = new Quaternion();
  rotationAxis: Vector3 = new Vector3();
  eye: Vector3 = new Vector3();

  gizmo: Record<string, Object3D>;
  picker: Record<string, Object3D>;
  helper: Record<string, Object3D>;

  materialLib: {
    xAxis: HighlightableMaterial;
    yAxis: HighlightableMaterial;
    zAxis: HighlightableMaterial;
    active: HighlightableMaterial;
    xAxisTransparent: HighlightableMaterial;
    yAxisTransparent: HighlightableMaterial;
    zAxisTransparent: HighlightableMaterial;
    activeTransparent: HighlightableMaterial;
  };

  constructor() {
    super();

    this.isTransformControlsGizmo = true;

    this.type = "TransformControlsGizmo";

    // shared materials

    const gizmoMaterial = new MeshBasicMaterial({
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      transparent: true,
    });

    const gizmoLineMaterial = new LineBasicMaterial({
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      transparent: true,
    });

    // Make unique material for each axis/color

    const matInvisible: HighlightableMaterial = gizmoMaterial.clone();
    matInvisible.opacity = 0.15;

    const matHelper: HighlightableMaterial = gizmoLineMaterial.clone() as unknown as HighlightableMaterial;
    matHelper.opacity = 0.5;

    const matRed = gizmoMaterial.clone();
    matRed.color.setHex(0xff0000);

    const matGreen = gizmoMaterial.clone();
    matGreen.color.setHex(0x00ff00);

    const matBlue = gizmoMaterial.clone();
    matBlue.color.setHex(0x0000ff);

    const matRedTransparent = gizmoMaterial.clone();
    matRedTransparent.color.setHex(0xff0000);
    matRedTransparent.opacity = 0.5;

    const matGreenTransparent = gizmoMaterial.clone();
    matGreenTransparent.color.setHex(0x00ff00);
    matGreenTransparent.opacity = 0.5;

    const matBlueTransparent = gizmoMaterial.clone();
    matBlueTransparent.color.setHex(0x0000ff);
    matBlueTransparent.opacity = 0.5;

    const matWhiteTransparent = gizmoMaterial.clone();
    matWhiteTransparent.opacity = 0.25;

    const matYellowTransparent = gizmoMaterial.clone();
    matYellowTransparent.color.setHex(0xffff00);
    matYellowTransparent.opacity = 0.25;

    const matYellow = gizmoMaterial.clone();
    matYellow.color.setHex(0xffff00);

    const matGray = gizmoMaterial.clone();
    matGray.color.setHex(0x787878);

    // materials in the below property are configurable via setColors()

    this.materialLib = {
      xAxis: matRed,
      yAxis: matGreen,
      zAxis: matBlue,
      active: matYellow,
      xAxisTransparent: matRedTransparent,
      yAxisTransparent: matGreenTransparent,
      zAxisTransparent: matBlueTransparent,
      activeTransparent: matYellowTransparent,
    };

    // reusable geometry

    const arrowGeometry = new CylinderGeometry(0, 0.04, 0.1, 12);
    arrowGeometry.translate(0, 0.05, 0);

    const scaleHandleGeometry = new BoxGeometry(0.08, 0.08, 0.08);
    scaleHandleGeometry.translate(0, 0.04, 0);

    const lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));

    const lineGeometry2 = new CylinderGeometry(0.0075, 0.0075, 0.5, 3);
    lineGeometry2.translate(0, 0.25, 0);

    function CircleGeometry(radius: number, arc: number): TorusGeometry {
      const geometry = new TorusGeometry(radius, 0.0075, 3, 64, arc * Math.PI * 2);
      geometry.rotateY(Math.PI / 2);
      geometry.rotateX(Math.PI / 2);
      return geometry;
    }

    // Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position

    function TranslateHelperGeometry(): BufferGeometry {
      const geometry = new BufferGeometry();

      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3));

      return geometry;
    }

    // Gizmo definitions - custom hierarchy definitions for setupGizmo() function

    const gizmoTranslate: GizmoMap = {
      X: [
        [new Mesh(arrowGeometry, matRed), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
        [new Mesh(arrowGeometry, matRed), [-0.5, 0, 0], [0, 0, Math.PI / 2]],
        [new Mesh(lineGeometry2, matRed), [0, 0, 0], [0, 0, -Math.PI / 2]],
      ],
      Y: [
        [new Mesh(arrowGeometry, matGreen), [0, 0.5, 0]],
        [new Mesh(arrowGeometry, matGreen), [0, -0.5, 0], [Math.PI, 0, 0]],
        [new Mesh(lineGeometry2, matGreen)],
      ],
      Z: [
        [new Mesh(arrowGeometry, matBlue), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
        [new Mesh(arrowGeometry, matBlue), [0, 0, -0.5], [-Math.PI / 2, 0, 0]],
        [new Mesh(lineGeometry2, matBlue), [0, 0, 0], [Math.PI / 2, 0, 0]],
      ],
      XYZ: [[new Mesh(new OctahedronGeometry(0.1, 0), matWhiteTransparent), [0, 0, 0]]],
      XY: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matBlueTransparent), [0.15, 0.15, 0]]],
      YZ: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matRedTransparent), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
      XZ: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matGreenTransparent), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
    };

    const pickerTranslate: GizmoMap = {
      X: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0.3, 0, 0], [0, 0, -Math.PI / 2]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [-0.3, 0, 0], [0, 0, Math.PI / 2]],
      ],
      Y: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0.3, 0]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, -0.3, 0], [0, 0, Math.PI]],
      ],
      Z: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0, 0.3], [Math.PI / 2, 0, 0]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0, -0.3], [-Math.PI / 2, 0, 0]],
      ],
      XYZ: [[new Mesh(new OctahedronGeometry(0.2, 0), matInvisible)]],
      XY: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0.15, 0.15, 0]]],
      YZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
      XZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
    };

    const helperTranslate: GizmoMap = {
      START: [[new Mesh(new OctahedronGeometry(0.01, 2), matHelper), [0, 0, 0], [0, 0, 0], [1, 1, 1], "helper"]],
      END: [[new Mesh(new OctahedronGeometry(0.01, 2), matHelper), [0, 0, 0], [0, 0, 0], [1, 1, 1], "helper"]],
      DELTA: [[new Line(TranslateHelperGeometry(), matHelper), [0, 0, 0], [0, 0, 0], [1, 1, 1], "helper"]],
      X: [[new Line(lineGeometry, matHelper), [-1e3, 0, 0], [0, 0, 0], [1e6, 1, 1], "helper"]],
      Y: [[new Line(lineGeometry, matHelper), [0, -1e3, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], "helper"]],
      Z: [[new Line(lineGeometry, matHelper), [0, 0, -1e3], [0, -Math.PI / 2, 0], [1e6, 1, 1], "helper"]],
    };

    const gizmoRotate: GizmoMap = {
      XYZE: [[new Mesh(CircleGeometry(0.5, 1), matGray), [0, 0, 0], [0, Math.PI / 2, 0]]],
      X: [[new Mesh(CircleGeometry(0.5, 0.5), matRed), [0, 0, 0], [0, 0, 0]]],
      Y: [[new Mesh(CircleGeometry(0.5, 0.5), matGreen), [0, 0, 0], [0, 0, -Math.PI / 2]]],
      Z: [[new Mesh(CircleGeometry(0.5, 0.5), matBlue), [0, 0, 0], [0, Math.PI / 2, 0]]],
      E: [[new Mesh(CircleGeometry(0.75, 1), matYellowTransparent), [0, 0, 0], [0, Math.PI / 2, 0]]],
    };

    const helperRotate: GizmoMap = {
      AXIS: [[new Line(lineGeometry, matHelper), [-1e3, 0, 0], [0, 0, 0], [1e6, 1, 1], "helper"]],
    };

    const pickerRotate: GizmoMap = {
      XYZE: [[new Mesh(new SphereGeometry(0.25, 10, 8), matInvisible), [0, 0, 0], [0, 0, 0]]],
      X: [[new Mesh(new TorusGeometry(0.5, 0.1, 4, 24), matInvisible), [0, 0, 0], [0, -Math.PI / 2, -Math.PI / 2]]],
      Y: [[new Mesh(new TorusGeometry(0.5, 0.1, 4, 24), matInvisible), [0, 0, 0], [Math.PI / 2, 0, 0]]],
      Z: [[new Mesh(new TorusGeometry(0.5, 0.1, 4, 24), matInvisible), [0, 0, 0], [0, 0, -Math.PI / 2]]],
      E: [[new Mesh(new TorusGeometry(0.75, 0.1, 2, 24), matInvisible), [0, 0, 0], [0, 0, 0]]],
    };

    const gizmoScale: GizmoMap = {
      X: [
        [new Mesh(scaleHandleGeometry, matRed), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
        [new Mesh(lineGeometry2, matRed), [0, 0, 0], [0, 0, -Math.PI / 2]],
        [new Mesh(scaleHandleGeometry, matRed), [-0.5, 0, 0], [0, 0, Math.PI / 2]],
      ],
      Y: [
        [new Mesh(scaleHandleGeometry, matGreen), [0, 0.5, 0]],
        [new Mesh(lineGeometry2, matGreen)],
        [new Mesh(scaleHandleGeometry, matGreen), [0, -0.5, 0], [0, 0, Math.PI]],
      ],
      Z: [
        [new Mesh(scaleHandleGeometry, matBlue), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
        [new Mesh(lineGeometry2, matBlue), [0, 0, 0], [Math.PI / 2, 0, 0]],
        [new Mesh(scaleHandleGeometry, matBlue), [0, 0, -0.5], [-Math.PI / 2, 0, 0]],
      ],
      XY: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matBlueTransparent), [0.15, 0.15, 0]]],
      YZ: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matRedTransparent), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
      XZ: [[new Mesh(new BoxGeometry(0.15, 0.15, 0.01), matGreenTransparent), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
      XYZ: [[new Mesh(new BoxGeometry(0.1, 0.1, 0.1), matWhiteTransparent), [0, 0, 0]]],
    };

    const pickerScale: GizmoMap = {
      X: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0.3, 0, 0], [0, 0, -Math.PI / 2]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [-0.3, 0, 0], [0, 0, Math.PI / 2]],
      ],
      Y: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0.3, 0]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, -0.3, 0], [0, 0, Math.PI]],
      ],
      Z: [
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0, 0.3], [Math.PI / 2, 0, 0]],
        [new Mesh(new CylinderGeometry(0.2, 0, 0.6, 4), matInvisible), [0, 0, -0.3], [-Math.PI / 2, 0, 0]],
      ],
      XY: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0.15, 0.15, 0]]],
      YZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
      XZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.01), matInvisible), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
      XYZ: [[new Mesh(new BoxGeometry(0.2, 0.2, 0.2), matInvisible), [0, 0, 0]]],
    };

    const helperScale: GizmoMap = {
      X: [[new Line(lineGeometry, matHelper), [-1e3, 0, 0], [0, 0, 0], [1e6, 1, 1], "helper"]],
      Y: [[new Line(lineGeometry, matHelper), [0, -1e3, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], "helper"]],
      Z: [[new Line(lineGeometry, matHelper), [0, 0, -1e3], [0, -Math.PI / 2, 0], [1e6, 1, 1], "helper"]],
    };

    // Creates an Object3D with gizmos described in custom hierarchy definition.

    function setupGizmo(gizmoMap: GizmoMap): Object3D {
      const root = new Object3D();

      for (const name in gizmoMap) {
        for (let i = gizmoMap[name].length; i--;) {
          const entry = gizmoMap[name][i];
          const object = entry[0].clone() as TaggedObject;
          const position = entry[1];
          const rotation = entry[2];
          const scale = entry[3];
          const tag = entry[4];

          // name and tag properties are essential for picking and updating logic.
          object.name = name;
          object.tag = tag;

          if (position) {
            object.position.set(position[0], position[1], position[2]);
          }

          if (rotation) {
            object.rotation.set(rotation[0], rotation[1], rotation[2]);
          }

          if (scale) {
            object.scale.set(scale[0], scale[1], scale[2]);
          }

          object.updateMatrix();

          const tempGeometry = object.geometry.clone();
          tempGeometry.applyMatrix4(object.matrix);
          object.geometry = tempGeometry;
          object.renderOrder = Infinity;

          object.position.set(0, 0, 0);
          object.rotation.set(0, 0, 0);
          object.scale.set(1, 1, 1);

          root.add(object);
        }
      }

      return root;
    }

    // Gizmo creation

    this.gizmo = {};
    this.picker = {};
    this.helper = {};

    this.add((this.gizmo["translate"] = setupGizmo(gizmoTranslate)));
    this.add((this.gizmo["rotate"] = setupGizmo(gizmoRotate)));
    this.add((this.gizmo["scale"] = setupGizmo(gizmoScale)));
    this.add((this.picker["translate"] = setupGizmo(pickerTranslate)));
    this.add((this.picker["rotate"] = setupGizmo(pickerRotate)));
    this.add((this.picker["scale"] = setupGizmo(pickerScale)));
    this.add((this.helper["translate"] = setupGizmo(helperTranslate)));
    this.add((this.helper["rotate"] = setupGizmo(helperRotate)));
    this.add((this.helper["scale"] = setupGizmo(helperScale)));

    // Pickers should be hidden always

    this.picker["translate"].visible = false;
    this.picker["rotate"].visible = false;
    this.picker["scale"].visible = false;
  }

  // updateMatrixWorld will update transformations and appearance of individual handles

  override updateMatrixWorld(force?: boolean): void {
    const space = this.mode === "scale" ? "local" : this.space; // scale always oriented to local rotation

    const quaternion = space === "local" ? this.worldQuaternion : _identityQuaternion;

    // Show only gizmos for current transform mode

    this.gizmo["translate"].visible = this.mode === "translate";
    this.gizmo["rotate"].visible = this.mode === "rotate";
    this.gizmo["scale"].visible = this.mode === "scale";

    this.helper["translate"].visible = this.mode === "translate";
    this.helper["rotate"].visible = this.mode === "rotate";
    this.helper["scale"].visible = this.mode === "scale";

    const handles: Object3D[] = [];
    handles.push(...this.picker[this.mode].children);
    handles.push(...this.gizmo[this.mode].children);
    handles.push(...this.helper[this.mode].children);

    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i] as TaggedObject;

      // hide aligned to camera

      handle.visible = true;
      handle.rotation.set(0, 0, 0);
      handle.position.copy(this.worldPosition);

      let factor: number;

      if ((this.camera as OrthographicCamera).isOrthographicCamera) {
        const ortho = this.camera as OrthographicCamera;
        factor = (ortho.top - ortho.bottom) / ortho.zoom;
      } else {
        const perspective = this.camera as PerspectiveCamera;
        factor =
          this.worldPosition.distanceTo(this.cameraPosition) *
          Math.min((1.9 * Math.tan((Math.PI * perspective.fov) / 360)) / perspective.zoom, 7);
      }

      handle.scale.set(1, 1, 1).multiplyScalar((factor * this.size) / 4);

      // TODO: simplify helpers and consider decoupling from gizmo (upstream note)

      if (handle.tag === "helper") {
        handle.visible = false;

        if (handle.name === "AXIS") {
          handle.visible = !!this.axis;

          if (this.axis === "X") {
            _tempQuaternion.setFromEuler(_tempEuler.set(0, 0, 0));
            handle.quaternion.copy(quaternion).multiply(_tempQuaternion);

            if (Math.abs(_alignVector.copy(_unitX).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
              handle.visible = false;
            }
          }

          if (this.axis === "Y") {
            _tempQuaternion.setFromEuler(_tempEuler.set(0, 0, Math.PI / 2));
            handle.quaternion.copy(quaternion).multiply(_tempQuaternion);

            if (Math.abs(_alignVector.copy(_unitY).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
              handle.visible = false;
            }
          }

          if (this.axis === "Z") {
            _tempQuaternion.setFromEuler(_tempEuler.set(0, Math.PI / 2, 0));
            handle.quaternion.copy(quaternion).multiply(_tempQuaternion);

            if (Math.abs(_alignVector.copy(_unitZ).applyQuaternion(quaternion).dot(this.eye)) > 0.9) {
              handle.visible = false;
            }
          }

          if (this.axis === "XYZE") {
            _tempQuaternion.setFromEuler(_tempEuler.set(0, Math.PI / 2, 0));
            _alignVector.copy(this.rotationAxis);
            handle.quaternion.setFromRotationMatrix(_lookAtMatrix.lookAt(_zeroVector, _alignVector, _unitY));
            handle.quaternion.multiply(_tempQuaternion);
            handle.visible = this.dragging;
          }

          if (this.axis === "E") {
            handle.visible = false;
          }
        } else if (handle.name === "START") {
          handle.position.copy(this.worldPositionStart);
          handle.visible = this.dragging;
        } else if (handle.name === "END") {
          handle.position.copy(this.worldPosition);
          handle.visible = this.dragging;
        } else if (handle.name === "DELTA") {
          handle.position.copy(this.worldPositionStart);
          handle.quaternion.copy(this.worldQuaternionStart);
          _tempVector.set(1e-10, 1e-10, 1e-10).add(this.worldPositionStart).sub(this.worldPosition).multiplyScalar(-1);
          _tempVector.applyQuaternion(this.worldQuaternionStart.clone().invert());
          handle.scale.copy(_tempVector);
          handle.visible = this.dragging;
        } else {
          handle.quaternion.copy(quaternion);

          if (this.dragging) {
            handle.position.copy(this.worldPositionStart);
          } else {
            handle.position.copy(this.worldPosition);
          }

          if (this.axis) {
            handle.visible = this.axis.search(handle.name) !== -1;
          }
        }

        // If updating helper, skip rest of the loop
        continue;
      }

      // Align handles to current local or world rotation

      handle.quaternion.copy(quaternion);

      if (this.mode === "translate" || this.mode === "scale") {
        // Hide translate and scale axis facing the camera

        const AXIS_HIDE_THRESHOLD = 0.99;
        const PLANE_HIDE_THRESHOLD = 0.2;

        if (handle.name === "X") {
          if (Math.abs(_alignVector.copy(_unitX).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        if (handle.name === "Y") {
          if (Math.abs(_alignVector.copy(_unitY).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        if (handle.name === "Z") {
          if (Math.abs(_alignVector.copy(_unitZ).applyQuaternion(quaternion).dot(this.eye)) > AXIS_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        if (handle.name === "XY") {
          if (Math.abs(_alignVector.copy(_unitZ).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        if (handle.name === "YZ") {
          if (Math.abs(_alignVector.copy(_unitX).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }

        if (handle.name === "XZ") {
          if (Math.abs(_alignVector.copy(_unitY).applyQuaternion(quaternion).dot(this.eye)) < PLANE_HIDE_THRESHOLD) {
            handle.scale.set(1e-10, 1e-10, 1e-10);
            handle.visible = false;
          }
        }
      } else if (this.mode === "rotate") {
        // Align handles to current local or world rotation

        _tempQuaternion2.copy(quaternion);
        _alignVector.copy(this.eye).applyQuaternion(_tempQuaternion.copy(quaternion).invert());

        if (handle.name.search("E") !== -1) {
          handle.quaternion.setFromRotationMatrix(_lookAtMatrix.lookAt(this.eye, _zeroVector, _unitY));
        }

        if (handle.name === "X") {
          _tempQuaternion.setFromAxisAngle(_unitX, Math.atan2(-_alignVector.y, _alignVector.z));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }

        if (handle.name === "Y") {
          _tempQuaternion.setFromAxisAngle(_unitY, Math.atan2(_alignVector.x, _alignVector.z));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }

        if (handle.name === "Z") {
          _tempQuaternion.setFromAxisAngle(_unitZ, Math.atan2(_alignVector.y, _alignVector.x));
          _tempQuaternion.multiplyQuaternions(_tempQuaternion2, _tempQuaternion);
          handle.quaternion.copy(_tempQuaternion);
        }
      }

      // Hide disabled axes
      handle.visible =
        handle.visible &&
        (handle.name.indexOf("X") === -1 || this.showX) &&
        (handle.name.indexOf("Y") === -1 || this.showY) &&
        (handle.name.indexOf("Z") === -1 || this.showZ) &&
        (handle.name.indexOf("E") === -1 || (this.showX && this.showY && this.showZ));

      // Hide disabled plane helpers
      handle.visible =
        handle.visible &&
        (handle.name.indexOf("XY") === -1 || this.showXY) &&
        (handle.name.indexOf("YZ") === -1 || this.showYZ) &&
        (handle.name.indexOf("XZ") === -1 || this.showXZ);

      // Hide disabled rotation helpers
      handle.visible = handle.visible && (handle.name !== "E" || this.showE);
      handle.visible = handle.visible && (handle.name !== "XYZE" || this.showXYZE);

      // highlight selected axis
      // Upstream caches lazily: `_color = _color || color.clone()` covers unset (undefined) and null.

      if (handle.material._color == null) {
        handle.material._color = handle.material.color.clone();
      }
      if (handle.material._opacity == null) {
        handle.material._opacity = handle.material.opacity;
      }
      const baseColor = handle.material._color;
      const baseOpacity = handle.material._opacity;

      handle.material.color.copy(baseColor!);
      handle.material.opacity = baseOpacity!;

      if (this.enabled && this.axis) {
        if (handle.name === this.axis) {
          handle.material.color.copy(this.materialLib.active.color);
          handle.material.opacity = 1.0;
        } else if (this.axis.split("").some((a) => handle.name === a)) {
          handle.material.color.copy(this.materialLib.active.color);
          handle.material.opacity = 1.0;
        }
      }
    }

    super.updateMatrixWorld(force);
  }
}

class TransformControlsPlane extends Mesh<MeshBasicMaterial> {
  isTransformControlsPlane: boolean;

  // control state mirrored from TransformControls via defineProperty
  mode: "translate" | "rotate" | "scale" = "translate";
  space: "world" | "local" = "world";
  axis: string | null = null;
  worldPosition: Vector3 = new Vector3();
  worldQuaternion: Quaternion = new Quaternion();
  cameraQuaternion: Quaternion = new Quaternion();
  eye: Vector3 = new Vector3();

  constructor() {
    super(
      new PlaneGeometry(100000, 100000, 2, 2),
      new MeshBasicMaterial({
        visible: false,
        wireframe: true,
        side: DoubleSide,
        transparent: true,
        opacity: 0.1,
        toneMapped: false,
      }),
    );

    this.isTransformControlsPlane = true;

    this.type = "TransformControlsPlane";
  }

  override updateMatrixWorld(force?: boolean): void {
    let space: "world" | "local" = this.space;

    this.position.copy(this.worldPosition);

    if (this.mode === "scale") space = "local"; // scale always oriented to local rotation

    _v1.copy(_unitX).applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);
    _v2.copy(_unitY).applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);
    _v3.copy(_unitZ).applyQuaternion(space === "local" ? this.worldQuaternion : _identityQuaternion);

    // Align the plane for current transform mode, axis and space.

    _alignVector.copy(_v2);

    switch (this.mode) {
      case "translate":
      case "scale":
        switch (this.axis) {
          case "X":
            _alignVector.copy(this.eye).cross(_v1);
            _dirVector.copy(_v1).cross(_alignVector);
            break;
          case "Y":
            _alignVector.copy(this.eye).cross(_v2);
            _dirVector.copy(_v2).cross(_alignVector);
            break;
          case "Z":
            _alignVector.copy(this.eye).cross(_v3);
            _dirVector.copy(_v3).cross(_alignVector);
            break;
          case "XY":
            _dirVector.copy(_v3);
            break;
          case "YZ":
            _dirVector.copy(_v1);
            break;
          case "XZ":
            _alignVector.copy(_v3);
            _dirVector.copy(_v2);
            break;
          case "XYZ":
          case "E":
            _dirVector.set(0, 0, 0);
            break;
        }

        break;
      case "rotate":
      default:
        // special case for rotate
        _dirVector.set(0, 0, 0);
    }

    if (_dirVector.length() === 0) {
      // If in rotate mode, make the plane parallel to camera
      this.quaternion.copy(this.cameraQuaternion);
    } else {
      _tempMatrix.lookAt(_tempVector.set(0, 0, 0), _dirVector, _alignVector);

      this.quaternion.setFromRotationMatrix(_tempMatrix);
    }

    super.updateMatrixWorld(force);
  }
}
