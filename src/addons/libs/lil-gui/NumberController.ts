import { Controller } from "./Controller";
import type { GUI } from "./GUI";

/**
 * Controls a number property with a text input. When both `min()` and `max()` are set,
 * displays a draggable slider filled proportionally to the value.
 */
export class NumberController extends Controller {
  $input!: HTMLInputElement;
  $slider: HTMLDivElement | undefined;
  $fill: HTMLDivElement | undefined;

  _hasSlider: boolean;

  _inputFocused: boolean;

  _min: number | undefined;
  _max: number | undefined;
  _step: number;
  _stepExplicit: boolean;
  _decimals: number | undefined;

  /**
   * Constructs a number controller.
   *
   * @param parent - The GUI that owns this controller.
   * @param object - The object whose property is controlled.
   * @param property - The property name.
   * @param min - Minimum value, enables the slider when `max` is given too.
   * @param max - Maximum value.
   * @param step - Snap step; defaults to an implicit step derived from min/max.
   */
  constructor(
    parent: GUI,
    object: Record<string, unknown>,
    property: string,
    min?: number,
    max?: number,
    step?: number,
  ) {
    super(parent, object, property, "number");

    this._hasSlider = false;
    this._inputFocused = false;
    this._min = undefined;
    this._max = undefined;
    this._step = 0.1;
    this._stepExplicit = false;
    this._decimals = undefined;

    this._initInput();

    this.min(min);
    this.max(max);

    const stepExplicit = step !== undefined;
    this.step(stepExplicit ? step : this._getImplicitStep(), stepExplicit);

    this.updateDisplay();
  }

  /**
   * Rounds the displayed value to a fixed number of decimals without affecting the actual value.
   *
   * @param decimals - Digits after the decimal point.
   * @returns `this`
   */
  override decimals(decimals: number): this {
    this._decimals = decimals;
    this.updateDisplay();
    return this;
  }

  override min(min?: number): this {
    this._min = min;
    this._onUpdateMinMax();
    return this;
  }

  override max(max?: number): this {
    this._max = max;
    this._onUpdateMinMax();
    return this;
  }

  /**
   * Sets the snap step.
   *
   * @param step - The new step.
   * @param explicit - Whether the step was explicitly requested (drives arrow-key multiplier).
   * @returns `this`
   */
  override step(step: number, explicit = true): this {
    this._step = step;
    this._stepExplicit = explicit;
    return this;
  }

  override updateDisplay(): this {
    const value = this.getValue() as number;

    if (this._hasSlider) {
      let percent = (value - this._min!) / (this._max! - this._min!);
      percent = Math.max(0, Math.min(percent, 1));

      this.$fill!.style.width = percent * 100 + "%";
    }

    if (!this._inputFocused) {
      this.$input.value = this._decimals === undefined ? String(value) : value.toFixed(this._decimals);
    }

    return this;
  }

