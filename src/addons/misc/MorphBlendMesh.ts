import type { BufferGeometry } from "../../core/BufferGeometry";
import type { Material } from "../../materials/Material";
import { clamp } from "../../math/MathUtils";
import { Mesh } from "../../objects/Mesh";

export interface MorphBlendAnimation {
  start: number;
  end: number;
  length: number;
  fps: number;
  duration: number;
  lastFrame: number;
  currentFrame: number;
  active: boolean;
  time: number;
  direction: number;
  weight: number;
  directionBackwards: boolean;
  mirroredLoop: boolean;
}

export class MorphBlendMesh<TMaterial extends Material | Material[] = Material | Material[]> extends Mesh<TMaterial> {
  animationsMap: Record<string, MorphBlendAnimation> = {};
  animationsList: MorphBlendAnimation[] = [];
  firstAnimation: string | undefined;

  constructor(geometry: BufferGeometry, material: TMaterial) {
    super(geometry, material);
    const numFrames = Object.keys(this.morphTargetDictionary ?? {}).length;
    this.createAnimation("__default", 0, numFrames - 1, numFrames);
    this.setAnimationWeight("__default", 1);
  }

  createAnimation(name: string, start: number, end: number, fps: number): void {
    const animation: MorphBlendAnimation = {
      start,
      end,
      length: end - start + 1,
      fps,
      duration: (end - start) / fps,
      lastFrame: 0,
      currentFrame: 0,
      active: false,
      time: 0,
      direction: 1,
      weight: 1,
      directionBackwards: false,
      mirroredLoop: false,
    };
    this.animationsMap[name] = animation;
    this.animationsList.push(animation);
  }

  autoCreateAnimations(fps: number): void {
    const ranges: Record<string, { start: number; end: number }> = {};
    let firstAnimation: string | undefined;
    let i = 0;
    for (const key in this.morphTargetDictionary) {
      const chunks = key.match(/([a-z]+)_?(\d+)/i);
      if (chunks && chunks.length > 1) {
        const name = chunks[1];
        const range = (ranges[name] ??= { start: Infinity, end: -Infinity });
        if (i < range.start) range.start = i;
        if (i > range.end) range.end = i;
        if (!firstAnimation) firstAnimation = name;
      }
      i++;
    }
    for (const name in ranges) this.createAnimation(name, ranges[name].start, ranges[name].end, fps);
    this.firstAnimation = firstAnimation;
  }

  setAnimationDirectionForward(name: string | null): void {
    const animation = name === null ? undefined : this.animationsMap[name];
    if (animation) {
      animation.direction = 1;
      animation.directionBackwards = false;
    }
  }
  setAnimationDirectionBackward(name: string | null): void {
    const animation = name === null ? undefined : this.animationsMap[name];
    if (animation) {
      animation.direction = -1;
      animation.directionBackwards = true;
    }
  }
  setAnimationFPS(name: string, fps: number): void {
    const animation = this.animationsMap[name];
    if (animation) {
      animation.fps = fps;
      animation.duration = (animation.end - animation.start) / fps;
    }
  }
  setAnimationDuration(name: string, duration: number): void {
    const animation = this.animationsMap[name];
    if (animation) {
      animation.duration = duration;
      animation.fps = (animation.end - animation.start) / duration;
    }
  }
  setAnimationWeight(name: string | null, weight: number): void {
    const animation = name === null ? undefined : this.animationsMap[name];
    if (animation) animation.weight = weight;
  }
  setAnimationTime(name: string, time: number): void {
    const animation = this.animationsMap[name];
    if (animation) animation.time = time;
  }
  getAnimationTime(name: string): number {
    return this.animationsMap[name]?.time ?? 0;
  }
  getAnimationDuration(name: string): number {
    return this.animationsMap[name]?.duration ?? -1;
  }
  playAnimation(name: string): void {
    const animation = this.animationsMap[name];
    if (animation) {
      animation.time = 0;
      animation.active = true;
    } else console.warn(`THREE.MorphBlendMesh: animation[${name}] undefined in .playAnimation()`);
  }
  stopAnimation(name: string): void {
    const animation = this.animationsMap[name];
    if (animation) animation.active = false;
  }
  update(delta: number): void {
    for (const animation of this.animationsList) {
      if (!animation.active) continue;
      const frameTime = animation.duration / animation.length;
      animation.time += animation.direction * delta;
      if (animation.mirroredLoop) {
        if (animation.time > animation.duration || animation.time < 0) {
          animation.direction *= -1;
          if (animation.time > animation.duration) {
            animation.time = animation.duration;
            animation.directionBackwards = true;
          }
          if (animation.time < 0) {
            animation.time = 0;
            animation.directionBackwards = false;
          }
        }
      } else {
        animation.time %= animation.duration;
        if (animation.time < 0) animation.time += animation.duration;
      }
      const keyframe = animation.start + clamp(Math.floor(animation.time / frameTime), 0, animation.length - 1);
      const weight = animation.weight;
      const influences = this.morphTargetInfluences!;
      if (keyframe !== animation.currentFrame) {
        influences[animation.lastFrame] = 0;
        influences[animation.currentFrame] = weight;
        influences[keyframe] = 0;
        animation.lastFrame = animation.currentFrame;
        animation.currentFrame = keyframe;
      }
      let mix = (animation.time % frameTime) / frameTime;
      if (animation.directionBackwards) mix = 1 - mix;
      if (animation.currentFrame !== animation.lastFrame) {
        influences[animation.currentFrame] = mix * weight;
        influences[animation.lastFrame] = (1 - mix) * weight;
      } else influences[animation.currentFrame] = weight;
    }
  }
}
