import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { Audio } from "../src/audio/Audio";
import { AudioListener } from "../src/audio/AudioListener";
import { AudioContext } from "../src/audio/AudioContext";
import { PositionalAudio } from "../src/audio/PositionalAudio";
import { Object3D } from "../src/core/Object3D";

function playback(): { audio: Audio; clock: { currentTime: number }; starts: number[][] } {
  const clock = { currentTime: 10 };
  const starts: number[][] = [];
  const parameter = { setTargetAtTime: () => {} };
  const context = {
    get currentTime() {
      return clock.currentTime;
    },
    createGain: () => ({ connect: () => {}, gain: parameter }),
    createPanner: () => ({ connect: () => {}, disconnect: () => {} }),
    createBufferSource: () => ({
      connect: () => {},
      disconnect: () => {},
      stop: () => {},
      start: (time: number, offset: number) => starts.push([time, offset]),
      detune: parameter,
      playbackRate: parameter,
    }),
  };
  const listener = { context, getInput: () => ({}) } as unknown as AudioListener;
  const audio = new Audio(listener);
  audio.setBuffer({ duration: 8 } as AudioBuffer);
  return { audio, clock, starts };
}

test("audio pause/resume excludes scheduled delay and applies playback rate to elapsed progress", () => {
  const { audio, clock, starts } = playback();
  audio.offset = 0.25;
  audio.setPlaybackRate(2);
  audio.play(3);
  clock.currentTime = 12;
  audio.pause();
  assert.equal(audio._progress, 0);
  audio.play();
  clock.currentTime = 13.5;
  audio.pause();
  assert.equal(audio._progress, 3);
  audio.play(1);
  assert.deepEqual(starts, [
    [13, 0.25],
    [12, 0.25],
    [14.5, 3.25],
  ]);
  audio.stop();
  assert.equal(audio._progress, 0);
  assert.equal(audio.isPlaying, false);
});

test("looped pause wraps progress at an explicit duration and ended playback resets it", () => {
  const { audio, clock } = playback();
  audio.duration = 2;
  audio.setLoop(true);
  audio.play();
  clock.currentTime = 15.5;
  audio.pause();
  assert.equal(audio._progress, 1.5);
  audio.play();
  audio.onEnded();
  assert.equal(audio._progress, 0);
  assert.equal(audio.isPlaying, false);
});

test("audio clones share buffers but not progress, playback nodes or filter arrays", () => {
  const { audio, clock } = playback();
  audio.offset = 0.5;
  audio.setPlaybackRate(1.5);
  audio.play();
  clock.currentTime = 11;
  audio.pause();
  const clone = audio.clone();
  assert.equal(clone.buffer, audio.buffer);
  assert.equal(clone.offset, 0.5);
  assert.equal(clone.playbackRate, 1.5);
  assert.equal(clone._progress, 0);
  assert.equal(clone.source, null);
  assert.notEqual(clone.filters, audio.filters);
  assert.notEqual(clone.gain, audio.gain);
});

test("inherited audio clones use declared classes and keep the source listener", () => {
  class CustomAudio extends Audio {
    label: string = "audio";
  }
  class CustomPositionalAudio extends PositionalAudio {
    label: string = "positional";
  }
  const { audio, starts } = playback();
  const source = new CustomAudio(audio.listener).setBuffer(audio.buffer!);
  source.add(new Object3D());
  const clone: Audio = source.clone();
  assert.equal(clone.constructor, Audio);
  assert.equal("label" in clone, false);
  assert.equal(clone.listener, source.listener);
  assert.equal(clone.context, source.context);
  assert.notEqual(clone.children[0], source.children[0]);
  assert.equal(source.clone(false).children.length, 0);
  clone.play();
  assert.equal(starts.length, 1);
  assert.equal(source.isPlaying, false);
  assert.notEqual(clone.source, source.source);
  clone.stop();

  const positional = new CustomPositionalAudio(audio.listener).setBuffer(audio.buffer!);
  const positionalClone: PositionalAudio = positional.clone();
  assert.equal(positionalClone.constructor, PositionalAudio);
  assert.equal("label" in positionalClone, false);
  assert.equal(positionalClone.listener, positional.listener);
  assert.equal(positionalClone.context, positional.context);
  assert.notEqual(positionalClone.panner, positional.panner);
  assert.notEqual(positionalClone.gain, positional.gain);
  assert.equal(positionalClone.getOutput(), positionalClone.panner);
  assert.equal(positionalClone.panner.panningModel, "HRTF");
});

test("listener clones retain independent destination nodes, timers and recursive children", () => {
  class CustomListener extends AudioListener {
    label: string = "listener";
  }
  const { audio } = playback();
  const context = vi.spyOn(AudioContext, "getContext").mockReturnValue(audio.context);
  try {
    const listener = new CustomListener();
    listener.position.set(1, 2, 3);
    listener.add(new Object3D());
    const clone: AudioListener = listener.clone();
    assert.equal(clone.constructor, AudioListener);
    assert.equal("label" in clone, false);
    assert.equal(clone.context, listener.context);
    assert.notEqual(clone.gain, listener.gain);
    assert.equal(clone.getInput(), clone.gain);
    assert.notEqual(clone._timer, listener._timer);
    assert.deepEqual(clone.position.toArray(), [1, 2, 3]);
    assert.notEqual(clone.children[0], listener.children[0]);
    assert.equal(listener.clone(false).children.length, 0);
  } finally {
    context.mockRestore();
  }
});
