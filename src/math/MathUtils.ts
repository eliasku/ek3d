import type { Quaternion } from "./Quaternion";
import { warn } from "../utils";
const _lut = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "0a",
  "0b",
  "0c",
  "0d",
  "0e",
  "0f",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "1a",
  "1b",
  "1c",
  "1d",
  "1e",
  "1f",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "3a",
  "3b",
  "3c",
  "3d",
  "3e",
  "3f",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "4a",
  "4b",
  "4c",
  "4d",
  "4e",
  "4f",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "5a",
  "5b",
  "5c",
  "5d",
  "5e",
  "5f",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "6a",
  "6b",
  "6c",
  "6d",
  "6e",
  "6f",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
  "7a",
  "7b",
  "7c",
  "7d",
  "7e",
  "7f",
  "80",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "8a",
  "8b",
  "8c",
  "8d",
  "8e",
  "8f",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
  "9a",
  "9b",
  "9c",
  "9d",
  "9e",
  "9f",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "a8",
  "a9",
  "aa",
  "ab",
  "ac",
  "ad",
  "ae",
  "af",
  "b0",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "ba",
  "bb",
  "bc",
  "bd",
  "be",
  "bf",
  "c0",
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "ca",
  "cb",
  "cc",
  "cd",
  "ce",
  "cf",
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "da",
  "db",
  "dc",
  "dd",
  "de",
  "df",
  "e0",
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
  "e9",
  "ea",
  "eb",
  "ec",
  "ed",
  "ee",
  "ef",
  "f0",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "fa",
  "fb",
  "fc",
  "fd",
  "fe",
  "ff",
];
let _seed = 1234567;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
/**
 * Generate a [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier)
 * (universally unique identifier).
 *
 * @return The UUID.
 */
export function generateUUID(): string {
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
  const d0 = (Math.random() * 0xffffffff) | 0;
  const d1 = (Math.random() * 0xffffffff) | 0;
  const d2 = (Math.random() * 0xffffffff) | 0;
  const d3 = (Math.random() * 0xffffffff) | 0;
  const uuid =
    _lut[d0 & 0xff] +
    _lut[(d0 >> 8) & 0xff] +
    _lut[(d0 >> 16) & 0xff] +
    _lut[(d0 >> 24) & 0xff] +
    "-" +
    _lut[d1 & 0xff] +
    _lut[(d1 >> 8) & 0xff] +
    "-" +
    _lut[((d1 >> 16) & 0x0f) | 0x40] +
    _lut[(d1 >> 24) & 0xff] +
    "-" +
    _lut[(d2 & 0x3f) | 0x80] +
    _lut[(d2 >> 8) & 0xff] +
    "-" +
    _lut[(d2 >> 16) & 0xff] +
    _lut[(d2 >> 24) & 0xff] +
    _lut[d3 & 0xff] +
    _lut[(d3 >> 8) & 0xff] +
    _lut[(d3 >> 16) & 0xff] +
    _lut[(d3 >> 24) & 0xff];
  // .toLowerCase() here flattens concatenated strings to save heap memory space.
  return uuid.toLowerCase();
}
/**
 * Clamps the given value between min and max.
 *
 * @param value - The value to clamp.
 * @param min - The min value.
 * @param max - The max value.
 * @return The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
/**
 * Computes the Euclidean modulo of the given parameters that
 * is `( ( n % m ) + m ) % m`.
 *
 * @param n - The first parameter.
 * @param m - The second parameter.
 * @return The Euclidean modulo.
 */
export function euclideanModulo(n: number, m: number): number {
  // https://en.wikipedia.org/wiki/Modulo_operation
  return ((n % m) + m) % m;
}
/**
 * Performs a linear mapping from range `<a1, a2>` to range `<b1, b2>`
 * for the given value. `a2` must be greater than `a1`.
 *
 * @param x - The value to be mapped.
 * @param a1 - Minimum value for range A.
 * @param a2 - Maximum value for range A.
 * @param b1 - Minimum value for range B.
 * @param b2 - Maximum value for range B.
 * @return The mapped value.
 */
export function mapLinear(x: number, a1: number, a2: number, b1: number, b2: number): number {
  return b1 + ((x - a1) * (b2 - b1)) / (a2 - a1);
}
/**
 * Returns the percentage in the closed interval `[0, 1]` of the given value
 * between the start and end point.
 *
 * @param x - The start point
 * @param y - The end point.
 * @param value - A value between start and end.
 * @return The interpolation factor.
 */
