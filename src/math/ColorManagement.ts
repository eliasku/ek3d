import { SRGBColorSpace, LinearSRGBColorSpace, SRGBTransfer, LinearTransfer, NoColorSpace } from "../constants";
import { Matrix3 } from "./Matrix3";
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
  const ColorManagement: any = {
    enabled: true,
    workingColorSpace: LinearSRGBColorSpace,
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
    spaces: {},
    convert: function (this: any, color?: any, sourceColorSpace?: any, targetColorSpace?: any) {
      if (this.enabled === false || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace) {
        return color;
      }
      if ((this.spaces as any)[sourceColorSpace].transfer === SRGBTransfer) {
        color.r = SRGBToLinear(color.r);
        color.g = SRGBToLinear(color.g);
        color.b = SRGBToLinear(color.b);
      }
      if ((this.spaces as any)[sourceColorSpace].primaries !== (this.spaces as any)[targetColorSpace].primaries) {
        color.applyMatrix3((this.spaces as any)[sourceColorSpace].toXYZ);
        color.applyMatrix3((this.spaces as any)[targetColorSpace].fromXYZ);
      }
      if ((this.spaces as any)[targetColorSpace].transfer === SRGBTransfer) {
        color.r = LinearToSRGB(color.r);
        color.g = LinearToSRGB(color.g);
        color.b = LinearToSRGB(color.b);
      }
      return color;
    },
    workingToColorSpace: function (this: any, color?: any, targetColorSpace?: any) {
      return this.convert(color, this.workingColorSpace, targetColorSpace);
    },
    colorSpaceToWorking: function (this: any, color?: any, sourceColorSpace?: any) {
      return this.convert(color, sourceColorSpace, this.workingColorSpace);
    },
    getPrimaries: function (this: any, colorSpace?: any) {
      return (this.spaces as any)[colorSpace].primaries;
    },
    getTransfer: function (this: any, colorSpace?: any) {
      if (colorSpace === NoColorSpace) return LinearTransfer;
      return (this.spaces as any)[colorSpace].transfer;
    },
    getToneMappingMode: function (this: any, colorSpace?: any) {
      return (this.spaces as any)[colorSpace].outputColorSpaceConfig.toneMappingMode || "standard";
    },
    getLuminanceCoefficients: function (this: any, target?: any, colorSpace: any = this.workingColorSpace) {
      return target.fromArray((this.spaces as any)[colorSpace].luminanceCoefficients);
    },
    define: function (this: any, colorSpaces?: any) {
      Object.assign(this.spaces, colorSpaces);
    },
    // Internal APIs
    _getMatrix: function (this: any, targetMatrix?: any, sourceColorSpace?: any, targetColorSpace?: any) {
      return targetMatrix
        .copy((this.spaces as any)[targetColorSpace].fromXYZ)
        .multiply((this.spaces as any)[sourceColorSpace].toXYZ);
    },
    _getDrawingBufferColorSpace: function (this: any, colorSpace?: any) {
      return (this.spaces as any)[colorSpace].outputColorSpaceConfig.drawingBufferColorSpace;
    },
    _getUnpackColorSpace: function (this: any, colorSpace: any = this.workingColorSpace) {
      return (this.spaces as any)[colorSpace].workingColorSpaceConfig.unpackColorSpace;
    },
  };
  /******************************************************************************
   * sRGB definitions
   */
  const REC709_PRIMARIES = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06];
  const REC709_LUMINANCE_COEFFICIENTS = [0.2126, 0.7152, 0.0722];
  const D65 = [0.3127, 0.329];
  ColorManagement.define({
    [LinearSRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: LinearTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      workingColorSpaceConfig: { unpackColorSpace: SRGBColorSpace },
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace },
    },
    [SRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: SRGBTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace },
    },
  });
  return ColorManagement;
}
export const ColorManagement = /*@__PURE__*/ createColorManagement();
export function SRGBToLinear(c?: any) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
export function LinearToSRGB(c?: any) {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
