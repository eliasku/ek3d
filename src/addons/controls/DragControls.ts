import { MOUSE, TOUCH } from "../../constants";
import type { Camera } from "../../cameras/Camera";
import { Controls } from "../../extras/Controls";
import { Group } from "../../objects/Group";
import type { Object3D } from "../../core/Object3D";
import { Matrix4 } from "../../math/Matrix4";
import { Plane } from "../../math/Plane";
import { Raycaster } from "../../core/Raycaster";
import type { Intersection } from "../../core/Raycaster";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";

const _plane = new Plane();

const _pointer = new Vector2();
const _offset = new Vector3();
const _diff = new Vector2();
const _previousPointer = new Vector2();
const _intersection = new Vector3();
const _worldPosition = new Vector3();
const _inverseMatrix = new Matrix4();

const _up = new Vector3();
const _right = new Vector3();

let _selected: Object3D | null = null;
let _hovered: Object3D | null = null;
const _intersections: Intersection[] = [];

const STATE = {
  NONE: -1,
  PAN: 0,
  ROTATE: 1,
};

/**
 * This class can be used to provide a drag'n'drop interaction.
 *
 * ```typescript
 * const controls = new DragControls( objects, camera, renderer.domElement );
 *
 * // add event listener to highlight dragged objects
 * controls.addEventListener( 'dragstart', function ( event ) {
 *
 * 	event.object.material.emissive.set( 0xaaaaaa );
 *
 * } );
 *
 * controls.addEventListener( 'dragend', function ( event ) {
 *
 * 	event.object.material.emissive.set( 0x000000 );
 *
 * } );
 * ```
 *
 * @augments Controls
 */
export class DragControls<TObject extends Camera = Camera> extends Controls<TObject> {
  /**
   * An array of draggable 3D objects.
   */
  objects: Object3D[];

  /**
   * Whether children of draggable objects can be dragged independently from their parent.
   *
   * @default true
   */
  recursive: boolean;

  /**
   * This option only works if the `objects` array contains a single draggable  group object.
   * If set to `true`, the controls does not transform individual objects but the entire group.
   *
   * @default false
   */
  transformGroup: boolean;

  /**
   * The speed at which the object will rotate when dragged in `rotate` mode.
   * The higher the number the faster the rotation.
   *
   * @default 1
   */
  rotateSpeed: number;

  /**
   * The raycaster used for detecting 3D objects.
   */
  raycaster: Raycaster;

  _onPointerMove: (event: PointerEvent) => void;
  _onPointerDown: (event: PointerEvent) => void;
  _onPointerCancel: () => void;
  _onContextMenu: (event: Event) => void;

  /**
   * Constructs a new controls instance.
   *
   * @param objects - An array of draggable 3D objects.
   * @param camera - The camera of the rendered scene.
   * @param domElement - The HTML DOM element used for event listeners.
   */
  constructor(objects: Object3D[], camera: TObject, domElement: HTMLElement | null = null) {
    super(camera, domElement);

    this.objects = objects;
    this.recursive = true;
    this.transformGroup = false;
    this.rotateSpeed = 1;
    this.raycaster = new Raycaster();

    this.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
    this.touches = { ONE: TOUCH.PAN, TWO: null };

    this._onPointerMove = onPointerMove.bind(this);
    this._onPointerDown = onPointerDown.bind(this);
    this._onPointerCancel = onPointerCancel.bind(this);
    this._onContextMenu = onContextMenu.bind(this);

    if (domElement !== null) {
      this.connect(domElement);
    }
  }

  override connect(element: HTMLElement): void {
    super.connect(element);

    this.domElement!.addEventListener("pointermove", this._onPointerMove);
    this.domElement!.addEventListener("pointerdown", this._onPointerDown);
    this.domElement!.addEventListener("pointerup", this._onPointerCancel);
    this.domElement!.addEventListener("pointerleave", this._onPointerCancel);
    this.domElement!.addEventListener("contextmenu", this._onContextMenu);

    this.domElement!.style.touchAction = "none"; // Disable touch scroll
  }

  override disconnect(): void {
    this.domElement!.removeEventListener("pointermove", this._onPointerMove);
    this.domElement!.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement!.removeEventListener("pointerup", this._onPointerCancel);
    this.domElement!.removeEventListener("pointerleave", this._onPointerCancel);
    this.domElement!.removeEventListener("contextmenu", this._onContextMenu);

    this.domElement!.style.touchAction = ""; // Restore touch scroll
    this.domElement!.style.cursor = "";
  }

  override dispose(): void {
    this.disconnect();
  }

  override update(): void {}