export function inverseLerp(x: number, y: number, value: number): number {
  // https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/inverse-lerp-a-super-useful-yet-often-overlooked-function-r5230/
  if (x !== y) {
    return (value - x) / (y - x);
  } else {
    return 0;
  }
}
/**
 * Returns a value linearly interpolated from two known points based on the given interval -
 * `t = 0` will return `x` and `t = 1` will return `y`.
 *
 * @param x - The start point
 * @param y - The end point.
 * @param t - The interpolation factor in the closed interval `[0, 1]`.
 * @return The interpolated value.
 */
export function lerp(x: number, y: number, t: number): number {
  return (1 - t) * x + t * y;
}
/**
 * Smoothly interpolate a number from `x` to `y` in  a spring-like manner using a delta
 * time to maintain frame rate independent movement. For details, see
 * [Frame rate independent damping using lerp](http://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/).
 *
 * @param x - The current point.
 * @param y - The target point.
 * @param lambda - A higher lambda value will make the movement more sudden,
 * and a lower value will make the movement more gradual.
 * @param dt - Delta time in seconds.
 * @return The interpolated value.
 */
export function damp(x: number, y: number, lambda: number, dt: number): number {
  return lerp(x, y, 1 - Math.exp(-lambda * dt));
}
/**
 * Returns a value that alternates between `0` and the given `length` parameter.
 *
 * @param x - The value to pingpong.
 * @param [length=1] - The positive value the function will pingpong to.
 * @return The alternated value.
 */
export function pingpong(x: number, length: number = 1): number {
  // https://www.desmos.com/calculator/vcsjnyz7x4
  return length - Math.abs(euclideanModulo(x, length * 2) - length);
}
/**
 * Returns a value in the range `[0,1]` that represents the percentage that `x` has
 * moved between `min` and `max`, but smoothed or slowed down the closer `x` is to
 * the `min` and `max`.
 *
 * See [Smoothstep](http://en.wikipedia.org/wiki/Smoothstep) for more details.
 *
 * @param x - The value to evaluate based on its position between `min` and `max`.
 * @param min - The min value. Any `x` value below `min` will be `0`. `min` must be lower than `max`.
 * @param max - The max value. Any `x` value above `max` will be `1`. `max` must be greater than `min`.
 * @return The alternated value.
 */
export function smoothstep(x: number, min: number, max: number): number {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * (3 - 2 * x);
}
/**
 * A [variation on smoothstep](https://en.wikipedia.org/wiki/Smoothstep#Variations)
 * that has zero 1st and 2nd order derivatives at `x=0` and `x=1`.
 *
 * @param x - The value to evaluate based on its position between `min` and `max`.
 * @param min - The min value. Any `x` value below `min` will be `0`. `min` must be lower than `max`.
 * @param max - The max value. Any `x` value above `max` will be `1`. `max` must be greater than `min`.
 * @return The alternated value.
 */
