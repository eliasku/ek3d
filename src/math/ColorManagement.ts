import { ColorSpace, Transfer } from "../constants";
import type { Color } from "./Color";
import type { Vector3 } from "./Vector3";
import { Matrix3 } from "./Matrix3";
export interface ColorSpaceDefinition {
  primaries: number[];
  whitePoint: number[];
  transfer: Transfer;
  toXYZ: Matrix3;
  fromXYZ: Matrix3;
  luminanceCoefficients: number[];
  outputColorSpaceConfig?: {
    drawingBufferColorSpace: PredefinedColorSpace;
    toneMappingMode?: "standard" | "extended";
  };
  workingColorSpaceConfig?: { unpackColorSpace: PredefinedColorSpace };
}

export interface ColorManagementState {
  enabled: boolean;
  workingColorSpace: string;
  spaces: Record<string, ColorSpaceDefinition>;
  convert<T extends Color>(
    this: ColorManagementState,
    color: T,
    sourceColorSpace?: string,
    targetColorSpace?: string,
  ): T;
}

const LINEAR_REC709_TO_XYZ = /*@__PURE__*/ new Matrix3().set(
  0.4123908,
  0.3575843,
  0.1804808,
  0.212639,
  0.7151687,
  0.0721923,
  0.0193308,
  0.1191948,
  0.9505322,
);
const XYZ_TO_LINEAR_REC709 = /*@__PURE__*/ new Matrix3().set(
  3.2409699,
  -1.5373832,
  -0.4986108,
  -0.9692436,
  1.8759675,
  0.0415551,
  0.0556301,
  -0.203977,
  1.0569715,
);
function createColorManagement() {
  const ColorManagement = {
    enabled: true,
    workingColorSpace: ColorSpace.LinearSRGB as string,
    /**
     * Implementations of supported color spaces.
     *
     * Required:
     *	- primaries: chromaticity coordinates [ rx ry gx gy bx by ]
     *	- whitePoint: reference white [ x y ]
     *	- transfer: transfer function (pre-defined)
     *	- toXYZ: Matrix3 RGB to XYZ transform
     *	- fromXYZ: Matrix3 XYZ to RGB transform
     *	- luminanceCoefficients: RGB luminance coefficients
     *
     * Optional:
     *  - outputColorSpaceConfig: { drawingBufferColorSpace: ColorSpace, toneMappingMode: 'extended' | 'standard' }
     *  - workingColorSpaceConfig: { unpackColorSpace: ColorSpace }
     *
     * Reference:
     * - https://www.russellcottrell.com/photo/matrixCalculator.htm
     */
    spaces: {} as Record<string, ColorSpaceDefinition>,
    convert: function <T extends Color>(
      this: ColorManagementState,
      color: T,
      sourceColorSpace?: string,
      targetColorSpace?: string,
    ): T {
      if (this.enabled === false || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace) {
        return color;
      }
      if (this.spaces[sourceColorSpace].transfer === Transfer.SRGB) {
        color.r = SRGBToLinear(color.r);
        color.g = SRGBToLinear(color.g);
        color.b = SRGBToLinear(color.b);
      }
      if (this.spaces[sourceColorSpace].primaries !== this.spaces[targetColorSpace].primaries) {
        color.applyMatrix3(this.spaces[sourceColorSpace].toXYZ);
        color.applyMatrix3(this.spaces[targetColorSpace].fromXYZ);
      }
      if (this.spaces[targetColorSpace].transfer === Transfer.SRGB) {
        color.r = LinearToSRGB(color.r);
        color.g = LinearToSRGB(color.g);
        color.b = LinearToSRGB(color.b);
      }
      return color;
    },
    workingToColorSpace: function <T extends Color>(
      this: ColorManagementState,
      color: T,
      targetColorSpace?: string,
    ): T {
      return this.convert(color, this.workingColorSpace, targetColorSpace);
    },
    colorSpaceToWorking: function <T extends Color>(
      this: ColorManagementState,
      color: T,
      sourceColorSpace?: string,
    ): T {
      return this.convert(color, sourceColorSpace, this.workingColorSpace);
    },
    getPrimaries: function (this: ColorManagementState, colorSpace?: string): number[] {
      return this.spaces[colorSpace!].primaries;
    },
    getTransfer: function (this: ColorManagementState, colorSpace?: string): Transfer {
      if (colorSpace === ColorSpace.No) return Transfer.Linear;
      return this.spaces[colorSpace!].transfer;
    },
    getToneMappingMode: function (this: ColorManagementState, colorSpace?: string): "standard" | "extended" {
      return this.spaces[colorSpace!].outputColorSpaceConfig!.toneMappingMode || "standard";
    },
    getLuminanceCoefficients: function (
      this: ColorManagementState,
      target: Vector3,
      colorSpace: string = this.workingColorSpace,
    ): Vector3 {
      return target.fromArray(this.spaces[colorSpace].luminanceCoefficients);
    },
    define: function <T extends Record<string, ColorSpaceDefinition>>(
      this: ColorManagementState,
      colorSpaces?: T,
    ): void {
      Object.assign(this.spaces, colorSpaces);
    },
    // Internal APIs
    _getMatrix: function (
      this: ColorManagementState,
      targetMatrix: Matrix3,
      sourceColorSpace: string,
      targetColorSpace: string,
    ): Matrix3 {
      return targetMatrix.copy(this.spaces[targetColorSpace].fromXYZ).multiply(this.spaces[sourceColorSpace].toXYZ);
    },
    _getDrawingBufferColorSpace: function (this: ColorManagementState, colorSpace?: string): PredefinedColorSpace {
      return this.spaces[colorSpace!].outputColorSpaceConfig!.drawingBufferColorSpace;
    },
    _getUnpackColorSpace: function (
      this: ColorManagementState,
      colorSpace: string = this.workingColorSpace,
    ): PredefinedColorSpace {
      return this.spaces[colorSpace].workingColorSpaceConfig!.unpackColorSpace;
    },
  };
  /******************************************************************************
   * sRGB definitions
   */
  const REC709_PRIMARIES = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06];
  const REC709_LUMINANCE_COEFFICIENTS = [0.2126, 0.7152, 0.0722];
  const D65 = [0.3127, 0.329];
  ColorManagement.define({
    [ColorSpace.LinearSRGB]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: Transfer.Linear,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      workingColorSpaceConfig: { unpackColorSpace: ColorSpace.SRGB },
      outputColorSpaceConfig: { drawingBufferColorSpace: ColorSpace.SRGB },
    },
    [ColorSpace.SRGB]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: Transfer.SRGB,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      outputColorSpaceConfig: { drawingBufferColorSpace: ColorSpace.SRGB },
    },
  });
  return ColorManagement;
}
export const ColorManagement = /*@__PURE__*/ createColorManagement();
export function SRGBToLinear(c?: number): number {
  return c! < 0.04045 ? c! * 0.0773993808 : Math.pow(c! * 0.9478672986 + 0.0521327014, 2.4);
}
export function LinearToSRGB(c?: number): number {
  return c! < 0.0031308 ? c! * 12.92 : 1.055 * Math.pow(c!, 0.41666) - 0.055;
}
