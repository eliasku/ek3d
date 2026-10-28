import type { Object3D } from "../core/Object3D";
import { EventDispatcher } from "../core/EventDispatcher";
import type { MOUSE, TOUCH } from "../constants";

/**
 * Abstract base class for controls.
 *
 * The generic parameter preserves the concrete object type managed by a control so
 * subclasses can narrow it without redeclaring inherited fields.
 *
 *
 * @abstract
 */
export abstract class Controls<TObject extends Object3D = Object3D> extends EventDispatcher {
  /**
   * The object that is managed by the controls.
   */
  object: TObject;

  /**
   * The HTML element used for event listeners.
   *
   * @default null
   */
  domElement: HTMLElement | null;

  /**
   * Whether the controls respond to user input or not.
   *
   * @default true
   */
  enabled: boolean = true;

  /**
   * The internal state of the controls.
   *
   * @default -1
   */
  state: number = -1;

  /**
   * This object defines the keyboard input of the controls. Camera controls keep named
   * bindings (`Record<string, string>`); key-driven controls like TrackballControls use
   * positional key codes (`string[]`).
   */
  keys: Record<string, string> | string[] = {};

  /**
   * This object defines what type of actions are assigned to the available mouse buttons.
   * It depends on the control implementation what kind of mouse buttons and actions are supported.
   */
  mouseButtons: { LEFT: MOUSE | null; MIDDLE: MOUSE | null; RIGHT: MOUSE | null } = {
    LEFT: null,
    MIDDLE: null,
    RIGHT: null,
  };

  /**
   * This object defines what type of actions are assigned to what kind of touch interaction.
   * It depends on the control implementation what kind of touch interaction and actions are supported.
   */
  touches: { ONE: TOUCH | null; TWO: TOUCH | null } = { ONE: null, TWO: null };

  /**
   * Constructs a new controls instance.
   *
   * @param object - The object that is managed by the controls.
   * @param domElement - The HTML element used for event listeners.
   */
  constructor(object: TObject, domElement: HTMLElement | null = null) {
    super();
    this.object = object;
    this.domElement = domElement;
  }

  /**
   * Connects the controls to the DOM. This method has so called "side effects" since
   * it adds the module's event listeners to the DOM.
   *
   * @param element - The DOM element to connect to.
   */
  connect(element: HTMLElement): void {
    if (this.domElement !== null) this.disconnect();
    this.domElement = element;
  }

  /**
   * Disconnects the controls from the DOM and removes their event listeners.
   */
  abstract disconnect(): void;

  /**
   * Call this method if you no longer want to use the controls. It frees all internal
   * resources and removes all event listeners.
   */
  abstract dispose(): void;

  /**
   * Controls should implement this method if they have to update their internal state
   * per simulation step.
   *
   * @param deltaTime - The time delta in seconds.
   */
  abstract update(deltaTime?: number): void;
}
