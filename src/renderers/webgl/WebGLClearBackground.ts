import type { Object3D } from "../../core/Object3D";
import type { Scene } from "../../scenes/Scene";
import type { WebGLRenderer } from "../WebGLRenderer";
import type { WebGLBackgroundState } from "./WebGLBackground";
import { Color } from "../../math/Color";
import { getUnlitUniformColorSpace } from "../shaders/UniformsUtils";
const _rgb = { r: 0, g: 0, b: 0 };
// The color-clear path is independent of textured-background geometry and materials.
export class WebGLClearBackground {
  private readonly renderer: WebGLRenderer;
  private readonly state: WebGLBackgroundState;
  private readonly premultipliedAlpha: boolean;
  private readonly clearColor: Color = new Color(0x000000);
  private clearAlpha: number;

  constructor(renderer: WebGLRenderer, state: WebGLBackgroundState, alpha: boolean, premultipliedAlpha: boolean) {
    this.renderer = renderer;
    this.state = state;
    this.premultipliedAlpha = premultipliedAlpha;
    this.clearAlpha = alpha === true ? 0 : 1;
    this.getClearColor = this.getClearColor.bind(this);
    this.setClearColor = this.setClearColor.bind(this);
    this.getClearAlpha = this.getClearAlpha.bind(this);
    this.setClearAlpha = this.setClearAlpha.bind(this);
    this.render = this.render.bind(this);
  }

  render(scene: Object3D): void {
    let forceClear = false;
    const background = (scene as Scene).isScene === true ? (scene as Scene).background : null;
    if (background !== null && (background as Color).isColor !== true)
      throw new Error("Textured backgrounds require createBackground.");
    if (background === null) {
      this.setClear(this.clearColor, this.clearAlpha);
    } else if (background && (background as Color).isColor) {
      this.setClear(background as Color, 1);
      forceClear = true;
    }
    if (this.renderer.autoClear || forceClear) {
      // buffers might not be writable which is required to ensure a correct clear
      this.state.buffers.depth.setTest(true);
      this.state.buffers.depth.setMask(true);
      this.state.buffers.color.setMask(true);
      this.renderer.clear(this.renderer.autoClearColor, this.renderer.autoClearDepth, this.renderer.autoClearStencil);
    }
  }

  private setClear(color: Color, alpha: number): void {
    color.getRGB(_rgb, getUnlitUniformColorSpace(this.renderer));
    this.state.buffers.color.setClear(_rgb.r, _rgb.g, _rgb.b, alpha, this.premultipliedAlpha);
  }

  getClearColor(): Color {
    return this.clearColor;
  }

  setClearColor(color?: Color | number | string, alpha: number = 1): void {
    this.clearColor.set(color);
    this.clearAlpha = alpha;
    this.setClear(this.clearColor, this.clearAlpha);
  }

  getClearAlpha(): number {
    return this.clearAlpha;
  }

  setClearAlpha(alpha: number): void {
    this.clearAlpha = alpha;
    this.setClear(this.clearColor, this.clearAlpha);
  }
}
