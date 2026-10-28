import { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { BufferGeometry } from "../../core/BufferGeometry";
import { Raycaster } from "../../core/Raycaster";
import { Controls } from "../../extras/Controls";
import { EllipseCurve } from "../../extras/curves/EllipseCurve";
import { GridHelper } from "../../helpers/GridHelper";
import { DEG2RAD, RAD2DEG } from "../../math/MathUtils";
import { clamp } from "../../math/MathUtils";
import { Box3 } from "../../math/Box3";
import { Sphere } from "../../math/Sphere";
import { Matrix4 } from "../../math/Matrix4";
import { Quaternion } from "../../math/Quaternion";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import { Line } from "../../objects/Line";
import { LineBasicMaterial } from "../../materials/LineBasicMaterial";
import { Group } from "../../objects/Group";
import type { Scene } from "../../scenes/Scene";

//trackball state
const STATE = {
  IDLE: Symbol(),
  ROTATE: Symbol(),
  PAN: Symbol(),
  SCALE: Symbol(),
  FOV: Symbol(),
  FOCUS: Symbol(),
  ZROTATE: Symbol(),
  TOUCH_MULTI: Symbol(),
  ANIMATION_FOCUS: Symbol(),
  ANIMATION_ROTATE: Symbol(),
};

const INPUT = {
  NONE: Symbol(),
  ONE_FINGER: Symbol(),
  ONE_FINGER_SWITCHED: Symbol(),
  TWO_FINGER: Symbol(),
  MULT_FINGER: Symbol(),
  CURSOR: Symbol(),
};

//cursor center coordinates
const _center = {
  x: 0,
  y: 0,
};

//transformation matrices for gizmos and camera
const _transformation: { camera: Matrix4 | null; gizmos: Matrix4 | null } = {
  camera: new Matrix4(),
  gizmos: new Matrix4(),
};

/**
 * Fires when the camera has been transformed by the controls.
 */
const _changeEvent = { type: "change" };

/**
 * Fires when an interaction was initiated.
 */
const _startEvent = { type: "start" };

/**
 * Fires when an interaction has finished.
 */
const _endEvent = { type: "end" };

const _raycaster = new Raycaster();
const _offset = new Vector3();

const _gizmoMatrixStateTemp = new Matrix4();
const _cameraMatrixStateTemp = new Matrix4();
const _scalePointTemp = new Vector3();

const _EPS = 0.000001;

/** The camera types supported by {@link ArcballControls}. */
type ArcballCamera = PerspectiveCamera | OrthographicCamera;

/** Duck-typed camera surface mirroring upstream's flag usage. */
interface CameraUnion {
  isPerspectiveCamera?: boolean | undefined;
  isOrthographicCamera?: boolean | undefined;
}

/** A mouse action binding: an operation and the pointer/key combination that triggers it. */
interface ArcballMouseAction {
  operation: "PAN" | "ROTATE" | "ZOOM" | "FOV";
  mouse: number | "WHEEL";
  key: "CTRL" | "SHIFT" | null;
  state: symbol;
}

/** A transformation pair applied to the camera and the gizmos. */
interface ArcballTransformation {
  camera: Matrix4 | null;
  gizmos: Matrix4 | null;
}

/**
 * Arcball controls allow the camera to be controlled by a virtual trackball with full touch support and advanced navigation functionality.
 * Cursor/finger positions and movements are mapped over a virtual trackball surface represented by a gizmo and mapped in intuitive and
 * consistent camera movements. Dragging cursor/fingers will cause camera to orbit around the center of the trackball in a conservative
 * way (returning to the starting point will make the camera return to its starting orientation).
 *
 * In addition to supporting pan, zoom and pinch gestures, double clicking/tapping focuses on a point, intuitively moving the object's
 * point of interest to the center of the virtual trackball. Focus allows a much better inspection and navigation in complex environment.
 * Moreover Arcball controls allow FOV manipulation (in a vertigo-style method) and z-rotation. Saving and restoring of Camera State
 * is supported also through clipboard (use ctrl+c and ctrl+v shortcuts for copy and paste the state).
 *
 * Unlike {@link OrbitControls} and {@link TrackballControls}, `ArcballControls` doesn't require `update()` to be called externally in an
 * animation loop when animations are on.
 *
 * @augments Controls
 */
export class ArcballControls<TObject extends ArcballCamera = ArcballCamera> extends Controls<TObject> {
  /**
   * The scene rendered by the camera. If not given, gizmos cannot be shown.
   *
   * @default null
   */
  scene: Scene | null;

  /**
   * The control's focus point.
   */
  target: Vector3;
  _currentTarget: Vector3;

  /**
   * The size of the gizmo relative to the screen width and height.
   *
   * @default 0.67
   */
  radiusFactor: number;

  /**
   * Holds the mouse actions of this controls. This property is maintained by the methods
   * `setMouseAction()` and `unsetMouseAction()`.
   */
  mouseActions: ArcballMouseAction[];
  _mouseOp: "PAN" | "ROTATE" | "ZOOM" | "FOV" | null;

  //global vectors and matrices that are used in some operations to avoid creating new objects every time (e.g. every time cursor moves)
  _v2_1: Vector2;
  _v3_1: Vector3;
  _v3_2: Vector3;

  _m4_1: Matrix4;
  _m4_2: Matrix4;

  _quat: Quaternion;

  //transformation matrices
  _translationMatrix: Matrix4;
  _rotationMatrix: Matrix4;
  _scaleMatrix: Matrix4;

  _rotationAxis: Vector3;

  //camera state
  _cameraMatrixState: Matrix4;
  _cameraProjectionState: Matrix4;

  _fovState: number;
  _upState: Vector3;
  _zoomState: number;
  _nearPos: number;
  _farPos: number;

  _gizmoMatrixState: Matrix4;

  //initial values
  _up0: Vector3;
  _zoom0: number;
  _fov0: number;
  _initialNear: number;
  _nearPos0: number;
  _initialFar: number;
  _farPos0: number;
  _cameraMatrixState0: Matrix4;
  _gizmoMatrixState0: Matrix4;
  _target0: Vector3;

  //pointers array
  _button: number;
  _touchStart: PointerEvent[];
  _touchCurrent: PointerEvent[];
  _input: symbol;

  //two fingers touch interaction
  _switchSensibility: number;
  _startFingerDistance: number;
  _currentFingerDistance: number;
  _startFingerRotation: number;
  _currentFingerRotation: number;

  //double tap
  _devPxRatio: number;
  _downValid: boolean;
  _nclicks: number;
  _downEvents: PointerEvent[];
  _downStart: number;
  _clickStart: number;
  _maxDownTime: number;
  _maxInterval: number;
  _posThreshold: number;
  _movementThreshold: number;

  //cursor positions
  _currentCursorPosition: Vector3;
  _startCursorPosition: Vector3;

  //grid
  _grid: GridHelper | null;
  _gridPosition: Vector3;

  //gizmos
  _gizmos: Group;
  _curvePts: number;

  //animations
  _timeStart: number;
  _animationId: number;

  /**
   * Duration of focus animations in ms.
   *
   * @default 500
   */
  focusAnimationTime: number;

  //rotate animation
  _timePrev: number;
  _timeCurrent: number;
  _anglePrev: number;
  _angleCurrent: number;
  _cursorPosPrev: Vector3;
  _cursorPosCurr: Vector3;
  _wPrev: number;
  _wCurr: number;

  /**
   * If set to `true`, the camera's near and far values will be adjusted every time zoom is
   * performed trying to maintain the same visible portion given by initial near and far
   * values. Only works with perspective cameras.
   *
   * This feature only works as expected if the camera's initial state (position, near and far values)
   * is correctly configured before creating the controls. Otherwise {@link ArcballControls#setCamera}
   * must be called by the application.
   *
   * @default false
   */
  adjustNearFar: boolean;

  /**
   * The scaling factor used when performing zoom operation.
   *
   * @default 1.1
   */
  scaleFactor: number;

  /**
   * The damping inertia used if 'enableAnimations` is set to `true`.
   *
   * @default 25
   */
  dampingFactor: number;

  /**
   * Maximum angular velocity allowed on rotation animation start.
   *
   * @default 20
   */
  wMax: number;

  /**
   * Set to `true` to enable animations for rotation (damping) and focus operation.
   *
   * @default true
   */
  enableAnimations: boolean;

  /**
   * If set to `true`, a grid will appear when panning operation is being performed
   * (desktop interaction only).
   *
   * @default false
   */
  enableGrid: boolean;

  /**
   * Set to `true` to make zoom become cursor centered.
   *
   * @default false
   */
  cursorZoom: boolean;

  /**
   * The minimum FOV in degrees.
   *
   * @default 5
   */
  minFov: number;

  /**
   * The maximum FOV in degrees.
   *
   * @default 90
   */
  maxFov: number;

  /**
   * Speed of rotation.
   *
   * @default 1
   */
  rotateSpeed: number;

  /**
   * Enable or disable camera panning.
   *
   * @default true
   */
  enablePan: boolean;

  /**
   * Enable or disable camera rotation.
   *
   * @default true
   */
  enableRotate: boolean;

  /**
   * Enable or disable camera zoom.
   *
   * @default true
   */
  enableZoom: boolean;

  /**
   * Enable or disable gizmos.
   *
   * @default true
   */
  enableGizmos: boolean;

  /**
   * Enable or disable camera focusing on double-tap (or click) operations.
   *
   * @default true
   */
  enableFocus: boolean;

  /**
   * How far you can dolly in. For perspective cameras only.
   *
   * @default 0
   */
  minDistance: number;

  /**
   * How far you can dolly out. For perspective cameras only.
   *
   * @default Infinity
   */
  maxDistance: number;

  /**
   * How far you can zoom in. For orthographic cameras only.
   *
   * @default 0
   */
  minZoom: number;

  /**
   * How far you can zoom out. For orthographic cameras only.
   *
   * @default Infinity
   */
  maxZoom: number;

  //trackball parameters
  _tbRadius: number;

  //FSA
  _state: symbol;

  _onContextMenu: (event: Event) => void;
  _onWheel: (event: WheelEvent) => void;
  _onPointerUp: (event: PointerEvent) => void;
  _onPointerMove: (event: PointerEvent) => void;
  _onPointerDown: (event: PointerEvent) => void;
  _onPointerCancel: () => void;
  _onWindowResize: () => void;

  /**
   * Constructs a new controls instance.
   *
   * @param camera - The camera to be controlled. The camera must not be a child of another object, unless that object is the scene itself.
   * @param domElement - The HTML element used for event listeners.
   * @param scene - The scene rendered by the camera. If not given, gizmos cannot be shown.
   */
  constructor(camera: TObject, domElement: HTMLElement | null = null, scene: Scene | null = null) {
    super(camera, domElement);

    this.scene = scene;

    this.target = new Vector3();
    this._currentTarget = new Vector3();

    this.radiusFactor = 0.67;

    this.mouseActions = [];
    this._mouseOp = null;

    this._v2_1 = new Vector2();
    this._v3_1 = new Vector3();
    this._v3_2 = new Vector3();

    this._m4_1 = new Matrix4();
    this._m4_2 = new Matrix4();

    this._quat = new Quaternion();

    this._translationMatrix = new Matrix4();
    this._rotationMatrix = new Matrix4();
    this._scaleMatrix = new Matrix4();

    this._rotationAxis = new Vector3();

    this._cameraMatrixState = new Matrix4();
    this._cameraProjectionState = new Matrix4();

    this._fovState = 1;
    this._upState = new Vector3();
    this._zoomState = 1;
    this._nearPos = 0;
    this._farPos = 0;

    this._gizmoMatrixState = new Matrix4();

    this._up0 = new Vector3();
    this._zoom0 = 1;
    this._fov0 = 0;
    this._initialNear = 0;
    this._nearPos0 = 0;
    this._initialFar = 0;
    this._farPos0 = 0;
    this._cameraMatrixState0 = new Matrix4();
    this._gizmoMatrixState0 = new Matrix4();
    this._target0 = new Vector3();

    this._button = -1;
    this._touchStart = [];
    this._touchCurrent = [];
    this._input = INPUT.NONE;

    this._switchSensibility = 32;
    this._startFingerDistance = 0;
    this._currentFingerDistance = 0;
    this._startFingerRotation = 0;
    this._currentFingerRotation = 0;

    this._devPxRatio = 0;
    this._downValid = true;
    this._nclicks = 0;
    this._downEvents = [];
    this._downStart = 0;
    this._clickStart = 0;
    this._maxDownTime = 250;
    this._maxInterval = 300;
    this._posThreshold = 24;
    this._movementThreshold = 24;

    this._currentCursorPosition = new Vector3();
    this._startCursorPosition = new Vector3();

    this._grid = null;
    this._gridPosition = new Vector3();

    this._gizmos = new Group();
    this._curvePts = 128;

    this._timeStart = -1;
    this._animationId = -1;

    this.focusAnimationTime = 500;

    this._timePrev = 0;
    this._timeCurrent = 0;
    this._anglePrev = 0;
    this._angleCurrent = 0;
    this._cursorPosPrev = new Vector3();
    this._cursorPosCurr = new Vector3();
    this._wPrev = 0;
    this._wCurr = 0;

    this.adjustNearFar = false;
    this.scaleFactor = 1.1;
    this.dampingFactor = 25;
    this.wMax = 20;
    this.enableAnimations = true;
    this.enableGrid = false;
    this.cursorZoom = false;
    this.minFov = 5;
    this.maxFov = 90;
    this.rotateSpeed = 1;
    this.enablePan = true;
    this.enableRotate = true;
    this.enableZoom = true;
    this.enableGizmos = true;
    this.enableFocus = true;
    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.minZoom = 0;
    this.maxZoom = Infinity;

    this._tbRadius = 1;

    this._state = STATE.IDLE;

    this.setCamera(camera);

    if (this.scene != null) {
      this.scene.add(this._gizmos);
    }

    this.initializeMouseActions();

    this._onContextMenu = onContextMenu.bind(this);
    this._onWheel = onWheel.bind(this);
    this._onPointerUp = onPointerUp.bind(this);
    this._onPointerMove = onPointerMove.bind(this);
    this._onPointerDown = onPointerDown.bind(this);
    this._onPointerCancel = onPointerCancel.bind(this);
    this._onWindowResize = onWindowResize.bind(this);

    if (domElement !== null) {
      this.connect(domElement);
    }
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    this._devPxRatio = window.devicePixelRatio;

    this.domElement!.addEventListener("contextmenu", this._onContextMenu);
    this.domElement!.addEventListener("wheel", this._onWheel, { passive: false });
    this.domElement!.addEventListener("pointerdown", this._onPointerDown);
    this.domElement!.addEventListener("pointercancel", this._onPointerCancel);

    window.addEventListener("resize", this._onWindowResize);

    this.domElement!.style.touchAction = "none"; // Disable touch scroll
  }

  override disconnect(): void {
    this.domElement!.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement!.removeEventListener("pointercancel", this._onPointerCancel);
    this.domElement!.removeEventListener("wheel", this._onWheel);
    this.domElement!.removeEventListener("contextmenu", this._onContextMenu);

    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);

    window.removeEventListener("resize", this._onWindowResize);

    this.domElement!.style.touchAction = ""; // Restore touch scroll
  }

  onSinglePanStart(event: PointerEvent, operation: string): void {
    if (this.enabled) {
      this.dispatchEvent(_startEvent);

      this.setCenter(event.clientX, event.clientY);

      switch (operation) {
        case "PAN":
          if (!this.enablePan) {
            return;
          }

          if (this._animationId != -1) {
            cancelAnimationFrame(this._animationId);
            this._animationId = -1;
            this._timeStart = -1;

            this.activateGizmos(false);
            this.dispatchEvent(_changeEvent);
          }

          this.updateTbState(STATE.PAN, true);
          this._startCursorPosition.copy(this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!));
          if (this.enableGrid) {
            this.drawGrid();
            this.dispatchEvent(_changeEvent);
          }

          break;

        case "ROTATE":
          if (!this.enableRotate) {
            return;
          }

          if (this._animationId != -1) {
            cancelAnimationFrame(this._animationId);
            this._animationId = -1;
            this._timeStart = -1;
          }

          this.updateTbState(STATE.ROTATE, true);
          this._startCursorPosition.copy(
            this.unprojectOnTbSurface(this.object, _center.x, _center.y, this.domElement!, this._tbRadius),
          );
          this.activateGizmos(true);
          if (this.enableAnimations) {
            this._timePrev = this._timeCurrent = performance.now();
            this._angleCurrent = this._anglePrev = 0;
            this._cursorPosPrev.copy(this._startCursorPosition);
            this._cursorPosCurr.copy(this._cursorPosPrev);
            this._wCurr = 0;
            this._wPrev = this._wCurr;
          }

          this.dispatchEvent(_changeEvent);
          break;

        case "FOV":
          if (!this.object.isPerspectiveCamera || !this.enableZoom) {
            return;
          }

          if (this._animationId != -1) {
            cancelAnimationFrame(this._animationId);
            this._animationId = -1;
            this._timeStart = -1;

            this.activateGizmos(false);
            this.dispatchEvent(_changeEvent);
          }

          this.updateTbState(STATE.FOV, true);
          this._startCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);
          this._currentCursorPosition.copy(this._startCursorPosition);
          break;

        case "ZOOM":
          if (!this.enableZoom) {
            return;
          }

          if (this._animationId != -1) {
            cancelAnimationFrame(this._animationId);
            this._animationId = -1;
            this._timeStart = -1;

            this.activateGizmos(false);
            this.dispatchEvent(_changeEvent);
          }

          this.updateTbState(STATE.SCALE, true);
          this._startCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);
          this._currentCursorPosition.copy(this._startCursorPosition);
          break;
      }
    }
  }

  onSinglePanMove(event: PointerEvent, opState: symbol): void {
    if (this.enabled) {
      const restart = opState != this._state;
      this.setCenter(event.clientX, event.clientY);

      const perspectiveOrOrtho = this.object;

      switch (opState) {
        case STATE.PAN:
          if (this.enablePan) {
            if (restart) {
              //switch to pan operation

              this.dispatchEvent(_endEvent);
              this.dispatchEvent(_startEvent);

              this.updateTbState(opState, true);
              this._startCursorPosition.copy(
                this.unprojectOnTbPlane(perspectiveOrOrtho, _center.x, _center.y, this.domElement!),
              );
              if (this.enableGrid) {
                this.drawGrid();
              }

              this.activateGizmos(false);
            } else {
              //continue with pan operation
              this._currentCursorPosition.copy(
                this.unprojectOnTbPlane(perspectiveOrOrtho, _center.x, _center.y, this.domElement!),
              );
              this.applyTransformMatrix(this.pan(this._startCursorPosition, this._currentCursorPosition));
            }
          }

          break;

        case STATE.ROTATE:
          if (this.enableRotate) {
            if (restart) {
              //switch to rotate operation

              this.dispatchEvent(_endEvent);
              this.dispatchEvent(_startEvent);

              this.updateTbState(opState, true);
              this._startCursorPosition.copy(
                this.unprojectOnTbSurface(perspectiveOrOrtho, _center.x, _center.y, this.domElement!, this._tbRadius),
              );

              if (this.enableGrid) {
                this.disposeGrid();
              }

              this.activateGizmos(true);
            } else {
              //continue with rotate operation
              this._currentCursorPosition.copy(
                this.unprojectOnTbSurface(perspectiveOrOrtho, _center.x, _center.y, this.domElement!, this._tbRadius),
              );

              const distance = this._startCursorPosition.distanceTo(this._currentCursorPosition);
              const angle = this._startCursorPosition.angleTo(this._currentCursorPosition);
              const amount = Math.max(distance / this._tbRadius, angle) * this.rotateSpeed; //effective rotation angle

              this.applyTransformMatrix(
                this.rotate(this.calculateRotationAxis(this._startCursorPosition, this._currentCursorPosition), amount),
              );

              if (this.enableAnimations) {
                this._timePrev = this._timeCurrent;
                this._timeCurrent = performance.now();
                this._anglePrev = this._angleCurrent;
                this._angleCurrent = amount;
                this._cursorPosPrev.copy(this._cursorPosCurr);
                this._cursorPosCurr.copy(this._currentCursorPosition);
                this._wPrev = this._wCurr;
                this._wCurr = this.calculateAngularSpeed(
                  this._anglePrev,
                  this._angleCurrent,
                  this._timePrev,
                  this._timeCurrent,
                );
              }
            }
          }

          break;

        case STATE.SCALE:
          if (this.enableZoom) {
            if (restart) {
              //switch to zoom operation

              this.dispatchEvent(_endEvent);
              this.dispatchEvent(_startEvent);

              this.updateTbState(opState, true);
              this._startCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);
              this._currentCursorPosition.copy(this._startCursorPosition);

              if (this.enableGrid) {
                this.disposeGrid();
              }

              this.activateGizmos(false);
            } else {
              //continue with zoom operation
              const screenNotches = 8; //how many wheel notches corresponds to a full screen pan
              this._currentCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);

              const movement = this._currentCursorPosition.y - this._startCursorPosition.y;

              let size = 1;

              if (movement < 0) {
                size = 1 / Math.pow(this.scaleFactor, -movement * screenNotches);
              } else if (movement > 0) {
                size = Math.pow(this.scaleFactor, movement * screenNotches);
              }

              this._v3_1.setFromMatrixPosition(this._gizmoMatrixState);

              this.applyTransformMatrix(this.scale(size, this._v3_1));
            }
          }

          break;

        case STATE.FOV:
          if (this.enableZoom && (perspectiveOrOrtho as CameraUnion).isPerspectiveCamera == true) {
            if (restart) {
              //switch to fov operation

              this.dispatchEvent(_endEvent);
              this.dispatchEvent(_startEvent);

              this.updateTbState(opState, true);
              this._startCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);
              this._currentCursorPosition.copy(this._startCursorPosition);

              if (this.enableGrid) {
                this.disposeGrid();
              }

              this.activateGizmos(false);
            } else {
              //continue with fov operation
              const screenNotches = 8; //how many wheel notches corresponds to a full screen pan
              this._currentCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);

              const movement = this._currentCursorPosition.y - this._startCursorPosition.y;

              let size = 1;

              if (movement < 0) {
                size = 1 / Math.pow(this.scaleFactor, -movement * screenNotches);
              } else if (movement > 0) {
                size = Math.pow(this.scaleFactor, movement * screenNotches);
              }

              this._v3_1.setFromMatrixPosition(this._cameraMatrixState);
              const x = this._v3_1.distanceTo(this._gizmos.position);
              let xNew = x / size; //distance between camera and gizmos if scale(size, scalepoint) would be performed

              //check min and max distance
              xNew = clamp(xNew, this.minDistance, this.maxDistance);

              const y = x * Math.tan(DEG2RAD * this._fovState * 0.5);

              //calculate new fov
              let newFov = RAD2DEG * (Math.atan(y / xNew) * 2);

              //check min and max fov
              newFov = clamp(newFov, this.minFov, this.maxFov);

              const newDistance = y / Math.tan(DEG2RAD * (newFov / 2));
              size = x / newDistance;
              this._v3_2.setFromMatrixPosition(this._gizmoMatrixState);

              this.setFov(newFov);
              this.applyTransformMatrix(this.scale(size, this._v3_2, false));

              //adjusting distance
              _offset
                .copy(this._gizmos.position)
                .sub(perspectiveOrOrtho.position)
                .normalize()
                .multiplyScalar(newDistance / x);
              this._m4_1.makeTranslation(_offset.x, _offset.y, _offset.z);
            }
          }

          break;
      }

      this.dispatchEvent(_changeEvent);
    }
  }

  onSinglePanEnd(): void {
    if (this._state == STATE.ROTATE) {
      if (!this.enableRotate) {
        return;
      }

      if (this.enableAnimations) {
        //perform rotation animation
        const deltaTime = performance.now() - this._timeCurrent;
        if (deltaTime < 120) {
          const w = Math.abs((this._wPrev + this._wCurr) / 2);

          this._animationId = window.requestAnimationFrame((t) => {
            this.updateTbState(STATE.ANIMATION_ROTATE, true);
            const rotationAxis = this.calculateRotationAxis(this._cursorPosPrev, this._cursorPosCurr);

            this.onRotationAnim(t, rotationAxis, Math.min(w, this.wMax));
          });
        } else {
          //cursor has been standing still for over 120 ms since last movement
          this.updateTbState(STATE.IDLE, false);
          this.activateGizmos(false);
          this.dispatchEvent(_changeEvent);
        }
      } else {
        this.updateTbState(STATE.IDLE, false);
        this.activateGizmos(false);
        this.dispatchEvent(_changeEvent);
      }
    } else if (this._state == STATE.PAN || this._state == STATE.IDLE) {
      this.updateTbState(STATE.IDLE, false);

      if (this.enableGrid) {
        this.disposeGrid();
      }

      this.activateGizmos(false);
      this.dispatchEvent(_changeEvent);
    }

    this.dispatchEvent(_endEvent);
  }

  onDoubleTap(event: PointerEvent): void {
    if (this.enabled && this.enablePan && this.enableFocus && this.scene != null) {
      this.dispatchEvent(_startEvent);

      this.setCenter(event.clientX, event.clientY);
      const hitP = this.unprojectOnObj(this.getCursorNDC(_center.x, _center.y, this.domElement!), this.object);

      if (hitP != null && this.enableAnimations) {
        if (this._animationId != -1) {
          window.cancelAnimationFrame(this._animationId);
        }

        this._timeStart = -1;
        this._animationId = window.requestAnimationFrame((t) => {
          this.updateTbState(STATE.ANIMATION_FOCUS, true);
          this.onFocusAnim(t, hitP, this._cameraMatrixState, this._gizmoMatrixState);
        });
      } else if (hitP != null && !this.enableAnimations) {
        this.updateTbState(STATE.FOCUS, true);
        this.focus(hitP, this.scaleFactor);
        this.updateTbState(STATE.IDLE, false);
        this.dispatchEvent(_changeEvent);
      }
    }

    this.dispatchEvent(_endEvent);
  }

  onDoublePanStart(): void {
    if (this.enabled && this.enablePan) {
      this.dispatchEvent(_startEvent);

      this.updateTbState(STATE.PAN, true);

      this.setCenter(
        (this._touchCurrent[0]!.clientX + this._touchCurrent[1]!.clientX) / 2,
        (this._touchCurrent[0]!.clientY + this._touchCurrent[1]!.clientY) / 2,
      );
      this._startCursorPosition.copy(
        this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!, true),
      );
      this._currentCursorPosition.copy(this._startCursorPosition);

      this.activateGizmos(false);
    }
  }

  onDoublePanMove(): void {
    if (this.enabled && this.enablePan) {
      this.setCenter(
        (this._touchCurrent[0]!.clientX + this._touchCurrent[1]!.clientX) / 2,
        (this._touchCurrent[0]!.clientY + this._touchCurrent[1]!.clientY) / 2,
      );

      if (this._state != STATE.PAN) {
        this.updateTbState(STATE.PAN, true);
        this._startCursorPosition.copy(this._currentCursorPosition);
      }

      this._currentCursorPosition.copy(
        this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!, true),
      );
      this.applyTransformMatrix(this.pan(this._startCursorPosition, this._currentCursorPosition, true));
      this.dispatchEvent(_changeEvent);
    }
  }

  onDoublePanEnd(): void {
    this.updateTbState(STATE.IDLE, false);
    this.dispatchEvent(_endEvent);
  }

  onRotateStart(): void {
    if (this.enabled && this.enableRotate) {
      this.dispatchEvent(_startEvent);

      this.updateTbState(STATE.ZROTATE, true);

      //this._startFingerRotation = event.rotation;

      this._startFingerRotation =
        this.getAngle(this._touchCurrent[1]!, this._touchCurrent[0]!) +
        this.getAngle(this._touchStart[1]!, this._touchStart[0]!);
      this._currentFingerRotation = this._startFingerRotation;

      this.object.getWorldDirection(this._rotationAxis); //rotation axis

      if (!this.enablePan && !this.enableZoom) {
        this.activateGizmos(true);
      }
    }
  }

  onRotateMove(): void {
    if (this.enabled && this.enableRotate) {
      this.setCenter(
        (this._touchCurrent[0]!.clientX + this._touchCurrent[1]!.clientX) / 2,
        (this._touchCurrent[0]!.clientY + this._touchCurrent[1]!.clientY) / 2,
      );
      let rotationPoint;

      if (this._state != STATE.ZROTATE) {
        this.updateTbState(STATE.ZROTATE, true);
        this._startFingerRotation = this._currentFingerRotation;
      }

      //this._currentFingerRotation = event.rotation;
      this._currentFingerRotation =
        this.getAngle(this._touchCurrent[1]!, this._touchCurrent[0]!) +
        this.getAngle(this._touchStart[1]!, this._touchStart[0]!);

      if (!this.enablePan) {
        rotationPoint = new Vector3().setFromMatrixPosition(this._gizmoMatrixState);
      } else {
        this._v3_2.setFromMatrixPosition(this._gizmoMatrixState);
        rotationPoint = this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!)
          .applyQuaternion(this.object.quaternion)
          .multiplyScalar(1 / this.object.zoom)
          .add(this._v3_2);
      }

      const amount = DEG2RAD * (this._startFingerRotation - this._currentFingerRotation);

      this.applyTransformMatrix(this.zRotate(rotationPoint, amount));
      this.dispatchEvent(_changeEvent);
    }
  }

  onRotateEnd(): void {
    this.updateTbState(STATE.IDLE, false);
    this.activateGizmos(false);
    this.dispatchEvent(_endEvent);
  }

  onPinchStart(): void {
    if (this.enabled && this.enableZoom) {
      this.dispatchEvent(_startEvent);
      this.updateTbState(STATE.SCALE, true);

      this._startFingerDistance = this.calculatePointersDistance(this._touchCurrent[0]!, this._touchCurrent[1]!);
      this._currentFingerDistance = this._startFingerDistance;

      this.activateGizmos(false);
    }
  }

  onPinchMove(): void {
    if (this.enabled && this.enableZoom) {
      this.setCenter(
        (this._touchCurrent[0]!.clientX + this._touchCurrent[1]!.clientX) / 2,
        (this._touchCurrent[0]!.clientY + this._touchCurrent[1]!.clientY) / 2,
      );
      const minDistance = 12; //minimum distance between fingers (in css pixels)

      if (this._state != STATE.SCALE) {
        this._startFingerDistance = this._currentFingerDistance;
        this.updateTbState(STATE.SCALE, true);
      }

      this._currentFingerDistance = Math.max(
        this.calculatePointersDistance(this._touchCurrent[0]!, this._touchCurrent[1]!),
        minDistance * this._devPxRatio,
      );
      const amount = this._currentFingerDistance / this._startFingerDistance;

      let scalePoint;

      if (!this.enablePan) {
        scalePoint = this._gizmos.position;
      } else {
        if ((this.object as CameraUnion).isOrthographicCamera == true) {
          scalePoint = this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!)
            .applyQuaternion(this.object.quaternion)
            .multiplyScalar(1 / this.object.zoom)
            .add(this._gizmos.position);
        } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
          scalePoint = this.unprojectOnTbPlane(this.object, _center.x, _center.y, this.domElement!)
            .applyQuaternion(this.object.quaternion)
            .add(this._gizmos.position);
        }
      }

      this.applyTransformMatrix(this.scale(amount, scalePoint!));
      this.dispatchEvent(_changeEvent);
    }
  }

  onPinchEnd(): void {
    this.updateTbState(STATE.IDLE, false);
    this.dispatchEvent(_endEvent);
  }

  onTriplePanStart(): void {
    if (this.enabled && this.enableZoom) {
      this.dispatchEvent(_startEvent);

      this.updateTbState(STATE.SCALE, true);

      //const center = event.center;
      let clientX = 0;
      let clientY = 0;
      const nFingers = this._touchCurrent.length;

      for (let i = 0; i < nFingers; i++) {
        clientX += this._touchCurrent[i]!.clientX;
        clientY += this._touchCurrent[i]!.clientY;
      }

      this.setCenter(clientX / nFingers, clientY / nFingers);

      this._startCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);
      this._currentCursorPosition.copy(this._startCursorPosition);
    }
  }

  onTriplePanMove(): void {
    if (this.enabled && this.enableZoom) {
      //	  fov / 2
      //		|\
      //		| \
      //		|  \
      //	x	|	\
      //		| 	 \
      //		| 	  \
      //		| _ _ _\
      //			y

      //const center = event.center;
      let clientX = 0;
      let clientY = 0;
      const nFingers = this._touchCurrent.length;

      for (let i = 0; i < nFingers; i++) {
        clientX += this._touchCurrent[i]!.clientX;
        clientY += this._touchCurrent[i]!.clientY;
      }

      this.setCenter(clientX / nFingers, clientY / nFingers);

      const screenNotches = 8; //how many wheel notches corresponds to a full screen pan
      this._currentCursorPosition.setY(this.getCursorNDC(_center.x, _center.y, this.domElement!).y * 0.5);

      const movement = this._currentCursorPosition.y - this._startCursorPosition.y;

      let size = 1;

      if (movement < 0) {
        size = 1 / Math.pow(this.scaleFactor, -movement * screenNotches);
      } else if (movement > 0) {
        size = Math.pow(this.scaleFactor, movement * screenNotches);
      }

      this._v3_1.setFromMatrixPosition(this._cameraMatrixState);
      const x = this._v3_1.distanceTo(this._gizmos.position);
      let xNew = x / size; //distance between camera and gizmos if scale(size, scalepoint) would be performed

      //check min and max distance
      xNew = clamp(xNew, this.minDistance, this.maxDistance);

      const y = x * Math.tan(DEG2RAD * this._fovState * 0.5);

      //calculate new fov
      let newFov = RAD2DEG * (Math.atan(y / xNew) * 2);

      //check min and max fov
      newFov = clamp(newFov, this.minFov, this.maxFov);

      const newDistance = y / Math.tan(DEG2RAD * (newFov / 2));
      size = x / newDistance;
      this._v3_2.setFromMatrixPosition(this._gizmoMatrixState);

      this.setFov(newFov);
      this.applyTransformMatrix(this.scale(size, this._v3_2, false));

      //adjusting distance
      _offset
        .copy(this._gizmos.position)
        .sub(this.object.position)
        .normalize()
        .multiplyScalar(newDistance / x);
      this._m4_1.makeTranslation(_offset.x, _offset.y, _offset.z);

      this.dispatchEvent(_changeEvent);
    }
  }

  onTriplePanEnd(): void {
    this.updateTbState(STATE.IDLE, false);
    this.dispatchEvent(_endEvent);
    //this.dispatchEvent( _changeEvent );
  }

  /**
   * Set _center's x/y coordinates.
   *
   * @param clientX - The x coordinate.
   * @param clientY - The y coordinate.
   */
  setCenter(clientX: number, clientY: number): void {
    _center.x = clientX;
    _center.y = clientY;
  }

  /**
   * Set default mouse actions.
   */
  initializeMouseActions(): void {
    this.setMouseAction("PAN", 0, "CTRL");
    this.setMouseAction("PAN", 2);

    this.setMouseAction("ROTATE", 0);

    this.setMouseAction("ZOOM", "WHEEL");
    this.setMouseAction("ZOOM", 1);

    this.setMouseAction("FOV", "WHEEL", "SHIFT");
    this.setMouseAction("FOV", 1, "SHIFT");
  }

  /**
   * Compare two mouse actions.
   *
   * @param action1 - The first mouse action.
   * @param action2 - The second mouse action.
   * @returns `true` if action1 and action 2 are the same mouse action, `false` otherwise.
   */
  compareMouseAction(action1: ArcballMouseAction, action2: ArcballMouseAction): boolean {
    if (action1.operation == action2.operation) {
      if (action1.mouse == action2.mouse && action1.key == action2.key) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  /**
   * Set a new mouse action by specifying the operation to be performed and a mouse/key combination. In case of conflict, replaces the existing one.
   *
   * @param operation - The operation to be performed ('PAN', 'ROTATE', 'ZOOM', 'FOV').
   * @param mouse - A mouse button (0, 1, 2) or 'WHEEL' for wheel notches.
   * @param key - The keyboard modifier ('CTRL', 'SHIFT') or null if key is not needed.
   * @returns `true` if the mouse action has been successfully added, `false` otherwise.
   */
  setMouseAction(
    operation: "PAN" | "ROTATE" | "ZOOM" | "FOV",
    mouse: number | "WHEEL",
    key: "CTRL" | "SHIFT" | null = null,
  ): boolean {
    const operationInput = ["PAN", "ROTATE", "ZOOM", "FOV"];
    const mouseInput = [0, 1, 2, "WHEEL"];
    const keyInput = ["CTRL", "SHIFT", null];
    let state;

    if (!operationInput.includes(operation) || !mouseInput.includes(mouse) || !keyInput.includes(key)) {
      //invalid parameters
      return false;
    }

    if (mouse == "WHEEL") {
      if (operation != "ZOOM" && operation != "FOV") {
        //cannot associate 2D operation to 1D input
        return false;
      }
    }

    switch (operation) {
      case "PAN":
        state = STATE.PAN;
        break;
      case "ROTATE":
        state = STATE.ROTATE;
        break;
      case "ZOOM":
        state = STATE.SCALE;
        break;
      case "FOV":
        state = STATE.FOV;
        break;
    }

    const action: ArcballMouseAction = {
      operation: operation,
      mouse: mouse,
      key: key,
      state: state!,
    };

    for (let i = 0; i < this.mouseActions.length; i++) {
      if (this.mouseActions[i]!.mouse == action.mouse && this.mouseActions[i]!.key == action.key) {
        this.mouseActions.splice(i, 1, action);
        return true;
      }
    }

    this.mouseActions.push(action);
    return true;
  }

  /**
   * Remove a mouse action by specifying its mouse/key combination.
   *
   * @param mouse - A mouse button (0, 1, 2) or 'WHEEL' for wheel notches.
   * @param key - The keyboard modifier ('CTRL', 'SHIFT') or null if key is not needed.
   * @returns `true` if the operation has been successfully removed, `false` otherwise.
   */
  unsetMouseAction(mouse: number | "WHEEL", key: "CTRL" | "SHIFT" | null = null): boolean {
    for (let i = 0; i < this.mouseActions.length; i++) {
      if (this.mouseActions[i]!.mouse == mouse && this.mouseActions[i]!.key == key) {
        this.mouseActions.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * Return the operation associated to a mouse/keyboard combination.
   *
   * @param mouse - Mouse button index (0, 1, 2) or 'WHEEL' for wheel notches.
   * @param key - Keyboard modifier.
   * @returns The operation if it has been found, `null` otherwise.
   */
  getOpFromAction(mouse: number | "WHEEL", key: "CTRL" | "SHIFT" | null): "PAN" | "ROTATE" | "ZOOM" | "FOV" | null {
    let action: ArcballMouseAction | undefined;

    for (let i = 0; i < this.mouseActions.length; i++) {
      action = this.mouseActions[i];
      if (action && action.mouse == mouse && action.key == key) {
        return action.operation;
      }
    }

    if (key != null) {
      for (let i = 0; i < this.mouseActions.length; i++) {
        action = this.mouseActions[i];
        if (action && action.mouse == mouse && action.key == null) {
          return action.operation;
        }
      }
    }

    return null;
  }

  /**
   * Get the operation associated to mouse and key combination and returns the corresponding FSA state.
   *
   * @param mouse - Mouse button index (0, 1, 2)
   * @param key - Keyboard modifier
   * @returns The FSA state obtained from the operation associated to mouse/keyboard combination.
   */
  getOpStateFromAction(mouse: number, key: "CTRL" | "SHIFT" | null): symbol | null {
    let action: ArcballMouseAction | undefined;

    for (let i = 0; i < this.mouseActions.length; i++) {
      action = this.mouseActions[i];
      if (action && action.mouse == mouse && action.key == key) {
        return action.state;
      }
    }

    if (key != null) {
      for (let i = 0; i < this.mouseActions.length; i++) {
        action = this.mouseActions[i];
        if (action && action.mouse == mouse && action.key == null) {
          return action.state;
        }
      }
    }

    return null;
  }

  /**
   * Calculate the angle between two pointers.
   *
   * @param p1 - The first pointer event.
   * @param p2 - The second pointer event.
   * @returns The angle between two pointers in degrees.
   */
  getAngle(p1: PointerEvent, p2: PointerEvent): number {
    return (Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX) * 180) / Math.PI;
  }

  /**
   * Updates a PointerEvent inside current pointerevents array.
   *
   * @param event - The pointer event.
   */
  updateTouchEvent(event: PointerEvent): void {
    for (let i = 0; i < this._touchCurrent.length; i++) {
      if (this._touchCurrent[i]!.pointerId == event.pointerId) {
        this._touchCurrent.splice(i, 1, event);
        break;
      }
    }
  }

  /**
   * Applies a transformation matrix, to the camera and gizmos.
   *
   * @param transformation - Object containing matrices to apply to camera and gizmos.
   */
  applyTransformMatrix(transformation: ArcballTransformation): void {
    const perspectiveOrOrtho = this.object;

    if (transformation.camera != null) {
      this._m4_1.copy(this._cameraMatrixState).premultiply(transformation.camera);
      this._m4_1.decompose(perspectiveOrOrtho.position, perspectiveOrOrtho.quaternion, perspectiveOrOrtho.scale);
      perspectiveOrOrtho.updateMatrix();

      //update camera up vector
      if (this._state == STATE.ROTATE || this._state == STATE.ZROTATE || this._state == STATE.ANIMATION_ROTATE) {
        perspectiveOrOrtho.up.copy(this._upState).applyQuaternion(perspectiveOrOrtho.quaternion);
      }
    }

    if (transformation.gizmos != null) {
      this._m4_1.copy(this._gizmoMatrixState).premultiply(transformation.gizmos);
      this._m4_1.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
      this._gizmos.updateMatrix();
    }

    if (this._state == STATE.SCALE || this._state == STATE.FOCUS || this._state == STATE.ANIMATION_FOCUS) {
      this._tbRadius = this.calculateTbRadius(perspectiveOrOrtho)!;

      if (this.adjustNearFar) {
        this._adjustNearFar(perspectiveOrOrtho.position.distanceTo(this._gizmos.position));
      } else {
        let update = false;

        if (perspectiveOrOrtho.near != this._initialNear) {
          perspectiveOrOrtho.near = this._initialNear;
          update = true;
        }

        if (perspectiveOrOrtho.far != this._initialFar) {
          perspectiveOrOrtho.far = this._initialFar;
          update = true;
        }

        if (update) {
          this.object.updateProjectionMatrix();
        }
      }
    }
  }

  _adjustNearFar(cameraDistance: number): void {
    const bb = new Box3();
    bb.setFromObject(this._gizmos);
    const sphere = new Sphere();
    bb.getBoundingSphere(sphere);

    const adjustedNearPosition = Math.max(this._nearPos0, sphere.radius + sphere.center.length());
    const regularNearPosition = cameraDistance - this._initialNear;

    const minNearPos = Math.min(adjustedNearPosition, regularNearPosition);
    this.object.near = cameraDistance - minNearPos;

    const adjustedFarPosition = Math.min(this._farPos0, -sphere.radius + sphere.center.length());
    const regularFarPosition = cameraDistance - this._initialFar;

    const minFarPos = Math.min(adjustedFarPosition, regularFarPosition);
    this.object.far = cameraDistance - minFarPos;

    this.object.updateProjectionMatrix();
  }

  /**
   * Calculates the angular speed.
   *
   * @param p0 - Position at t0.
   * @param p1 - Position at t1.
   * @param t0 - Initial time in milliseconds.
   * @param t1 - Ending time in milliseconds.
   * @returns The angular speed.
   */
  calculateAngularSpeed(p0: number, p1: number, t0: number, t1: number): number {
    const s = p1 - p0;
    const t = (t1 - t0) / 1000;
    if (t == 0) {
      return 0;
    }

    return s / t;
  }

  /**
   * Calculates the distance between two pointers.
   *
   * @param p0 - The first pointer.
   * @param p1 - The second pointer.
   * @returns The distance between the two pointers.
   */
  calculatePointersDistance(p0: PointerEvent, p1: PointerEvent): number {
    return Math.sqrt(Math.pow(p1.clientX - p0.clientX, 2) + Math.pow(p1.clientY - p0.clientY, 2));
  }

  /**
   * Calculates the rotation axis as the vector perpendicular between two vectors.
   *
   * @param vec1 - The first vector.
   * @param vec2 - The second vector.
   * @returns The normalized rotation axis.
   */
  calculateRotationAxis(vec1: Vector3, vec2: Vector3): Vector3 {
    this._rotationMatrix.extractRotation(this._cameraMatrixState);
    this._quat.setFromRotationMatrix(this._rotationMatrix);

    this._rotationAxis.crossVectors(vec1, vec2).applyQuaternion(this._quat);
    return this._rotationAxis.normalize().clone();
  }

  /**
   * Calculates the trackball radius so that gizmo's diameter will be 2/3 of the minimum side of the camera frustum.
   *
   * @param camera - The camera.
   * @returns The trackball radius.
   */
  calculateTbRadius(camera: TObject): number | undefined {
    const distance = camera.position.distanceTo(this._gizmos.position);

    const halfFovV = DEG2RAD * (camera as PerspectiveCamera).fov * 0.5; //vertical fov/2 in radians
    const halfFovH = Math.atan((camera as PerspectiveCamera).aspect * Math.tan(halfFovV)); //horizontal fov/2 in radians

    if (camera.type == "OrthographicCamera") {
      return Math.min((camera as OrthographicCamera).top, (camera as OrthographicCamera).right) * this.radiusFactor;
    }

    return Math.tan(Math.min(halfFovV, halfFovH)) * distance * this.radiusFactor;
  }

  /**
   * Focus operation consist of positioning the point of interest in front of the camera and a slightly zoom in.
   *
   * @param point - The point of interest.
   * @param size - Scale factor.
   * @param amount - Amount of operation to be completed (used for focus animations, default is complete full operation).
   */
  focus(point: Vector3, size: number, amount = 1): void {
    //move center of camera (along with gizmos) towards point of interest
    _offset.copy(point).sub(this._gizmos.position).multiplyScalar(amount);
    this._translationMatrix.makeTranslation(_offset.x, _offset.y, _offset.z);

    _gizmoMatrixStateTemp.copy(this._gizmoMatrixState);
    this._gizmoMatrixState.premultiply(this._translationMatrix);
    this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);

    _cameraMatrixStateTemp.copy(this._cameraMatrixState);
    this._cameraMatrixState.premultiply(this._translationMatrix);
    this._cameraMatrixState.decompose(this.object.position, this.object.quaternion, this.object.scale);

    //apply zoom
    if (this.enableZoom) {
      this.applyTransformMatrix(this.scale(size, this._gizmos.position));
    }

    this._gizmoMatrixState.copy(_gizmoMatrixStateTemp);
    this._cameraMatrixState.copy(_cameraMatrixStateTemp);
  }

  /**
   * Creates a grid if necessary and adds it to the scene.
   */
  drawGrid(): void {
    if (this.scene != null) {
      const color = 0x888888;
      const multiplier = 3;
      let size: number;
      let divisions: number;
      let maxLength: number;
      let tick: number;

      if (this.object instanceof OrthographicCamera) {
        const ortho = this.object;
        const width = ortho.right - ortho.left;
        const height = ortho.bottom - ortho.top;

        maxLength = Math.max(width, height);
        tick = maxLength / 20;

        size = (maxLength / ortho.zoom) * multiplier;
        divisions = (size / tick) * ortho.zoom;
      } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
        const perspective = this.object as PerspectiveCamera;
        const distance = perspective.position.distanceTo(this._gizmos.position);
        const halfFovV = DEG2RAD * perspective.fov * 0.5;
        const halfFovH = Math.atan(perspective.aspect * Math.tan(halfFovV));

        maxLength = Math.tan(Math.max(halfFovV, halfFovH)) * distance * 2;
        tick = maxLength / 20;

        size = maxLength * multiplier;
        divisions = size / tick;
      } else {
        return;
      }

      if (this._grid == null) {
        this._grid = new GridHelper(size, divisions, color, color);
        this._grid.position.copy(this._gizmos.position);
        this._gridPosition.copy(this._grid.position);
        this._grid.quaternion.copy(this.object.quaternion);
        this._grid.rotateX(Math.PI * 0.5);

        this.scene.add(this._grid);
      }
    }
  }

  override dispose(): void {
    if (this._animationId != -1) {
      window.cancelAnimationFrame(this._animationId);
    }

    this.disconnect();

    if (this.scene !== null) this.scene.remove(this._gizmos);
    this.disposeGrid();
  }

  /**
   * Removes the grid from the scene.
   */
  disposeGrid(): void {
    if (this._grid != null && this.scene != null) {
      this.scene.remove(this._grid);
      this._grid = null;
    }
  }

  /**
   * Computes the easing out cubic function for ease out effect in animation.
   *
   * @param t - The absolute progress of the animation in the bound of `0` (beginning of the) and `1` (ending of animation).
   * @returns Result of easing out cubic at time `t`.
   */
  easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Makes rotation gizmos more or less visible.
   *
   * @param isActive - If set to `true`, gizmos are more visible.
   */
  activateGizmos(isActive: boolean): void {
    const gizmoX = this._gizmos.children[0] as unknown as { material: LineBasicMaterial };
    const gizmoY = this._gizmos.children[1] as unknown as { material: LineBasicMaterial };
    const gizmoZ = this._gizmos.children[2] as unknown as { material: LineBasicMaterial };

    if (isActive) {
      gizmoX.material.setValues({ opacity: 1 });
      gizmoY.material.setValues({ opacity: 1 });
      gizmoZ.material.setValues({ opacity: 1 });
    } else {
      gizmoX.material.setValues({ opacity: 0.6 });
      gizmoY.material.setValues({ opacity: 0.6 });
      gizmoZ.material.setValues({ opacity: 0.6 });
    }
  }

  /**
   * Calculates the cursor position in NDC.
   *
   * @param cursorX - Cursor horizontal coordinate within the canvas.
   * @param cursorY - Cursor vertical coordinate within the canvas.
   * @param canvas - The canvas where the renderer draws its output.
   * @returns Cursor normalized position inside the canvas.
   */
  getCursorNDC(cursorX: number, cursorY: number, canvas: HTMLElement): Vector2 {
    const canvasRect = canvas.getBoundingClientRect();
    this._v2_1.setX(((cursorX - canvasRect.left) / canvasRect.width) * 2 - 1);
    this._v2_1.setY(((canvasRect.bottom - cursorY) / canvasRect.height) * 2 - 1);
    return this._v2_1.clone();
  }

  /**
   * Calculates the cursor position inside the canvas x/y coordinates with the origin being in the center of the canvas.
   *
   * @param cursorX - Cursor horizontal coordinate within the canvas.
   * @param cursorY - Cursor vertical coordinate within the canvas.
   * @param canvas - The canvas where the renderer draws its output.
   * @returns Cursor position inside the canvas.
   */
  getCursorPosition(cursorX: number, cursorY: number, canvas: HTMLElement): Vector2 {
    this._v2_1.copy(this.getCursorNDC(cursorX, cursorY, canvas));
    // Only used with orthographic cameras (upstream contract): their frustum spans define the mapping.
    const ortho = this.object as OrthographicCamera;
    this._v2_1.x *= (ortho.right - ortho.left) * 0.5;
    this._v2_1.y *= (ortho.top - ortho.bottom) * 0.5;
    return this._v2_1.clone();
  }

  /**
   * Sets the camera to be controlled.  Must be called in order to set a new camera to be controlled.
   *
   * @param camera - The camera to be controlled.
   */
  setCamera(camera: TObject): void {
    camera.lookAt(this.target);
    camera.updateMatrix();

    //setting state
    if (camera.type == "PerspectiveCamera") {
      const perspective = camera as PerspectiveCamera;
      this._fov0 = perspective.fov;
      this._fovState = perspective.fov;
    }

    this._cameraMatrixState0.copy(camera.matrix);
    this._cameraMatrixState.copy(this._cameraMatrixState0);
    this._cameraProjectionState.copy(camera.projectionMatrix);
    this._zoom0 = camera.zoom;
    this._zoomState = this._zoom0;

    this._initialNear = camera.near;
    this._nearPos0 = camera.position.distanceTo(this.target) - camera.near;
    this._nearPos = this._initialNear;

    this._initialFar = camera.far;
    this._farPos0 = camera.position.distanceTo(this.target) - camera.far;
    this._farPos = this._initialFar;

    this._up0.copy(camera.up);
    this._upState.copy(camera.up);

    this.object = camera;
    this.object.updateProjectionMatrix();

    //making gizmos
    this._tbRadius = this.calculateTbRadius(camera)!;
    this.makeGizmos(this.target, this._tbRadius);
  }

  /**
   * Sets gizmos visibility.
   *
   * @param value - Value of gizmos visibility.
   */
  setGizmosVisible(value: boolean): void {
    this._gizmos.visible = value;
    this.dispatchEvent(_changeEvent);
  }

  /**
   * Sets gizmos radius factor and redraws gizmos.
   *
   * @param value - Value of radius factor.
   */
  setTbRadius(value: number): void {
    this.radiusFactor = value;
    this._tbRadius = this.calculateTbRadius(this.object)!;

    const curve = new EllipseCurve(0, 0, this._tbRadius, this._tbRadius);
    const points = curve.getPoints(this._curvePts);
    const curveGeometry = new BufferGeometry().setFromPoints(points);

    // The children map is keyed by index, so the `for..in` iteration behaves like a plain loop.
    const gizmos = this._gizmos.children as unknown as Record<string, { geometry: BufferGeometry }>;

    for (const gizmo in gizmos) {
      gizmos[gizmo].geometry = curveGeometry;
    }

    this.dispatchEvent(_changeEvent);
  }

  /**
   * Creates the rotation gizmos matching trackball center and radius.
   *
   * @param tbCenter - The trackball center.
   * @param tbRadius - The trackball radius.
   */
  makeGizmos(tbCenter: Vector3, tbRadius: number): void {
    const curve = new EllipseCurve(0, 0, tbRadius, tbRadius);
    const points = curve.getPoints(this._curvePts);

    //geometry
    const curveGeometry = new BufferGeometry().setFromPoints(points);

    //material
    const curveMaterialX = new LineBasicMaterial({ color: 0xff8080, fog: false, transparent: true, opacity: 0.6 });
    const curveMaterialY = new LineBasicMaterial({ color: 0x80ff80, fog: false, transparent: true, opacity: 0.6 });
    const curveMaterialZ = new LineBasicMaterial({ color: 0x8080ff, fog: false, transparent: true, opacity: 0.6 });

    //line
    const gizmoX = new Line(curveGeometry, curveMaterialX);
    const gizmoY = new Line(curveGeometry, curveMaterialY);
    const gizmoZ = new Line(curveGeometry, curveMaterialZ);

    const rotation = Math.PI * 0.5;
    gizmoX.rotation.y = rotation;
    gizmoY.rotation.x = rotation;

    //setting state
    this._gizmoMatrixState0.identity().setPosition(tbCenter);
    this._gizmoMatrixState.copy(this._gizmoMatrixState0);

    if (this.object.zoom !== 1) {
      //adapt gizmos size to camera zoom
      const size = 1 / this.object.zoom;
      this._scaleMatrix.makeScale(size, size, size);
      this._translationMatrix.makeTranslation(-tbCenter.x, -tbCenter.y, -tbCenter.z);

      this._gizmoMatrixState.premultiply(this._translationMatrix).premultiply(this._scaleMatrix);
      this._translationMatrix.makeTranslation(tbCenter.x, tbCenter.y, tbCenter.z);
      this._gizmoMatrixState.premultiply(this._translationMatrix);
    }

    this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);

    //

    this._gizmos.traverse(function (object) {
      const withGeometry = object as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } };
      if (withGeometry.geometry) withGeometry.geometry.dispose();
      if (withGeometry.material) withGeometry.material.dispose();
    });

    this._gizmos.clear();

    //

    this._gizmos.add(gizmoX);
    this._gizmos.add(gizmoY);
    this._gizmos.add(gizmoZ);
  }

  /**
   * Performs animation for focus operation.
   *
   * @param time - Instant in which this function is called as performance.now().
   * @param point - Point of interest for focus operation.
   * @param cameraMatrix - Camera matrix.
   * @param gizmoMatrix - Gizmos matrix.
   */
  onFocusAnim(time: number, point: Vector3, cameraMatrix: Matrix4, gizmoMatrix: Matrix4): void {
    if (this._timeStart == -1) {
      //animation start
      this._timeStart = time;
    }

    if (this._state == STATE.ANIMATION_FOCUS) {
      const deltaTime = time - this._timeStart;
      const animTime = deltaTime / this.focusAnimationTime;

      this._gizmoMatrixState.copy(gizmoMatrix);

      if (animTime >= 1) {
        //animation end

        this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);

        this.focus(point, this.scaleFactor);

        this._timeStart = -1;
        this.updateTbState(STATE.IDLE, false);
        this.activateGizmos(false);

        this.dispatchEvent(_changeEvent);
      } else {
        const amount = this.easeOutCubic(animTime);
        const size = 1 - amount + this.scaleFactor * amount;

        this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
        this.focus(point, size, amount);

        this.dispatchEvent(_changeEvent);
        this._animationId = window.requestAnimationFrame((t) => {
          this.onFocusAnim(t, point, cameraMatrix, gizmoMatrix.clone());
        });
      }
    } else {
      //interrupt animation

      this._animationId = -1;
      this._timeStart = -1;
    }
  }

  /**
   * Performs animation for rotation operation.
   *
   * @param time - Instant in which this function is called as performance.now().
   * @param rotationAxis - Rotation axis.
   * @param w0 - Initial angular velocity.
   */
  onRotationAnim(time: number, rotationAxis: Vector3, w0: number): void {
    if (this._timeStart == -1) {
      //animation start
      this._anglePrev = 0;
      this._angleCurrent = 0;
      this._timeStart = time;
    }

    if (this._state == STATE.ANIMATION_ROTATE) {
      //w = w0 + alpha * t
      const deltaTime = (time - this._timeStart) / 1000;
      const w = w0 + -this.dampingFactor * deltaTime;

      if (w > 0) {
        //tetha = 0.5 * alpha * t^2 + w0 * t + tetha0
        this._angleCurrent = 0.5 * -this.dampingFactor * Math.pow(deltaTime, 2) + w0 * deltaTime + 0;
        this.applyTransformMatrix(this.rotate(rotationAxis, this._angleCurrent));
        this.dispatchEvent(_changeEvent);
        this._animationId = window.requestAnimationFrame((t) => {
          this.onRotationAnim(t, rotationAxis, w0);
        });
      } else {
        this._animationId = -1;
        this._timeStart = -1;

        this.updateTbState(STATE.IDLE, false);
        this.activateGizmos(false);

        this.dispatchEvent(_changeEvent);
      }
    } else {
      //interrupt animation

      this._animationId = -1;
      this._timeStart = -1;

      if (this._state != STATE.ROTATE) {
        this.activateGizmos(false);
        this.dispatchEvent(_changeEvent);
      }
    }
  }

  /**
   * Performs pan operation moving camera between two points.
   *
   * @param p0 - Initial point.
   * @param p1 - Ending point.
   * @param adjust - If movement should be adjusted considering camera distance (Perspective only).
   * @returns The transformation to be applied to camera and gizmos.
   */
  pan(p0: Vector3, p1: Vector3, adjust = false): ArcballTransformation {
    const movement = p0.clone().sub(p1);

    if ((this.object as CameraUnion).isOrthographicCamera == true) {
      //adjust movement amount
      movement.multiplyScalar(1 / this.object.zoom);
    } else if (this.object.isPerspectiveCamera && adjust) {
      //adjust movement amounts
      this._v3_1.setFromMatrixPosition(this._cameraMatrixState0); //camera's initial position
      this._v3_2.setFromMatrixPosition(this._gizmoMatrixState0); //gizmo's initial position
      const distanceFactor = this._v3_1.distanceTo(this._v3_2) / this.object.position.distanceTo(this._gizmos.position);
      movement.multiplyScalar(1 / distanceFactor);
    }

    this._v3_1.set(movement.x, movement.y, 0).applyQuaternion(this.object.quaternion);

    this._m4_1.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z);

    this.setTransformationMatrices(this._m4_1, this._m4_1);
    return _transformation;
  }

  /**
   * Resets the controls.
   */
  reset(): void {
    this.target.copy(this._target0);
    this.object.zoom = this._zoom0;

    if (this.object.isPerspectiveCamera) {
      (this.object as PerspectiveCamera).fov = this._fov0;
    }

    this.object.near = this._nearPos;
    this.object.far = this._farPos;
    this._cameraMatrixState.copy(this._cameraMatrixState0);
    this._cameraMatrixState.decompose(this.object.position, this.object.quaternion, this.object.scale);
    this.object.up.copy(this._up0);

    this.object.updateMatrix();
    this.object.updateProjectionMatrix();

    this._gizmoMatrixState.copy(this._gizmoMatrixState0);
    this._gizmoMatrixState0.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);
    this._gizmos.updateMatrix();

    this._tbRadius = this.calculateTbRadius(this.object)!;
    this.makeGizmos(this._gizmos.position, this._tbRadius);

    this.object.lookAt(this._gizmos.position);

    this.updateTbState(STATE.IDLE, false);

    this.dispatchEvent(_changeEvent);
  }

  /**
   * Rotates the camera around an axis passing by trackball's center.
   *
   * @param axis - Rotation axis.
   * @param angle - Angle in radians.
   * @returns The computed transformation matrix.
   */
  rotate(axis: Vector3, angle: number): ArcballTransformation {
    const point = this._gizmos.position; //rotation center
    this._translationMatrix.makeTranslation(-point.x, -point.y, -point.z);
    this._rotationMatrix.makeRotationAxis(axis, -angle);

    //rotate camera
    this._m4_1.makeTranslation(point.x, point.y, point.z);
    this._m4_1.multiply(this._rotationMatrix);
    this._m4_1.multiply(this._translationMatrix);

    this.setTransformationMatrices(this._m4_1);

    return _transformation;
  }

  /**
   * Copy the current state to clipboard (as a readable JSON text).
   */
  copyState(): void {
    let state: string | undefined;
    if ((this.object as CameraUnion).isOrthographicCamera == true) {
      state = JSON.stringify({
        arcballState: {
          cameraFar: this.object.far,
          cameraMatrix: this.object.matrix,
          cameraNear: this.object.near,
          cameraUp: this.object.up,
          cameraZoom: this.object.zoom,
          gizmoMatrix: this._gizmos.matrix,
          target: this.target,
        },
      });
    } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
      state = JSON.stringify({
        arcballState: {
          cameraFar: this.object.far,
          cameraFov: (this.object as PerspectiveCamera).fov,
          cameraMatrix: this.object.matrix,
          cameraNear: this.object.near,
          cameraUp: this.object.up,
          cameraZoom: this.object.zoom,
          gizmoMatrix: this._gizmos.matrix,
          target: this.target,
        },
      });
    }

    void navigator.clipboard.writeText(state!);
  }

  /**
   * Set the controls state from the clipboard, assumes that the clipboard stores a JSON
   * text as saved from `copyState()`.
   */
  pasteState(): void {
    // clipboard rejection leaves the current state untouched, like upstream
    void navigator.clipboard.readText().then((value) => this.setStateFromJSON(JSON.parse(value)));
  }

  /**
   * Saves the current state of the control. This can later be recover with `reset()`.
   */
  saveState(): void {
    this.object.updateMatrix();
    this._gizmos.updateMatrix();

    this._target0.copy(this.target);
    this._cameraMatrixState0.copy(this.object.matrix);
    this._gizmoMatrixState0.copy(this._gizmos.matrix);
    this._nearPos = this.object.near;
    this._farPos = this.object.far;
    this._zoom0 = this.object.zoom;
    this._up0.copy(this.object.up);

    if (this.object.isPerspectiveCamera) {
      this._fov0 = (this.object as PerspectiveCamera).fov;
    }
  }

  /**
   * Performs uniform scale operation around a given point.
   *
   * @param size - Scale factor.
   * @param point - Point around which scale.
   * @param scaleGizmos - If gizmos should be scaled (Perspective only).
   * @returns The computed transformation matrix.
   */
  scale(size: number, point: Vector3, scaleGizmos = true): ArcballTransformation {
    _scalePointTemp.copy(point);
    let sizeInverse = 1 / size;

    if ((this.object as CameraUnion).isOrthographicCamera == true) {
      //camera zoom
      this.object.zoom = this._zoomState;
      this.object.zoom *= size;

      //check min and max zoom
      if (this.object.zoom > this.maxZoom) {
        this.object.zoom = this.maxZoom;
        sizeInverse = this._zoomState / this.maxZoom;
      } else if (this.object.zoom < this.minZoom) {
        this.object.zoom = this.minZoom;
        sizeInverse = this._zoomState / this.minZoom;
      }

      this.object.updateProjectionMatrix();

      this._v3_1.setFromMatrixPosition(this._gizmoMatrixState); //gizmos position

      //scale gizmos so they appear in the same spot having the same dimension
      this._scaleMatrix.makeScale(sizeInverse, sizeInverse, sizeInverse);
      this._translationMatrix.makeTranslation(-this._v3_1.x, -this._v3_1.y, -this._v3_1.z);

      this._m4_2.makeTranslation(this._v3_1.x, this._v3_1.y, this._v3_1.z).multiply(this._scaleMatrix);
      this._m4_2.multiply(this._translationMatrix);

      //move camera and gizmos to obtain pinch effect
      _scalePointTemp.sub(this._v3_1);

      const amount = _scalePointTemp.clone().multiplyScalar(sizeInverse);
      _scalePointTemp.sub(amount);

      this._m4_1.makeTranslation(_scalePointTemp.x, _scalePointTemp.y, _scalePointTemp.z);
      this._m4_2.premultiply(this._m4_1);

      this.setTransformationMatrices(this._m4_1, this._m4_2);
      return _transformation;
    } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
      this._v3_1.setFromMatrixPosition(this._cameraMatrixState);
      this._v3_2.setFromMatrixPosition(this._gizmoMatrixState);

      //move camera
      let distance = this._v3_1.distanceTo(_scalePointTemp);
      let amount = distance - distance * sizeInverse;

      //check min and max distance
      const newDistance = distance - amount;
      if (newDistance < this.minDistance) {
        sizeInverse = this.minDistance / distance;
        amount = distance - distance * sizeInverse;
      } else if (newDistance > this.maxDistance) {
        sizeInverse = this.maxDistance / distance;
        amount = distance - distance * sizeInverse;
      }

      _offset.copy(_scalePointTemp).sub(this._v3_1).normalize().multiplyScalar(amount);

      this._m4_1.makeTranslation(_offset.x, _offset.y, _offset.z);

      if (scaleGizmos) {
        //scale gizmos so they appear in the same spot having the same dimension
        const pos = this._v3_2;

        distance = pos.distanceTo(_scalePointTemp);
        amount = distance - distance * sizeInverse;
        _offset.copy(_scalePointTemp).sub(this._v3_2).normalize().multiplyScalar(amount);

        this._translationMatrix.makeTranslation(pos.x, pos.y, pos.z);
        this._scaleMatrix.makeScale(sizeInverse, sizeInverse, sizeInverse);

        this._m4_2.makeTranslation(_offset.x, _offset.y, _offset.z).multiply(this._translationMatrix);
        this._m4_2.multiply(this._scaleMatrix);

        this._translationMatrix.makeTranslation(-pos.x, -pos.y, -pos.z);

        this._m4_2.multiply(this._translationMatrix);
        this.setTransformationMatrices(this._m4_1, this._m4_2);
      } else {
        this.setTransformationMatrices(this._m4_1);
      }

      return _transformation;
    }

    return _transformation;
  }

  /**
   * Sets camera fov.
   *
   * @param value - The FOV to be set.
   */
  setFov(value: number): void {
    if (this.object.isPerspectiveCamera) {
      (this.object as PerspectiveCamera).fov = clamp(value, this.minFov, this.maxFov);
      this.object.updateProjectionMatrix();
    }
  }

  /**
   * Sets values in transformation object.
   *
   * @param camera - Transformation to be applied to the camera.
   * @param gizmos - Transformation to be applied to gizmos.
   */
  setTransformationMatrices(camera: Matrix4 | null = null, gizmos: Matrix4 | null = null): void {
    if (camera != null) {
      if (_transformation.camera != null) {
        _transformation.camera.copy(camera);
      } else {
        _transformation.camera = camera.clone();
      }
    } else {
      _transformation.camera = null;
    }

    if (gizmos != null) {
      if (_transformation.gizmos != null) {
        _transformation.gizmos.copy(gizmos);
      } else {
        _transformation.gizmos = gizmos.clone();
      }
    } else {
      _transformation.gizmos = null;
    }
  }

  /**
   * Rotates camera around its direction axis passing by a given point by a given angle.
   *
   * @param point - The point where the rotation axis is passing through.
   * @param angle - Angle in radians.
   * @returns The computed transformation matrix.
   */
  zRotate(point: Vector3, angle: number): ArcballTransformation {
    this._rotationMatrix.makeRotationAxis(this._rotationAxis, angle);
    this._translationMatrix.makeTranslation(-point.x, -point.y, -point.z);

    this._m4_1.makeTranslation(point.x, point.y, point.z);
    this._m4_1.multiply(this._rotationMatrix);
    this._m4_1.multiply(this._translationMatrix);

    this._v3_1.setFromMatrixPosition(this._gizmoMatrixState).sub(point); //vector from rotation center to gizmos position
    this._v3_2.copy(this._v3_1).applyAxisAngle(this._rotationAxis, angle); //apply rotation
    this._v3_2.sub(this._v3_1);

    this._m4_2.makeTranslation(this._v3_2.x, this._v3_2.y, this._v3_2.z);

    this.setTransformationMatrices(this._m4_1, this._m4_2);
    return _transformation;
  }

  /**
   * Returns the raycaster that is used for user interaction. This object is shared between all
   * instances of `ArcballControls`.
   *
   * @returns The internal raycaster.
   */
  getRaycaster(): Raycaster {
    return _raycaster;
  }

  /**
   * Unprojects the cursor on the 3D object surface.
   *
   * @param cursor - Cursor coordinates in NDC.
   * @param camera - Virtual camera.
   * @returns The point of intersection with the model, if exist, null otherwise.
   */
  unprojectOnObj(cursor: Vector2, camera: TObject): Vector3 | null {
    const raycaster = this.getRaycaster();
    raycaster.near = camera.near;
    raycaster.far = camera.far;
    raycaster.setFromCamera(cursor, camera);

    const intersect = raycaster.intersectObjects(this.scene!.children, true);

    for (let i = 0; i < intersect.length; i++) {
      if (intersect[i].object.uuid != this._gizmos.uuid && intersect[i].face != null) {
        return intersect[i].point.clone();
      }
    }

    return null;
  }

  /**
   * Unproject the cursor on the trackball surface.
   *
   * @param camera - The virtual camera.
   * @param cursorX - Cursor horizontal coordinate on screen.
   * @param cursorY - Cursor vertical coordinate on screen.
   * @param canvas - The canvas where the renderer draws its output.
   * @param tbRadius - The trackball radius.
   * @returns The unprojected point on the trackball surface.
   */
  unprojectOnTbSurface(
    camera: TObject,
    cursorX: number,
    cursorY: number,
    canvas: HTMLElement,
    tbRadius: number,
  ): Vector3 {
    if (camera.type == "OrthographicCamera") {
      this._v2_1.copy(this.getCursorPosition(cursorX, cursorY, canvas));
      this._v3_1.set(this._v2_1.x, this._v2_1.y, 0);

      const x2 = Math.pow(this._v2_1.x, 2);
      const y2 = Math.pow(this._v2_1.y, 2);
      const r2 = Math.pow(this._tbRadius, 2);

      if (x2 + y2 <= r2 * 0.5) {
        //intersection with sphere
        this._v3_1.setZ(Math.sqrt(r2 - (x2 + y2)));
      } else {
        //intersection with hyperboloid
        this._v3_1.setZ((r2 * 0.5) / Math.sqrt(x2 + y2));
      }

      return this._v3_1;
    } else if (camera.type == "PerspectiveCamera") {
      //unproject cursor on the near plane
      this._v2_1.copy(this.getCursorNDC(cursorX, cursorY, canvas));

      this._v3_1.set(this._v2_1.x, this._v2_1.y, -1);
      this._v3_1.applyMatrix4(camera.projectionMatrixInverse);

      const rayDir = this._v3_1.clone().normalize(); //unprojected ray direction
      const cameraGizmoDistance = camera.position.distanceTo(this._gizmos.position);
      const radius2 = Math.pow(tbRadius, 2);

      //	  camera
      //		|\
      //		| \
      //		|  \
      //	h	|	\
      //		| 	 \
      //		| 	  \
      //	_ _ | _ _ _\ _ _  near plane
      //			l

      const h = this._v3_1.z;
      const l = Math.sqrt(Math.pow(this._v3_1.x, 2) + Math.pow(this._v3_1.y, 2));

      if (l == 0) {
        //ray aligned with camera
        rayDir.set(this._v3_1.x, this._v3_1.y, tbRadius);
        return rayDir;
      }

      const m = h / l;
      const q = cameraGizmoDistance;

      /*
       * calculate intersection point between unprojected ray and trackball surface
       *|y = m * x + q
       *|x^2 + y^2 = r^2
       *
       * (m^2 + 1) * x^2 + (2 * m * q) * x + q^2 - r^2 = 0
       */
      let a = Math.pow(m, 2) + 1;
      let b = 2 * m * q;
      let c = Math.pow(q, 2) - radius2;
      let delta = Math.pow(b, 2) - 4 * a * c;

      if (delta >= 0) {
        //intersection with sphere
        this._v2_1.setX((-b - Math.sqrt(delta)) / (2 * a));
        this._v2_1.setY(m * this._v2_1.x + q);

        const angle = RAD2DEG * this._v2_1.angle();

        if (angle >= 45) {
          //if angle between intersection point and X' axis is >= 45°, return that point
          //otherwise, calculate intersection point with hyperboloid

          const rayLength = Math.sqrt(Math.pow(this._v2_1.x, 2) + Math.pow(cameraGizmoDistance - this._v2_1.y, 2));
          rayDir.multiplyScalar(rayLength);
          rayDir.z += cameraGizmoDistance;
          return rayDir;
        }
      }

      //intersection with hyperboloid
      /*
       *|y = m * x + q
       *|y = (1 / x) * (r^2 / 2)
       *
       * m * x^2 + q * x - r^2 / 2 = 0
       */

      a = m;
      b = q;
      c = -radius2 * 0.5;
      delta = Math.pow(b, 2) - 4 * a * c;
      this._v2_1.setX((-b - Math.sqrt(delta)) / (2 * a));
      this._v2_1.setY(m * this._v2_1.x + q);

      const rayLength = Math.sqrt(Math.pow(this._v2_1.x, 2) + Math.pow(cameraGizmoDistance - this._v2_1.y, 2));

      rayDir.multiplyScalar(rayLength);
      rayDir.z += cameraGizmoDistance;
      return rayDir;
    }

    return new Vector3();
  }

  /**
   * Unprojects the cursor on the plane passing through the center of the trackball orthogonal to the camera.
   *
   * @param camera - The virtual camera.
   * @param cursorX - Cursor horizontal coordinate on screen.
   * @param cursorY - Cursor vertical coordinate on screen.
   * @param canvas - The canvas where the renderer draws its output.
   * @param initialDistance - If initial distance between camera and gizmos should be used for calculations instead of current (Perspective only).
   * @returns The unprojected point on the trackball plane.
   */
  unprojectOnTbPlane(
    camera: TObject,
    cursorX: number,
    cursorY: number,
    canvas: HTMLElement,
    initialDistance = false,
  ): Vector3 {
    if (camera.type == "OrthographicCamera") {
      this._v2_1.copy(this.getCursorPosition(cursorX, cursorY, canvas));
      this._v3_1.set(this._v2_1.x, this._v2_1.y, 0);

      return this._v3_1.clone();
    } else if (camera.type == "PerspectiveCamera") {
      this._v2_1.copy(this.getCursorNDC(cursorX, cursorY, canvas));

      //unproject cursor on the near plane
      this._v3_1.set(this._v2_1.x, this._v2_1.y, -1);
      this._v3_1.applyMatrix4(camera.projectionMatrixInverse);

      const rayDir = this._v3_1.clone().normalize(); //unprojected ray direction

      //	  camera
      //		|\
      //		| \
      //		|  \
      //	h	|	\
      //		| 	 \
      //		| 	  \
      //	_ _ | _ _ _\ _ _  near plane
      //			l

      const h = this._v3_1.z;
      const l = Math.sqrt(Math.pow(this._v3_1.x, 2) + Math.pow(this._v3_1.y, 2));
      let cameraGizmoDistance: number;

      if (initialDistance) {
        cameraGizmoDistance = this._v3_1
          .setFromMatrixPosition(this._cameraMatrixState0)
          .distanceTo(this._v3_2.setFromMatrixPosition(this._gizmoMatrixState0));
      } else {
        cameraGizmoDistance = camera.position.distanceTo(this._gizmos.position);
      }

      /*
       * calculate intersection point between unprojected ray and the plane
       *|y = mx + q
       *|y = 0
       *
       * x = -q/m
       */
      if (l == 0) {
        //ray aligned with camera
        rayDir.set(0, 0, 0);
        return rayDir;
      }

      const m = h / l;
      const q = cameraGizmoDistance;
      const x = -q / m;

      const rayLength = Math.sqrt(Math.pow(q, 2) + Math.pow(x, 2));
      rayDir.multiplyScalar(rayLength);
      rayDir.z = 0;
      return rayDir;
    }

    return new Vector3();
  }

  /**
   * Updates camera and gizmos state.
   */
  updateMatrixState(): void {
    //update camera and gizmos state
    this._cameraMatrixState.copy(this.object.matrix);
    this._gizmoMatrixState.copy(this._gizmos.matrix);

    if ((this.object as CameraUnion).isOrthographicCamera == true) {
      this._cameraProjectionState.copy(this.object.projectionMatrix);
      this.object.updateProjectionMatrix();
      this._zoomState = this.object.zoom;
    } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
      this._fovState = (this.object as PerspectiveCamera).fov;
    }
  }

  /**
   * Updates the trackball FSA.
   *
   * @param newState - New state of the FSA.
   * @param updateMatrices - If matrices state should be updated.
   */
  updateTbState(newState: symbol, updateMatrices: boolean): void {
    this._state = newState;
    if (updateMatrices) {
      this.updateMatrixState();
    }
  }

  override update(): void {
    if (this.target.equals(this._currentTarget) === false) {
      this._gizmos.position.copy(this.target); //for correct radius calculation
      this._tbRadius = this.calculateTbRadius(this.object)!;
      this.makeGizmos(this.target, this._tbRadius);
      this._currentTarget.copy(this.target);
    }

    //check min/max parameters
    if ((this.object as CameraUnion).isOrthographicCamera == true) {
      //check zoom
      if (this.object.zoom > this.maxZoom || this.object.zoom < this.minZoom) {
        const newZoom = clamp(this.object.zoom, this.minZoom, this.maxZoom);
        this.applyTransformMatrix(this.scale(newZoom / this.object.zoom, this._gizmos.position, true));
      }
    } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
      //check distance
      const distance = this.object.position.distanceTo(this._gizmos.position);

      if (distance > this.maxDistance + _EPS || distance < this.minDistance - _EPS) {
        const newDistance = clamp(distance, this.minDistance, this.maxDistance);
        this.applyTransformMatrix(this.scale(newDistance / distance, this._gizmos.position));
        this.updateMatrixState();
      }

      //check fov
      if (
        (this.object as PerspectiveCamera).fov < this.minFov ||
        (this.object as PerspectiveCamera).fov > this.maxFov
      ) {
        (this.object as PerspectiveCamera).fov = clamp(
          (this.object as PerspectiveCamera).fov,
          this.minFov,
          this.maxFov,
        );
        this.object.updateProjectionMatrix();
      }

      const oldRadius = this._tbRadius;
      this._tbRadius = this.calculateTbRadius(this.object)!;

      if (oldRadius < this._tbRadius - _EPS || oldRadius > this._tbRadius + _EPS) {
        const scale = (this._gizmos.scale.x + this._gizmos.scale.y + this._gizmos.scale.z) / 3;
        const newRadius = this._tbRadius / scale;
        const curve = new EllipseCurve(0, 0, newRadius, newRadius);
        const points = curve.getPoints(this._curvePts);
        const curveGeometry = new BufferGeometry().setFromPoints(points);

        // The children map is keyed by index, so the `for..in` iteration behaves like a plain loop.
        const gizmos = this._gizmos.children as unknown as Record<string, { geometry: BufferGeometry }>;

        for (const gizmo in gizmos) {
          gizmos[gizmo].geometry = curveGeometry;
        }
      }
    }

    this.object.lookAt(this._gizmos.position);
  }

  /**
   * Sets the controls state from a JSON text as saved from `copyState()`.
   *
   * @param json - The state JSON, either as text or already parsed.
   */
  setStateFromJSON(json: string | { arcballState?: Record<string, unknown> }): void {
    const state = typeof json === "string" ? JSON.parse(json) : json;

    if (state.arcballState != undefined) {
      const arcballState = state.arcballState as {
        target: number[];
        cameraMatrix: { elements: number[] };
        cameraUp: number[];
        cameraNear: number;
        cameraFar: number;
        cameraZoom: number;
        cameraFov?: number;
        gizmoMatrix: { elements: number[] };
      };

      this.target.fromArray(arcballState.target);

      this._cameraMatrixState.fromArray(arcballState.cameraMatrix.elements);
      this._cameraMatrixState.decompose(this.object.position, this.object.quaternion, this.object.scale);

      this.object.up.fromArray(arcballState.cameraUp);
      this.object.near = arcballState.cameraNear;
      this.object.far = arcballState.cameraFar;

      this.object.zoom = arcballState.cameraZoom;

      if (this.object.isPerspectiveCamera) {
        (this.object as PerspectiveCamera).fov = arcballState.cameraFov!;
      }

      this._gizmoMatrixState.fromArray(arcballState.gizmoMatrix.elements);
      this._gizmoMatrixState.decompose(this._gizmos.position, this._gizmos.quaternion, this._gizmos.scale);

      this.object.updateMatrix();
      this.object.updateProjectionMatrix();

      this._gizmos.updateMatrix();

      this._tbRadius = this.calculateTbRadius(this.object)!;
      const gizmoTmp = new Matrix4().copy(this._gizmoMatrixState0);
      this.makeGizmos(this._gizmos.position, this._tbRadius);
      this._gizmoMatrixState0.copy(gizmoTmp);

      this.object.lookAt(this._gizmos.position);
      this.updateTbState(STATE.IDLE, false);

      this.dispatchEvent(_changeEvent);
    }
  }
}

