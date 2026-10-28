import type { AnimationClip } from "./AnimationClip";
import type { AnimationMixer } from "./AnimationMixer";
import type { AnimationObjectGroup } from "./AnimationObjectGroup";
import type { AnimationBuffer, Interpolant } from "../math/Interpolant";
import type { LinearInterpolant } from "../math/interpolants/LinearInterpolant";
import type { Object3D } from "../core/Object3D";
import {
  WrapAroundEnding,
  ZeroCurvatureEnding,
  ZeroSlopeEnding,
  LoopPingPong,
  LoopOnce,
  LoopRepeat,
  NormalAnimationBlendMode,
  AdditiveAnimationBlendMode,
} from "../constants";
/**
 * An instance of `AnimationAction` schedules the playback of an animation which is
 * stored in {@link AnimationClip}.
 */
export class AnimationAction {
  _mixer: AnimationMixer;
  _clip: AnimationClip;
  _localRoot: Object3D | AnimationObjectGroup | null;
  blendMode: number;
  _interpolantSettings: any;
  _interpolants: any[];
  _propertyBindings: any[];
  _cacheIndex: number | null;
  _byClipCacheIndex: number | null;
  _timeScaleInterpolant: LinearInterpolant | null;
  _restoreTimeScale: number | null;
  _weightInterpolant: LinearInterpolant | null;
  loop: number;
  _loopCount: number;
  _startTime: number | null;
  time: number;
  timeScale: number;
  _effectiveTimeScale: number;
  weight: number;
  _effectiveWeight: number;
  repetitions: number;
  paused: boolean;
  enabled: boolean;
  clampWhenFinished: boolean;
  zeroSlopeAtStart: boolean;
  zeroSlopeAtEnd: boolean;

