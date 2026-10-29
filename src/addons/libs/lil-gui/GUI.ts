import { BooleanController, FunctionController, OptionController, StringController } from "./controllers";
import { ColorController } from "./ColorController";
import { NumberController } from "./NumberController";
import { Controller } from "./Controller";
import stylesheet from "./stylesheet";
import { injectStyles as injectStylesheet } from "./injectStyles";

let stylesInjected = false;

/** Options accepted by the `GUI` constructor. */
export interface GUIOptions {
  /**
   * Adds the GUI as a child in another GUI. Usually this is done for you by `addFolder()`.
   */
  parent?: GUI | undefined;

  /**
   * Adds the GUI to `document.body` and fixes it to the top right of the page.
   *
   * @default true
   */
  autoPlace?: boolean | undefined;

  /**
   * Adds the GUI to this DOM element. Overrides `autoPlace`.
   */
  container?: HTMLElement | undefined;

  /**
   * Width of the GUI in pixels, usually set when name labels become too long.
   *
   * @default undefined
   */
  width?: number | undefined;

  /**
   * Name to display in the title bar.
   *
   * @default 'Controls'
   */
  title?: string | undefined;

  /**
   * Pass `true` to close all folders in this GUI by default.
   *
   * @default false
   */
  closeFolders?: boolean | undefined;

  /**
   * Injects the default stylesheet into the page if this is the first GUI.
   * Pass `false` to use your own stylesheet.
   *
   * @default true
   */
  injectStyles?: boolean | undefined;

  /**
   * Makes controllers larger on touch devices. Pass `false` to disable touch styles.
   *
   * @default true
   */
  touchStyles?: boolean | undefined;
}

/** Argument payload of `onChange`/`onFinishChange` handlers bound through `GUI`. */
export interface GUIChangeEvent {
  /** The object that was modified. */
  object: Record<string, unknown>;
  /** The name of the modified property. */
  property: string;
  /** The new value of the controller. */
  value: unknown;
  /** The controller that was modified. */
  controller: Controller;
}

/**
 * A lightweight graphical user interface. Changes made with GUI are automatically applied to
 * the controlled object.
 *
 * ```ts
 * import { GUI } from 'ek3d/addons/libs/lil-gui';
 *
 * const gui = new GUI();
 *
 * const params = { size: 1, color: '#ff0000', animate: true };
 *
 * gui.add( params, 'size', 0, 2 );
 * gui.addColor( params, 'color' );
 * gui.add( params, 'animate' );
 * ```
 */
export class GUI {
  /**
   * The GUI containing this folder, or `undefined` if this is a root GUI.
   */
  parent: GUI | undefined;

  /**
   * The top level GUI containing this folder, or `this` if this is a root GUI.
   */
  root: GUI;

  /**
   * The list of controllers and folders contained by this GUI.
   */
  children: Array<GUI | Controller>;

  /**
   * The list of controllers contained by this GUI.
   */
  controllers: Controller[];

  /**
   * The list of folders contained by this GUI.
   */
  folders: GUI[];

  /**
   * Used to determine if the GUI is closed. Use `gui.open()` or `gui.close()` to change this.
   *
   * @default false
   */
  _closed: boolean;

  /**
   * Used to determine if the GUI is hidden. Use `gui.show()` or `gui.hide()` to change this.
   *
   * @default false
   */
  _hidden: boolean;

  /**
   * Current title of the GUI. Use `gui.title('Title')` to modify this value.
   */
  _title: string = "Controls";

  /**
   * The outermost container element.
   */
  domElement: HTMLDivElement;

  /**
   * The DOM element that contains the title.
   */
  $title: HTMLButtonElement;

  /**
   * The DOM element that contains children.
   */
  $children: HTMLDivElement;

  _closeFolders: boolean = false;

  _onChange: ((event: GUIChangeEvent) => void) | undefined;
  _onFinishChange: ((event: GUIChangeEvent) => void) | undefined;
  _onOpenClose: ((gui: GUI) => void) | undefined;