//listeners

function onWindowResize(this: ArcballControls): void {
  const scale = (this._gizmos.scale.x + this._gizmos.scale.y + this._gizmos.scale.z) / 3;
  this._tbRadius = this.calculateTbRadius(this.object)!;

  const newRadius = this._tbRadius / scale;
  const curve = new EllipseCurve(0, 0, newRadius, newRadius);
  const points = curve.getPoints(this._curvePts);
  const curveGeometry = new BufferGeometry().setFromPoints(points);

  // The children map is keyed by index, so the `for..in` iteration behaves like a plain loop.
  const gizmos = this._gizmos.children as unknown as Record<string, { geometry: BufferGeometry }>;

  for (const gizmo in gizmos) {
    gizmos[gizmo].geometry = curveGeometry;
  }

  this.dispatchEvent(_changeEvent);
}

function onContextMenu(this: ArcballControls, event: Event): void {
  if (!this.enabled) {
    return;
  }

  for (let i = 0; i < this.mouseActions.length; i++) {
    if (this.mouseActions[i]!.mouse == 2) {
      //prevent only if button 2 is actually used
      event.preventDefault();
      break;
    }
  }
}

function onPointerCancel(this: ArcballControls): void {
  this._touchStart.splice(0, this._touchStart.length);
  this._touchCurrent.splice(0, this._touchCurrent.length);
  this._input = INPUT.NONE;
}

