import type { GUI } from "./GUI";

/**
 * Base class for all GUI controllers. A controller wraps one property of an object
 * and renders it as a labeled widget inside a {@link GUI} panel.
 */
export class Controller {
  /**
   * The GUI that contains this controller.
   */
  parent: GUI;

  /**
   * The object this controller will modify.
   */
  object: Record<string, unknown>;

  /**
   * The name of the property to control.
   */
  property: string;

  /**
   * Used to determine if the controller is disabled.
   * Use `controller.disable(true | false)` to modify this value.
   *
   * @default false
   */
  _disabled: boolean;

  /**
   * Used to determine if the Controller is hidden.
   * Use `controller.show()` or `controller.hide()` to change this.
   *
   * @default false
   */
  _hidden: boolean;

  /**
   * The value of `object[property]` when the controller was created.
   */
  initialValue: unknown;

  /**
   * The outermost container DOM element for this controller.
   */
  domElement: HTMLElement;

  /**
   * The DOM element that contains the controller's name.
   */
  $name: HTMLElement;

  /**
   * The DOM element that contains the controller's "widget" (which differs by controller type).
   */
  $widget: HTMLElement;

  /**
   * The DOM element that receives the disabled attribute when using `disable()`.
   */
  $disable: HTMLElement;

  /** Whether the controller value changed since the last finish-change event. */
  _changed: boolean;

  /** Callback bound through `onChange()`. */
  _onChange: ((value: unknown) => void) | undefined;

  /** Callback bound through `onFinishChange()`. */
  _onFinishChange: ((value: unknown) => void) | undefined;

  /** Whether the controller polls its value every frame. */
  _listening: boolean;

  _pendingInsertion: boolean;

  /** `requestAnimationFrame` id of the active listener loop. */
  _listenCallbackID: number | undefined;

  /** Last value seen by the listener loop. */
  _listenPrevValue: unknown;

  static nextNameID: number;

  /**
   * Constructs a controller and attaches it to the parent GUI.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   * @param className - Additional CSS class for the row.
   * @param elementType - The tag name of the row element.
   */
  constructor(parent: GUI, object: Record<string, unknown>, property: string, className: string, elementType = "div") {
    this.parent = parent;
    this.object = object;
    this.property = property;

    this._disabled = false;
    this._hidden = false;

    this.initialValue = this.getValue();

    this.domElement = document.createElement(elementType);
    this.domElement.classList.add("controller", className);

    this.$name = document.createElement("div");
    this.$name.classList.add("name");
    this.$name.textContent = property;

    Controller.nextNameID = Controller.nextNameID || 0;
    this.$name.id = `lil-gui-name-${++Controller.nextNameID}`;

    this.$widget = document.createElement("div");
    this.$widget.classList.add("widget");

    this.$disable = this.$widget;

    this.domElement.appendChild(this.$name);
    this.domElement.appendChild(this.$widget);

    // Don't fire global key events while typing in a controller
    this.domElement.addEventListener("keydown", (e) => e.stopPropagation());
    this.domElement.addEventListener("keyup", (e) => e.stopPropagation());

    this.parent.children.push(this);
    this.parent.controllers.push(this);

    this.parent.$children.appendChild(this.domElement);

    this._listenCallback = this._listenCallback.bind(this);

    this._onChange = undefined;
    this._onFinishChange = undefined;
    this._changed = false;
    this._listening = false;
    this._listenCallbackID = undefined;
    this._listenPrevValue = null;
    this._pendingInsertion = false;
  }

  /**
   * Sets the name of the controller and its label in the GUI.
   *
   * @param name - The new name.
   * @returns `this`
   */
  name(name: string): this {
    this.$name.textContent = name;
    return this;
  }

  /**
   * Pass a function to be called whenever the value is modified by this controller.
   * The function receives the new value as its first parameter. The value of `this` will be the
   * controller.
   *
   * For function controllers, the `onChange` callback will be fired on click, after the function
   * executes.
   *
   * @param callback - Receives the new value.
   * @returns `this`
   */
  onChange(callback: (value: unknown) => void): this {
    this._onChange = callback;
    return this;
  }

  /**
   * Calls the `onChange` methods of this controller and its parent GUI.
   */
  _callOnChange(): void {
    this.parent._callOnChange(this as Controller);

    if (this._onChange !== undefined) {
      this._onChange.call(this, this.getValue());
    }

    this._changed = true;
  }

  /**
   * Pass a function to be called after this controller has been modified and loses focus.
   *
   * @param callback - Receives the final value.
   * @returns `this`
   */
  onFinishChange(callback: (value: unknown) => void): this {
    this._onFinishChange = callback;
    return this;
  }

  /**
   * Should be called by the controller when its widget loses focus.
   */
  _callOnFinishChange(): void {
    if (this._changed) {
      this.parent._callOnFinishChange(this);

      if (this._onFinishChange !== undefined) {
        this._onFinishChange.call(this, this.getValue());
      }
    }

    this._changed = false;
  }

