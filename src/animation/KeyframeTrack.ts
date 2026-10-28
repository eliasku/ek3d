import type { AnimationBuffer } from "../math/Interpolant";
import type { AnimationBufferConstructor } from "../math/Interpolant";
import type { Interpolant } from "../math/Interpolant";
import type { InterpolantSettings } from "../math/Interpolant";
import type { NumericAnimationBuffer } from "../math/Interpolant";
import { Interpolation } from "../constants";
import { CubicInterpolant } from "../math/interpolants/CubicInterpolant";
import { LinearInterpolant } from "../math/interpolants/LinearInterpolant";
import { DiscreteInterpolant } from "../math/interpolants/DiscreteInterpolant";
import { BezierInterpolant } from "../math/interpolants/BezierInterpolant";
import { convertArray, hasTangents } from "./AnimationUtils";
import { isTypedArray } from "../utils";
import { warn, error } from "../utils";
/**
 * Represents a timed sequence of keyframes, which are composed of lists of
 * times and related values, and which are used to animate a specific property
 * of an object.
 */
export class KeyframeTrack {
  name: string;
  times: NumericAnimationBuffer;

  get values(): AnimationBuffer {
    // Normal access hits the own data property; subclass super access reaches this getter.
    return Object.getOwnPropertyDescriptor(this, "values")?.value;
  }
  set values(value: AnimationBuffer) {
    Object.defineProperty(this, "values", { value, writable: true, enumerable: true, configurable: true });
  }
  // setInterpolation() selects a factory during construction.
  createInterpolant!: ((result?: AnimationBuffer | null) => Interpolant<AnimationBuffer>) & {
    isInterpolantFactoryMethodGLTFCubicSpline?: boolean;
  };

  /** Optional tangent data, inherited until assigned for this track. */
  get settings(): InterpolantSettings | undefined {
    return undefined;
  }
  set settings(value: InterpolantSettings | undefined) {
    Object.defineProperty(this, "settings", { value, writable: true, enumerable: true, configurable: true });
  }

  /** The value type name. */
  get ValueTypeName(): string {
    return "";
  }
  set ValueTypeName(value: string) {
    Object.defineProperty(this, "ValueTypeName", { value, writable: true, enumerable: true, configurable: true });
  }

  /** The time buffer constructor, shared until overridden. */
  get TimeBufferType(): { new (values: never): NumericAnimationBuffer; BYTES_PER_ELEMENT?: number } {
    return Float32Array;
  }
  set TimeBufferType(value: { new (values: never): NumericAnimationBuffer; BYTES_PER_ELEMENT?: number }) {
    Object.defineProperty(this, "TimeBufferType", { value, writable: true, enumerable: true, configurable: true });
  }

  /** The value buffer constructor, shared until overridden. */
  get ValueBufferType(): AnimationBufferConstructor {
    return Float32Array;
  }
  set ValueBufferType(value: AnimationBufferConstructor) {
    Object.defineProperty(this, "ValueBufferType", { value, writable: true, enumerable: true, configurable: true });
  }