function onPointerDown(this: ArcballControls, event: PointerEvent): void {
  if (event.button == 0 && event.isPrimary) {
    this._downValid = true;
    this._downEvents.push(event);
    this._downStart = performance.now();
  } else {
    this._downValid = false;
  }

  if (event.pointerType == "touch" && this._input != INPUT.CURSOR) {
    this._touchStart.push(event);
    this._touchCurrent.push(event);

    switch (this._input) {
      case INPUT.NONE:
        //singleStart
        this._input = INPUT.ONE_FINGER;
        this.onSinglePanStart(event, "ROTATE");

        window.addEventListener("pointermove", this._onPointerMove);
        window.addEventListener("pointerup", this._onPointerUp);

        break;

      case INPUT.ONE_FINGER:
      case INPUT.ONE_FINGER_SWITCHED:
        //doubleStart
        this._input = INPUT.TWO_FINGER;

        this.onRotateStart();
        this.onPinchStart();
        this.onDoublePanStart();

        break;

      case INPUT.TWO_FINGER:
        //multipleStart
        this._input = INPUT.MULT_FINGER;
        this.onTriplePanStart();
        break;
    }
  } else if (event.pointerType != "touch" && this._input == INPUT.NONE) {
    let modifier: "CTRL" | "SHIFT" | null = null;

    if (event.ctrlKey || event.metaKey) {
      modifier = "CTRL";
    } else if (event.shiftKey) {
      modifier = "SHIFT";
    }

    this._mouseOp = this.getOpFromAction(event.button, modifier);
    if (this._mouseOp != null) {
      window.addEventListener("pointermove", this._onPointerMove);
      window.addEventListener("pointerup", this._onPointerUp);

      //singleStart
      this._input = INPUT.CURSOR;
      this._button = event.button;
      this.onSinglePanStart(event, this._mouseOp);
    }
  }
}

