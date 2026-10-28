import { Controller } from "./Controller";
import type { GUI } from "./GUI";

/**
 * Controls a boolean property with a checkbox.
 */
export class BooleanController extends Controller {
  /** The checkbox input of the widget. */
  $input: HTMLInputElement;

  /**
   * Constructs a boolean checkbox controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   */
  constructor(parent: GUI, object: Record<string, unknown>, property: string) {
    super(parent, object, property, "boolean", "label");

    this.$input = document.createElement("input");
    this.$input.setAttribute("type", "checkbox");
    this.$input.setAttribute("aria-labelledby", this.$name.id);

    this.$widget.appendChild(this.$input);

    this.$input.addEventListener("change", () => {
      this.setValue(this.$input.checked);
      this._callOnFinishChange();
    });

    this.$disable = this.$input;

    this.updateDisplay();
  }

  override updateDisplay(): this {
    this.$input.checked = this.getValue() as boolean;
    return this;
  }
}

/**
 * Controls a function property and runs it on click.
 */
export class FunctionController extends Controller {
  /** The button element that renders the function name. */
  $button: HTMLButtonElement;

  /**
   * Constructs a function button controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   */
  constructor(parent: GUI, object: Record<string, unknown>, property: string) {
    super(parent, object, property, "function");

    // Buttons are the only case where widget contains name
    this.$button = document.createElement("button");
    this.$button.appendChild(this.$name);
    this.$widget.appendChild(this.$button);

    this.$button.addEventListener("click", (e) => {
      e.preventDefault();
      (this.getValue() as () => void).call(this.object);
      this._callOnChange();
    });

    // enables :active pseudo class on mobile
    this.$button.addEventListener("touchstart", () => {}, { passive: true });

    this.$disable = this.$button;
  }
}

/**
 * Controls a string property with a text input.
 */
export class StringController extends Controller {
  /** The text input of the widget. */
  $input: HTMLInputElement;

  /**
   * Constructs a string controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   */
  constructor(parent: GUI, object: Record<string, unknown>, property: string) {
    super(parent, object, property, "string");

    this.$input = document.createElement("input");
    this.$input.setAttribute("type", "text");
    this.$input.setAttribute("spellcheck", "false");
    this.$input.setAttribute("aria-labelledby", this.$name.id);

    this.$input.addEventListener("input", () => {
      this.setValue(this.$input.value);
    });

    this.$input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.$input.blur();
      }
    });

    this.$input.addEventListener("blur", () => {
      this._callOnFinishChange();
    });

    this.$widget.appendChild(this.$input);

    this.$disable = this.$input;

    this.updateDisplay();
  }

  override updateDisplay(): this {
    this.$input.value = this.getValue() as string;
    return this;
  }
}

/**
 * Controls a property with a dropdown of predefined options.
 */
export class OptionController extends Controller {
  /** The select element of the widget. */
  $select: HTMLSelectElement;

  /** The label shown over the collapsed select. */
  $display: HTMLDivElement;

  /** Option values aligned with `$select`'s children. */
  _values: unknown[] = [];

  /** Option labels aligned with `_values`. */
  _names: string[] = [];

  /**
   * Constructs an option dropdown controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   * @param options - Option values keyed by labels, or as an array.
   */
  constructor(
    parent: GUI,
    object: Record<string, unknown>,
    property: string,
    options: Record<string, unknown> | unknown[],
  ) {
    super(parent, object, property, "option");

    this.$select = document.createElement("select");
    this.$select.setAttribute("aria-labelledby", this.$name.id);

    this.$display = document.createElement("div");
    this.$display.classList.add("display");

    this.$select.addEventListener("change", () => {
      this.setValue(this._values[this.$select.selectedIndex]);
      this._callOnFinishChange();
    });

    this.$select.addEventListener("focus", () => {
      this.$display.classList.add("focus");
    });

    this.$select.addEventListener("blur", () => {
      this.$display.classList.remove("focus");
    });

    this.$widget.appendChild(this.$select);
    this.$widget.appendChild(this.$display);

    this.$disable = this.$select;

    this.options(options);
  }

  /**
   * Replaces the dropdown options.
   *
   * @param options - Option values keyed by labels, or as an array.
   * @returns `this`
   */
  override options(options: Record<string, unknown> | unknown[]): this {
    this._values = Array.isArray(options) ? options : Object.values(options);
    this._names = Array.isArray(options) ? options.map(String) : Object.keys(options);

    this.$select.replaceChildren();

    this._names.forEach((name) => {
      const $option = document.createElement("option");
      $option.textContent = name;
      this.$select.appendChild($option);
    });

    this.updateDisplay();

    return this;
  }

  override updateDisplay(): this {
    const value = this.getValue();
    const index = this._values.indexOf(value);
    this.$select.selectedIndex = index;
    this.$display.textContent = index === -1 ? String(value) : this._names[index];
    return this;
  }
}