  /** The default interpolation type. */
  get DefaultInterpolation(): Interpolation {
    return Interpolation.Linear;
  }
  set DefaultInterpolation(value: Interpolation) {
    Object.defineProperty(this, "DefaultInterpolation", {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Constructs a new keyframe track.
   *
   * @param name - The keyframe track's name.
   * @param times - A list of keyframe times.
   * @param values - A list of keyframe values.
   * @param [interpolation] - The interpolation type.
   */
  constructor(name: string, times: NumericAnimationBuffer, values: AnimationBuffer, interpolation?: Interpolation) {
    if (name === undefined) throw new Error("THREE.KeyframeTrack: track name is undefined");
    if (times === undefined || times.length === 0)
      throw new Error("THREE.KeyframeTrack: no keyframes in track named " + name);
    /**
     * The track's name can refer to morph targets or bones or
     * possibly other values within an animated object. See {@link PropertyBinding#parseTrackName}
     * for the forms of strings that can be parsed for property binding.
     *
     */
    this.name = name;
    /**
     * The keyframe times.
     *
     */
    this.times = convertArray(times, this.TimeBufferType);
    /**
     * The keyframe values.
     *
     */
    this.values = convertArray(values, this.ValueBufferType);
    this.setInterpolation(interpolation || this.DefaultInterpolation);
  }
  /**
   * Converts the keyframe track to JSON.
   *
   * @static
   * @param track - The keyframe track to serialize.
   * @return The serialized keyframe track as JSON.
   */
  static toJSON(track: KeyframeTrack) {
    const trackType = track.constructor;
    let json: any;
    // derived classes can define a static toJSON method
    if ((trackType as any).toJSON !== this.toJSON) {
      json = (trackType as any).toJSON(track);
    } else {
      // by default, we assume the data can be serialized as-is
      json = {
        name: track.name,
        times: convertArray(track.times, Array),
        values: convertArray(track.values, Array),
      };
      const interpolation = track.getInterpolation();
      if (interpolation !== track.DefaultInterpolation) {
        (json as any).interpolation = interpolation;
      }
      if (hasTangents((track as any).settings)) {
        (json as any).settings = {
          inTangents: convertArray((track as any).settings.inTangents, Array),
          outTangents: convertArray((track as any).settings.outTangents, Array),
        };
      }
    }
    json.type = track.ValueTypeName; // mandatory
    return json;
  }
  /**
   * Factory method for creating a new discrete interpolant.
   *
   * @static
   * @param [result] - The result buffer.
   * @return The new interpolant.
   */
  InterpolantFactoryMethodDiscrete(result?: AnimationBuffer | null): DiscreteInterpolant<AnimationBuffer> {
    return new DiscreteInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  /**
   * Factory method for creating a new linear interpolant.
   *
   * @static
   * @param [result] - The result buffer.
   * @return The new interpolant.
   */
  InterpolantFactoryMethodLinear(result?: AnimationBuffer | null): LinearInterpolant {
    return new LinearInterpolant(
      this.times,
      this.values as NumericAnimationBuffer,
      this.getValueSize(),
      result as NumericAnimationBuffer | null | undefined,
    );
  }
  /**
   * Factory method for creating a new smooth interpolant.
   *
   * @static
   * @param [result] - The result buffer.
   * @return The new interpolant.
   */
  InterpolantFactoryMethodSmooth(result?: AnimationBuffer | null): CubicInterpolant {
    return new CubicInterpolant(
      this.times,
      this.values as NumericAnimationBuffer,
      this.getValueSize(),
      result as NumericAnimationBuffer | null | undefined,
    );
  }
  /**
   * Factory method for creating a new Bezier interpolant.
   *
   * The Bezier interpolant requires tangent data to be set via the `settings` property
   * on the track before creating the interpolant. The settings should contain:
   * - `inTangents`: Float32Array with [time, value] pairs per keyframe per component
   * - `outTangents`: Float32Array with [time, value] pairs per keyframe per component
   *
   * @static
   * @param [result] - The result buffer.
   * @return The new interpolant.
   */
  InterpolantFactoryMethodBezier(result?: AnimationBuffer | null): BezierInterpolant {
    const interpolant = new BezierInterpolant(
      this.times,
      this.values as NumericAnimationBuffer,
      this.getValueSize(),
      result as NumericAnimationBuffer | null | undefined,
    );
    if ((this as any).settings) {
      (interpolant as any).inTangents = (this as any).settings.inTangents;
      (interpolant as any).outTangents = (this as any).settings.outTangents;
    }
    return interpolant;
  }
  /**
   * Defines the interpolation factor method for this keyframe track.
   *
   * @param interpolation - The interpolation type.
   * @return A reference to this keyframe track.
   */
  setInterpolation(interpolation: Interpolation): this {
    let factoryMethod: any;
    /* oxlint-disable typescript/unbound-method -- Store the original factory as this.createInterpolant, preserving its receiver and identity. */
    switch (interpolation) {
      case Interpolation.Discrete:
        factoryMethod = this.InterpolantFactoryMethodDiscrete;
        break;
      case Interpolation.Linear:
        factoryMethod = this.InterpolantFactoryMethodLinear;
        break;
      case Interpolation.Smooth:
        factoryMethod = this.InterpolantFactoryMethodSmooth;
        break;
      case Interpolation.Bezier:
        factoryMethod = this.InterpolantFactoryMethodBezier;
        break;
    }
    /* oxlint-enable typescript/unbound-method */
    if (factoryMethod === undefined) {
      const message = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
      if (this.createInterpolant === undefined) {
        // fall back to default, unless the default itself is messed up
        if (interpolation !== this.DefaultInterpolation) {
          this.setInterpolation(this.DefaultInterpolation);
        } else {
          throw new Error(message); // fatal, in this case
        }
      }
      warn("KeyframeTrack:", message);
      return this;
    }
    this.createInterpolant = factoryMethod;
    return this;
  }
  /**
   * Returns the current interpolation type.
   *
   * @return The interpolation type.
   */
  getInterpolation() {
    /* oxlint-disable typescript/unbound-method -- Compare factory identities without invoking or binding them. */
    switch (this.createInterpolant) {
      case this.InterpolantFactoryMethodDiscrete:
        return Interpolation.Discrete;
      case this.InterpolantFactoryMethodLinear:
        return Interpolation.Linear;
      case this.InterpolantFactoryMethodSmooth:
        return Interpolation.Smooth;
      case this.InterpolantFactoryMethodBezier:
        return Interpolation.Bezier;
    }
    /* oxlint-enable typescript/unbound-method */
  }
  /**
   * Returns the value size.
   *
   * @return The value size.
   */
  getValueSize(): number {
    return this.values.length / this.times.length;
  }
  /**
   * Moves all keyframes either forward or backward in time.
   *
   * @param timeOffset - The offset to move the time values.
   * @return A reference to this keyframe track.
   */
  shift(timeOffset: number): this {
    if (timeOffset !== 0.0) {
      const times = this.times;
      for (let i = 0, n = times.length; i !== n; ++i) {
        (times as any)[i] += timeOffset;
      }
      if (hasTangents((this as any).settings)) {
        shiftTangentTimes((this as any).settings.inTangents, timeOffset);
        shiftTangentTimes((this as any).settings.outTangents, timeOffset);
      }
    }
    return this;
  }
  /**
   * Scale all keyframe times by a factor (useful for frame - seconds conversions).
   *
   * @param timeScale - The time scale.
   * @return A reference to this keyframe track.
   */
  scale(timeScale: number): this {
    if (timeScale !== 1.0) {
      const times = this.times;
      for (let i = 0, n = times.length; i !== n; ++i) {
        (times as any)[i] *= timeScale;
      }
      if (hasTangents((this as any).settings)) {
        scaleTangentTimes((this as any).settings.inTangents, timeScale);
        scaleTangentTimes((this as any).settings.outTangents, timeScale);
      }
    }
    return this;
  }
  /**
   * Removes keyframes before and after animation without changing any values within the defined time range.
   *
   * Note: The method does not shift around keys to the start of the track time, because for interpolated
   * keys this will change their values
   *
   * @param startTime - The start time.
   * @param endTime - The end time.
   * @return A reference to this keyframe track.
   */
  trim(startTime: number, endTime: number): this {
    const times = this.times,
      nKeys = times.length;
    let from = 0,
      to = nKeys - 1;
    while (from !== nKeys && (times as any)[from] < startTime) {
      ++from;
    }
    while (to !== -1 && (times as any)[to] > endTime) {
      --to;
    }
    ++to; // inclusive -> exclusive bound
    if (from !== 0 || to !== nKeys) {
      // empty tracks are forbidden, so keep at least one keyframe
      if (from >= to) {
        to = Math.max(to, 1);
        from = to - 1;
      }
      const stride = this.getValueSize();
      this.times = times.slice(from, to);
      this.values = this.values.slice(from * stride, to * stride);
    }
    return this;
  }
  /**
   * Performs minimal validation on the keyframe track. Returns `true` if the values
   * are valid.
   *
   * @return Whether the keyframes are valid or not.
   */
  validate(): boolean {
    let valid = true;
    const valueSize = this.getValueSize();
    if (valueSize - Math.floor(valueSize) !== 0) {
      error("KeyframeTrack: Invalid value size in track.", this);
      valid = false;
    }
    const times = this.times,
      values = this.values,
      nKeys = times.length;
    if (nKeys === 0) {
      error("KeyframeTrack: Track is empty.", this);
      valid = false;
    }
    let prevTime: any = null;
    for (let i = 0; i !== nKeys; i++) {
      const currTime = (times as any)[i];
      if (typeof currTime === "number" && isNaN(currTime)) {
        error("KeyframeTrack: Time is not a valid number.", this, i, currTime);
        valid = false;
        break;
      }
      if (prevTime !== null && prevTime > currTime) {
        error("KeyframeTrack: Out of order keys.", this, i, currTime, prevTime);
        valid = false;
        break;
      }
      prevTime = currTime;
    }
    if (values !== undefined) {
      if (isTypedArray(values)) {
        for (let i = 0, n = values.length; i !== n; ++i) {
          const value = (values as any)[i];
          if (isNaN(value)) {
            error("KeyframeTrack: Value is not a valid number.", this, i, value);
            valid = false;
            break;
          }
        }
      }
    }
    return valid;
  }
  /**
   * Optimizes this keyframe track by removing equivalent sequential keys (which are
   * common in morph target sequences).
   *
   * @return A reference to this keyframe track.
   */
  optimize(): this {
    // (0,0,0,0,1,1,1,0,0,0,0,0,0,0) --> (0,0,1,1,0,0)
    // times or values may be shared with other tracks, so overwriting is unsafe
    const times = this.times.slice(),
      values = this.values.slice(),
      stride = this.getValueSize(),
      smoothInterpolation = this.getInterpolation() === Interpolation.Smooth,
      lastIndex = times.length - 1;
    let writeIndex = 1;
    for (let i = 1; i < lastIndex; ++i) {
      let keep = false;
      const time = (times as any)[i];
      const timeNext = (times as any)[i + 1];
      // remove adjacent keyframes scheduled at the same time
      if (time !== timeNext && (i !== 1 || time !== (times as any)[0])) {
        if (!smoothInterpolation) {
          // remove unnecessary keyframes same as their neighbors
          const offset = i * stride,
            offsetP = offset - stride,
            offsetN = offset + stride;
          for (let j = 0; j !== stride; ++j) {
            const value = (values as any)[offset + j];
            if (value !== (values as any)[offsetP + j] || value !== (values as any)[offsetN + j]) {
              keep = true;
              break;
            }
          }
        } else {
          keep = true;
        }
      }
      // in-place compaction
      if (keep) {
        if (i !== writeIndex) {
          (times as any)[writeIndex] = (times as any)[i];
          const readOffset = i * stride,
            writeOffset = writeIndex * stride;
          for (let j = 0; j !== stride; ++j) {
            (values as any)[writeOffset + j] = (values as any)[readOffset + j];
          }
        }
        ++writeIndex;
      }
    }
    // flush last keyframe (compaction looks ahead)
    if (lastIndex > 0) {
      (times as any)[writeIndex] = (times as any)[lastIndex];
      for (let readOffset = lastIndex * stride, writeOffset = writeIndex * stride, j = 0; j !== stride; ++j) {
        (values as any)[writeOffset + j] = (values as any)[readOffset + j];
      }
      ++writeIndex;
    }
    if (writeIndex !== times.length) {
      this.times = times.slice(0, writeIndex);
      this.values = values.slice(0, writeIndex * stride);
    } else {
      this.times = times;
      this.values = values;
    }
    return this;
  }
  /**
   * Returns a new keyframe track with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): this {
    const times = this.times.slice();
    const values = this.values.slice();
    const TypedKeyframeTrack = this.constructor as new (
      name: string,
      times: NumericAnimationBuffer,
      values: AnimationBuffer,
    ) => this;
    const track = new TypedKeyframeTrack(this.name, times, values);
    // Interpolant argument to constructor is not saved, so copy the factory method directly.
    track.createInterpolant = this.createInterpolant;
    if (hasTangents((this as any).settings)) {
      track.settings = {
        inTangents: (this as any).settings.inTangents.slice(),
        outTangents: (this as any).settings.outTangents.slice(),
      };
    }
    return track;
  }
}
function shiftTangentTimes(tangents?: any, timeOffset?: any) {
  // tangents are [ time, value ] pairs, so only every second entry is a time
  for (let i = 0, n = tangents.length; i !== n; i += 2) {
    tangents[i] += timeOffset;
  }
}
function scaleTangentTimes(tangents?: any, timeScale?: any) {
  // tangents are [ time, value ] pairs, so only every second entry is a time
  for (let i = 0, n = tangents.length; i !== n; i += 2) {
    tangents[i] *= timeScale;
  }
}