  /**
   * Constructs a new animation action.
   *
   * @param mixer - The mixer that is controlled by this action.
   * @param clip - The animation clip that holds the actual keyframes.
   * @param [localRoot=null] - The root object on which this action is performed.
   * @param [blendMode] - The blend mode.
   */
  constructor(
    mixer: AnimationMixer,
    clip: AnimationClip,
    localRoot: Object3D | AnimationObjectGroup | null = null,
    blendMode: number = clip.blendMode,
  ) {
    this._mixer = mixer;
    this._clip = clip;
    this._localRoot = localRoot;
    /**
     * Defines how the animation is blended/combined when two or more animations
     * are simultaneously played.
     *
     */
    this.blendMode = blendMode;
    const tracks = clip.tracks,
      nTracks = tracks.length,
      interpolants = Array<Interpolant<AnimationBuffer>>(nTracks);
    const interpolantSettings: any = {
      endingStart: ZeroCurvatureEnding,
      endingEnd: ZeroCurvatureEnding,
    };
    for (let i = 0; i !== nTracks; ++i) {
      const interpolant = tracks[i].createInterpolant(null);
      interpolants[i] = interpolant;
      interpolant.settings = interpolantSettings;
    }
    this._interpolantSettings = interpolantSettings;
    this._interpolants = interpolants; // bound by the mixer
    // inside: PropertyMixer (managed by the mixer)
    this._propertyBindings = Array(nTracks);
    this._cacheIndex = null; // for the memory manager
    this._byClipCacheIndex = null; // for the memory manager
    this._timeScaleInterpolant = null;
    this._restoreTimeScale = null;
    this._weightInterpolant = null;
    /**
     * The loop mode, set via {@link AnimationAction#setLoop}.
     *
     * @default LoopRepeat
     */
    this.loop = LoopRepeat;
    this._loopCount = -1;
    // global mixer time when the action is to be started
    // it's set back to 'null' upon start of the action
    this._startTime = null;
    /**
     * The local time of this action (in seconds, starting with `0`).
     *
     * The value gets clamped or wrapped to `[0,clip.duration]` (according to the
     * loop state).
     *
     * @default 0
     */
    this.time = 0;
    /**
     * Scaling factor for the {@link AnimationAction#time}. A value of `0` causes the
     * animation to pause. Negative values cause the animation to play backwards.
     *
     * @default 1
     */
    this.timeScale = 1;
    this._effectiveTimeScale = 1;
    /**
     * The degree of influence of this action (in the interval `[0, 1]`). Values
     * between `0` (no impact) and `1` (full impact) can be used to blend between
     * several actions.
     *
     * @default 1
     */
    this.weight = 1;
    this._effectiveWeight = 1;
    /**
     * The number of repetitions of the performed clip over the course of this action.
     * Can be set via {@link AnimationAction#setLoop}.
     *
     * Setting this number has no effect if {@link AnimationAction#loop} is set to
     * `THREE:LoopOnce`.
     *
     * @default Infinity
     */
    this.repetitions = Infinity;
    /**
     * If set to `true`, the playback of the action is paused.
     *
     * @default false
     */
    this.paused = false;
    /**
     * If set to `false`, the action is disabled so it has no impact.
     *
     * When the action is re-enabled, the animation continues from its current
     * time (setting `enabled` to `false` doesn't reset the action).
     *
     * @default true
     */
    this.enabled = true;
    /**
     * If set to true the animation will automatically be paused on its last frame.
     *
     * If set to false, {@link AnimationAction#enabled} will automatically be switched
     * to `false` when the last loop of the action has finished, so that this action has
     * no further impact.
     *
     * Note: This member has no impact if the action is interrupted (it
     * has only an effect if its last loop has really finished).
     *
     * @default false
     */
    this.clampWhenFinished = false;
    /**
     * Enables smooth interpolation without separate clips for start, loop and end.
     *
     * @default true
     */
    this.zeroSlopeAtStart = true;
    /**
     * Enables smooth interpolation without separate clips for start, loop and end.
     *
     * @default true
     */
    this.zeroSlopeAtEnd = true;
  }
  /**
   * Starts the playback of the animation.
   *
   * @return A reference to this animation action.
   */
  play(): AnimationAction {
    this._mixer._activateAction(this);
    return this;
  }
  /**
   * Stops the playback of the animation.
   *
   * @return A reference to this animation action.
   */
  stop(): AnimationAction {
    this._mixer._deactivateAction(this);
    return this.reset();
  }
  /**
   * Resets the playback of the animation.
   *
   * @return A reference to this animation action.
   */
  reset(): AnimationAction {
    this.paused = false;
    this.enabled = true;
    this.time = 0; // restart clip
    this._loopCount = -1; // forget previous loops
    this._startTime = null; // forget scheduling
    return this.stopFading().stopWarping();
  }
  /**
   * Returns `true` if the animation is running.
   *
   * @return Whether the animation is running or not.
   */
  isRunning(): boolean {
    return (
      this.enabled &&
      !this.paused &&
      this.timeScale !== 0 &&
      this._startTime === null &&
      this._mixer._isActiveAction(this)
    );
  }
  /**
   * Returns `true` when {@link AnimationAction#play} has been called.
   *
   * @return Whether the animation is scheduled or not.
   */
  isScheduled(): boolean {
    return this._mixer._isActiveAction(this);
  }
  /**
   * Defines the time when the animation should start.
   *
   * @param time - The start time in seconds.
   * @return A reference to this animation action.
   */
  startAt(time: number): AnimationAction {
    this._startTime = time;
    return this;
  }
  /**
   * Configures the loop settings for this action.
   *
   * @param mode - The loop mode.
   * @param repetitions - The number of repetitions.
   * @return A reference to this animation action.
   */
  setLoop(mode: number, repetitions: number): AnimationAction {
    this.loop = mode;
    this.repetitions = repetitions;
    return this;
  }
  /**
   * Sets the effective weight of this action.
   *
   * An action has no effect and thus an effective weight of zero when the
   * action is disabled.
   *
   * @param weight - The weight to set.
   * @return A reference to this animation action.
   */
  setEffectiveWeight(weight: number): AnimationAction {
    this.weight = weight;
    // note: same logic as when updated at runtime
    this._effectiveWeight = this.enabled ? weight : 0;
    return this.stopFading();
  }
  /**
   * Returns the effective weight of this action.
   *
   * @return The effective weight.
   */
  getEffectiveWeight(): number {
    return this._effectiveWeight;
  }
  /**
   * Fades the animation in by increasing its weight gradually from `0` to `1`,
   * within the passed time interval.
   *
   * @param duration - The duration of the fade.
   * @return A reference to this animation action.
   */
  fadeIn(duration: number): AnimationAction {
    return this._scheduleFading(duration, 0, 1);
  }
  /**
   * Fades the animation out by decreasing its weight gradually from `1` to `0`,
   * within the passed time interval.
   *
   * @param duration - The duration of the fade.
   * @return A reference to this animation action.
   */
  fadeOut(duration: number): AnimationAction {
    return this._scheduleFading(duration, 1, 0);
  }
  /**
   * Causes this action to fade in and the given action to fade out,
   * within the passed time interval.
   *
   * @param fadeOutAction - The animation action to fade out.
   * @param duration - The duration of the fade.
   * @param [warp=false] - Whether warping should be used or not.
   * @return A reference to this animation action.
   */
  crossFadeFrom(fadeOutAction: AnimationAction, duration: number, warp: boolean = false): AnimationAction {
    fadeOutAction.fadeOut(duration);
    this.fadeIn(duration);
    if (warp === true) {
      const fadeInDuration = this._clip.duration,
        fadeOutDuration = fadeOutAction._clip.duration,
        startEndRatio = fadeOutDuration / fadeInDuration,
        endStartRatio = fadeInDuration / fadeOutDuration;
      fadeOutAction._restoreTimeScale = fadeOutAction.timeScale;
      this._restoreTimeScale = this.timeScale;
      fadeOutAction.warp(1.0, startEndRatio, duration);
      this.warp(endStartRatio, 1.0, duration);
    }
    return this;
  }
  /**
   * Causes this action to fade out and the given action to fade in,
   * within the passed time interval.
   *
   * @param fadeInAction - The animation action to fade in.
   * @param duration - The duration of the fade.
   * @param [warp=false] - Whether warping should be used or not.
   * @return A reference to this animation action.
   */
  crossFadeTo(fadeInAction: AnimationAction, duration: number, warp: boolean = false): AnimationAction {
    return fadeInAction.crossFadeFrom(this, duration, warp);
  }
  /**
   * Stops any fading which is applied to this action.
   *
   * @return A reference to this animation action.
   */
  stopFading(): AnimationAction {
    const weightInterpolant = this._weightInterpolant;
    if (weightInterpolant !== null) {
      this._weightInterpolant = null;
      this._mixer._takeBackControlInterpolant(weightInterpolant);
    }
    return this;
  }
  /**
   * Sets the effective time scale of this action.
   *
   * An action has no effect and thus an effective time scale of zero when the
   * action is paused.
   *
   * @param timeScale - The time scale to set.
   * @return A reference to this animation action.
   */
  setEffectiveTimeScale(timeScale: number): AnimationAction {
    this.timeScale = timeScale;
    this._effectiveTimeScale = this.paused ? 0 : timeScale;
    return this.stopWarping();
  }
  /**
   * Returns the effective time scale of this action.
   *
   * @return The effective time scale.
   */
  getEffectiveTimeScale(): number {
    return this._effectiveTimeScale;
  }
  /**
   * Sets the duration for a single loop of this action.
   *
   * @param duration - The duration to set.
   * @return A reference to this animation action.
   */
  setDuration(duration: number): AnimationAction {
    this.timeScale = this._clip.duration / duration;
    return this.stopWarping();
  }
  /**
   * Synchronizes this action with the passed other action.
   *
   * @param action - The action to sync with.
   * @return A reference to this animation action.
   */
  syncWith(action: AnimationAction): AnimationAction {
    this.time = action.time;
    this.timeScale = action.timeScale;
    return this.stopWarping();
  }
  /**
   * Decelerates this animation's speed to `0` within the passed time interval.
   *
   * @param duration - The duration.
   * @return A reference to this animation action.
   */
  halt(duration: number): AnimationAction {
    return this.warp(this._effectiveTimeScale, 0, duration);
  }
  /**
   * Changes the playback speed, within the passed time interval, by modifying
   * {@link AnimationAction#timeScale} gradually from `startTimeScale` to
   * `endTimeScale`.
   *
   * @param startTimeScale - The start time scale.
   * @param endTimeScale - The end time scale.
   * @param duration - The duration.
   * @return A reference to this animation action.
   */
  warp(startTimeScale: number, endTimeScale: number, duration: number): AnimationAction {
    const mixer = this._mixer,
      now = mixer.time,
      timeScale = this.timeScale;
    let interpolant = this._timeScaleInterpolant;
    if (interpolant === null) {
      interpolant = mixer._lendControlInterpolant();
      this._timeScaleInterpolant = interpolant;
    }
    const times = interpolant.parameterPositions,
      values = interpolant.sampleValues;
    times[0] = now;
    times[1] = now + duration;
    values[0] = startTimeScale / timeScale;
    values[1] = endTimeScale / timeScale;
    return this;
  }
  /**
   * Stops any scheduled warping which is applied to this action.
   *
   * @return A reference to this animation action.
   */
  stopWarping(): AnimationAction {
    const timeScaleInterpolant = this._timeScaleInterpolant;
    if (timeScaleInterpolant !== null) {
      this._timeScaleInterpolant = null;
      this._mixer._takeBackControlInterpolant(timeScaleInterpolant);
    }
    this._restoreTimeScale = null;
    return this;
  }
  /**
   * Returns the animation mixer of this animation action.
   *
   * @return The animation mixer.
   */
  getMixer(): AnimationMixer {
    return this._mixer;
  }
  /**
   * Returns the animation clip of this animation action.
   *
   * @return The animation clip.
   */
  getClip(): AnimationClip {
    return this._clip;
  }
  /**
   * Returns the root object of this animation action.
   *
   * @return The root object.
   */
  getRoot(): Object3D | AnimationObjectGroup {
    return this._localRoot || this._mixer._root;
  }
  // Internal
  _update(time: any, deltaTime: any, timeDirection: any, accuIndex?: any) {
    // called by the mixer
    if (!this.enabled) {
      // call ._updateWeight() to update ._effectiveWeight
      this._updateWeight(time);
      return;
    }
    const startTime = this._startTime;
    if (startTime !== null) {
      // check for scheduled start of action
      const timeRunning = (time - startTime) * timeDirection;
      if (timeRunning < 0 || timeDirection === 0) {
        deltaTime = 0;
      } else {
        this._startTime = null; // unschedule
        deltaTime = timeDirection * timeRunning;
      }
    }
    // apply time scale and advance time
    deltaTime *= this._updateTimeScale(time);
    const clipTime = this._updateTime(deltaTime);
    // note: _updateTime may disable the action resulting in
    // an effective weight of 0
    const weight = this._updateWeight(time);
    if (weight > 0) {
      const interpolants = this._interpolants;
      const propertyMixers = this._propertyBindings;
      switch (this.blendMode) {
        case AdditiveAnimationBlendMode:
          for (let j = 0, m = interpolants.length; j !== m; ++j) {
            interpolants[j].evaluate(clipTime);
            propertyMixers[j].accumulateAdditive(weight);
          }
          break;
        case NormalAnimationBlendMode:
        default:
          for (let j = 0, m = interpolants.length; j !== m; ++j) {
            interpolants[j].evaluate(clipTime);
            propertyMixers[j].accumulate(accuIndex, weight);
          }
      }
    }
  }
  _updateWeight(time?: any) {
    let weight = 0;
    if (this.enabled) {
      weight = this.weight;
      const interpolant = this._weightInterpolant;
      if (interpolant !== null) {
        const interpolantValue = interpolant.evaluate(time)[0];
        weight *= interpolantValue;
        if (time > interpolant.parameterPositions[1]) {
          this.stopFading();
          if (interpolantValue === 0) {
            // faded out, disable
            this.enabled = false;
          }
        }
      }
    }
    this._effectiveWeight = weight;
    return weight;
  }
  _updateTimeScale(time?: any) {
    let timeScale = 0;
    if (!this.paused) {
      timeScale = this.timeScale;
      const interpolant = this._timeScaleInterpolant;
      if (interpolant !== null) {
        const interpolantValue = interpolant.evaluate(time)[0];
        timeScale *= interpolantValue;
        if (time > interpolant.parameterPositions[1]) {
          if (timeScale === 0) {
            // motion has halted, pause
            this.paused = true;
          } else {
            if (this._restoreTimeScale !== null) {
              timeScale = this._restoreTimeScale;
            }
            // warp done - apply final time scale
            this.timeScale = timeScale;
          }
          this.stopWarping();
        }
      }
    }
    this._effectiveTimeScale = timeScale;
    return timeScale;
  }
  _updateTime(deltaTime?: any) {
    const duration = this._clip.duration;
    const loop = this.loop;
    let time = this.time + deltaTime;
    let loopCount = this._loopCount;
    const pingPong = loop === LoopPingPong;
    if (deltaTime === 0) {
      if (loopCount === -1) return time;
      return pingPong && (loopCount & 1) === 1 ? duration - time : time;
    }
    if (loop === LoopOnce) {
      if (loopCount === -1) {
        // just started
        this._loopCount = 0;
        this._setEndings(true, true, false);
      }
      handle_stop: {
        if (time >= duration) {
          time = duration;
        } else if (time < 0) {
          time = 0;
        } else {
          this.time = time;
          break handle_stop;
        }
        if (this.clampWhenFinished) this.paused = true;
        else this.enabled = false;
        this.time = time;
        this._mixer.dispatchEvent({
          type: "finished",
          action: this,
          direction: deltaTime < 0 ? -1 : 1,
        });
      }
    } else {
      // repetitive Repeat or PingPong
      if (loopCount === -1) {
        // just started
        if (deltaTime >= 0) {
          loopCount = 0;
          this._setEndings(true, this.repetitions === 0, pingPong);
        } else {
          // when looping in reverse direction, the initial
          // transition through zero counts as a repetition,
          // so leave loopCount at -1
          this._setEndings(this.repetitions === 0, true, pingPong);
        }
      }
      if (time >= duration || time < 0) {
        // wrap around
        const loopDelta = Math.floor(time / duration); // signed
        time -= duration * loopDelta;
        loopCount += Math.abs(loopDelta);
        const pending = this.repetitions - loopCount;
        if (pending <= 0) {
          // have to stop (switch state, clamp time, fire event)
          if (this.clampWhenFinished) this.paused = true;
          else this.enabled = false;
          time = deltaTime > 0 ? duration : 0;
          this.time = time;
          this._mixer.dispatchEvent({
            type: "finished",
            action: this,
            direction: deltaTime > 0 ? 1 : -1,
          });
        } else {
          // keep running
          if (pending === 1) {
            // entering the last round
            const atStart = deltaTime < 0;
            this._setEndings(atStart, !atStart, pingPong);
          } else {
            this._setEndings(false, false, pingPong);
          }
          this._loopCount = loopCount;
          this.time = time;
          this._mixer.dispatchEvent({
            type: "loop",
            action: this,
            loopDelta: loopDelta,
          });
        }
      } else {
        this._loopCount = loopCount;
        this.time = time;
      }
      if (pingPong && (loopCount & 1) === 1) {
        // invert time for the "pong round"
        return duration - time;
      }
    }
    return time;
  }
  _setEndings(atStart: any, atEnd: any, pingPong?: any) {
    const settings = this._interpolantSettings;
    if (pingPong) {
      settings.endingStart = ZeroSlopeEnding;
      settings.endingEnd = ZeroSlopeEnding;
    } else {
      // assuming for LoopOnce atStart == atEnd == true
      if (atStart) {
        settings.endingStart = this.zeroSlopeAtStart ? ZeroSlopeEnding : ZeroCurvatureEnding;
      } else {
        settings.endingStart = WrapAroundEnding;
      }
      if (atEnd) {
        settings.endingEnd = this.zeroSlopeAtEnd ? ZeroSlopeEnding : ZeroCurvatureEnding;
      } else {
        settings.endingEnd = WrapAroundEnding;
      }
    }
  }
  _scheduleFading(duration: any, weightNow: any, weightThen?: any) {
    const mixer = this._mixer,
      now = mixer.time;
    let interpolant = this._weightInterpolant;
    if (interpolant === null) {
      interpolant = mixer._lendControlInterpolant();
      this._weightInterpolant = interpolant;
    }
    const times = interpolant.parameterPositions,
      values = interpolant.sampleValues;
    times[0] = now;
    values[0] = weightNow;
    times[1] = now + duration;
    values[1] = weightThen;
    return this;
  }
}