function onPointerMove(this: ArcballControls, event: PointerEvent): void {
  if (event.pointerType == "touch" && this._input != INPUT.CURSOR) {
    switch (this._input) {
      case INPUT.ONE_FINGER:
        //singleMove
        this.updateTouchEvent(event);

        this.onSinglePanMove(event, STATE.ROTATE);
        break;

      case INPUT.ONE_FINGER_SWITCHED: {
        const movement = this.calculatePointersDistance(this._touchCurrent[0]!, event) * this._devPxRatio;

        if (movement >= this._switchSensibility) {
          //singleMove
          this._input = INPUT.ONE_FINGER;
          this.updateTouchEvent(event);

          this.onSinglePanStart(event, "ROTATE");
          break;
        }

        break;
      }

      case INPUT.TWO_FINGER:
        //rotate/pan/pinchMove
        this.updateTouchEvent(event);

        this.onRotateMove();
        this.onPinchMove();
        this.onDoublePanMove();

        break;

      case INPUT.MULT_FINGER:
        //multMove
        this.updateTouchEvent(event);

        this.onTriplePanMove();
        break;
    }
  } else if (event.pointerType != "touch" && this._input == INPUT.CURSOR) {
    let modifier: "CTRL" | "SHIFT" | null = null;

    if (event.ctrlKey || event.metaKey) {
      modifier = "CTRL";
    } else if (event.shiftKey) {
      modifier = "SHIFT";
    }

    const mouseOpState = this.getOpStateFromAction(this._button, modifier);

    if (mouseOpState != null) {
      this.onSinglePanMove(event, mouseOpState);
    }
  }

  //checkDistance
  if (this._downValid) {
    const movement =
      this.calculatePointersDistance(this._downEvents[this._downEvents.length - 1]!, event) * this._devPxRatio;
    if (movement > this._movementThreshold) {
      this._downValid = false;
    }
  }
}

