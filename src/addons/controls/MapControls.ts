import { MOUSE, TOUCH } from "../../constants";
import { Plane } from "../../math/Plane";
import { Raycaster } from "../../core/Raycaster";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";
import type { OrthographicCamera } from "../../cameras/OrthographicCamera";
import type { PerspectiveCamera } from "../../cameras/PerspectiveCamera";
import { OrbitControls } from "./OrbitControls";

/** The camera types supported by {@link MapControls}. */
type MapCamera = PerspectiveCamera | OrthographicCamera;

const _plane = new Plane();
const _raycaster = new Raycaster();
const _mouse = new Vector2();
const _panCurrent = new Vector3();

/**
 * This class is intended for transforming a camera over a map from bird's eye perspective.
 * The class shares its implementation with {@link OrbitControls} but uses a specific preset
 * for mouse/touch interaction and disables screen space panning by default.
 *
 * - Orbit: Right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate.
 * - Zoom: Middle mouse, or mousewheel / touch: two-finger spread or squish.
 * - Pan: Left mouse, or arrow keys / touch: one-finger move.
 *
 * @augments OrbitControls
 */
export class MapControls<TObject extends MapCamera = MapCamera> extends OrbitControls<TObject> {
  _panWorldStart: Vector3;

  /**
   * Constructs a new controls instance.
   *
   * @param object - The camera that is managed by the controls.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(object: TObject, domElement: HTMLElement | null = null) {
    super(object, domElement);

    /**
     * Overwritten and set to `false` to pan orthogonal to world-space direction `camera.up`.
     *
     * @default false
     */
    this.screenSpacePanning = false;

    /**
     * This object contains references to the mouse actions used by the controls.
     *
     * @default {LEFT: PAN, MIDDLE: DOLLY, RIGHT: ROTATE}
     */
    this.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };

    /**
     * This object contains references to the touch actions used by the controls.
     *
     * @default {ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE}
     */
    this.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };

    this._panWorldStart = new Vector3();
  }

  override _handleMouseDownPan(event: { clientX: number; clientY: number }): void {
    super._handleMouseDownPan(event);

    this._panOffset.set(0, 0, 0);

    if (this.screenSpacePanning === true) return;

    _plane.setFromNormalAndCoplanarPoint(this.object.up, this.target);

    const element = this.domElement;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_mouse, this.object);
    _raycaster.ray.intersectPlane(_plane, this._panWorldStart);
  }

  override _handleMouseMovePan(event: { clientX: number; clientY: number }): void {
    if (this.screenSpacePanning === true) {
      super._handleMouseMovePan(event);
      return;
    }

    const element = this.domElement;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_mouse, this.object);

    if (_raycaster.ray.intersectPlane(_plane, _panCurrent)) {
      _panCurrent.sub(this._panWorldStart);
      this._panOffset.copy(_panCurrent).negate();

      this.update();
    }
  }
}
