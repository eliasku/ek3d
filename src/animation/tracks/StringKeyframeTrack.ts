import type { NumericAnimationBuffer } from "../../math/Interpolant";
import { Interpolation } from "../../constants";
import { KeyframeTrack } from "../KeyframeTrack";
/**
 * A track for string keyframe values.
 *
 */
export class StringKeyframeTrack extends KeyframeTrack {
  override get values(): string[] {
    return super.values as string[];
  }
  override set values(value: string[]) {
    super.values = value;
  }

  /**
   * Constructs a new string keyframe track.
   *
   * This keyframe track type has no `interpolation` parameter because the
   * interpolation is always discrete.
   *
   * @param name - The keyframe track's name.
   * @param times - A list of keyframe times.
   * @param values - A list of keyframe values.
   */
  constructor(name: string, times: NumericAnimationBuffer, values: string[]) {
    super(name, times, values);
  }
}
/**
 * The value type name.
 *
 * @default 'string'
 */
StringKeyframeTrack.prototype.ValueTypeName = "string";
/**
 * The value buffer type of this keyframe track.
 *
 * @default Array.constructor
 */
StringKeyframeTrack.prototype.ValueBufferType = Array;
/**
 * The default interpolation type of this keyframe track.
 *
 * @default Interpolation.Discrete
 */
StringKeyframeTrack.prototype.DefaultInterpolation = Interpolation.Discrete;
StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear =
  undefined as unknown as typeof StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear;
StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth =
  undefined as unknown as typeof StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth;