function onPointerUp(this: ArcballControls, event: PointerEvent): void {
  if (event.pointerType == "touch" && this._input != INPUT.CURSOR) {
    const nTouch = this._touchCurrent.length;

    for (let i = 0; i < nTouch; i++) {
      if (this._touchCurrent[i]!.pointerId == event.pointerId) {
        this._touchCurrent.splice(i, 1);
        this._touchStart.splice(i, 1);
        break;
      }
    }

    switch (this._input) {
      case INPUT.ONE_FINGER:
      case INPUT.ONE_FINGER_SWITCHED:
        //singleEnd
        window.removeEventListener("pointermove", this._onPointerMove);
        window.removeEventListener("pointerup", this._onPointerUp);

        this._input = INPUT.NONE;
        this.onSinglePanEnd();

        break;

      case INPUT.TWO_FINGER:
        //doubleEnd
        this.onDoublePanEnd();
        this.onPinchEnd();
        this.onRotateEnd();

        //switching to singleStart
        this._input = INPUT.ONE_FINGER_SWITCHED;

        break;

      case INPUT.MULT_FINGER:
        if (this._touchCurrent.length == 0) {
          window.removeEventListener("pointermove", this._onPointerMove);
          window.removeEventListener("pointerup", this._onPointerUp);

          //multCancel
          this._input = INPUT.NONE;
          this.onTriplePanEnd();
        }

        break;
    }
  } else if (event.pointerType != "touch" && this._input == INPUT.CURSOR) {
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);

    this._input = INPUT.NONE;
    this.onSinglePanEnd();
    this._button = -1;
  }

  if (event.isPrimary) {
    if (this._downValid) {
      const downTime = event.timeStamp - this._downEvents[this._downEvents.length - 1]!.timeStamp;

      if (downTime <= this._maxDownTime) {
        if (this._nclicks == 0) {
          //first valid click detected
          this._nclicks = 1;
          this._clickStart = performance.now();
        } else {
          const clickInterval = event.timeStamp - this._clickStart;
          const movement =
            this.calculatePointersDistance(this._downEvents[1] as PointerEvent, this._downEvents[0]!) *
            this._devPxRatio;

          if (clickInterval <= this._maxInterval && movement <= this._posThreshold) {
            //second valid click detected
            //fire double tap and reset values
            this._nclicks = 0;
            this._downEvents.splice(0, this._downEvents.length);
            this.onDoubleTap(event);
          } else {
            //new 'first click'
            this._nclicks = 1;
            this._downEvents.shift();
            this._clickStart = performance.now();
          }
        }
      } else {
        this._downValid = false;
        this._nclicks = 0;
        this._downEvents.splice(0, this._downEvents.length);
      }
    } else {
      this._nclicks = 0;
      this._downEvents.splice(0, this._downEvents.length);
    }
  }
}

