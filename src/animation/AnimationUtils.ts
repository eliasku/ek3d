import type { AnimationBuffer } from "../math/Interpolant";
import type { AnimationBufferConstructor } from "../math/Interpolant";
import type { AnimationClip } from "./AnimationClip";
import type { NumericAnimationBuffer } from "../math/Interpolant";
import { Quaternion } from "../math/Quaternion";
import { AnimationBlendMode } from "../constants";
/**
 * Converts an array to a specific type.
 *
 * @param array - The array to convert.
 * @param type - The constructor of a typed array that defines the new type.
 * @return The converted array.
 */
export function convertArray<B extends AnimationBuffer>(
  array: AnimationBuffer,
  type: { new (values: never): B; BYTES_PER_ELEMENT?: number },
): B;
export function convertArray(array: AnimationBuffer, type: AnimationBufferConstructor): AnimationBuffer {
  if (!array || (array.constructor as { new (values: never): AnimationBuffer; BYTES_PER_ELEMENT?: number }) === type)
    return array;
  if (typeof type.BYTES_PER_ELEMENT === "number") {
    return new type(array as never); // create typed array
  }
  return Array.prototype.slice.call(array); // create Array
}
/**
 * Returns `true` if the given keyframe track settings hold Bezier tangent data.
 *
 * @param settings - The settings of a keyframe track.
 * @return Whether both tangent arrays are defined or not.
 */
export function hasTangents(settings?: any): boolean {
  return settings !== undefined && settings.inTangents !== undefined && settings.outTangents !== undefined;
}
/**
 * Returns an array by which times and values can be sorted.
 *
 * @param times - The keyframe time values.
 * @return The array.
 */
export function getKeyframeOrder(times: ArrayLike<number>): number[] {
  function compareTime(i: number, j: number) {
    return times[i] - times[j];
  }
  const n = times.length;
  const result = Array<number>(n);
  for (let i = 0; i !== n; ++i) result[i] = i;
  result.sort(compareTime);
  return result;
}
/**
 * Sorts the given array by the previously computed order via `getKeyframeOrder()`.
 *
 * @param values - The values to sort.
 * @param stride - The stride.
 * @param order - The sort order.
 * @return The sorted values.
 */
export function sortedArray<B extends AnimationBuffer>(values: B, stride: number, order: ArrayLike<number>): B {
  const nValues = values.length;
  const result = new (values.constructor as {
    new (values: never): AnimationBuffer;
    BYTES_PER_ELEMENT?: number;
  } as any)(nValues);
  for (let i = 0, dstOffset = 0; dstOffset !== nValues; ++i) {
    const srcOffset = order[i] * stride;
    for (let j = 0; j !== stride; ++j) {
      result[dstOffset++] = values[srcOffset + j];
    }
  }
  return result;
}
/**
 * Used for parsing AOS keyframe formats.
 *
 * @param jsonKeys - A list of JSON keyframes.
 * @param times - This array will be filled with keyframe times by this function.
 * @param values - This array will be filled with keyframe values by this function.
 * @param valuePropertyName - The name of the property to use.
 */
export function flattenJSON(
  jsonKeys: Record<string, unknown>[],
  times: number[],
  values: number[],
  valuePropertyName: string,
) {
  let i = 1,
    key = jsonKeys[0];
  while (key !== undefined && (key as any)[valuePropertyName] === undefined) {
    key = jsonKeys[i++];
  }
  if (key === undefined) return; // no data
  let value = (key as any)[valuePropertyName];
  if (value === undefined) return; // no data
  if (Array.isArray(value)) {
    do {
      value = (key as any)[valuePropertyName];
      if (value !== undefined) {
        times.push((key as any).time);
        values.push(...value); // push all elements
      }
      key = jsonKeys[i++];
    } while (key !== undefined);
  } else if (value.toArray !== undefined) {
    // ...assume THREE.Math-ish
    do {
      value = (key as any)[valuePropertyName];
      if (value !== undefined) {
        times.push((key as any).time);
        value.toArray(values, values.length);
      }
      key = jsonKeys[i++];
    } while (key !== undefined);
  } else {
    // otherwise push as-is
    do {
      value = (key as any)[valuePropertyName];
      if (value !== undefined) {
        times.push((key as any).time);
        values.push(value);
      }
      key = jsonKeys[i++];
    } while (key !== undefined);
  }
}
/**
 * Creates a new clip, containing only the segment of the original clip between the given frames.
 *
 * @param sourceClip - The values to sort.
 * @param name - The name of the clip.
 * @param startFrame - The start frame.
 * @param endFrame - The end frame.
 * @param [fps=30] - The FPS.
 * @return The new sub clip.
 */
