import type { Color } from "../../math/Color";
import { clamp, euclideanModulo } from "../../math/MathUtils";

const hsl = { h: 0, s: 0, l: 0 };

/** Converts between HSV values and the working color space. */
export class ColorConverter {
  static setHSV(color: Color, h: number, s: number, v: number): Color {
    h = euclideanModulo(h, 1);
    s = clamp(s, 0, 1);
    v = clamp(v, 0, 1);
    const l = (2 - s) * v;
    const saturation = l === 0 || l === 2 ? 0 : (s * v) / (l < 1 ? l : 2 - l);
    return color.setHSL(h, saturation, l * 0.5);
  }

  static getHSV<T extends { h: number; s: number; v: number }>(color: Color, target: T): T {
    color.getHSL(hsl);
    hsl.s *= hsl.l < 0.5 ? hsl.l : 1 - hsl.l;
    const v = hsl.l + hsl.s;
    target.h = hsl.h;
    target.s = v === 0 ? 0 : (2 * hsl.s) / v;
    target.v = v;
    return target;
  }
}
