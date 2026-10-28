import type { NumericAnimationBuffer } from "../Interpolant";
import { Interpolant } from "../Interpolant";
/**
 * A basic linear interpolant.
 *
 */
export class LinearInterpolant extends Interpolant {
  /**
   * Constructs a new linear interpolant.
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
      offset1 = i1 * stride,
      offset0 = offset1 - stride,
      weight1 = (t - t0) / (t1 - t0),
      weight0 = 1 - weight1;
    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
    }
    return result;
  }
}