  _initInput(): void {
    this.$input = document.createElement("input");
    this.$input.setAttribute("type", "text");
    this.$input.setAttribute("aria-labelledby", this.$name.id);

    // On touch devices only, use input[type=number] to force a numeric keyboard.
    // Ideally we could use one input type everywhere, but [type=number] has quirks
    // on desktop, and [inputmode=decimal] has quirks on iOS.
    // See https://github.com/georgealways/lil-gui/pull/16

    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    if (isTouch) {
      this.$input.setAttribute("type", "number");
      this.$input.setAttribute("step", "any");
    }

    this.$widget.appendChild(this.$input);

    this.$disable = this.$input;

    const onInput = () => {
      let value = parseFloat(this.$input.value);

      if (isNaN(value)) return;

      if (this._stepExplicit) {
        value = this._snap(value);
      }

      this.setValue(this._clamp(value));
    };

    // Keys & mouse wheel

    const increment = (delta: number) => {
      const value = parseFloat(this.$input.value);

      if (isNaN(value)) return;

      this._snapClampSetValue(value + delta);

      // Force the input to updateDisplay when it's focused
      this.$input.value = String(this.getValue());
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Using `e.key` instead of `e.code` also catches NumpadEnter
      if (e.key === "Enter") {
        this.$input.blur();
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        increment(this._step * this._arrowKeyMultiplier(e));
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        increment(this._step * this._arrowKeyMultiplier(e) * -1);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (this._inputFocused) {
        e.preventDefault();
        increment(this._step * this._normalizeMouseWheel(e));
      }
    };

    // Vertical drag

    let testingForVerticalDrag = false,
      initClientX: number,
      prevClientY: number,
      initValue: number,
      dragDelta: number;

    // Once the mouse is dragged more than DRAG_THRESH px on any axis, we decide
    // on the user's intent: horizontal means highlight, vertical means drag.
    const DRAG_THRESH = 5;

    const onMouseDown = (e: MouseEvent) => {
      initClientX = e.clientX;
      prevClientY = e.clientY;
      testingForVerticalDrag = true;

      initValue = this.getValue() as number;
      dragDelta = 0;

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (testingForVerticalDrag) {
        const dx = e.clientX - initClientX;
        const dy = e.clientY - prevClientY;

        if (Math.abs(dy) > DRAG_THRESH) {
          e.preventDefault();
          this.$input.blur();
          testingForVerticalDrag = false;
          this._setDraggingStyle(true, "vertical");
        } else if (Math.abs(dx) > DRAG_THRESH) {
          onMouseUp();
        }
      }

      // This isn't an else so that the first move counts towards dragDelta
      if (!testingForVerticalDrag) {
        const dy = e.clientY - prevClientY;

        dragDelta -= dy * this._step * this._arrowKeyMultiplier(e);

        // Clamp dragDelta so we don't have 'dead space' after dragging past bounds.
        // We're okay with the fact that bounds can be undefined here.
        if (this._max !== undefined && initValue + dragDelta > this._max) {
          dragDelta = this._max - initValue;
        } else if (this._min !== undefined && initValue + dragDelta < this._min) {
          dragDelta = this._min - initValue;
        }

        this._snapClampSetValue(initValue + dragDelta);
      }

      prevClientY = e.clientY;
    };

    const onMouseUp = () => {
      this._setDraggingStyle(false, "vertical");
      this._callOnFinishChange();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    // Focus state & onFinishChange

    const onFocus = () => {
      this._inputFocused = true;
    };

    const onBlur = () => {
      this._inputFocused = false;
      this.updateDisplay();
      this._callOnFinishChange();
    };

    this.$input.addEventListener("input", onInput);
    this.$input.addEventListener("keydown", onKeyDown);
    this.$input.addEventListener("wheel", onWheel, { passive: false });
    this.$input.addEventListener("mousedown", onMouseDown);
    this.$input.addEventListener("focus", onFocus);
    this.$input.addEventListener("blur", onBlur);
  }

  _initSlider(): void {
    this._hasSlider = true;

    // Build DOM

    this.$slider = document.createElement("div");
    this.$slider.classList.add("slider");

    this.$fill = document.createElement("div");
    this.$fill.classList.add("fill");

    this.$slider.appendChild(this.$fill);
    this.$widget.insertBefore(this.$slider, this.$input);

    this.domElement.classList.add("has-slider");

    // Map clientX to value

    const map = (v: number, a: number, b: number, c: number, d: number) => {
      return ((v - a) / (b - a)) * (d - c) + c;
    };

    const setValueFromX = (clientX: number) => {
      const rect = this.$slider!.getBoundingClientRect();
      const value = map(clientX, rect.left, rect.right, this._min!, this._max!);
      this._snapClampSetValue(value);
    };

    // Mouse drag

    const mouseDown = (e: MouseEvent) => {
      this._setDraggingStyle(true);
      setValueFromX(e.clientX);
      window.addEventListener("mousemove", mouseMove);
      window.addEventListener("mouseup", mouseUp);
    };

    const mouseMove = (e: MouseEvent) => {
      setValueFromX(e.clientX);
    };

    const mouseUp = () => {
      this._callOnFinishChange();
      this._setDraggingStyle(false);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("mouseup", mouseUp);
    };

    // Touch drag

    let testingForScroll = false,
      prevClientX: number,
      prevClientY: number;

    const beginTouchDrag = (e: TouchEvent) => {
      e.preventDefault();
      this._setDraggingStyle(true);
      setValueFromX(e.touches[0].clientX);
      testingForScroll = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) return;

      // If we're in a scrollable container, we should wait for the first
      // touchmove to see if the user is trying to slide or scroll.
      if (this._hasScrollBar) {
        prevClientX = e.touches[0].clientX;
        prevClientY = e.touches[0].clientY;
        testingForScroll = true;
      } else {
        // Otherwise, we can set the value straight away on touchstart.
        beginTouchDrag(e);
      }

      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (testingForScroll) {
        const dx = e.touches[0].clientX - prevClientX;
        const dy = e.touches[0].clientY - prevClientY;

        if (Math.abs(dx) > Math.abs(dy)) {
          // We moved horizontally, set the value and stop checking.
          beginTouchDrag(e);
        } else {
          // This was, in fact, an attempt to scroll. Abort.
          window.removeEventListener("touchmove", onTouchMove);
          window.removeEventListener("touchend", onTouchEnd);
        }
      } else {
        e.preventDefault();
        setValueFromX(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      this._callOnFinishChange();
      this._setDraggingStyle(false);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };

    // Mouse wheel

    // We have to use a debounced function to call onFinishChange because
    // there's no way to tell when the user is "done" mouse-wheeling.
    const callOnFinishChange = this._callOnFinishChange.bind(this);
    const WHEEL_DEBOUNCE_TIME = 400;
    let wheelFinishChangeTimeout: ReturnType<typeof setTimeout>;

    const onWheel = (e: WheelEvent) => {
      // ignore vertical wheels if there's a scrollbar
      const isVertical = Math.abs(e.deltaX) < Math.abs(e.deltaY);
      if (isVertical && this._hasScrollBar) return;

      e.preventDefault();

      // set value
      const delta = this._normalizeMouseWheel(e) * this._step;
      this._snapClampSetValue((this.getValue() as number) + delta);

      // force the input to updateDisplay when it's focused
      this.$input.value = String(this.getValue());

      // debounce onFinishChange
      clearTimeout(wheelFinishChangeTimeout);
      wheelFinishChangeTimeout = setTimeout(callOnFinishChange, WHEEL_DEBOUNCE_TIME);
    };

    this.$slider.addEventListener("mousedown", mouseDown);
    this.$slider.addEventListener("touchstart", onTouchStart, { passive: false });
    this.$slider.addEventListener("wheel", onWheel, { passive: false });
  }

  _setDraggingStyle(active: boolean, axis = "horizontal"): void {
    if (this.$slider) {
      this.$slider.classList.toggle("active", active);
    }
    document.body.classList.toggle(axis === "vertical" ? "lil-gui-vertical" : "lil-gui-dragging", active);
  }

  _getImplicitStep(): number {
    if (this._hasMin && this._hasMax) {
      return (this._max! - this._min!) / 1000;
    }

    return 0.1;
  }

  _onUpdateMinMax(): void {
    if (!this._hasSlider && this._hasMin && this._hasMax) {
      // If this is the first time we're hearing about min and max
      // and we haven't explicitly stated what our step is, let's
      // update that too.
      if (!this._stepExplicit) {
        this.step(this._getImplicitStep(), false);
      }

      this._initSlider();
      this.updateDisplay();
    }
  }

  _normalizeMouseWheel(e: WheelEvent): number {
    let { deltaX, deltaY } = e;

    // Safari and Chrome report weird non-integral values for a notched wheel,
    // but still expose actual lines scrolled via wheelDelta. Notched wheels
    // should behave the same way as arrow keys.
    const wheelDelta = (e as WheelEvent & { wheelDelta?: number }).wheelDelta;
    if (Math.floor(e.deltaY) !== e.deltaY && wheelDelta) {
      deltaX = 0;
      deltaY = -wheelDelta / 120;
      deltaY *= this._stepExplicit ? 1 : 10;
    }

    const wheel = deltaX + -deltaY;

    return wheel;
  }

  _arrowKeyMultiplier(e: KeyboardEvent | MouseEvent | WheelEvent): number {
    let mult = this._stepExplicit ? 1 : 10;

    if (e.shiftKey) {
      mult *= 10;
    } else if (e.altKey) {
      mult /= 10;
    }

    return mult;
  }

  _snap(value: number): number {
    // Make the steps "start" at min or max.
    let offset = 0;
    if (this._hasMin) {
      offset = this._min as number;
    } else if (this._hasMax) {
      offset = this._max as number;
    }

    value -= offset;

    value = Math.round(value / this._step) * this._step;

    value += offset;

    // Used to prevent "flyaway" decimals like 1.00000000000001
    value = parseFloat(value.toPrecision(15));

    return value;
  }

  _clamp(value: number): number {
    // either condition is false if min or max is undefined
    if (this._min !== undefined && value < this._min) value = this._min;
    if (this._max !== undefined && value > this._max) value = this._max;
    return value;
  }

  _snapClampSetValue(value: number): void {
    this.setValue(this._clamp(this._snap(value)));
  }

  get _hasScrollBar(): boolean {
    const root = this.parent.root.$children;
    return root.scrollHeight > root.clientHeight;
  }

  get _hasMin(): boolean {
    return this._min !== undefined;
  }

  get _hasMax(): boolean {
    return this._max !== undefined;
  }
}
