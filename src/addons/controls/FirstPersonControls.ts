import { Controls } from "../../extras/Controls";
import type { Object3D } from "../../core/Object3D";
import { Spherical } from "../../math/Spherical";
import { Vector3 } from "../../math/Vector3";
import { clamp, degToRad, lerp, mapLinear, radToDeg } from "../../math/MathUtils";

const _lookDirection = new Vector3();
const _spherical = new Spherical();
const _target = new Vector3();
const _targetPosition = new Vector3();
const _targetVelocity = new Vector3();

/**
 * This class is an alternative implementation of {@link FlyControls}.
 *
 * @augments Controls
 */
export class FirstPersonControls<TObject extends Object3D = Object3D> extends Controls<TObject> {
  /**
   * The movement speed.
   *
   * @default 1
   */
  movementSpeed: number;

  /**
   * The look around speed.
   *
   * @default 0.005
   */
  lookSpeed: number;

  /**
   * How quickly the movement and look velocity catches up to the input. Lower
   * values feel heavier (more inertia), `1` disables damping.
   *
   * @default 0.1
   */
  dampingFactor: number;

  /**
   * Whether it's possible to vertically look around or not.
   *
   * @default true
   */
  lookVertical: boolean;

  /**
   * Whether the camera is automatically moved forward or not.
   *
   * @default false
   */
  autoForward: boolean;

  /**
   * Whether or not the camera's height influences the forward movement speed.
   * Use the properties `heightCoef`, `heightMin` and `heightMax` for configuration.
   *
   * @default false
   */
  heightSpeed: boolean;

  /**
   * Determines how much faster the camera moves when it's y-component is near `heightMax`.
   *
   * @default 1
   */
  heightCoef: number;

  /**
   * Lower camera height limit used for movement speed adjustment.
   *
   * @default 0
   */
  heightMin: number;

  /**
   * Upper camera height limit used for movement speed adjustment.
   *
   * @default 1
   */
  heightMax: number;

  /**
   * Whether or not looking around is vertically constrained by `verticalMin` and `verticalMax`.
   *
   * @default false
   */
  constrainVertical: boolean;

  /**
   * How far you can vertically look around, lower limit. Range is `0` to `Math.PI` in radians.
   *
   * @default 0
   */
  verticalMin: number;

  /**
   * How far you can vertically look around, upper limit. Range is `0` to `Math.PI` in radians.
   *
   * @default Math.PI
   */
  verticalMax: number;

  /**
   * Whether the mouse is pressed down or not.
   *
   * @readonly
   * @default false
   */
  mouseDragOn: boolean;

  // internals

  _velocity: Vector3;

  _pointerX: number;
  _pointerY: number;

  _pointerDownX: number;
  _pointerDownY: number;

  _pointerCount: number;

  /** forward / backward come from keys and the pointer, tracked per source so they don't
   * clobber: while a forward / backward key is held, a click only looks */
  _keyForward: boolean;
  _keyBackward: boolean;
  _pointerForward: boolean;
  _pointerBackward: boolean;
  _moveLeft: boolean;
  _moveRight: boolean;
  _moveUp: boolean;
  _moveDown: boolean;

  _lat: number;
  _lon: number;

  _lonVelocity: number;
  _latVelocity: number;

  _onPointerMove: (event: PointerEvent) => void;
  _onPointerDown: (event: PointerEvent) => void;
  _onPointerUp: (event: PointerEvent) => void;
  _onContextMenu: (event: Event) => void;
  _onKeyDown: (event: KeyboardEvent) => void;
  _onKeyUp: (event: KeyboardEvent) => void;

