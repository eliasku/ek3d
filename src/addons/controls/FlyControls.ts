import { Controls } from "../../extras/Controls";
import type { Object3D } from "../../core/Object3D";
import { Quaternion } from "../../math/Quaternion";
import { Vector3 } from "../../math/Vector3";

/**
 * Fires when the camera has been transformed by the controls.
 */
const _changeEvent = { type: "change" };

const _EPS = 0.000001;
const _tmpQuaternion = new Quaternion();

/** Movement axes tracked as pressed keys or pointer buttons. */
interface MoveState {
  up: number;
  down: number;
  left: number;
  right: number;
  forward: number;
  back: number;
  pitchUp: number;
  pitchDown: number;
  yawLeft: number;
  yawRight: number;
  rollLeft: number;
  rollRight: number;
}

/**
 * This class enables a navigation similar to fly modes in DCC tools like Blender.
 * You can arbitrarily transform the camera in 3D space without any limitations
 * (e.g. focus on a specific target).
 *
 * @augments Controls
 */
export class FlyControls<TObject extends Object3D = Object3D> extends Controls<TObject> {
  /**
   * The movement speed.
   *
   * @default 1
   */
  movementSpeed: number;

  /**
   * The rotation speed.
   *
   * @default 0.005
   */
  rollSpeed: number;

  /**
   * If set to `true`, you can only look around by performing a drag interaction.
   *
   * @default false
   */
  dragToLook: boolean;

  /**
   * If set to `true`, the camera automatically moves forward (and does not stop) when initially translated.
   *
   * @default false
   */
  autoForward: boolean;

  /**
   * Multiplier applied while a Shift key is held. Upstream keeps the field dormant:
   * the handlers assign it, `update()` does not read it.
   *
   * @default 1
   */
  movementSpeedMultiplier: number;

  // internals

  _moveState: MoveState;
  _moveVector: Vector3;
  _rotationVector: Vector3;
  _lastQuaternion: Quaternion;
  _lastPosition: Vector3;
  _status: number;

  _onKeyDown: (event: KeyboardEvent) => void;
  _onKeyUp: (event: KeyboardEvent) => void;
  _onPointerMove: (event: PointerEvent) => void;
  _onPointerDown: (event: PointerEvent) => void;
  _onPointerUp: (event: PointerEvent) => void;
  _onPointerCancel: () => void;
  _onContextMenu: (event: Event) => void;

