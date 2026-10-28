import { ColorSpace } from "../../constants";
import { Color } from "../../math/Color";
import { clamp } from "../../math/MathUtils";

export const ColorMapKeywords: Record<string, [number, number][]> = {
  rainbow: [
    [0, 0x0000ff],
    [0.2, 0x00ffff],
    [0.5, 0x00ff00],
    [0.8, 0xffff00],
    [1, 0xff0000],
  ],
  cooltowarm: [
    [0, 0x3c4ec2],
    [0.2, 0x9bbcff],
    [0.5, 0xdcdcdc],
    [0.8, 0xf6a385],
    [1, 0xb40426],
  ],
  blackbody: [
    [0, 0x000000],
    [0.2, 0x780000],
    [0.5, 0xe63200],
    [0.8, 0xffff00],
    [1, 0xffffff],
  ],
  grayscale: [
    [0, 0x000000],
    [0.2, 0x404040],
    [0.5, 0x7f7f80],
    [0.8, 0xbfbfbf],
    [1, 0xffffff],
  ],
};

export class Lut {
  readonly isLut: boolean = true;
  lut: Color[] = [];
  map: [number, number][] = [];
  n: number = 0;
  minV: number = 0;
  maxV: number = 1;

  constructor(colormap = "rainbow", count = 32) {
    this.setColorMap(colormap, count);
  }

  set(value: Lut): this {
    if (value.isLut) this.copy(value);
    return this;
  }

  setMin(min: number): this {
    this.minV = min;
    return this;
  }
  setMax(max: number): this {
    this.maxV = max;
    return this;
  }

  setColorMap(colormap = "rainbow", count = 32): this {
    this.map = ColorMapKeywords[colormap] || ColorMapKeywords.rainbow;
    this.n = count;
    const minColor = new Color();
    const maxColor = new Color();
    this.lut.length = 0;
    this.lut.push(new Color().setHex(this.map[0][1], ColorSpace.LinearSRGB));
    for (let i = 1; i < count; i++) {
      const alpha = i / count;
      for (let j = 0; j < this.map.length - 1; j++) {
        const [min, minHex] = this.map[j];
        const [max, maxHex] = this.map[j + 1];
        if (alpha > min && alpha <= max) {
          minColor.setHex(minHex, ColorSpace.LinearSRGB);
          maxColor.setHex(maxHex, ColorSpace.LinearSRGB);
          this.lut.push(new Color().lerpColors(minColor, maxColor, (alpha - min) / (max - min)));
        }
      }
    }
    this.lut.push(new Color().setHex(this.map[this.map.length - 1][1], ColorSpace.LinearSRGB));
    return this;
  }

  copy(lut: Lut): this {
    this.lut = lut.lut;
    this.map = lut.map;
    this.n = lut.n;
    this.minV = lut.minV;
    this.maxV = lut.maxV;
    return this;
  }

  getColor(alpha: number): Color {
    alpha = (clamp(alpha, this.minV, this.maxV) - this.minV) / (this.maxV - this.minV);
    return this.lut[Math.round(alpha * this.n)];
  }

  addColorMap(name: string, colors: [number, number][]): this {
    ColorMapKeywords[name] = colors;
    return this;
  }

  createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = this.n;
    return this.updateCanvas(canvas);
  }

  updateCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx === null) throw new Error("Unable to create lookup table canvas context");
    const imageData = ctx.getImageData(0, 0, 1, this.n);
    const data = imageData.data;
    const minColor = new Color();
    const maxColor = new Color();
    const finalColor = new Color();
    let k = 0;
    for (let i = 1; i >= 0; i -= 1 / this.n) {
      for (let j = this.map.length - 1; j > 0; j--) {
        const [min, minHex] = this.map[j - 1];
        const [max, maxHex] = this.map[j];
        if (i < max && i >= min) {
          minColor.setHex(minHex, ColorSpace.LinearSRGB);
          maxColor.setHex(maxHex, ColorSpace.LinearSRGB);
          finalColor.lerpColors(minColor, maxColor, (i - min) / (max - min));
          data[k * 4] = Math.round(finalColor.r * 255);
          data[k * 4 + 1] = Math.round(finalColor.g * 255);
          data[k * 4 + 2] = Math.round(finalColor.b * 255);
          data[k * 4 + 3] = 255;
          k++;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }
}
