import type { AnimationBuffer } from "../Interpolant";
import type { NumericAnimationBuffer } from "../Interpolant";
import { Interpolant } from "../Interpolant";
/**
 * Interpolant that evaluates to the sample value at the position preceding
 * the parameter.
 *
 */
export class DiscreteInterpolant<B extends AnimationBuffer = NumericAnimationBuffer> extends Interpolant<B> {
  /**
   * Constructs a new discrete interpolant.
   *
   * @param parameterPositions - The parameter positions hold the interpolation factors.
   * @param sampleValues - The sample values.
   * @param sampleSize - The sample size
   * @param [resultBuffer] - The result buffer.
   */
  constructor(
    parameterPositions: NumericAnimationBuffer,
    sampleValues: B,
    sampleSize: number,
    resultBuffer?: B | null,
  ) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1: number /*, t0, t, t1 */): B {
    return this.copySampleValue_(i1 - 1);
  }
}