  /**
   * Sets this controller back to its initial value.
   *
   * @returns `this`
   */
  reset(): this {
    this.setValue(this.initialValue);
    this._callOnFinishChange();
    return this;
  }

  /**
   * Enables this controller.
   *
   * @param enabled - Pass `false` to disable.
   * @returns `this`
   */
  enable(enabled = true): this {
    return this.disable(!enabled);
  }

  /**
   * Disables this controller.
   *
   * @param disabled - Pass `false` to enable.
   * @returns `this`
   */
  disable(disabled = true): this {
    if (disabled === this._disabled) return this;

    this._disabled = disabled;

    this.domElement.classList.toggle("disabled", disabled);
    this.$disable.toggleAttribute("disabled", disabled);

    return this;
  }

  /**
   * Shows the controller after it's been hidden.
   *
   * @param show - Pass `false` to hide.
   * @returns `this`
   */
  show(show = true): this {
    this._hidden = !show;

    this.domElement.style.display = this._hidden ? "none" : "";

    return this;
  }

  /**
   * Hides the controller.
   *
   * @returns `this`
   */
  hide(): this {
    return this.show(false);
  }

  /**
   * Changes this controller into a dropdown of options.
   *
   * Calling this method on an option controller will simply update the options. However, if this
   * controller was not already an option controller, old references to this controller are
   * destroyed, and a new controller is added to the end of the GUI.
   *
   * @param options - Option values keyed by labels, or as an array.
   * @returns The replacement controller. Not `this` when re-created.
   */
  options(options: Record<string, unknown> | unknown[]): Controller {
    const controller = this.parent.add(this.object, this.property, options);
    controller.name(this.$name.textContent ?? "");
    this.destroy();
    return controller;
  }

  /**
   * Sets the minimum value. Only works on number controllers.
   *
   * @param _min - Ignored unless overridden.
   * @returns `this`
   */
  min(_min: number): this {
    return this;
  }

  /**
   * Sets the maximum value. Only works on number controllers.
   *
   * @param _max - Ignored unless overridden.
   * @returns `this`
   */
  max(_max: number): this {
    return this;
  }

  /**
   * Rounds values set by this controller to multiples of `step`. Only works on number controllers.
   *
   * @param _step - Ignored unless overridden.
   * @returns `this`
   */
  step(_step: number): this {
    return this;
  }

  /**
   * Rounds the displayed value to a fixed number of decimals, without affecting the actual value
   * like `step()`. Only works on number controllers.
   *
   * @param _decimals - Ignored unless overridden.
   * @returns `this`
   */
  decimals(_decimals: number): this {
    return this;
  }

  /**
   * Calls `updateDisplay()` every animation frame. Pass `false` to stop listening.
   *
   * @param listen - Whether to listen for external updates.
   * @returns `this`
   */
  listen(listen = true): this {
    this._listening = listen;

    if (this._listenCallbackID !== undefined) {
      cancelAnimationFrame(this._listenCallbackID);
      this._listenCallbackID = undefined;
    }

    if (this._listening) {
      this._listenCallback();
    }

    return this;
  }

  /** Listener loop body; polls the value and refreshes the display when it changed. */
  _listenCallback(): void {
    this._listenCallbackID = requestAnimationFrame(this._listenCallback);

    // To prevent framerate loss, make sure the value has changed before updating the display.
    // Note: save() is used here instead of `getValue()` only because of `ColorController`. The
    // `!==` operator won't work for color objects or arrays, but its `save()` returns a string.

    const curValue = this.save();

    if (curValue !== this._listenPrevValue) {
      this.updateDisplay();
    }

    this._listenPrevValue = curValue;
  }

  /**
   * Returns `object[property]`.
   */
  getValue(): unknown {
    return (this.object as Record<string, unknown>)[this.property];
  }

  /**
   * Sets the value of `object[property]`, invokes any `onChange` handlers and updates the display.
   *
   * @param value - The new value.
   * @returns `this`
   */
  setValue(value: unknown): this {
    if (this.getValue() !== value) {
      (this.object as Record<string, unknown>)[this.property] = value;
      this._callOnChange();
      this.updateDisplay();
    }

    return this;
  }

  /**
   * Updates the display to keep it in sync with the current value. Useful for updating
   * controllers when their values have been modified outside of the GUI.
   *
   * @returns `this`
   */
  updateDisplay(): this {
    return this;
  }

  /**
   * Recalls a value from a state object created by `save()`.
   *
   * @param value - The restored value.
   * @returns `this`
   */
  load(value: unknown): this {
    this.setValue(value);
    this._callOnFinishChange();
    return this;
  }

  /**
   * Returns the persisted representation of the current value.
   */
  save(): unknown {
    return this.getValue();
  }

  /**
   * Destroys this controller and removes it from the parent GUI.
   */
  destroy(): void {
    this.listen(false);
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent.controllers.splice(this.parent.controllers.indexOf(this), 1);
    this.parent.$children.removeChild(this.domElement);
  }
}
