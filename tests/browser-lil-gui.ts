import { GUI } from "ek3d/addons/libs/lil-gui/GUI";
import type { Controller } from "ek3d/addons/libs/lil-gui/Controller";
import type {
  BooleanController,
  FunctionController,
  OptionController,
  StringController,
} from "ek3d/addons/libs/lil-gui/controllers";
import type { NumberController } from "ek3d/addons/libs/lil-gui/NumberController";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Verifies lil-gui widget behavior in a real DOM: controller creation, value mutation
 * through the widget, save/load round-trips, folders, disable/destroy and color parsing.
 */
export async function verifyLilGui() {
  const checks: string[] = [];

  const params = {
    number: 1.5,
    boundedNumber: 0.5,
    boolean: true,
    string: "hello",
    option: "a",
    colorCss: "#ff00ff",
    colorInt: 0xff3366,
    colorRgb: { r: 0, g: 0.2, b: 0.4 },
    colorArray: [0, 0.5, 1],
    action: () => {
      params.actionCalls++;
    },
    actionCalls: 0,
  };

  const gui = new GUI({ title: "Test GUI", width: 300 });
  checks.push("constructor");

  const numberController = gui.add(params, "number") as NumberController;
  check(numberController.getValue() === 1.5, "number controller reads the initial value");

  const boundedController = gui.add(params, "boundedNumber", 0, 1, 0.01);
  check(
    boundedController.domElement.classList.contains("controller") &&
      boundedController.domElement.classList.contains("number") &&
      boundedController.domElement.classList.contains("has-slider"),
    "bounded number widget carries its class chain including the slider",
  );

  const booleanController = gui.add(params, "boolean") as BooleanController;
  const optionController = gui.add(params, "option", ["a", "b", "c"]) as OptionController;
  const functionController = gui.add(params, "action") as FunctionController;
  const stringController = gui.add(params, "string") as StringController;
  gui.addColor(params, "colorCss");
  gui.addColor(params, "colorInt");
  gui.addColor(params, "colorRgb");
  gui.addColor(params, "colorArray");
  check(gui.controllers.length === 10, "all controllers registered");
  checks.push("controllers");

  // String input writes through.
  stringController.$input.value = "world";
  stringController.$input.dispatchEvent(new Event("input"));
  check(params.string === "world", "string input writes the target property");

  // Checkbox interaction flips the value.
  const checkbox = booleanController.$input as HTMLInputElement;
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change"));
  check((params.boolean as boolean) === false, "checkbox change writes the target property");
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change"));

  // Function controller fires the bound function.
  functionController.$button.click();
  check(params.actionCalls === 1, "function controller runs the bound function");

  // Dropdown selection applies the option value.
  const select = optionController.$select as HTMLSelectElement;
  select.selectedIndex = 2;
  select.dispatchEvent(new Event("change"));
  check(params.option === "c", "select change writes the picked option");

  // Number input parses, snaps and clamps to [0, 1].
  const numberInput = (boundedController as NumberController).$input;
  const freeInput = (numberController as NumberController).$input;
  freeInput.value = "0.1234";
  freeInput.dispatchEvent(new Event("input"));
  check(Math.abs((params.number as number) - 0.1234) < 1e-12, "number text input accepts free values");
  numberInput.value = "0.1264";
  numberInput.dispatchEvent(new Event("input"));
  check(
    Math.abs(params.boundedNumber / 0.01 - Math.round(params.boundedNumber / 0.01)) < 1e-6,
    `explicit step snaps the input, got ${params.boundedNumber}`,
  );
  numberInput.value = "5";
  numberInput.dispatchEvent(new Event("input"));
  check((params.boundedNumber as number) === 1, "number input clamps to max");
  numberInput.value = "-3";
  numberInput.dispatchEvent(new Event("input"));
  check((params.boundedNumber as number) === 0, "number input clamps to min");
  checks.push("widgets");

  // Slider drag maps x to value.
  const slider = (boundedController as unknown as { $slider: HTMLDivElement }).$slider;
  const rect = { left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20, x: 0, y: 0, toJSON: () => ({}) };
  slider.getBoundingClientRect = () => rect as DOMRect;
  slider.dispatchEvent(new MouseEvent("mousedown", { clientX: 50 }));
  check(Math.abs(params.boundedNumber - 0.5) < 0.011, `slider center maps to mid value, got ${params.boundedNumber}`);
  window.dispatchEvent(new MouseEvent("mouseup"));
  checks.push("slider");

  // Color controller: text hex mutates string, object and array targets.
  const cssController = gui.controllers.find((c) => c.property === "colorCss") as Controller;
  const colorTextInput = (cssController as unknown as { $text: HTMLInputElement }).$text;
  colorTextInput.value = "00ff00";
  colorTextInput.dispatchEvent(new Event("input"));
  check(params.colorCss === "#00ff00", "color text accepts bare hex");
  const cssSwatch = (cssController as unknown as { $input: HTMLInputElement }).$input;
  check(cssSwatch.value === "#00ff00", "color swatch syncs with text");

  const rgbController = gui.controllers.find((c) => c.property === "colorRgb") as Controller;
  const rgbTextInput = (rgbController as unknown as { $text: HTMLInputElement }).$text;
  rgbTextInput.value = "#ffffff";
  rgbTextInput.dispatchEvent(new Event("input"));
  check(
    params.colorRgb.r === 1 && params.colorRgb.g === 1 && params.colorRgb.b === 1,
    "object color target mutates in place",
  );

  const intController = gui.controllers.find((c) => c.property === "colorInt") as Controller;
  check(intController.save() === "#ff3366", "int color saves as padded hex");
  checks.push("colors");

  // Folder nesting and recursion.
  const folder = gui.addFolder("Nested");
  const folderValue = { x: 5 };
  folder.add(folderValue, "x", 0, 10);
  check(gui.folders.length === 1 && folder.controllers.length === 1, "folder nesting");

  // save/load round trip.
  params.number = 9.5;
  const saved = gui.save();
  params.number = 1;
  gui.load(JSON.parse(JSON.stringify(saved)));
  check(params.number === 9.5, "save/load round-trip restores values");
  checks.push("save-load");

  // onChange plumbing.
  let notified = 0;
  gui.onChange(() => notified++);
  const beforeNotified = notified;
  booleanController.setValue(false);
  check(notified > beforeNotified, "GUI onChange fires for controller changes");

  // disable + reset + destroy.
  booleanController.disable();
  check(booleanController.$input.disabled === true, "disable sets widget attribute");
  booleanController.reset();
  check((params.boolean as boolean) === true, "reset restores the initial value");
  optionController.destroy();
  check((gui.controllers.length as number) === 9, "destroy removes the controller");
  checks.push("disable-reset-destroy");

  // Clean up the injected GUI.
  gui.destroy();
  check(document.querySelectorAll(".lil-gui").length === 0, "destroy removes the DOM panel");

  return { checks, glError: 0 };
}
