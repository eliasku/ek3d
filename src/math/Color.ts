import type { BufferAttribute } from "../core/BufferAttribute";
import type { InterleavedBufferAttribute } from "../core/InterleavedBufferAttribute";
import type { Matrix3 } from "./Matrix3";
import type { Vector3 } from "./Vector3";
import { clamp, euclideanModulo, lerp } from "./MathUtils";
import { ColorManagement, SRGBToLinear, LinearToSRGB } from "./ColorManagement";
import { ColorSpace } from "../constants";
import { warn } from "../utils";
const _colorKeywords = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32,
};
const _hslA = { h: 0, s: 0, l: 0 };
const _hslB = { h: 0, s: 0, l: 0 };
function hue2rgb(p?: any, q?: any, t?: any) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
/**
 * A Color instance is represented by RGB components in the linear <i>working
 * color space</i>, which defaults to `ColorSpace.LinearSRGB`. Inputs
 * conventionally using `ColorSpace.SRGB` (such as hexadecimals and CSS
 * strings) are converted to the working color space automatically.
 *
 * ```typescript
 * import { Color } from 'ek3d/math/Color';
 * import { ColorSpace } from 'ek3d/constants';
 *
 * // converted automatically from ColorSpace.SRGB to ColorSpace.LinearSRGB
 * const color = new Color().setHex( 0x112233 );
 * ```
 * Source color spaces may be specified explicitly, to ensure correct conversions.
 * ```typescript
 * import { Color } from 'ek3d/math/Color';
 * import { ColorSpace } from 'ek3d/constants';
 *
 * // assumed already ColorSpace.LinearSRGB; no conversion
 * const color = new Color().setRGB( 0.5, 0.5, 0.5 );
 *
 * // converted explicitly from ColorSpace.SRGB to ColorSpace.LinearSRGB
 * const srgbColor = new Color().setRGB( 0.5, 0.5, 0.5, ColorSpace.SRGB );
 * ```
 * If THREE.ColorManagement is disabled, no conversions occur. For details,
 * see <i>Color management</i>. Iterating through a Color instance will yield
 * its components (r, g, b) in the corresponding order. A Color can be initialised
 * in any of the following ways:
 * ```typescript
 * import { Color } from 'ek3d/math/Color';
 *
 * //empty constructor - will default white
 * const color1 = new Color();
 *
 * //Hexadecimal color (recommended)
 * const color2 = new Color( 0xff0000 );
 *
 * //RGB string
 * const color3 = new Color("rgb(255, 0, 0)");
 * const color4 = new Color("rgb(100%, 0%, 0%)");
 *
 * //X11 color name - all 140 color names are supported.
 * //Note the lack of CamelCase in the name
 * const color5 = new Color( 'skyblue' );
 * //HSL string
 * const color6 = new Color("hsl(0, 100%, 50%)");
 *
 * //Separate RGB values between 0 and 1
 * const color7 = new Color( 1, 0, 0 );
 * ```
 */
export class Color {
  isColor: boolean;
  r: number;
  g: number;
  b: number;
  static NAMES: any;