function onWheel(this: ArcballControls, event: WheelEvent): void {
  if (this.enabled && this.enableZoom) {
    let modifier: "CTRL" | "SHIFT" | null = null;

    if (event.ctrlKey || event.metaKey) {
      modifier = "CTRL";
    } else if (event.shiftKey) {
      modifier = "SHIFT";
    }

    const mouseOp = this.getOpFromAction("WHEEL", modifier);

    if (mouseOp != null) {
      event.preventDefault();
      this.dispatchEvent(_startEvent);

      const notchDeltaY = 125; //distance of one notch of mouse wheel
      let sgn = event.deltaY / notchDeltaY;

      let size = 1;

      if (sgn > 0) {
        size = 1 / this.scaleFactor;
      } else if (sgn < 0) {
        size = this.scaleFactor;
      }

      switch (mouseOp) {
        case "ZOOM":
          this.updateTbState(STATE.SCALE, true);

          if (sgn > 0) {
            size = 1 / Math.pow(this.scaleFactor, sgn);
          } else if (sgn < 0) {
            size = Math.pow(this.scaleFactor, -sgn);
          }

          if (this.cursorZoom && this.enablePan) {
            let scalePoint;

            if ((this.object as CameraUnion).isOrthographicCamera == true) {
              scalePoint = this.unprojectOnTbPlane(this.object, event.clientX, event.clientY, this.domElement!)
                .applyQuaternion(this.object.quaternion)
                .multiplyScalar(1 / this.object.zoom)
                .add(this._gizmos.position);
            } else if ((this.object as CameraUnion).isPerspectiveCamera == true) {
              scalePoint = this.unprojectOnTbPlane(this.object, event.clientX, event.clientY, this.domElement!)
                .applyQuaternion(this.object.quaternion)
                .add(this._gizmos.position);
            }

            this.applyTransformMatrix(this.scale(size, scalePoint!));
          } else {
            this.applyTransformMatrix(this.scale(size, this._gizmos.position));
          }

          if (this._grid != null) {
            this.disposeGrid();
            this.drawGrid();
          }

          this.updateTbState(STATE.IDLE, false);

          this.dispatchEvent(_changeEvent);
          this.dispatchEvent(_endEvent);

          break;

        case "FOV":
          if (this.object.isPerspectiveCamera) {
            this.updateTbState(STATE.FOV, true);

            //Vertigo effect

            //	  fov / 2
            //		|\
            //		| \
            //		|  \
            //	x	|	\
            //		| 	 \
            //		| 	  \
            //		| _ _ _\
            //			y

            //check for iOs shift shortcut
            if (event.deltaX != 0) {
              sgn = event.deltaX / notchDeltaY;

              size = 1;

              if (sgn > 0) {
                size = 1 / Math.pow(this.scaleFactor, sgn);
              } else if (sgn < 0) {
                size = Math.pow(this.scaleFactor, -sgn);
              }
            }

            this._v3_1.setFromMatrixPosition(this._cameraMatrixState);
            const x = this._v3_1.distanceTo(this._gizmos.position);
            let xNew = x / size; //distance between camera and gizmos if scale(size, scalepoint) would be performed

            //check min and max distance
            xNew = clamp(xNew, this.minDistance, this.maxDistance);

            const y = x * Math.tan(DEG2RAD * (this.object as PerspectiveCamera).fov * 0.5);

            //calculate new fov
            let newFov = RAD2DEG * (Math.atan(y / xNew) * 2);

            //check min and max fov
            if (newFov > this.maxFov) {
              newFov = this.maxFov;
            } else if (newFov < this.minFov) {
              newFov = this.minFov;
            }

            const newDistance = y / Math.tan(DEG2RAD * (newFov / 2));
            size = x / newDistance;

            this.setFov(newFov);
            this.applyTransformMatrix(this.scale(size, this._gizmos.position, false));
          }

          if (this._grid != null) {
            this.disposeGrid();
            this.drawGrid();
          }

          this.updateTbState(STATE.IDLE, false);

          this.dispatchEvent(_changeEvent);
          this.dispatchEvent(_endEvent);

          break;
      }
    }
  }
}