  /**
   * Constructs a new controls instance.
   *
   * @param object - The object that is managed by the controls.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(object: TObject, domElement: HTMLElement | Document | null = null) {
    super(object, domElement as HTMLElement | null);

    this.movementSpeed = 1.0;
    this.rollSpeed = 0.005;
    this.dragToLook = false;
    this.autoForward = false;
    this.movementSpeedMultiplier = 1;

    this._moveState = {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
      forward: 0,
      back: 0,
      pitchUp: 0,
      pitchDown: 0,
      yawLeft: 0,
      yawRight: 0,
      rollLeft: 0,
      rollRight: 0,
    };
    this._moveVector = new Vector3(0, 0, 0);
    this._rotationVector = new Vector3(0, 0, 0);
    this._lastQuaternion = new Quaternion();
    this._lastPosition = new Vector3();
    this._status = 0;

    this._onKeyDown = onKeyDown.bind(this);
    this._onKeyUp = onKeyUp.bind(this);
    this._onPointerMove = onPointerMove.bind(this);
    this._onPointerDown = onPointerDown.bind(this);
    this._onPointerUp = onPointerUp.bind(this);
    this._onPointerCancel = onPointerCancel.bind(this);
    this._onContextMenu = onContextMenu.bind(this);

    if (domElement !== null) {
      this.connect(domElement as HTMLElement);
    }
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    this.domElement!.addEventListener("pointermove", this._onPointerMove);
    this.domElement!.addEventListener("pointerdown", this._onPointerDown);
    this.domElement!.addEventListener("pointerup", this._onPointerUp);
    this.domElement!.addEventListener("pointercancel", this._onPointerCancel);
    this.domElement!.addEventListener("contextmenu", this._onContextMenu);

    this.domElement!.style.touchAction = "none"; // Disable touch scroll
  }

  override disconnect(): void {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);

    this.domElement!.removeEventListener("pointermove", this._onPointerMove);
    this.domElement!.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement!.removeEventListener("pointerup", this._onPointerUp);
    this.domElement!.removeEventListener("pointercancel", this._onPointerCancel);
    this.domElement!.removeEventListener("contextmenu", this._onContextMenu);

    this.domElement!.style.touchAction = ""; // Restore touch scroll
  }

  override dispose(): void {
    this.disconnect();
  }

  override update(delta: number): void {
    if (this.enabled === false) return;

    const object = this.object;

    const moveMult = delta * this.movementSpeed;
    const rotMult = delta * this.rollSpeed;

    object.translateX(this._moveVector.x * moveMult);
    object.translateY(this._moveVector.y * moveMult);
    object.translateZ(this._moveVector.z * moveMult);

    _tmpQuaternion
      .set(this._rotationVector.x * rotMult, this._rotationVector.y * rotMult, this._rotationVector.z * rotMult, 1)
      .normalize();
    object.quaternion.multiply(_tmpQuaternion);

    if (
      this._lastPosition.distanceToSquared(object.position) > _EPS ||
      8 * (1 - this._lastQuaternion.dot(object.quaternion)) > _EPS
    ) {
      this.dispatchEvent(_changeEvent);
      this._lastQuaternion.copy(object.quaternion);
      this._lastPosition.copy(object.position);
    }
  }

  // private

  _updateMovementVector(): void {
    const forward = this._moveState.forward || (this.autoForward && !this._moveState.back) ? 1 : 0;

    this._moveVector.x = -this._moveState.left + this._moveState.right;
    this._moveVector.y = -this._moveState.down + this._moveState.up;
    this._moveVector.z = -forward + this._moveState.back;
  }

  _updateRotationVector(): void {
    this._rotationVector.x = -this._moveState.pitchDown + this._moveState.pitchUp;
    this._rotationVector.y = -this._moveState.yawRight + this._moveState.yawLeft;
    this._rotationVector.z = -this._moveState.rollRight + this._moveState.rollLeft;
  }

  _getContainerDimensions(): { size: [number, number]; offset: [number, number] } {
    if (this.domElement !== null && this.domElement !== undefined) {
      const element = this.domElement as HTMLElement;
      return {
        size: [element.offsetWidth, element.offsetHeight],
        offset: [element.offsetLeft, element.offsetTop],
      };
    } else {
      return {
        size: [window.innerWidth, window.innerHeight],
        offset: [0, 0],
      };
    }
  }
}

function onKeyDown(this: FlyControls, event: KeyboardEvent): void {
  if (event.altKey || this.enabled === false) {
    return;
  }

  switch (event.code) {
    case "ShiftLeft":
    case "ShiftRight":
      this.movementSpeedMultiplier = 0.1;
      break;
    case "KeyW":
      this._moveState.forward = 1;
      break;
    case "KeyS":
      this._moveState.back = 1;
      break;
    case "KeyA":
      this._moveState.left = 1;
      break;
    case "KeyD":
      this._moveState.right = 1;
      break;
    case "KeyR":
      this._moveState.up = 1;
      break;
    case "KeyF":
      this._moveState.down = 1;
      break;
    case "ArrowUp":
      this._moveState.pitchUp = 1;
      break;
    case "ArrowDown":
      this._moveState.pitchDown = 1;
      break;
    case "ArrowLeft":
      this._moveState.yawLeft = 1;
      break;
    case "ArrowRight":
      this._moveState.yawRight = 1;
      break;
    case "KeyQ":
      this._moveState.rollLeft = 1;
      break;
    case "KeyE":
      this._moveState.rollRight = 1;
      break;
  }

  this._updateMovementVector();
  this._updateRotationVector();
}

function onKeyUp(this: FlyControls, event: KeyboardEvent): void {
  if (this.enabled === false) return;

  switch (event.code) {
    case "ShiftLeft":
    case "ShiftRight":
      this.movementSpeedMultiplier = 1;
      break;
    case "KeyW":
      this._moveState.forward = 0;
      break;
    case "KeyS":
      this._moveState.back = 0;
      break;
    case "KeyA":
      this._moveState.left = 0;
      break;
    case "KeyD":
      this._moveState.right = 0;
      break;
    case "KeyR":
      this._moveState.up = 0;
      break;
    case "KeyF":
      this._moveState.down = 0;
      break;
    case "ArrowUp":
      this._moveState.pitchUp = 0;
      break;
    case "ArrowDown":
      this._moveState.pitchDown = 0;
      break;
    case "ArrowLeft":
      this._moveState.yawLeft = 0;
      break;
    case "ArrowRight":
      this._moveState.yawRight = 0;
      break;
    case "KeyQ":
      this._moveState.rollLeft = 0;
      break;
    case "KeyE":
      this._moveState.rollRight = 0;
      break;
  }

  this._updateMovementVector();
  this._updateRotationVector();
}

function onPointerDown(this: FlyControls, event: PointerEvent): void {
  if (this.enabled === false) return;

  if (this.dragToLook) {
    this._status++;
  } else {
    switch (event.button) {
      case 0:
        this._moveState.forward = 1;
        break;
      case 2:
        this._moveState.back = 1;
        break;
    }

    this._updateMovementVector();
  }
}

function onPointerMove(this: FlyControls, event: PointerEvent): void {
  if (this.enabled === false) return;

  if (!this.dragToLook || this._status > 0) {
    const container = this._getContainerDimensions();
    const halfWidth = container.size[0] / 2;
    const halfHeight = container.size[1] / 2;

    this._moveState.yawLeft = -(event.pageX - container.offset[0] - halfWidth) / halfWidth;
    this._moveState.pitchDown = (event.pageY - container.offset[1] - halfHeight) / halfHeight;

    this._updateRotationVector();
  }
}

function onPointerUp(this: FlyControls, event: PointerEvent): void {
  if (this.enabled === false) return;

  if (this.dragToLook) {
    this._status--;

    this._moveState.yawLeft = this._moveState.pitchDown = 0;
  } else {
    switch (event.button) {
      case 0:
        this._moveState.forward = 0;
        break;
      case 2:
        this._moveState.back = 0;
        break;
    }

    this._updateMovementVector();
  }

  this._updateRotationVector();
}

function onPointerCancel(this: FlyControls): void {
  if (this.enabled === false) return;

  if (this.dragToLook) {
    this._status = 0;

    this._moveState.yawLeft = this._moveState.pitchDown = 0;
  } else {
    this._moveState.forward = 0;
    this._moveState.back = 0;

    this._updateMovementVector();
  }

  this._updateRotationVector();
}

function onContextMenu(this: FlyControls, event: Event): void {
  if (this.enabled === false) return;

  event.preventDefault();
}
