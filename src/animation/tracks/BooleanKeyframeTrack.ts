import type { NumericAnimationBuffer } from "../../math/Interpolant";
import { InterpolateDiscrete } from "../../constants";
import { KeyframeTrack } from "../KeyframeTrack";
/**
 * A track for boolean keyframe values.
 *
 */
export class BooleanKeyframeTrack extends KeyframeTrack {
  override get values(): boolean[] {
    return super.values as boolean[];
  }
  override set values(value: boolean[]) {
    super.values = value;
  }

  /**
   * Constructs a new boolean keyframe track.
   *
   * This keyframe track type has no `interpolation` parameter because the
   * interpolation is always discrete.
   *
   * @param name - The keyframe track's name.
   * @param times - A list of keyframe times.
   * @param values - A list of keyframe values.
   */
  constructor(name: string, times: NumericAnimationBuffer, values: boolean[]) {
    super(name, times, values);
  }
}
/**
 * The value type name.
 *
 * @default 'bool'
 */
BooleanKeyframeTrack.prototype.ValueTypeName = "bool";
/**
 * The value buffer type of this keyframe track.
 *
 * @default Array.constructor
 */
BooleanKeyframeTrack.prototype.ValueBufferType = Array;
/**
 * The default interpolation type of this keyframe track.
 *
 * @default InterpolateDiscrete
 */
BooleanKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear =
  undefined as unknown as typeof BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth =
  undefined as unknown as typeof BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth;
