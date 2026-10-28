import { AnimationClip } from "../../animation/AnimationClip";
import { BooleanKeyframeTrack } from "../../animation/tracks/BooleanKeyframeTrack";
import { ColorKeyframeTrack } from "../../animation/tracks/ColorKeyframeTrack";
import { NumberKeyframeTrack } from "../../animation/tracks/NumberKeyframeTrack";
import { VectorKeyframeTrack } from "../../animation/tracks/VectorKeyframeTrack";
import type { Color } from "../../math/Color";
import { Vector3 } from "../../math/Vector3";

/** Factory methods for basic animation clips. */
export class AnimationClipCreator {
  static CreateRotationAnimation(period: number, axis: "x" | "y" | "z" = "x"): AnimationClip {
    return new AnimationClip("", period, [new NumberKeyframeTrack(`.rotation[${axis}]`, [0, period], [0, 360])]);
  }

  static CreateScaleAxisAnimation(period: number, axis: "x" | "y" | "z" = "x"): AnimationClip {
    return new AnimationClip("", period, [new NumberKeyframeTrack(`.scale[${axis}]`, [0, period], [0, 1])]);
  }

  static CreateShakeAnimation(duration: number, shakeScale: Vector3): AnimationClip {
    const times: number[] = [],
      values: number[] = [],
      tmp = new Vector3();
    for (let i = 0; i < duration * 10; i++) {
      times.push(i / 10);
      tmp
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .multiply(shakeScale)
        .toArray(values, values.length);
    }
    return new AnimationClip("", duration, [new VectorKeyframeTrack(".position", times, values)]);
  }

  static CreatePulsationAnimation(duration: number, pulseScale: number): AnimationClip {
    const times: number[] = [],
      values: number[] = [],
      tmp = new Vector3();
    for (let i = 0; i < duration * 10; i++) {
      times.push(i / 10);
      const factor = Math.random() * pulseScale;
      tmp.set(factor, factor, factor).toArray(values, values.length);
    }
    return new AnimationClip("", duration, [new VectorKeyframeTrack(".scale", times, values)]);
  }

  static CreateVisibilityAnimation(duration: number): AnimationClip {
    return new AnimationClip("", duration, [
      new BooleanKeyframeTrack(".visible", [0, duration / 2, duration], [true, false, true]),
    ]);
  }

  static CreateMaterialColorAnimation(duration: number, colors: Color[]): AnimationClip {
    const times: number[] = [],
      values: number[] = [];
    const step = colors.length > 1 ? duration / (colors.length - 1) : 0;
    for (let i = 0; i < colors.length; i++) {
      times.push(i * step);
      const color = colors[i];
      values.push(color.r, color.g, color.b);
    }
    return new AnimationClip("", duration, [new ColorKeyframeTrack(".material.color", times, values)]);
  }
}
