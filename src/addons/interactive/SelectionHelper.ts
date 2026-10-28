import { Vector2 } from "../../math/Vector2";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";

/**
 * A helper for {@link SelectionBox}.
 *
 * It visualizes the current selection box with a `div` container element.
 */
export class SelectionHelper {
  /**
   * The visualization of the selection box.
   */
  element: HTMLDivElement;

  /**
   * A reference to the renderer.
   */
  renderer: WebGLRenderer;

  /**
   * Whether the mouse or pointer is pressed down.
   */
  isDown: boolean;

  /**
   * Whether helper is enabled or not.
   */
  enabled: boolean;

  _startPoint: Vector2;
  _pointTopLeft: Vector2;
  _pointBottomRight: Vector2;

  _onPointerDown: (event: PointerEvent) => void;
  _onPointerMove: (event: PointerEvent) => void;
  _onPointerUp: () => void;

  /**
   * Constructs a new selection helper.
   *
   * @param renderer - The renderer.
   * @param cssClassName - The CSS class name of the `div`.
   */
  constructor(renderer: WebGLRenderer, cssClassName: string) {
    this.element = document.createElement("div");
    this.element.classList.add(cssClassName);
    this.element.style.pointerEvents = "none";

    this.renderer = renderer;

    this.isDown = false;
    this.enabled = true;

    this._startPoint = new Vector2();
    this._pointTopLeft = new Vector2();
    this._pointBottomRight = new Vector2();

    this._onPointerDown = (event: PointerEvent) => {
      if (this.enabled === false) return;

      this.isDown = true;
      this._onSelectStart(event);
    };

    this._onPointerMove = (event: PointerEvent) => {
      if (this.enabled === false) return;

      if (this.isDown) {
        this._onSelectMove(event);
      }
    };

    this._onPointerUp = () => {
      if (this.enabled === false) return;

      this.isDown = false;
      this._onSelectOver();
    };

    const listen = this.renderer.domElement as HTMLCanvasElement;
    listen.addEventListener("pointerdown", this._onPointerDown);
    listen.addEventListener("pointermove", this._onPointerMove);
    listen.addEventListener("pointerup", this._onPointerUp);
  }

  /**
   * Call this method if you no longer want use to the controls. It frees all internal
   * resources and removes all event listeners.
   */
  dispose(): void {
    const listen = this.renderer.domElement as HTMLCanvasElement;
    listen.removeEventListener("pointerdown", this._onPointerDown);
    listen.removeEventListener("pointermove", this._onPointerMove);
    listen.removeEventListener("pointerup", this._onPointerUp);

    this.element.remove(); // in case disposal happens while dragging
  }

  // private

  _onSelectStart(event: PointerEvent): void {
    this.element.style.display = "none";

    (this.renderer.domElement as HTMLCanvasElement).parentElement!.appendChild(this.element);

    this.element.style.left = event.clientX + "px";
    this.element.style.top = event.clientY + "px";
    this.element.style.width = "0px";
    this.element.style.height = "0px";

    this._startPoint.x = event.clientX;
    this._startPoint.y = event.clientY;
  }

  _onSelectMove(event: PointerEvent): void {
    this.element.style.display = "block";

    this._pointBottomRight.x = Math.max(this._startPoint.x, event.clientX);
    this._pointBottomRight.y = Math.max(this._startPoint.y, event.clientY);
    this._pointTopLeft.x = Math.min(this._startPoint.x, event.clientX);
    this._pointTopLeft.y = Math.min(this._startPoint.y, event.clientY);

    this.element.style.left = this._pointTopLeft.x + "px";
    this.element.style.top = this._pointTopLeft.y + "px";
    this.element.style.width = this._pointBottomRight.x - this._pointTopLeft.x + "px";
    this.element.style.height = this._pointBottomRight.y - this._pointTopLeft.y + "px";
  }

  _onSelectOver(): void {
    this.element.remove();
  }
}