  /**
   * Creates a panel that holds controllers.
   *
   * @param options - Panel options; `parent`-less GUIs auto-place into `document.body`.
   */
  constructor({
    parent,
    autoPlace = parent === undefined,
    container,
    width,
    title = "Controls",
    closeFolders = false,
    injectStyles = true,
    touchStyles = true,
  }: GUIOptions = {}) {
    this.parent = parent;
    this.root = parent ? parent.root : this;

    this.children = [];
    this.controllers = [];
    this.folders = [];

    this._closed = false;
    this._hidden = false;
    this._onChange = undefined;
    this._onFinishChange = undefined;
    this._onOpenClose = undefined;

    this.domElement = document.createElement("div");
    this.domElement.classList.add("lil-gui");

    this.$title = document.createElement("button");
    this.$title.classList.add("title");
    this.$title.setAttribute("aria-expanded", "true");

    this.$title.addEventListener("click", () => this.openAnimated(this._closed));

    // enables :active pseudo class on mobile
    this.$title.addEventListener("touchstart", () => {}, { passive: true });

    this.$children = document.createElement("div");
    this.$children.classList.add("children");

    this.domElement.appendChild(this.$title);
    this.domElement.appendChild(this.$children);

    this.title(title);

    if (this.parent) {
      this.parent.children.push(this);
      this.parent.folders.push(this);

      this.parent.$children.appendChild(this.domElement);

      // Stop the constructor early, everything onward only applies to root GUI's
      return;
    }

    this.domElement.classList.add("root");

    if (touchStyles) {
      this.domElement.classList.add("allow-touch-styles");
    }

    // Inject stylesheet if we haven't done that yet
    if (!stylesInjected && injectStyles) {
      injectStylesheet(stylesheet);
      stylesInjected = true;
    }

    if (container) {
      container.appendChild(this.domElement);
    } else if (autoPlace) {
      this.domElement.classList.add("autoPlace");
      document.body.appendChild(this.domElement);
    }

    if (width) {
      this.domElement.style.setProperty("--width", String(width) + "px");
    }

    this._closeFolders = closeFolders;
  }

  /**
   * Adds a controller to the GUI, inferring controller type using the `typeof` operator.
   *
   * ```ts
   * gui.add( object, 'property' );
   * gui.add( object, 'number', 0, 100, 1 );
   * gui.add( object, 'options', [ 1, 2, 3 ] );
   * ```
   *
   * @param object The object the controller will modify.
   * @param property Name of the property to control.
   * @param $1 Minimum value for number controllers, or the set of selectable values for a dropdown.
   * @param max Maximum value for number controllers.
   * @param step Step value for number controllers.
   * @returns The created controller.
   */
  add(
    object: object,
    property: string,
    $1?: number | Record<string, unknown> | unknown[],
    max?: number,
    step?: number,
  ): Controller {
    if (Object($1) === $1) {
      return new OptionController(
        this,
        object as Record<string, unknown>,
        property,
        $1 as Record<string, unknown> | unknown[],
      );
    }

    const initialValue = (object as Record<string, unknown>)[property];

    switch (typeof initialValue) {
      case "number":
        return new NumberController(
          this,
          object as Record<string, unknown>,
          property,
          $1 as number | undefined,
          max,
          step,
        );
      case "boolean":
        return new BooleanController(this, object as Record<string, unknown>, property);
      case "string":
        return new StringController(this, object as Record<string, unknown>, property);
      case "function":
        return new FunctionController(this, object as Record<string, unknown>, property);
    }

    console.error(`gui.add failed\n[property:`, property, `\nobject:`, object, `\nvalue:`, initialValue);

    return undefined as unknown as Controller;
  }

  /**
   * Adds a color controller to the GUI.
   *
   * ```ts
   * const params = {
   * 	cssColor: '#ff00ff',
   * 	rgbColor: { r: 0, g: 0.2, b: 0.4 },
   * 	customRange: [ 0, 127, 255 ],
   * };
   *
   * gui.addColor( params, 'cssColor' );
   * gui.addColor( params, 'rgbColor' );
   * gui.addColor( params, 'customRange', 255 );
   * ```
   *
   * @param object The object the controller will modify.
   * @param property Name of the property to control.
   * @param rgbScale Maximum value for a color channel when using an RGB color. You may
   * need to set this to 255 if your colors are too bright.
   * @returns The created controller.
   */
  addColor(object: Record<string, unknown>, property: string, rgbScale = 1): ColorController {
    return new ColorController(this, object as Record<string, unknown>, property, rgbScale);
  }

