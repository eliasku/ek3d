import { Color } from "../../math/Color";
import { getUnlitUniformColorSpace } from "../shaders/UniformsUtils";
const _rgb = { r: 0, g: 0, b: 0 };
// The color-clear path is independent of textured-background geometry and materials.
export function WebGLClearBackground(renderer?: any, state?: any, alpha?: any, premultipliedAlpha?: any) {
  const clearColor = new Color(0x000000);
  let clearAlpha = alpha === true ? 0 : 1;
  function render(scene?: any) {
    let forceClear = false;
    const background = scene.isScene === true ? scene.background : null;
    if (background !== null && background.isColor !== true)
      throw new Error("Textured backgrounds require createBackground.");
    if (background === null) {
      setClear(clearColor, clearAlpha);
    } else if (background && background.isColor) {
      setClear(background, 1);
      forceClear = true;
    }
    if (renderer.autoClear || forceClear) {
      // buffers might not be writable which is required to ensure a correct clear
      state.buffers.depth.setTest(true);
      state.buffers.depth.setMask(true);
      state.buffers.color.setMask(true);
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }
  }
  function setClear(color?: any, alpha?: any) {
    color.getRGB(_rgb, getUnlitUniformColorSpace(renderer));
    state.buffers.color.setClear(_rgb.r, _rgb.g, _rgb.b, alpha, premultipliedAlpha);
  }
  return {
    getClearColor: function () {
      return clearColor;
    },
    setClearColor: function (color?: any, alpha: number = 1) {
      clearColor.set(color);
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    getClearAlpha: function () {
      return clearAlpha;
    },
    setClearAlpha: function (alpha?: any) {
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    render: render,
  };
}
