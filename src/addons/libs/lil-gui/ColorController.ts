import { Controller } from "./Controller";
import type { GUI } from "./GUI";
import { getColorFormat, normalizeColorString } from "./colorUtils";

/** A color format description able to read and write hex strings. */
interface ColorFormat {
  isPrimitive: boolean;
  fromHexString(hex: string, target?: unknown, rgbScale?: number): unknown;
  toHexString(value: unknown, rgbScale?: number): string;
}

/**
 * Controls a color property. Accepts CSS hex strings, `number` packed RGB, `[r, g, b]`
 * arrays (and typed arrays thereof) and `{ r, g, b }` objects, applying an `rgbScale`.
 */
export class ColorController extends Controller {
  /** The swatch input of the widget. */
  $input: HTMLInputElement;

  /** The text input of the widget. */
  $text: HTMLInputElement;

  /** The highlighted swatch display. */
  $display: HTMLDivElement;

  _format: ColorFormat;
  _rgbScale: number;
  _initialValueHexString: string;
  _textFocused: boolean;

  /**
   * Constructs a color controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   * @param rgbScale - Scale applied to normalized RGB channels for object/array targets.
   */
  constructor(parent: GUI, object: Record<string, unknown>, property: string, rgbScale = 1) {
    super(parent, object, property, "color");

    this.$input = document.createElement("input");
    this.$input.setAttribute("type", "color");
    this.$input.setAttribute("tabindex", "-1");
    this.$input.setAttribute("aria-labelledby", this.$name.id);

    this.$text = document.createElement("input");
    this.$text.setAttribute("type", "text");
    this.$text.setAttribute("spellcheck", "false");
    this.$text.setAttribute("aria-labelledby", this.$name.id);

    this.$display = document.createElement("div");
    this.$display.classList.add("display");

    this.$display.appendChild(this.$input);
    this.$widget.appendChild(this.$display);
    this.$widget.appendChild(this.$text);

    this._format = getColorFormat(this.initialValue as never) as ColorFormat;
    this._rgbScale = rgbScale;

    this._initialValueHexString = this.save();
    this._textFocused = false;

    this.$input.addEventListener("input", () => {
      this._setValueFromHexString(this.$input.value);
    });

    this.$input.addEventListener("blur", () => {
      this._callOnFinishChange();
    });

    this.$text.addEventListener("input", () => {
      const tryParse = normalizeColorString(this.$text.value);
      if (tryParse) {
        this._setValueFromHexString(tryParse);
      }
    });

    this.$text.addEventListener("focus", () => {
      this._textFocused = true;
      this.$text.select();
    });

    this.$text.addEventListener("blur", () => {
      this._textFocused = false;
      this.updateDisplay();
      this._callOnFinishChange();
    });

    this.$disable = this.$text;

    this.updateDisplay();
  }

  override reset(): this {
    this._setValueFromHexString(this._initialValueHexString);
    return this;
  }

  /** Writes the color from a `#rrggbb` string, mutating non-primitive targets in place. */
  _setValueFromHexString(hex: string): void {
    if (this._format.isPrimitive) {
      const newValue = this._format.fromHexString(hex);
      this.setValue(newValue);
    } else {
      this._format.fromHexString(hex, this.getValue(), this._rgbScale);
      this._callOnChange();
      this.updateDisplay();
    }
  }

  override save(): string {
    return this._format.toHexString(this.getValue(), this._rgbScale);
  }

  override load(hex: string): this {
    this._setValueFromHexString(hex);
    this._callOnFinishChange();
    return this;
  }

  override updateDisplay(): this {
    this.$input.value = this._format.toHexString(this.getValue(), this._rgbScale);
    if (!this._textFocused) {
      this.$text.value = this.$input.value.substring(1);
    }
    this.$display.style.backgroundColor = this.$input.value;
    return this;
  }
}