  /**
   * Adds a folder to the GUI, which is just another GUI. This method returns
   * the nested GUI so you can add controllers to it.
   *
   * @param title Name to display in the folder's title bar.
   * @returns The created folder.
   */
  addFolder(title: string): GUI {
    const folder = new GUI({ parent: this, title });
    if (this.root._closeFolders) folder.close();
    return folder;
  }

  /**
   * Recalls values that were saved with `gui.save()`.
   *
   * @param obj The saved state.
   * @param recursive Pass false to exclude folders descending from this GUI.
   * @returns `this`
   */
  load(obj: { controllers?: Record<string, unknown>; folders?: Record<string, unknown> }, recursive = true): this {
    const savedControllers = obj.controllers;
    const savedFolders = obj.folders;

    if (savedControllers !== undefined) {
      this.controllers.forEach((c) => {
        if (c instanceof FunctionController) return;

        if (c.property in savedControllers) {
          c.load(savedControllers[c.property]);
        }
      });
    }

    if (recursive && savedFolders !== undefined) {
      this.folders.forEach((f) => {
        if (f.title() in savedFolders) {
          f.load(
            savedFolders[f.title()] as { controllers?: Record<string, unknown>; folders?: Record<string, unknown> },
          );
        }
      });
    }

    return this;
  }

  /**
   * Returns an object mapping property names to values. The object can be passed to `gui.load()`
   * to recall these values.
   *
   * @param recursive Pass false to exclude folders descending from this GUI.
   * @returns The saved state.
   */
  save(recursive = true): { controllers: Record<string, unknown>; folders: Record<string, unknown> } {
    const obj = {
      controllers: {} as Record<string, unknown>,
      folders: {} as Record<string, unknown>,
    };

    this.controllers.forEach((c) => {
      if (c instanceof FunctionController) return;

      if (c.property in obj.controllers) {
        throw new Error(`Cannot save GUI with duplicate property "${c.property}"`);
      }

      obj.controllers[c.property] = c.save();
    });

    if (recursive) {
      this.folders.forEach((f) => {
        if (f.title() in obj.folders) {
          throw new Error(`Cannot save GUI with duplicate folder "${f.title()}"`);
        }

        obj.folders[f.title()] = f.save();
      });
    }

    return obj;
  }

  /**
   * Opens a GUI or folder. GUI and folders are open by default.
   *
   * @param open Pass false to close.
   * @returns `this`
   */
  open(open = true): this {
    this._setClosed(!open);

    this.$title.setAttribute("aria-expanded", String(!this._closed));
    this.domElement.classList.toggle("closed", this._closed);

    return this;
  }

  /**
   * Closes the GUI.
   *
   * @returns `this`
   */
  close(): this {
    return this.open(false);
  }

  _setClosed(closed: boolean): void {
    if (this._closed === closed) return;
    this._closed = closed;
    this._callOnOpenClose(this);
  }

  /**
   * Shows the GUI after it's been hidden.
   *
   * @param show Pass `false` to hide.
   * @returns `this`
   */
  show(show = true): this {
    this._hidden = !show;

    this.domElement.style.display = this._hidden ? "none" : "";

    return this;
  }

  /**
   * Hides the GUI.
   *
   * @returns `this`
   */
  hide(): this {
    return this.show(false);
  }