export function smootherstep(x: number, min: number, max: number): number {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
/**
 * Returns a random integer from `<low, high>` interval.
 *
 * @param low - The lower value boundary.
 * @param high - The upper value boundary
 * @return A random integer.
 */
export function randInt(low: number, high: number): number {
  return low + Math.floor(Math.random() * (high - low + 1));
}
/**
 * Returns a random float from `<low, high>` interval.
 *
 * @param low - The lower value boundary.
 * @param high - The upper value boundary
 * @return A random float.
 */
export function randFloat(low: number, high: number): number {
  return low + Math.random() * (high - low);
}
/**
 * Returns a random integer from `<-range/2, range/2>` interval.
 *
 * @param range - Defines the value range.
 * @return A random float.
 */
export function randFloatSpread(range: number): number {
  return range * (0.5 - Math.random());
}
/**
 * Returns a deterministic pseudo-random float in the interval `[0, 1]`.
 *
 * @param [s] - The integer seed.
 * @return A random float.
 */
export function seededRandom(s?: number): number {
  if (s !== undefined) _seed = s;
  // Mulberry32 generator
  let t = (_seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/**
 * Converts degrees to radians.
 *
 * @param degrees - A value in degrees.
 * @return The converted value in radians.
 */
export function degToRad(degrees: number): number {
  return degrees * DEG2RAD;
}
/**
 * Converts radians to degrees.
 *
 * @param radians - A value in radians.
 * @return The converted value in degrees.
 */
export function radToDeg(radians: number): number {
  return radians * RAD2DEG;
}
/**
 * Returns `true` if the given integer is a power of two.
 *
 * @param value - The value to check.
 * @return Whether the given integer is a power of two or not.
 */
export function isPowerOfTwo(value: number): boolean {
  return value > 0 && Number.isInteger(value) && 2 ** Math.round(Math.log2(value)) === value;
}
/**
 * Returns the smallest power of two that is greater than or equal to the given number.
 *
 * @param value - The value to find a POT for. Must be greater than `0`.
 * @return The smallest power of two that is greater than or equal to the given number.
 */
export function ceilPowerOfTwo(value: number): number {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}
/**
 * Returns the largest power of two that is less than or equal to the given number.
 *
 * @param value - The value to find a POT for. Must be greater than `0`.
 * @return The largest power of two that is less than or equal to the given number.
 */
export function floorPowerOfTwo(value: number): number {
  return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}
/**
 * Sets the given quaternion from the [Intrinsic Proper Euler Angles](https://en.wikipedia.org/wiki/Euler_angles)
 * defined by the given angles and order.
 *
 * Rotations are applied to the axes in the order specified by order:
 * rotation by angle `a` is applied first, then by angle `b`, then by angle `c`.
 *
 * @param q - The quaternion to set.
 * @param a - The rotation applied to the first axis, in radians.
 * @param b - The rotation applied to the second axis, in radians.
 * @param c - The rotation applied to the third axis, in radians.
 * @param order - A string specifying the axes order.
 */
export function setQuaternionFromProperEuler(q: Quaternion, a: number, b: number, c: number, order?: any) {
  const cos = Math.cos;
  const sin = Math.sin;
  const c2 = cos(b / 2);
  const s2 = sin(b / 2);
  const c13 = cos((a + c) / 2);
  const s13 = sin((a + c) / 2);
  const c1_3 = cos((a - c) / 2);
  const s1_3 = sin((a - c) / 2);
  const c3_1 = cos((c - a) / 2);
  const s3_1 = sin((c - a) / 2);
  switch (order) {
    case "XYX":
      q.set(c2 * s13, s2 * c1_3, s2 * s1_3, c2 * c13);
      break;
    case "YZY":
      q.set(s2 * s1_3, c2 * s13, s2 * c1_3, c2 * c13);
      break;
    case "ZXZ":
      q.set(s2 * c1_3, s2 * s1_3, c2 * s13, c2 * c13);
      break;
    case "XZX":
      q.set(c2 * s13, s2 * s3_1, s2 * c3_1, c2 * c13);
      break;
    case "YXY":
      q.set(s2 * c3_1, c2 * s13, s2 * s3_1, c2 * c13);
      break;
    case "ZYZ":
      q.set(s2 * s3_1, s2 * c3_1, c2 * s13, c2 * c13);
      break;
    default:
      warn("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " + order);
  }
}
/**
 * Returns the factor used by {@link normalize} and {@link denormalize} for the given typed array,
 * or `undefined` if the values are not scaled (float arrays) or the array type is not supported.
 *
 * @param array - The typed array that defines the data type of the value.
 * @return The normalization factor.
 */
export function getNormalizationScale(
  array:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array,
): number | undefined {
  switch (array.constructor) {
    case Uint32Array:
      return 4294967295.0;
    case Uint16Array:
      return 65535.0;
    case Uint8Array:
    case Uint8ClampedArray:
      return 255.0;
    case Int32Array:
      return 2147483647.0;
    case Int16Array:
      return 32767.0;
    case Int8Array:
      return 127.0;
    default:
      return undefined;
  }
}
/**
 * Denormalizes the given value according to the given typed array.
 *
 * @param value - The value to denormalize.
 * @param array - The typed array that defines the data type of the value.
 * @return The denormalized (float) value in the range `[0,1]` or `[-1,1]`
 */
export function denormalize(
  value: number,
  array:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array,
): number {
  if (array.constructor === Float32Array) return value;
  const scale = getNormalizationScale(array);
  if (scale === undefined) throw new Error("THREE.MathUtils: Invalid component type.");
  return Math.max(value / scale, -1.0);
}
/**
 * Normalizes the given value according to the given typed array.
 *
 * @param value - The float value in the range `[0,1]` or `[-1,1]` to normalize.
 * @param array - The typed array that defines the data type of the value.
 * @return The normalized value.
 */
export function normalize(
  value: number,
  array:
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array,
): number {
  if (array.constructor === Float32Array) return value;
  const scale = getNormalizationScale(array);
  if (scale === undefined) throw new Error("THREE.MathUtils: Invalid component type.");
  return Math.round(value * scale);
}
/**
 * @class
 * @classdesc A collection of math utility functions.
 * @hideconstructor
 */