  /**
   * Constructs a new controls instance.
   *
   * @param object - The object that is managed by the controls.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(object: TObject, domElement: HTMLElement | null = null) {
    super(object, domElement);

    this.movementSpeed = 1.0;
    this.lookSpeed = 0.005;
    this.dampingFactor = 0.1;
    this.lookVertical = true;
    this.autoForward = false;
    this.heightSpeed = false;
    this.heightCoef = 1.0;
    this.heightMin = 0.0;
    this.heightMax = 1.0;
    this.constrainVertical = false;
    this.verticalMin = 0;
    this.verticalMax = Math.PI;
    this.mouseDragOn = false;

    this._velocity = new Vector3();

    this._pointerX = 0;
    this._pointerY = 0;

    this._pointerDownX = 0;
    this._pointerDownY = 0;

    this._pointerCount = 0;

    // forward / backward come from keys and the pointer, tracked per source so they don't
    // clobber: while a forward / backward key is held, a click only looks
    this._keyForward = false;
    this._keyBackward = false;
    this._pointerForward = false;
    this._pointerBackward = false;
    this._moveLeft = false;
    this._moveRight = false;
    this._moveUp = false;
    this._moveDown = false;

    this._lat = 0;
    this._lon = 0;

    this._lonVelocity = 0;
    this._latVelocity = 0;

    this._onPointerMove = onPointerMove.bind(this);
    this._onPointerDown = onPointerDown.bind(this);
    this._onPointerUp = onPointerUp.bind(this);
    this._onContextMenu = onContextMenu.bind(this);
    this._onKeyDown = onKeyDown.bind(this);
    this._onKeyUp = onKeyUp.bind(this);

    if (domElement !== null) {
      this.connect(domElement);
    }

    this._setOrientation();
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    this.domElement!.addEventListener("pointerdown", this._onPointerDown);
    this.domElement!.addEventListener("contextmenu", this._onContextMenu);

    const ownerDocument = this.domElement!.ownerDocument;

    ownerDocument.addEventListener("pointermove", this._onPointerMove);
    ownerDocument.addEventListener("pointerup", this._onPointerUp);
    ownerDocument.addEventListener("pointercancel", this._onPointerUp);

    this.domElement!.style.touchAction = "none"; // Disable touch scroll
  }

  override disconnect(): void {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);

    this.domElement!.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement!.removeEventListener("contextmenu", this._onContextMenu);

    const ownerDocument = this.domElement!.ownerDocument;

    ownerDocument.removeEventListener("pointermove", this._onPointerMove);
    ownerDocument.removeEventListener("pointerup", this._onPointerUp);
    ownerDocument.removeEventListener("pointercancel", this._onPointerUp);

    this.domElement!.style.touchAction = ""; // Restore touch scroll
  }

  override dispose(): void {
    this.disconnect();
  }

  /**
   * Rotates the camera towards the defined target position.
   *
   * @param x - The x coordinate of the target position or alternatively a vector representing the target position.
   * @param y - The y coordinate of the target position.
   * @param z - The z coordinate of the target position.
   * @return A reference to this controls.
   */
  lookAt(x: Vector3 | number, y?: number, z?: number): this {
    if ((x as Vector3).isVector3) {
      _target.copy(x as Vector3);
    } else {
      // A numeric target always supplies all three coordinates (upstream contract).
      _target.set(x as number, y as number, z as number);
    }

    this.object.lookAt(_target);

    this._setOrientation();

    return this;
  }

  override update(delta: number): void {
    if (this.enabled === false) return;

    let drive = (this._keyForward ? 1 : 0) - (this._keyBackward ? 1 : 0);
    let lookMove = (this._pointerForward ? 1 : 0) - (this._pointerBackward ? 1 : 0);

    if (this.autoForward && drive === 0 && lookMove === 0) lookMove = 1;

    // faster forward movement the higher the camera is

    let forwardSpeed = this.movementSpeed;

    if (this.heightSpeed) {
      const y = clamp(this.object.position.y, this.heightMin, this.heightMax);
      forwardSpeed += (y - this.heightMin) * this.heightCoef;
    }

    // target velocity in world space: keys are world axis aligned, moving in the
    // XZ plane from the camera's yaw only (R / F along world Y), while pointer
    // and touch input moves along the look direction

    const yaw = degToRad(this._lon);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    let strafe = (this._moveRight ? 1 : 0) - (this._moveLeft ? 1 : 0);
    let climb = (this._moveUp ? 1 : 0) - (this._moveDown ? 1 : 0);

    // normalize combined key input so diagonal movement isn't faster

    const keyScale = 1 / Math.max(1, Math.sqrt(strafe * strafe + climb * climb + drive * drive));

    strafe *= this.movementSpeed * keyScale;
    climb *= this.movementSpeed * keyScale;
    drive *= (drive > 0 ? forwardSpeed : this.movementSpeed) * keyScale;

    _targetVelocity.set(sinYaw * drive - cosYaw * strafe, climb, cosYaw * drive + sinYaw * strafe);

    if (lookMove !== 0) {
      _lookDirection.set(0, 0, -1).applyQuaternion(this.object.quaternion);
      _targetVelocity.addScaledVector(_lookDirection, lookMove * (lookMove > 0 ? forwardSpeed : this.movementSpeed));
    }

    // ease toward the target velocity for smooth acceleration and deceleration

    this._velocity.lerp(_targetVelocity, this.dampingFactor);

    this.object.position.addScaledVector(this._velocity, delta);

    let verticalLookRatio = 1;

    if (this.constrainVertical) {
      verticalLookRatio = Math.PI / (this.verticalMax - this.verticalMin);
    }

    // target look velocity, zero when not dragging so the view eases to a stop

    const targetLon = this.mouseDragOn ? -this._pointerX * this.lookSpeed : 0;
    const targetLat = this.mouseDragOn && this.lookVertical ? -this._pointerY * this.lookSpeed * verticalLookRatio : 0;

    this._lonVelocity = lerp(this._lonVelocity, targetLon, this.dampingFactor);
    this._latVelocity = lerp(this._latVelocity, targetLat, this.dampingFactor);

    this._lon += this._lonVelocity * delta;
    this._lat += this._latVelocity * delta;

    this._lat = Math.max(-85, Math.min(85, this._lat));

    let phi = degToRad(90 - this._lat);
    const theta = degToRad(this._lon);

    if (this.constrainVertical) {
      phi = mapLinear(phi, 0, Math.PI, this.verticalMin, this.verticalMax);
    }

    const position = this.object.position;

    _targetPosition.setFromSphericalCoords(1, phi, theta).add(position);

    this.object.lookAt(_targetPosition);
  }