  /**
   * Constructs a new color.
   *
   * Note that standard method of specifying color in three.js is with a hexadecimal triplet,
   * and that method is used throughout the rest of the documentation.
   *
   * @param [r] - The red component of the color. If `g` and `b` are
   * not provided, it can be hexadecimal triplet, a CSS-style string or another `Color` instance.
   * @param [g] - The green component.
   * @param [b] - The blue component.
   */
  constructor(r?: number | string | Color, g?: number, b?: number) {
    /**
     * This flag can be used for type testing.
     *
     * @readonly
     * @default true
     */
    this.isColor = true;
    /**
     * The red component.
     *
     * @default 1
     */
    this.r = 1;
    /**
     * The green component.
     *
     * @default 1
     */
    this.g = 1;
    /**
     * The blue component.
     *
     * @default 1
     */
    this.b = 1;
    return this.set(r!, g!, b!);
  }
  /**
   * Sets the colors's components from the given values.
   *
   * @param [r] - The red component of the color. If `g` and `b` are
   * not provided, it can be hexadecimal triplet, a CSS-style string or another `Color` instance.
   * @param [g] - The green component.
   * @param [b] - The blue component.
   * @return A reference to this color.
   */
  set(r?: number | string | Color, g?: number, b?: number): Color;
  set(r?: any, g?: number, b?: number): Color {
    if (g! === undefined && b! === undefined) {
      // r is THREE.Color, hex or string
      const value = r;
      if (value && (value as any).isColor) {
        this.copy(value);
      } else if (typeof value === "number") {
        this.setHex(value);
      } else if (typeof value === "string") {
        this.setStyle(value);
      }
    } else {
      this.setRGB(r, g!, b!);
    }
    return this;
  }
  /**
   * Sets the colors's components to the given scalar value.
   *
   * @param scalar - The scalar value.
   * @return A reference to this color.
   */
  setScalar(scalar: number): Color {
    this.r = scalar;
    this.g = scalar;
    this.b = scalar;
    return this;
  }
  /**
   * Sets this color from a hexadecimal value.
   *
   * @param hex - The hexadecimal value.
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return A reference to this color.
   */
  setHex(hex: number, colorSpace: string = ColorSpace.SRGB): Color {
    hex = Math.floor(hex);
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  /**
   * Sets this color from RGB values.
   *
   * @param r - Red channel value between `0.0` and `1.0`.
   * @param g - Green channel value between `0.0` and `1.0`.
   * @param b - Blue channel value between `0.0` and `1.0`.
   * @param [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return A reference to this color.
   */
  setRGB(r: number, g: number, b: number, colorSpace: string = ColorManagement.workingColorSpace): Color {
    this.r = r;
    this.g = g;
    this.b = b;
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  /**
   * Sets this color from RGB values.
   *
   * @param h - Hue value between `0.0` and `1.0`.
   * @param s - Saturation value between `0.0` and `1.0`.
   * @param l - Lightness value between `0.0` and `1.0`.
   * @param [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return A reference to this color.
   */
  setHSL(h: number, s: number, l: number, colorSpace: string = ColorManagement.workingColorSpace): Color {
    // h,s,l ranges are in 0.0 - 1.0
    h = euclideanModulo(h, 1);
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    if (s === 0) {
      this.r = this.g = this.b = l;
    } else {
      const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
      const q = 2 * l - p;
      this.r = hue2rgb(q, p, h + 1 / 3);
      this.g = hue2rgb(q, p, h);
      this.b = hue2rgb(q, p, h - 1 / 3);
    }
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  /**
   * Sets this color from a CSS-style string. For example, `rgb(250, 0,0)`,
   * `rgb(100%, 0%, 0%)`, `hsl(0, 100%, 50%)`, `#ff0000`, `#f00`, or `red` ( or
   * any [X11 color name](https://en.wikipedia.org/wiki/X11_color_names#Color_name_chart) -
   * all 140 color names are supported).
   *
   * @param style - Color as a CSS-style string.
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return A reference to this color.
   */
  setStyle(style: string, colorSpace: string = ColorSpace.SRGB): Color {
    function handleAlpha(string?: any) {
      if (string === undefined) return;
      if (parseFloat(string) < 1) {
        warn("Color: Alpha component of " + style + " will be ignored.");
      }
    }
    let m: any;
    if ((m = /^(\w+)\(([^)]*)\)/.exec(style))) {
      // rgb / hsl
      let color: any;
      const name = (m as any)[1];
      const components = (m as any)[2];
      switch (name) {
        case "rgb":
        case "rgba":
          if ((color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(components))) {
            // rgb(255,0,0) rgba(255,0,0,0.5)
            handleAlpha((color as any)[4]);
            return this.setRGB(
              Math.min(255, parseInt((color as any)[1], 10)) / 255,
              Math.min(255, parseInt((color as any)[2], 10)) / 255,
              Math.min(255, parseInt((color as any)[3], 10)) / 255,
              colorSpace,
            );
          }
          if (
            (color =
              /^\s*(\d+(?:\.\d+)?|\.\d+)%\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(
                components,
              ))
          ) {
            // rgb(100%,0%,0%) rgba(100%,0%,0%,0.5) rgb(50.5%,0%,0%)
            handleAlpha((color as any)[4]);
            return this.setRGB(
              Math.min(100, parseFloat((color as any)[1])) / 100,
              Math.min(100, parseFloat((color as any)[2])) / 100,
              Math.min(100, parseFloat((color as any)[3])) / 100,
              colorSpace,
            );
          }
          break;
        case "hsl":
        case "hsla":
          if (
            (color =
              /^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*,\s*(\d+(?:\.\d+)?|\.\d+)%\s*(?:,\s*(\d+(?:\.\d+)?|\.\d+)\s*)?$/.exec(
                components,
              ))
          ) {
            // hsl(120,50%,50%) hsla(120,50%,50%,0.5) hsl(-120,50%,50%)
            handleAlpha((color as any)[4]);
            return this.setHSL(
              parseFloat((color as any)[1]) / 360,
              parseFloat((color as any)[2]) / 100,
              parseFloat((color as any)[3]) / 100,
              colorSpace,
            );
          }
          break;
        default:
          warn("Color: Unknown color model " + style);
      }
    } else if ((m = /^#([A-Fa-f\d]+)$/.exec(style))) {
      // hex color
      const hex = (m as any)[1];
      const size = hex.length;
      if (size === 3) {
        // #ff0
        return this.setRGB(
          parseInt(hex.charAt(0), 16) / 15,
          parseInt(hex.charAt(1), 16) / 15,
          parseInt(hex.charAt(2), 16) / 15,
          colorSpace,
        );
      } else if (size === 6) {
        // #ff0000
        return this.setHex(parseInt(hex, 16), colorSpace);
      } else {
        warn("Color: Invalid hex color " + style);
      }
    } else if (style && style.length > 0) {
      return this.setColorName(style, colorSpace);
    }
    return this;
  }
  /**
   * Sets this color from a color name. Faster than {@link Color#setStyle} if
   * you don't need the other CSS-style formats.
   *
   * For convenience, the list of names is exposed in `Color.NAMES` as a hash.
   * ```typescript
   * import { Color } from 'ek3d/math/Color';
   *
   * Color.NAMES.aliceblue // returns 0xF0F8FF
   * ```
   *
   * @param style - The color name.
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return A reference to this color.
   */
  setColorName(style: string, colorSpace: string = ColorSpace.SRGB): Color {
    // color keywords
    const hex = (_colorKeywords as any)[style.toLowerCase()];
    if (hex !== undefined) {
      // red
      this.setHex(hex, colorSpace);
    } else {
      // unknown color
      warn("Color: Unknown color " + style);
    }
    return this;
  }
  /**
   * Returns a new color with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): Color {
    return new (this.constructor as any)(this.r, this.g, this.b);
  }
  /**
   * Copies the values of the given color to this instance.
   *
   * @param color - The color to copy.
   * @return A reference to this color.
   */
  copy(color: Color): Color {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }
  /**
   * Copies the given color into this color, and then converts this color from
   * `ColorSpace.SRGB` to `ColorSpace.LinearSRGB`.
   *
   * @param color - The color to copy/convert.
   * @return A reference to this color.
   */
  copySRGBToLinear(color: Color): Color {
    this.r = SRGBToLinear(color.r);
    this.g = SRGBToLinear(color.g);
    this.b = SRGBToLinear(color.b);
    return this;
  }
  /**
   * Copies the given color into this color, and then converts this color from
   * `ColorSpace.LinearSRGB` to `ColorSpace.SRGB`.
   *
   * @param color - The color to copy/convert.
   * @return A reference to this color.
   */
  copyLinearToSRGB(color: Color): Color {
    this.r = LinearToSRGB(color.r);
    this.g = LinearToSRGB(color.g);
    this.b = LinearToSRGB(color.b);
    return this;
  }
  /**
   * Converts this color from `ColorSpace.SRGB` to `ColorSpace.LinearSRGB`.
   *
   * @return A reference to this color.
   */
  convertSRGBToLinear(): Color {
    this.copySRGBToLinear(this);
    return this;
  }
  /**
   * Converts this color from `ColorSpace.LinearSRGB` to `ColorSpace.SRGB`.
   *
   * @return A reference to this color.
   */
  convertLinearToSRGB(): Color {
    this.copyLinearToSRGB(this);
    return this;
  }
  /**
   * Returns the hexadecimal value of this color.
   *
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return The hexadecimal value.
   */
  getHex(colorSpace: string = ColorSpace.SRGB): number {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    return (
      Math.round(clamp(_color.r * 255, 0, 255)) * 65536 +
      Math.round(clamp(_color.g * 255, 0, 255)) * 256 +
      Math.round(clamp(_color.b * 255, 0, 255))
    );
  }
  /**
   * Returns the hexadecimal value of this color as a string (for example, 'FFFFFF').
   *
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return The hexadecimal value as a string.
   */
  getHexString(colorSpace: string = ColorSpace.SRGB): string {
    return ("000000" + this.getHex(colorSpace).toString(16)).slice(-6);
  }
  /**
   * Converts the colors RGB values into the HSL format and stores them into the
   * given target object.
   *
   * @param target - The target object that is used to store the method's result.
   * @param [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return The HSL representation of this color.
   */
  getHSL(target?: any, colorSpace: string = ColorManagement.workingColorSpace) {
    // h,s,l ranges are in 0.0 - 1.0
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    const r = _color.r,
      g = _color.g,
      b = _color.b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue: any, saturation: any;
    const lightness = (min + max) / 2.0;
    if (min === max) {
      hue = 0;
      saturation = 0;
    } else {
      const delta = max - min;
      saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    target.h = hue;
    target.s = saturation;
    target.l = lightness;
    return target;
  }
  /**
   * Returns the RGB values of this color and stores them into the given target object.
   *
   * @param target - The target color that is used to store the method's result.
   * @param [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return The RGB representation of this color.
   */
  getRGB<T extends Pick<Color, "r" | "g" | "b">>(target: T, colorSpace: string = ColorManagement.workingColorSpace): T {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    target.r = _color.r;
    target.g = _color.g;
    target.b = _color.b;
    return target;
  }
  /**
   * Returns the value of this color as a CSS style string. Example: `rgb(255,0,0)`.
   *
   * @param [colorSpace=ColorSpace.SRGB] - The color space.
   * @return The CSS representation of this color.
   */
  getStyle(colorSpace: string = ColorSpace.SRGB): string {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    const r = _color.r,
      g = _color.g,
      b = _color.b;
    if (colorSpace !== ColorSpace.SRGB) {
      // Requires CSS Color Module Level 4 (https://www.w3.org/TR/css-color-4/).
      return `color(${colorSpace} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)})`;
    }
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }
  /**
   * Adds the given HSL values to this color's values.
   * Internally, this converts the color's RGB values to HSL, adds HSL
   * and then converts the color back to RGB.
   *
   * @param h - Hue value between `0.0` and `1.0`.
   * @param s - Saturation value between `0.0` and `1.0`.
   * @param l - Lightness value between `0.0` and `1.0`.
   * @return A reference to this color.
   */
  offsetHSL(h: number, s: number, l: number): Color {
    this.getHSL(_hslA);
    return this.setHSL(_hslA.h + h, _hslA.s + s, _hslA.l + l);
  }
  /**
   * Adds the RGB values of the given color to the RGB values of this color.
   *
   * @param color - The color to add.
   * @return A reference to this color.
   */
  add(color: Color): Color {
    this.r += color.r;
    this.g += color.g;
    this.b += color.b;
    return this;
  }
  /**
   * Adds the RGB values of the given colors and stores the result in this instance.
   *
   * @param color1 - The first color.
   * @param color2 - The second color.
   * @return A reference to this color.
   */
  addColors(color1: Color, color2: Color): Color {
    this.r = color1.r + color2.r;
    this.g = color1.g + color2.g;
    this.b = color1.b + color2.b;
    return this;
  }
  /**
   * Adds the given scalar value to the RGB values of this color.
   *
   * @param s - The scalar to add.
   * @return A reference to this color.
   */
  addScalar(s: number): Color {
    this.r += s;
    this.g += s;
    this.b += s;
    return this;
  }
  /**
   * Subtracts the RGB values of the given color from the RGB values of this color.
   *
   * @param color - The color to subtract.
   * @return A reference to this color.
   */
  sub(color: Color): Color {
    this.r = Math.max(0, this.r - color.r);
    this.g = Math.max(0, this.g - color.g);
    this.b = Math.max(0, this.b - color.b);
    return this;
  }
  /**
   * Multiplies the RGB values of the given color with the RGB values of this color.
   *
   * @param color - The color to multiply.
   * @return A reference to this color.
   */
  multiply(color: Color): Color {
    this.r *= color.r;
    this.g *= color.g;
    this.b *= color.b;
    return this;
  }
  /**
   * Multiplies the given scalar value with the RGB values of this color.
   *
   * @param s - The scalar to multiply.
   * @return A reference to this color.
   */
  multiplyScalar(s: number): Color {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }
  /**
   * Linearly interpolates this color's RGB values toward the RGB values of the
   * given color. The alpha argument can be thought of as the ratio between
   * the two colors, where `0.0` is this color and `1.0` is the first argument.
   *
   * @param color - The color to converge on.
   * @param alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return A reference to this color.
   */
  lerp(color: Color, alpha: number): Color {
    this.r += (color.r - this.r) * alpha;
    this.g += (color.g - this.g) * alpha;
    this.b += (color.b - this.b) * alpha;
    return this;
  }
  /**
   * Linearly interpolates between the given colors and stores the result in this instance.
   * The alpha argument can be thought of as the ratio between the two colors, where `0.0`
   * is the first and `1.0` is the second color.
   *
   * @param color1 - The first color.
   * @param color2 - The second color.
   * @param alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return A reference to this color.
   */
  lerpColors(color1: Color, color2: Color, alpha: number): Color {
    this.r = color1.r + (color2.r - color1.r) * alpha;
    this.g = color1.g + (color2.g - color1.g) * alpha;
    this.b = color1.b + (color2.b - color1.b) * alpha;
    return this;
  }
  /**
   * Linearly interpolates this color's HSL values toward the HSL values of the
   * given color. It differs from {@link Color#lerp} by not interpolating straight
   * from one color to the other, but instead going through all the hues in between
   * those two colors. The alpha argument can be thought of as the ratio between
   * the two colors, where 0.0 is this color and 1.0 is the first argument.
   *
   * @param color - The color to converge on.
   * @param alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return A reference to this color.
   */
  lerpHSL(color: Color, alpha: number): Color {
    this.getHSL(_hslA);
    color.getHSL(_hslB);
    const h = lerp(_hslA.h, _hslB.h, alpha);
    const s = lerp(_hslA.s, _hslB.s, alpha);
    const l = lerp(_hslA.l, _hslB.l, alpha);
    this.setHSL(h, s, l);
    return this;
  }
  /**
   * Sets the color's RGB components from the given 3D vector.
   *
   * @param v - The vector to set.
   * @return A reference to this color.
   */
  setFromVector3(v: Vector3): Color {
    this.r = v.x;
    this.g = v.y;
    this.b = v.z;
    return this;
  }
  /**
   * Transforms this color with the given 3x3 matrix.
   *
   * @param m - The matrix.
   * @return A reference to this color.
   */
  applyMatrix3(m: Matrix3): Color {
    const r = this.r,
      g = this.g,
      b = this.b;
    const e = m.elements;
    this.r = e[0] * r + e[3] * g + e[6] * b;
    this.g = e[1] * r + e[4] * g + e[7] * b;
    this.b = e[2] * r + e[5] * g + e[8] * b;
    return this;
  }
  /**
   * Returns `true` if this color is equal with the given one.
   *
   * @param c - The color to test for equality.
   * @return Whether this bounding color is equal with the given one.
   */
  equals(c: Color): boolean {
    return c.r === this.r && c.g === this.g && c.b === this.b;
  }
  /**
   * Sets this color's RGB components from the given array.
   *
   * @param array - An array holding the RGB values.
   * @param [offset=0] - The offset into the array.
   * @return A reference to this color.
   */
  fromArray(array: ArrayLike<number>, offset: number = 0): Color {
    this.r = array[offset];
    this.g = array[offset + 1];
    this.b = array[offset + 2];
    return this;
  }
  /**
   * Writes the RGB components of this color to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param [array=[]] - The target array holding the color components.
   * @param [offset=0] - Index of the first element in the array.
   * @return The color components.
   */
  toArray(array?: number[], offset?: number): number[];
  toArray<
    T extends
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array,
  >(array: T, offset?: number): T;
  toArray(
    array:
      | number[]
      | Int8Array
      | Uint8Array
      | Uint8ClampedArray
      | Int16Array
      | Uint16Array
      | Int32Array
      | Uint32Array
      | Float32Array
      | Float64Array = [],
    offset: number = 0,
  ):
    | number[]
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array {
    array[offset] = this.r;
    array[offset + 1] = this.g;
    array[offset + 2] = this.b;
    return array;
  }
  /**
   * Sets the components of this color from the given buffer attribute.
   *
   * @param attribute - The buffer attribute holding color data.
   * @param index - The index into the attribute.
   * @return A reference to this color.
   */
  fromBufferAttribute(attribute: BufferAttribute | InterleavedBufferAttribute, index: number): Color;
  fromBufferAttribute(attribute: any, index: number): Color {
    this.r = attribute.getX(index);
    this.g = attribute.getY(index);
    this.b = attribute.getZ(index);
    return this;
  }
  /**
   * This methods defines the serialization result of this class. Returns the color
   * as a hexadecimal value.
   *
   * @return The hexadecimal value.
   */
  toJSON(): number {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    yield this.r;
    yield this.g;
    yield this.b;
  }
}
const _color = /*@__PURE__*/ new Color();
/**
 * A dictionary with X11 color names.
 *
 * Note that multiple words such as Dark Orange become the string 'darkorange'.
 *
 * @static
 */
Color.NAMES = _colorKeywords;
