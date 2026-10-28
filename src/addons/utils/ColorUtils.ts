import { SRGBColorSpace } from "../../constants";
import type { Color } from "../../math/Color";
import { clamp } from "../../math/MathUtils";

/** Sets a color from a correlated color temperature in Kelvin, clamped to 1000–40000. */
export function setKelvin(color: Color, kelvin: number): Color {
  const temp = clamp(kelvin, 1000, 40000) / 100;
  const r = temp <= 66 ? 255 : 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  const g =
    temp <= 66 ? 99.4708025861 * Math.log(temp) - 161.1195681661 : 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  const b = temp >= 66 ? 255 : temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  return color.setRGB(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255, SRGBColorSpace);
}