  _setOrientation(): void {
    const quaternion = this.object.quaternion;

    _lookDirection.set(0, 0, -1).applyQuaternion(quaternion);
    _spherical.setFromVector3(_lookDirection);

    this._lat = 90 - radToDeg(_spherical.phi);
    this._lon = radToDeg(_spherical.theta);
  }
}

function onPointerDown(this: FirstPersonControls, event: PointerEvent): void {
  if (this.enabled === false) return;

  this.domElement!.focus();

  this.domElement!.setPointerCapture(event.pointerId);

  this._pointerCount++;

  if (event.pointerType === "touch") {
    this._pointerForward = this._pointerCount === 1;
    this._pointerBackward = this._pointerCount >= 2;
  } else {
    switch (event.button) {
      case 0:
        if (!this._keyForward && !this._keyBackward) this._pointerForward = true;
        break;
      case 2:
        if (!this._keyForward && !this._keyBackward) this._pointerBackward = true;
        break;
    }
  }

  this._pointerDownX = event.pageX;
  this._pointerDownY = event.pageY;

  this._pointerX = 0;
  this._pointerY = 0;

  this.mouseDragOn = true;
}

function onPointerUp(this: FirstPersonControls, event: PointerEvent): void {
  if (this.mouseDragOn === false) return;

  this.domElement!.releasePointerCapture(event.pointerId);

  this._pointerCount--;

  if (event.pointerType === "touch") {
    this._pointerForward = this._pointerCount === 1;
    this._pointerBackward = false;
  } else {
    switch (event.button) {
      case 0:
        this._pointerForward = false;
        break;
      case 2:
        this._pointerBackward = false;
        break;
    }
  }

  this._pointerX = 0;
  this._pointerY = 0;

  if (this._pointerCount === 0) this.mouseDragOn = false;
}

function onPointerMove(this: FirstPersonControls, event: PointerEvent): void {
  if (this.mouseDragOn === false) return;

  this._pointerX = event.pageX - this._pointerDownX;
  this._pointerY = event.pageY - this._pointerDownY;
}

function onKeyDown(this: FirstPersonControls, event: KeyboardEvent): void {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      this._keyForward = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      this._moveLeft = true;
      break;
    case "ArrowDown":
    case "KeyS":
      this._keyBackward = true;
      break;
    case "ArrowRight":
    case "KeyD":
      this._moveRight = true;
      break;
    case "KeyR":
      this._moveUp = true;
      break;
    case "KeyF":
      this._moveDown = true;
      break;
  }
}

function onKeyUp(this: FirstPersonControls, event: KeyboardEvent): void {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      this._keyForward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      this._moveLeft = false;
      break;
    case "ArrowDown":
    case "KeyS":
      this._keyBackward = false;
      break;
    case "ArrowRight":
    case "KeyD":
      this._moveRight = false;
      break;
    case "KeyR":
      this._moveUp = false;
      break;
    case "KeyF":
      this._moveDown = false;
      break;
  }
}

function onContextMenu(this: FirstPersonControls, event: Event): void {
  if (this.enabled === false) return;

  event.preventDefault();
}
