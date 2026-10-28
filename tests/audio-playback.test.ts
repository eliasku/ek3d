import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Audio } from "../src/audio/Audio";
import type { AudioListener } from "../src/audio/AudioListener";

function playback(): { audio: Audio; clock: { currentTime: number }; starts: number[][] } {
  const clock = { currentTime: 10 };
  const starts: number[][] = [];
  const parameter = { setTargetAtTime: () => {} };
  const context = {
    get currentTime() {
      return clock.currentTime;
    },
    createGain: () => ({ connect: () => {}, gain: parameter }),
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
