import type { Camera } from "../../cameras/Camera";
import type { WebGLRenderer } from "../../renderers/WebGLRenderer";
import { Group } from "../../objects/Group";
import { Raycaster } from "../../core/Raycaster";
import { Vector2 } from "../../math/Vector2";

const pointer = new Vector2();
const dispatchedEvent = { type: "", data: pointer };
const pointerEvents = [
  "pointerdown",
  "pointerup",
  "pointermove",
  "mousedown",
  "mouseup",
  "mousemove",
  "click",
] as const;

/** Groups objects receiving pointer and mouse events through WebGL raycasting. */
export class InteractiveGroup extends Group {
  raycaster: Raycaster = new Raycaster();
  element: HTMLElement | null = null;
  camera: Camera | null = null;
  private _onPointerEvent: (event: MouseEvent) => void = this.onPointerEvent.bind(this);

  onPointerEvent(event: MouseEvent): void {
    event.stopPropagation();
    if (this.element === null || this.camera === null) return;
    const rect = this.element.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(pointer, this.camera);
    const intersection = this.raycaster.intersectObjects(this.children, false)[0];
    if (intersection) {
      dispatchedEvent.type = event.type;
      dispatchedEvent.data.set(intersection.uv!.x, 1 - intersection.uv!.y);
      intersection.object.dispatchEvent(dispatchedEvent);
    }
  }

  listenToPointerEvents(renderer: WebGLRenderer, camera: Camera): void {
    this.camera = camera;
    this.element = renderer.domElement as HTMLCanvasElement;
    for (const type of pointerEvents) {
      this.element.addEventListener(type, this._onPointerEvent);
    }
  }

  disconnectionPointerEvents(): void {
    if (this.element !== null) {
      for (const type of pointerEvents) {
        this.element.removeEventListener(type, this._onPointerEvent);
      }
    }
  }

  /** XR controller support is omitted because this package excludes the XR backend. */
  disconnect(): void {
    this.disconnectionPointerEvents();
    this.camera = null;
    this.element = null;
  }
}
