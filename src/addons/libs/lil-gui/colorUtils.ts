/** Normalizes any supported CSS color string to an `#rrggbb` hex string, or `false`. */
export function normalizeColorString(string: string): string | false {
  let match: RegExpExecArray | RegExpMatchArray | null;

  if ((match = string.match(/(#|0x)?([a-f0-9]{6})/i))) {
    return `#${match[2]}`;
  } else if ((match = string.match(/rgb\(\s*(\d*)\s*,\s*(\d*)\s*,\s*(\d*)\s*\)/))) {
    return (
      `#${parseInt(match[1]).toString(16).padStart(2, "0")}` +
      `${parseInt(match[2]).toString(16).padStart(2, "0")}` +
      `${parseInt(match[3]).toString(16).padStart(2, "0")}`
    );
  } else if ((match = string.match(/^(?:#)?([a-f0-9])([a-f0-9])([a-f0-9])$/i)) !== null) {
    const a = match[1];
    const b = match[2];
    const c = match[3];
    return `#${a}${a}${b}${b}${c}${c}`;
  }

  return false;
}

type ColorChannelTuple = number[];

/** A color format description able to read and write hex strings. */
export interface ColorFormat {
  isPrimitive: boolean;
  match(v: unknown): boolean;
  fromHexString(
    hex: string,
    target?: ColorChannelTuple | { r: number; g: number; b: number },
    rgbScale?: number,
  ): unknown;
  toHexString(value: unknown, rgbScale?: number): string;
}

/** Color formats matched against the property's initial value. */
const STRING: ColorFormat = {
  isPrimitive: true,
  match: (v: unknown): boolean => typeof v === "string",
  fromHexString: (hex: string): string => normalizeColorString(hex) || hex,
  toHexString: (value: string): string => normalizeColorString(value) || value,
};

const INT: ColorFormat = {
  isPrimitive: true,
  match: (v: unknown): boolean => typeof v === "number",
  fromHexString: (hex: string): number => parseInt(hex.substring(1), 16),
  toHexString: (value: number): string => `#${value.toString(16).padStart(6, "0")}`,
};

const ARRAY: ColorFormat = {
  isPrimitive: false,
  match: (v: unknown): boolean => Array.isArray(v) || ArrayBuffer.isView(v),
  fromHexString(hex: string, target: ColorChannelTuple, rgbScale = 1): void {
    const int = INT.fromHexString(hex) as number;

    target[0] = (((int >> 16) & 255) / 255) * rgbScale;
    target[1] = (((int >> 8) & 255) / 255) * rgbScale;
    target[2] = ((int & 255) / 255) * rgbScale;
  },
  toHexString([r, g, b]: ColorChannelTuple, rgbScale = 1): string {
    rgbScale = 255 / rgbScale;

    const int = ((r * rgbScale) << 16) ^ ((g * rgbScale) << 8) ^ ((b * rgbScale) << 0);

    return INT.toHexString(int);
  },
};

const OBJECT: ColorFormat = {
  isPrimitive: false,
  match: (v: unknown): boolean => Object(v) === v && !Array.isArray(v) && !ArrayBuffer.isView(v),
  fromHexString(hex: string, target: { r: number; g: number; b: number }, rgbScale = 1): void {
    const int = INT.fromHexString(hex) as number;

    target.r = (((int >> 16) & 255) / 255) * rgbScale;
    target.g = (((int >> 8) & 255) / 255) * rgbScale;
    target.b = ((int & 255) / 255) * rgbScale;
  },
  toHexString({ r, g, b }: { r: number; g: number; b: number }, rgbScale = 1): string {
    rgbScale = 255 / rgbScale;

    const int = ((r * rgbScale) << 16) ^ ((g * rgbScale) << 8) ^ ((b * rgbScale) << 0);

    return INT.toHexString(int);
  },
};

const FORMATS = [STRING, INT, ARRAY, OBJECT];

/**
 * Returns the color format that matches the given initial `value`.
 *
 * @param value - The initial property value.
 * @returns The matching format description, or `undefined` if unsupported.
 */
export function getColorFormat(
  value: string | number | unknown[] | { r: number; g: number; b: number },
): ColorFormat | undefined {
  return FORMATS.find((format) => format.match(value));
}
