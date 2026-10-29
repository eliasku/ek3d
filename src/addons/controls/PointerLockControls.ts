import type { Camera } from "../../cameras/Camera";
import { Controls } from "../../extras/Controls";
import { Euler } from "../../math/Euler";
import { Vector3 } from "../../math/Vector3";

const _euler = new Euler(0, 0, 0, "YXZ");
const _vector = new Vector3();

/**
 * Fires when the user moves the mouse.
 */
const _changeEvent = { type: "change" };

/**
 * Fires when the pointer lock status is "locked" (in other words: the mouse is captured).
 */
const _lockEvent = { type: "lock" };

/**
 * Fires when the pointer lock status is "unlocked" (in other words: the mouse is not captured anymore).
 */
const _unlockEvent = { type: "unlock" };

const _MOUSE_SENSITIVITY = 0.002;
const _PI_2 = Math.PI / 2;

/**
 * The implementation of this class is based on the [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API).
 * `PointerLockControls` is a perfect choice for first person 3D games.
 *
 * ```ts
 * const controls = new PointerLockControls( camera, document.body );
 *
 * // add event listener to show/hide a UI (e.g. the game's menu)
 * controls.addEventListener( 'lock', function () {
 *
 * 	menu.style.display = 'none';
 *
 * } );
 *
 * controls.addEventListener( 'unlock', function () {
 *
 * 	menu.style.display = 'block';
 *
 * } );
 * ```
 *
 * @augments Controls
 */
export class PointerLockControls<TObject extends Camera = Camera> extends Controls<TObject> {
  /**
   * Whether the controls are locked or not.
   *
   * @default false
   */
  isLocked: boolean;

  /**
   * Camera pitch, lower limit. Range is '[0, Math.PI]' in radians.
   *
   * @default 0
   */
  minPolarAngle: number;

  /**
   * Camera pitch, upper limit. Range is '[0, Math.PI]' in radians.
   *
   * @default Math.PI
   */
  maxPolarAngle: number;

  /**
   * Multiplier for how much the pointer movement influences the camera rotation.
   *
   * @default 1
   */
  pointerSpeed: number;

  _onMouseMove: (event: MouseEvent) => void;
  _onPointerlockChange: () => void;
  _onPointerlockError: () => void;

  /**
   * Constructs a new controls instance.
   *
   * @param camera - The camera that is managed by the controls.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(camera: TObject, domElement: HTMLElement | null = null) {
    super(camera, domElement);

    this.isLocked = false;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.pointerSpeed = 1.0;

    this._onMouseMove = onMouseMove.bind(this);
    this._onPointerlockChange = onPointerlockChange.bind(this);
    this._onPointerlockError = onPointerlockError.bind(this);

    if (this.domElement !== null) {
      this.connect(this.domElement);
    }
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    this.domElement!.ownerDocument.addEventListener("mousemove", this._onMouseMove);
    this.domElement!.ownerDocument.addEventListener("pointerlockchange", this._onPointerlockChange);
    this.domElement!.ownerDocument.addEventListener("pointerlockerror", this._onPointerlockError);
  }

  override disconnect(): void {
    this.domElement!.ownerDocument.removeEventListener("mousemove", this._onMouseMove);
    this.domElement!.ownerDocument.removeEventListener("pointerlockchange", this._onPointerlockChange);
    this.domElement!.ownerDocument.removeEventListener("pointerlockerror", this._onPointerlockError);
  }

  override dispose(): void {
    this.disconnect();
  }

  override update(): void {}

  /**
   * Returns the look direction of the camera.
   *
   * @param v - The target vector that is used to store the method's result.
   * @return The normalized direction vector.
   */
  getDirection(v: Vector3): Vector3 {
    return v.set(0, 0, -1).applyQuaternion(this.object.quaternion);
  }

  /**
   * Moves the camera forward parallel to the xz-plane. Assumes camera.up is y-up.
   *
   * @param distance - The signed distance.
   */
  moveForward(distance: number): void {
    if (this.enabled === false) return;

    // move forward parallel to the xz-plane
    // assumes camera.up is y-up

    const camera = this.object;

    _vector.setFromMatrixColumn(camera.matrix, 0);

    _vector.crossVectors(camera.up, _vector);

    camera.position.addScaledVector(_vector, distance);
  }

  /**
   * Moves the camera sidewards parallel to the xz-plane.
   *
   * @param distance - The signed distance.
   */
  moveRight(distance: number): void {
    if (this.enabled === false) return;

    const camera = this.object;

    _vector.setFromMatrixColumn(camera.matrix, 0);

    camera.position.addScaledVector(_vector, distance);
  }

  /**
   * Activates the pointer lock.
   *
   * @param unadjustedMovement - Disables OS-level adjustment for mouse acceleration, and accesses raw mouse input instead.
   * Setting it to true will disable mouse acceleration.
   */
  lock(unadjustedMovement: boolean = false): void {
    // The lock request resolves asynchronously through pointerlockchange; nothing to await here.
    void this.domElement!.requestPointerLock({ unadjustedMovement });
  }

  /**
   * Exits the pointer lock.
   */
  unlock(): void {
    this.domElement!.ownerDocument.exitPointerLock();
  }
}

// event listeners

function onMouseMove(this: PointerLockControls, event: MouseEvent): void {
  if (this.enabled === false || this.isLocked === false) return;

  const camera = this.object;
  _euler.setFromQuaternion(camera.quaternion);

  _euler.y -= event.movementX * _MOUSE_SENSITIVITY * this.pointerSpeed;
  _euler.x -= event.movementY * _MOUSE_SENSITIVITY * this.pointerSpeed;

  _euler.x = Math.max(_PI_2 - this.maxPolarAngle, Math.min(_PI_2 - this.minPolarAngle, _euler.x));

  camera.quaternion.setFromEuler(_euler);

  this.dispatchEvent(_changeEvent);
}

function onPointerlockChange(this: PointerLockControls): void {
  if (this.domElement!.ownerDocument.pointerLockElement === this.domElement) {
    this.dispatchEvent(_lockEvent);

    this.isLocked = true;
  } else {
    this.dispatchEvent(_unlockEvent);

    this.isLocked = false;
  }
}

function onPointerlockError(this: PointerLockControls): void {
  console.error("THREE.PointerLockControls: Unable to use Pointer Lock API");
}