export function subclip(
  sourceClip: AnimationClip,
  name: string,
  startFrame: number,
  endFrame: number,
  fps: number = 30,
): AnimationClip {
  const clip = sourceClip.clone();
  clip.name = name;
  const tracks: any[] = [];
  for (let i = 0; i < clip.tracks.length; ++i) {
    const track = clip.tracks[i];
    const valueSize = track.getValueSize();
    const times: any[] = [];
    const values: any[] = [];
    for (let j = 0; j < track.times.length; ++j) {
      const frame = track.times[j] * fps;
      if (frame < startFrame || frame >= endFrame) continue;
      times.push(track.times[j]);
      for (let k = 0; k < valueSize; ++k) {
        values.push(track.values[j * valueSize + k]);
      }
    }
    if (times.length === 0) continue;
    track.times = convertArray(
      times,
      track.times.constructor as { new (values: never): NumericAnimationBuffer; BYTES_PER_ELEMENT?: number },
    );
    track.values = convertArray(
      values,
      track.values.constructor as { new (values: never): AnimationBuffer; BYTES_PER_ELEMENT?: number },
    );
    tracks.push(track);
  }
  clip.tracks = tracks;
  // find minimum .times value across all tracks in the trimmed clip
  let minStartTime = Infinity;
  for (let i = 0; i < clip.tracks.length; ++i) {
    if (minStartTime > clip.tracks[i].times[0]) {
      minStartTime = clip.tracks[i].times[0];
    }
  }
  // shift all tracks such that clip begins at t=0
  for (let i = 0; i < clip.tracks.length; ++i) {
    clip.tracks[i].shift(-1 * minStartTime);
  }
  clip.resetDuration();
  return clip;
}
/**
 * Converts the keyframes of the given animation clip to an additive format.
 *
 * @param targetClip - The clip to make additive.
 * @param [referenceFrame=0] - The reference frame.
 * @param [referenceClip=targetClip] - The reference clip.
 * @param [fps=30] - The FPS.
 * @return The updated clip which is now additive.
 */
export function makeClipAdditive(
  targetClip: AnimationClip,
  referenceFrame: number = 0,
  referenceClip: AnimationClip = targetClip,
  fps: number = 30,
): AnimationClip {
  if (fps <= 0) fps = 30;
  const numTracks = referenceClip.tracks.length;
  const referenceTime = referenceFrame / fps;
  // Make each track's values relative to the values at the reference frame
  for (let i = 0; i < numTracks; ++i) {
    const referenceTrack = referenceClip.tracks[i];
    const referenceTrackType = referenceTrack.ValueTypeName;
    // Skip this track if it's non-numeric
    if (referenceTrackType === "bool" || referenceTrackType === "string") continue;
    // Find the track in the target clip whose name and type matches the reference track
    const targetTrack = targetClip.tracks.find(function (track?: any) {
      return track.name === referenceTrack.name && track.ValueTypeName === referenceTrackType;
    });
    if (targetTrack === undefined) continue;
    let referenceOffset = 0;
    const referenceValueSize = referenceTrack.getValueSize();
    if (referenceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
      referenceOffset = referenceValueSize / 3;
    }
    let targetOffset = 0;
    const targetValueSize = targetTrack.getValueSize();
    if (targetTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
      targetOffset = targetValueSize / 3;
    }
    const lastIndex = referenceTrack.times.length - 1;
    let referenceValue: any;
    // Find the value to subtract out of the track
    if (referenceTime <= referenceTrack.times[0]) {
      // Reference frame is earlier than the first keyframe, so just use the first keyframe
      const startIndex = referenceOffset;
      const endIndex = referenceValueSize - referenceOffset;
      referenceValue = referenceTrack.values.slice(startIndex, endIndex);
    } else if (referenceTime >= referenceTrack.times[lastIndex]) {
      // Reference frame is after the last keyframe, so just use the last keyframe
      const startIndex = lastIndex * referenceValueSize + referenceOffset;
      const endIndex = startIndex + referenceValueSize - referenceOffset;
      referenceValue = referenceTrack.values.slice(startIndex, endIndex);
    } else {
      // Interpolate to the reference value
      const interpolant = referenceTrack.createInterpolant();
      interpolant.evaluate(referenceTime);
      referenceValue = interpolant.resultBuffer.slice();
    }
    // Conjugate the quaternion
    if (referenceTrackType === "quaternion") {
      const referenceQuat = new Quaternion().fromArray(referenceValue).normalize().conjugate();
      referenceQuat.toArray(referenceValue);
    }
    // Subtract the reference value from all of the track values
    const numTimes = targetTrack.times.length;
    for (let j = 0; j < numTimes; ++j) {
      const valueStart = j * targetValueSize + targetOffset;
      if (referenceTrackType === "quaternion") {
        // Multiply the conjugate for quaternion track types
        Quaternion.multiplyQuaternionsFlat(
          targetTrack.values as NumericAnimationBuffer,
          valueStart,
          referenceValue,
          0,
          targetTrack.values as NumericAnimationBuffer,
          valueStart,
        );
      } else {
        const valueEnd = targetValueSize - targetOffset * 2;
        // Subtract each value for all other numeric track types
        for (let k = 0; k < valueEnd; ++k) {
          (targetTrack.values as NumericAnimationBuffer)[valueStart + k] -= referenceValue[k];
        }
      }
    }
  }
  targetClip.blendMode = AnimationBlendMode.Additive;
  return targetClip;
}
/**
 * A class with various methods to assist with animations.
 *
 * @hideconstructor
 */
