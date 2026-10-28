import { Interpolation } from "../../constants";
import type { AnimationBuffer } from "../../math/Interpolant";
import type { NumericAnimationBuffer } from "../../math/Interpolant";
import { KeyframeTrack } from "../KeyframeTrack";
import { QuaternionLinearInterpolant } from "../../math/interpolants/QuaternionLinearInterpolant";
/**
 * A track for Quaternion keyframe values.
 *
 */
export class QuaternionKeyframeTrack extends KeyframeTrack {
  override get values(): NumericAnimationBuffer {
    return super.values as NumericAnimationBuffer;
  }
  override set values(value: NumericAnimationBuffer) {
    super.values = value;
  }

  /**
   * Constructs a new Quaternion keyframe track.
   *
   * @param name - The keyframe track's name.
   * @param times - A list of keyframe times.
   * @param values - A list of keyframe values.
   * @param [interpolation] - The interpolation type.
   */
  constructor(
    name: string,
    times: NumericAnimationBuffer,
    values: NumericAnimationBuffer,
    interpolation?: Interpolation,
  ) {
    super(name, times, values, interpolation);
  }
  /**
   * Overwritten so the method returns Quaternion based interpolant.
   *
   * @static
   * @param [result] - The result buffer.
   * @return The new interpolant.
   */
  InterpolantFactoryMethodLinear(result?: AnimationBuffer | null): QuaternionLinearInterpolant {
    return new QuaternionLinearInterpolant(
      this.times,
      this.values as NumericAnimationBuffer,
      this.getValueSize(),
      result as NumericAnimationBuffer | null | undefined,
    );
  }
}
/**
 * The value type name.
 *
 * @default 'quaternion'
 */
QuaternionKeyframeTrack.prototype.ValueTypeName = "quaternion";
// ValueBufferType is inherited
// DefaultInterpolation is inherited;
QuaternionKeyframeTrack.prototype.InterpolantFactoryMethodSmooth =
  undefined as unknown as typeof QuaternionKeyframeTrack.prototype.InterpolantFactoryMethodSmooth;