  /**
   * Opens or closes the GUI with an animated height transition.
   *
   * @param open Pass `false` to close.
   * @returns `this`
   */
  openAnimated(open = true): this {
    // set state immediately
    this._setClosed(!open);

    this.$title.setAttribute("aria-expanded", String(!this._closed));

    // wait for next frame to measure $children
    requestAnimationFrame(() => {
      // explicitly set initial height for transition
      const initialHeight = this.$children.clientHeight;
      this.$children.style.height = initialHeight + "px";

      this.domElement.classList.add("transition");

      const onTransitionEnd = (e: TransitionEvent) => {
        if (e.target !== this.$children) return;
        this.$children.style.height = "";
        this.domElement.classList.remove("transition");
        this.$children.removeEventListener("transitionend", onTransitionEnd);
      };

      this.$children.addEventListener("transitionend", onTransitionEnd);

      const targetHeight = !open ? 0 : this.$children.scrollHeight;

      this.domElement.classList.toggle("closed", !open);

      requestAnimationFrame(() => {
        this.$children.style.height = targetHeight + "px";
      });
    });

    return this;
  }

  /**
   * Change the title of this GUI.
   *
   * @param title The new title.
   * @returns `this`
   */
  title(title?: string): string {
    if (title !== undefined) {
      this._title = title;
      this.$title.textContent = title;
    }

    return this._title;
  }

  /**
   * Resets all controllers to their initial values.
   *
   * @param recursive Pass false to exclude folders descending from this GUI.
   * @returns `this`
   */
  reset(recursive = true): this {
    const controllers = recursive ? this.controllersRecursive() : this.controllers;
    controllers.forEach((c) => c.reset());
    return this;
  }

  /**
   * Pass a function to be called whenever a controller in this GUI changes.
   *
   * @param callback Receives the change event.
   * @returns `this`
   */
  onChange(callback: (event: GUIChangeEvent) => void): this {
    this._onChange = callback;
    return this;
  }

  _callOnChange(controller: Controller): void {
    if (this.parent) {
      this.parent._callOnChange(controller);
    }

    if (this._onChange !== undefined) {
      this._onChange.call(this, {
        object: controller.object,
        property: controller.property,
        value: controller.getValue(),
        controller,
      });
    }
  }

  /**
   * Pass a function to be called whenever a controller in this GUI has finished changing.
   *
   * @param callback Receives the change event.
   * @returns `this`
   */
  onFinishChange(callback: (event: GUIChangeEvent) => void): this {
    this._onFinishChange = callback;
    return this;
  }

  _callOnFinishChange(controller: Controller): void {
    if (this.parent) {
      this.parent._callOnFinishChange(controller);
    }

    if (this._onFinishChange !== undefined) {
      this._onFinishChange.call(this, {
        object: controller.object,
        property: controller.property,
        value: controller.getValue(),
        controller,
      });
    }
  }

  /**
   * Pass a function to be called when this GUI or its descendants are opened or closed.
   *
   * @param callback Receives the toggled GUI.
   * @returns `this`
   */
  onOpenClose(callback: (gui: GUI) => void): this {
    this._onOpenClose = callback;
    return this;
  }

  _callOnOpenClose(changedGUI: GUI): void {
    if (this.parent) {
      this.parent._callOnOpenClose(changedGUI);
    }

    if (this._onOpenClose !== undefined) {
      this._onOpenClose.call(this, changedGUI);
    }
  }

  /**
   * Destroys all DOM elements and event listeners associated with this GUI.
   */
  destroy(): void {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent.folders.splice(this.parent.folders.indexOf(this), 1);
    }

    if (this.domElement.parentElement) {
      this.domElement.parentElement.removeChild(this.domElement);
    }

    Array.from(this.children as GUI[]).forEach((c) => c.destroy());
  }

  /**
   * Returns an array of controllers contained by this GUI and its descendants.
   *
   * @returns The recursive controller list.
   */
  controllersRecursive(): Controller[] {
    let controllers = Array.from(this.controllers);
    this.folders.forEach((f) => {
      controllers = controllers.concat(f.controllersRecursive());
    });
    return controllers;
  }

  /**
   * Returns an array of folders contained by this GUI and its descendants.
   *
   * @returns The recursive folder list.
   */
  foldersRecursive(): GUI[] {
    let folders = Array.from(this.folders);
    this.folders.forEach((f) => {
      folders = folders.concat(f.foldersRecursive());
    });
    return folders;
  }
}
