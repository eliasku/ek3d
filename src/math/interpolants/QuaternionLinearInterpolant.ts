import type { NumericAnimationBuffer } from "../Interpolant";
import { Interpolant } from "../Interpolant";
import { Quaternion } from "../Quaternion";
/**
 * Spherical linear unit quaternion interpolant.
 *
 */
export class QuaternionLinearInterpolant extends Interpolant {
  /**
   * Constructs a new SLERP interpolant.
   *
   * @param parameterPositions - The parameter positions hold the interpolation factors.
   * @param sampleValues - The sample values.
   * @param sampleSize - The sample size
   * @param [resultBuffer] - The result buffer.
   */
  constructor(
    parameterPositions: NumericAnimationBuffer,
    sampleValues: NumericAnimationBuffer,
    sampleSize: number,
    resultBuffer?: NumericAnimationBuffer | null,
  ) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1: number, t0: number, t: number, t1: number): NumericAnimationBuffer {
    const result = this.resultBuffer,
      values = this.sampleValues,
      stride = this.valueSize,
      alpha = (t - t0) / (t1 - t0);
    let offset = i1 * stride;
    for (let end = offset + stride; offset !== end; offset += 4) {
      Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    }
    return result;
  }
}
