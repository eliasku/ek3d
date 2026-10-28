import type { NumericAnimationBuffer } from "../../math/Interpolant";
import { KeyframeTrack } from "../KeyframeTrack";
/**
 * A track for color keyframe values.
 *
 */
export class ColorKeyframeTrack extends KeyframeTrack {
  override get values(): NumericAnimationBuffer {
    return super.values as NumericAnimationBuffer;
  }
  override set values(value: NumericAnimationBuffer) {
    super.values = value;
  }

  /**
   * Constructs a new color keyframe track.
   *
   * @param name - The keyframe track's name.
   * @param times - A list of keyframe times.
   * @param values - A list of keyframe values.
   * @param [interpolation] - The interpolation type.
   */
  constructor(name: string, times: NumericAnimationBuffer, values: NumericAnimationBuffer, interpolation?: number) {
    super(name, times, values, interpolation);
  }
}
/**
 * The value type name.
 *
 * @default 'color'
 */
ColorKeyframeTrack.prototype.ValueTypeName = "color";
// ValueBufferType is inherited
// DefaultInterpolation is inherited
