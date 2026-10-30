import type { Object3D } from "../core/Object3D";
import { getKeyframeOrder, sortedArray, flattenJSON, hasTangents, convertArray } from "./AnimationUtils";
import { KeyframeTrack } from "./KeyframeTrack";
import { BooleanKeyframeTrack } from "./tracks/BooleanKeyframeTrack";
import { ColorKeyframeTrack } from "./tracks/ColorKeyframeTrack";
import { NumberKeyframeTrack } from "./tracks/NumberKeyframeTrack";
import { QuaternionKeyframeTrack } from "./tracks/QuaternionKeyframeTrack";
import { StringKeyframeTrack } from "./tracks/StringKeyframeTrack";
import { VectorKeyframeTrack } from "./tracks/VectorKeyframeTrack";
import { generateUUID } from "../math/MathUtils";
import { AnimationBlendMode } from "../constants";
/**
 * A reusable set of keyframe tracks which represent an animation.
 */
export class AnimationClip {
  name: string;
  tracks: KeyframeTrack[];
  duration: number;
  blendMode: AnimationBlendMode;
  uuid: string;
  userData: any;

  /**
   * Constructs a new animation clip.
   *
   * Note: Instead of instantiating an AnimationClip directly with the constructor, you can
   * use the static interface of this class for creating clips. In most cases though, animation clips
   * will automatically be created by loaders when importing animated 3D assets.
   *
   * @param [name=''] - The clip's name.
   * @param [duration=-1] - The clip's duration in seconds. If a negative value is passed,
   * the duration will be calculated from the passed keyframes.
   * @param tracks - An array of keyframe tracks.
   * @param [blendMode=AnimationBlendMode.Normal] - Defines how the animation
   * is blended/combined when two or more animations are simultaneously played.
   */
  constructor(
    name: string = "",
    duration: number = -1,
    tracks: KeyframeTrack[] = [],
    blendMode: AnimationBlendMode = AnimationBlendMode.Normal,
  ) {
    /**
     * The clip's name.
     *
     */
    this.name = name;
    /**
     *  An array of keyframe tracks.
     *
     */
    this.tracks = tracks;
    /**
     * The clip's duration in seconds.
     *
     */
    this.duration = duration;
    /**
     * Defines how the animation is blended/combined when two or more animations
     * are simultaneously played.
     *
     */
    this.blendMode = blendMode;
    /**
     * The UUID of the animation clip.
     *
     * @readonly
     */
    this.uuid = generateUUID();
    /**
     * An object that can be used to store custom data about the animation clip.
     * It should not hold references to functions as these will not be cloned.
     *
     */
    this.userData = {};
    // this means it should figure out its duration by scanning the tracks
    if (this.duration < 0) {
      this.resetDuration();
    }
  }
  /**
   * Factory method for creating an animation clip from the given JSON.
   *
   * @static
   * @param json - The serialized animation clip.
   * @return The new animation clip.
   */
  static parse(json?: any): AnimationClip {
    const tracks: any[] = [],
      jsonTracks = json.tracks,
      frameTime = 1.0 / (json.fps || 1.0);
    for (let i = 0, n = jsonTracks.length; i !== n; ++i) {
      tracks.push(parseKeyframeTrack(jsonTracks[i]).scale(frameTime));
    }
    const clip = new this(json.name, json.duration, tracks, json.blendMode);
    clip.uuid = json.uuid;
    clip.userData = JSON.parse(json.userData || "{}");
    return clip;
  }
  /**
   * Serializes the given animation clip into JSON.
   *
   * @static
   * @param clip - The animation clip to serialize.
   * @return The JSON object.
   */
  static toJSON(clip: AnimationClip) {
    const tracks: any[] = [],
      clipTracks = clip.tracks;
    const json: any = {
      name: clip.name,
      duration: clip.duration,
      tracks: tracks,
      uuid: clip.uuid,
      blendMode: clip.blendMode,
      userData: JSON.stringify(clip.userData),
    };
    for (let i = 0, n = clipTracks.length; i !== n; ++i) {
      tracks.push(KeyframeTrack.toJSON(clipTracks[i]));
    }
    return json;
  }
  /**
   * Returns a new animation clip from the passed morph targets array of a
   * geometry, taking a name and the number of frames per second.
   *
   * Note: The fps parameter is required, but the animation speed can be
   * overridden via {@link AnimationAction#setDuration}.
   *
   * @static
   * @param name - The name of the animation clip.
   * @param morphTargetSequence - A sequence of morph targets.
   * @param fps - The Frames-Per-Second value.
   * @param noLoop - Whether the clip should be no loop or not.
   * @return The new animation clip.
   */
  static CreateFromMorphTargetSequence(
    name: string,
    morphTargetSequence: { name: string }[],
    fps: number,
    noLoop: boolean,
  ): AnimationClip {
    const numMorphTargets = morphTargetSequence.length;
    const tracks: KeyframeTrack[] = [];
    for (let i = 0; i < numMorphTargets; i++) {
      let times: number[] = [];
      let values: number[] = [];
      times.push((i + numMorphTargets - 1) % numMorphTargets, i, (i + 1) % numMorphTargets);
      values.push(0, 1, 0);
      const order = getKeyframeOrder(times);
      times = sortedArray(times, 1, order);
      values = sortedArray(values, 1, order);
      // if there is a key at the first frame, duplicate it as the
      // last frame as well for perfect loop.
      if (!noLoop && times[0] === 0) {
        times.push(numMorphTargets);
        values.push(values[0]);
      }
      tracks.push(
        new NumberKeyframeTrack(".morphTargetInfluences[" + morphTargetSequence[i].name + "]", times, values).scale(
          1.0 / fps,
        ),
      );
    }
    return new this(name, -1, tracks);
  }
  /**
   * Searches for an animation clip by name, taking as its first parameter
   * either an array of clips, or a mesh or geometry that contains an
   * array named "animations" property.
   *
   * @static
   * @param objectOrClipArray - The array or object to search through.
   * @param name - The name to search for.
   * @return The found animation clip. Returns `null` if no clip has been found.
   */
  static findByName(objectOrClipArray: AnimationClip[] | Object3D, name: string): AnimationClip | null;
  static findByName(objectOrClipArray: any, name: string): AnimationClip | null {
    let clipArray = objectOrClipArray;
    if (!Array.isArray(objectOrClipArray)) {
      const o = objectOrClipArray;
      clipArray = (o.geometry && o.geometry.animations) || o.animations;
    }
    for (let i = 0; i < clipArray.length; i++) {
      if (clipArray[i].name === name) {
        return clipArray[i];
      }
    }
    return null;
  }
  /**
   * Returns an array of new AnimationClips created from the morph target
   * sequences of a geometry, trying to sort morph target names into
   * animation-group-based patterns like "Walk_001, Walk_002, Run_001, Run_002...".
   *
   * See {@link MD2Loader#parse} as an example for how the method should be used.
   *
   * @static
   * @param morphTargets - A sequence of morph targets.
   * @param fps - The Frames-Per-Second value.
   * @param noLoop - Whether the clip should be no loop or not.
   * @return An array of new animation clips.
   */
  static CreateClipsFromMorphTargetSequences(
    morphTargets: { name: string }[],
    fps: number,
    noLoop: boolean,
  ): AnimationClip[] {
    const animationToMorphTargets: Record<string, { name: string }[]> = {};
    // tested with https://regex101.com/ on trick sequences
    // such flamingo_flyA_003, flamingo_run1_003, crdeath0059
    const pattern = /^([\w-]*?)([\d]+)$/;
    // sort morph target names into animation groups based
    // patterns like Walk_001, Walk_002, Run_001, Run_002
    for (let i = 0, il = morphTargets.length; i < il; i++) {
      const morphTarget = morphTargets[i];
      const parts = morphTarget.name.match(pattern);
      if (parts && parts.length > 1) {
        const name = parts[1];
        let animationMorphTargets = animationToMorphTargets[name];
        if (!animationMorphTargets) {
          animationToMorphTargets[name] = animationMorphTargets = [];
        }
        animationMorphTargets.push(morphTarget);
      }
    }
    const clips: AnimationClip[] = [];
    for (const name in animationToMorphTargets) {
      clips.push(this.CreateFromMorphTargetSequence(name, animationToMorphTargets[name], fps, noLoop));
    }
    return clips;
  }
  /**
   * Sets the duration of this clip to the duration of its longest keyframe track.
   *
   * @return A reference to this animation clip.
   */
  resetDuration(): AnimationClip {
    const tracks = this.tracks;
    let duration = 0;
    for (let i = 0, n = tracks.length; i !== n; ++i) {
      const track = this.tracks[i];
      duration = Math.max(duration, track.times[track.times.length - 1]);
    }
    this.duration = duration;
    return this;
  }
  /**
   * Trims all tracks to the clip's duration.
   *
   * @return A reference to this animation clip.
   */
  trim(): AnimationClip {
    for (let i = 0; i < this.tracks.length; i++) {
      this.tracks[i].trim(0, this.duration);
    }
    return this;
  }
  /**
   * Performs minimal validation on each track in the clip. Returns `true` if all
   * tracks are valid.
   *
   * @return Whether the clip's keyframes are valid or not.
   */
  validate(): boolean {
    let valid = true;
    for (let i = 0; i < this.tracks.length; i++) {
      valid = valid && this.tracks[i].validate();
    }
    return valid;
  }
  /**
   * Optimizes each track by removing equivalent sequential keys (which are
   * common in morph target sequences).
   *
   * @return A reference to this animation clip.
   */
  optimize(): AnimationClip {
    for (let i = 0; i < this.tracks.length; i++) {
      this.tracks[i].optimize();
    }
    return this;
  }
  /**
   * Returns a new animation clip with copied values from this instance.
   *
   * @return A clone of this instance.
   */
  clone(): AnimationClip {
    const tracks: KeyframeTrack[] = [];
    for (let i = 0; i < this.tracks.length; i++) {
      tracks.push(this.tracks[i].clone());
    }
    const clip = new (this.constructor as any)(this.name, this.duration, tracks, this.blendMode);
    clip.userData = JSON.parse(JSON.stringify(this.userData));
    return clip;
  }
  /**
   * Serializes this animation clip into JSON.
   *
   * @return The JSON object.
   */
  toJSON() {
    return (this.constructor as any).toJSON(this);
  }
}
function getTrackTypeForValueTypeName(typeName?: any) {
  switch (typeName.toLowerCase()) {
    case "scalar":
    case "double":
    case "float":
    case "number":
    case "integer":
      return NumberKeyframeTrack;
    case "vector":
    case "vector2":
    case "vector3":
    case "vector4":
      return VectorKeyframeTrack;
    case "color":
      return ColorKeyframeTrack;
    case "quaternion":
      return QuaternionKeyframeTrack;
    case "bool":
    case "boolean":
      return BooleanKeyframeTrack;
    case "string":
      return StringKeyframeTrack;
  }
  throw new Error("THREE.KeyframeTrack: Unsupported typeName: " + typeName);
}
function parseKeyframeTrack(json?: any) {
  if (json.type === undefined) {
    throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");
  }
  const trackType = getTrackTypeForValueTypeName(json.type);
  if (json.times === undefined) {
    const times: any[] = [],
      values: any[] = [];
    flattenJSON(json.keys, times, values, "value");
    json.times = times;
    json.values = values;
  }
  let track: any;
  // derived classes can define a static parse method
  if ((trackType as any).parse !== undefined) {
    track = (trackType as any).parse(json);
  } else {
    // by default, we assume a constructor compatible with the base
    track = new trackType(json.name, json.times, json.values, json.interpolation);
  }
  if (hasTangents(json.settings)) {
    track.settings = {
      inTangents: convertArray(json.settings.inTangents, Float32Array),
      outTangents: convertArray(json.settings.outTangents, Float32Array),
    };
  }
  return track;
}
