import { Interpolation } from "../../constants";
import type { NumericAnimationBuffer } from "../../math/Interpolant";
import { KeyframeTrack } from "../KeyframeTrack";
/**
 * A track for vector keyframe values.
 *
 */
export class VectorKeyframeTrack extends KeyframeTrack {
  override get values(): NumericAnimationBuffer {
    return super.values as NumericAnimationBuffer;
  }
  override set values(value: NumericAnimationBuffer) {
    super.values = value;
  }

  /**
   * Constructs a new vector keyframe track.
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
}
/**
 * The value type name.
 *
 * @default 'vector'
 */
VectorKeyframeTrack.prototype.ValueTypeName = "vector";
// ValueBufferType is inherited
// DefaultInterpolation is inherited