  _updatePointer(event: Pick<PointerEvent, "clientX" | "clientY">): void {
    const rect = this.domElement!.getBoundingClientRect();

    _pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _updateState(event: { pointerType: string; button: number }): void {
    // determine action

    let action: number | null;

    if (event.pointerType === "touch") {
      action = this.touches.ONE;
    } else {
      switch (event.button) {
        case 0:
          action = this.mouseButtons.LEFT;
          break;

        case 1:
          action = this.mouseButtons.MIDDLE;
          break;

        case 2:
          action = this.mouseButtons.RIGHT;
          break;

        default:
          action = null;
      }
    }

    // determine state

    switch (action) {
      case MOUSE.PAN:
      case TOUCH.PAN:
        this.state = STATE.PAN;
        break;

      case MOUSE.ROTATE:
      case TOUCH.ROTATE:
        this.state = STATE.ROTATE;
        break;

      default:
        this.state = STATE.NONE;
    }
  }
}

function onPointerMove(this: DragControls, event: PointerEvent): void {
  const camera = this.object;
  const domElement = this.domElement!;
  const raycaster = this.raycaster;

  if (this.enabled === false) return;

  this._updatePointer(event);

  raycaster.setFromCamera(_pointer, camera);

  if (_selected) {
    if (this.state === STATE.PAN) {
      if (raycaster.ray.intersectPlane(_plane, _intersection)) {
        _selected.position.copy(_intersection.sub(_offset).applyMatrix4(_inverseMatrix));
        this.dispatchEvent({ type: "drag", object: _selected });
      }
    } else if (this.state === STATE.ROTATE) {
      _diff.subVectors(_pointer, _previousPointer).multiplyScalar(this.rotateSpeed);
      _selected.rotateOnWorldAxis(_up, _diff.x);
      _selected.rotateOnWorldAxis(_right.normalize(), -_diff.y);
      this.dispatchEvent({ type: "drag", object: _selected });
    }

    _previousPointer.copy(_pointer);
  } else {
    // hover support

    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      _intersections.length = 0;

      raycaster.setFromCamera(_pointer, camera);
      raycaster.intersectObjects(this.objects, this.recursive, _intersections);

      if (_intersections.length > 0) {
        const object = _intersections[0].object;

        _plane.setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(_plane.normal),
          _worldPosition.setFromMatrixPosition(object.matrixWorld),
        );

        if (_hovered !== object && _hovered !== null) {
          this.dispatchEvent({ type: "hoveroff", object: _hovered });

          domElement.style.cursor = "auto";
          _hovered = null;
        }

        if (_hovered !== object) {
          this.dispatchEvent({ type: "hoveron", object });

          domElement.style.cursor = "pointer";
          _hovered = object;
        }
      } else {
        if (_hovered !== null) {
          this.dispatchEvent({ type: "hoveroff", object: _hovered });

          domElement.style.cursor = "auto";
          _hovered = null;
        }
      }
    }
  }

  _previousPointer.copy(_pointer);
}

function onPointerDown(this: DragControls, event: PointerEvent): void {
  const camera = this.object;
  const domElement = this.domElement!;
  const raycaster = this.raycaster;

  if (this.enabled === false) return;

  this._updatePointer(event);
  this._updateState(event);

  _intersections.length = 0;

  raycaster.setFromCamera(_pointer, camera);
  raycaster.intersectObjects(this.objects, this.recursive, _intersections);

  if (_intersections.length > 0) {
    const selected =
      this.transformGroup === true
        ? // look for the outermost group in the object's upper hierarchy
          findGroup(_intersections[0].object)
        : _intersections[0].object;
    if (selected === null) return;
    _selected = selected;

    _plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(_plane.normal),
      _worldPosition.setFromMatrixPosition(_selected.matrixWorld),
    );

    if (raycaster.ray.intersectPlane(_plane, _intersection)) {
      if (this.state === STATE.PAN) {
        if (_selected.parent === null) return;
        _inverseMatrix.copy(_selected.parent.matrixWorld).invert();
        _offset.copy(_intersection).sub(_worldPosition.setFromMatrixPosition(_selected.matrixWorld));
        domElement.style.cursor = "move";
        this.dispatchEvent({ type: "dragstart", object: _selected });
      } else if (this.state === STATE.ROTATE) {
        // the controls only support Y+ up
        _up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        domElement.style.cursor = "move";
        this.dispatchEvent({ type: "dragstart", object: _selected });
      }
    }
  }

  _previousPointer.copy(_pointer);
}

function onPointerCancel(this: DragControls): void {
  if (this.enabled === false) return;

  if (_selected) {
    this.dispatchEvent({ type: "dragend", object: _selected });

    _selected = null;
  }

  this.domElement!.style.cursor = _hovered ? "pointer" : "auto";

  this.state = STATE.NONE;
}

function onContextMenu(this: DragControls, event: Event): void {
  if (this.enabled === false) return;

  event.preventDefault();
}

function findGroup(obj: Object3D, group: Object3D | null = null): Object3D | null {
  if (obj instanceof Group) group = obj;

  if (obj.parent === null) return group;

  return findGroup(obj.parent, group);
}
