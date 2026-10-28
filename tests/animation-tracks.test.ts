import { test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { AnimationClip } from "../src/animation/AnimationClip";
import { KeyframeTrack } from "../src/animation/KeyframeTrack";
import { NumberKeyframeTrack } from "../src/animation/tracks/NumberKeyframeTrack";
import { VectorKeyframeTrack } from "../src/animation/tracks/VectorKeyframeTrack";
import { ColorKeyframeTrack } from "../src/animation/tracks/ColorKeyframeTrack";
import { QuaternionKeyframeTrack } from "../src/animation/tracks/QuaternionKeyframeTrack";
import { BooleanKeyframeTrack } from "../src/animation/tracks/BooleanKeyframeTrack";
import { StringKeyframeTrack } from "../src/animation/tracks/StringKeyframeTrack";
import {
  convertArray,
  getKeyframeOrder,
  sortedArray,
  flattenJSON,
  hasTangents,
  subclip,
  makeClipAdditive,
} from "../src/animation/AnimationUtils";
import { Interpolant } from "../src/math/Interpolant";
import {
  InterpolateDiscrete,
  InterpolateLinear,
  InterpolateSmooth,
  InterpolateBezier,
  AdditiveAnimationBlendMode,
} from "../src/constants";
import { AnimationClip as UpstreamClip } from "../upstream/three.js/src/animation/AnimationClip.js";
import { NumberKeyframeTrack as UpstreamNumber } from "../upstream/three.js/src/animation/tracks/NumberKeyframeTrack.js";
import { VectorKeyframeTrack as UpstreamVector } from "../upstream/three.js/src/animation/tracks/VectorKeyframeTrack.js";
import { ColorKeyframeTrack as UpstreamColor } from "../upstream/three.js/src/animation/tracks/ColorKeyframeTrack.js";
import { QuaternionKeyframeTrack as UpstreamQuaternion } from "../upstream/three.js/src/animation/tracks/QuaternionKeyframeTrack.js";
import { BooleanKeyframeTrack as UpstreamBoolean } from "../upstream/three.js/src/animation/tracks/BooleanKeyframeTrack.js";
import { StringKeyframeTrack as UpstreamString } from "../upstream/three.js/src/animation/tracks/StringKeyframeTrack.js";
import {
  subclip as upstreamSubclip,
  makeClipAdditive as upstreamMakeAdditive,
} from "../upstream/three.js/src/animation/AnimationUtils.js";

function data(clip: AnimationClip | UpstreamClip) {
  const { uuid: _uuid, ...json } = clip.toJSON();
  return json;
}

function samples(track: KeyframeTrack) {
  const interpolant = track.createInterpolant();
  return [-10, 0, 0.125, 0.5, 1, 1.875, 2, 10, 0.75, 0, 2].map((time) => Array.from(interpolant.evaluate(time)));
}

test("every track family preserves interpolation and non-monotonic boundary sampling upstream", () => {
  const tracks: [KeyframeTrack, KeyframeTrack][] = [
    [
      new VectorKeyframeTrack(".position", [0, 1, 2], [0, 1, 2, 3, 5, 7, 6, 9, 12]),
      new UpstreamVector(".position", [0, 1, 2], [0, 1, 2, 3, 5, 7, 6, 9, 12]) as unknown as KeyframeTrack,
    ],
    [
      new ColorKeyframeTrack(".color", [0, 1, 2], [0, 0, 0, 1, 0.5, 0.25, 1, 1, 1]),
      new UpstreamColor(".color", [0, 1, 2], [0, 0, 0, 1, 0.5, 0.25, 1, 1, 1]) as unknown as KeyframeTrack,
    ],
    [
      new QuaternionKeyframeTrack(".quaternion", [0, 1, 2], [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, -1]),
      new UpstreamQuaternion(
        ".quaternion",
        [0, 1, 2],
        [0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, -1],
      ) as unknown as KeyframeTrack,
    ],
    [
      new BooleanKeyframeTrack(".visible", [0, 1, 2], [true, false, true]),
      new UpstreamBoolean(".visible", [0, 1, 2], [true, false, true]) as unknown as KeyframeTrack,
    ],
    [
      new StringKeyframeTrack(".name", [0, 1, 2], ["first", "second", "last"]),
      new UpstreamString(".name", [0, 1, 2], ["first", "second", "last"]) as unknown as KeyframeTrack,
    ],
  ];
  for (const interpolation of [InterpolateDiscrete, InterpolateLinear, InterpolateSmooth]) {
    tracks.push([
      new NumberKeyframeTrack(".position[x]", [0, 1, 2], [1, 4, 2], interpolation),
      new UpstreamNumber(".position[x]", [0, 1, 2], [1, 4, 2], interpolation) as unknown as KeyframeTrack,
    ]);
  }
  for (const [actual, expected] of tracks) {
    assert.equal(actual.validate(), true);
    assert.deepEqual(samples(actual), samples(expected));
    assert.deepEqual(KeyframeTrack.toJSON(actual), KeyframeTrack.toJSON(expected));
    const clone = actual.clone();
    assert.equal(clone.constructor, actual.constructor);
    assert.notEqual(clone.times, actual.times);
    assert.notEqual(clone.values, actual.values);
    assert.deepEqual(samples(clone), samples(actual));
  }
  const quaternion = tracks[2][0].createInterpolant().evaluate(0.5);
  assert.ok(Math.abs(Math.hypot(...(Array.from(quaternion) as number[])) - 1) < 1e-6);
});

test("track defaults remain inherited and writable without hiding prototype factories", () => {
  class CustomTrack extends NumberKeyframeTrack {}
  CustomTrack.prototype.ValueBufferType = Float64Array;
  CustomTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
  const settings = { inTangents: [0, 2, 1, 4], outTangents: [0, 2, 1, 4] };
  CustomTrack.prototype.settings = settings;
  const track = new CustomTrack(".position[x]", [0, 1], [2, 4]);
  assert.ok(track.values instanceof Float64Array);
  assert.equal(track.getInterpolation(), InterpolateDiscrete);
  assert.equal(Object.hasOwn(track, "ValueBufferType"), false);
  assert.equal(track.settings, settings);
  assert.equal(Object.hasOwn(track, "settings"), false);
  track.settings = {};
  assert.equal(CustomTrack.prototype.settings, settings);
  assert.equal(Object.hasOwn(track, "DefaultInterpolation"), false);
  assert.equal(Object.hasOwn(track, "InterpolantFactoryMethodDiscrete"), false);
  assert.deepEqual(Array.from(track.createInterpolant().evaluate(0.5)), [2]);
  track.ValueBufferType = Array;
  assert.equal(Object.hasOwn(track, "ValueBufferType"), true);
  assert.equal(CustomTrack.prototype.ValueBufferType, Float64Array);
  assert.equal(new NumberKeyframeTrack(".x", [0], [1]).ValueBufferType, Float32Array);
  const bool = new BooleanKeyframeTrack(".visible", [0, 1], [true, false]);
  const string = new StringKeyframeTrack(".name", [0, 1], ["a", "b"]);
  const quaternion = new QuaternionKeyframeTrack(".quaternion", [0], [0, 0, 0, 1]);
  assert.deepEqual(Array.from(quaternion.createInterpolant().evaluate(0.5)), [0, 0, 0, 1]);
  assert.deepEqual(Array.from(bool.createInterpolant().evaluate(0.5)), [true]);
  assert.deepEqual(Array.from(string.createInterpolant().evaluate(0.5)), ["a"]);
});

test("base track conversion cannot promise an arbitrary generic value array", () => {
  // @ts-expect-error The runtime buffer constructor, not a type argument, determines conversion.
  const base = new KeyframeTrack<string[]>(".name", [0], ["7"]);
  assert.ok(base.values instanceof Float32Array);
  assert.equal(base.values[0], 7);

  const stringTrack = new StringKeyframeTrack(".name", [0, 1], ["first", "last"]);
  const strings: string[] = stringTrack.values;
  assert.equal(strings[0].trim(), "first");
  stringTrack.values = ["new", "value"];
  assert.deepEqual(stringTrack.clone().trim(1, 1).values, ["value"]);
  const boolTrack = new BooleanKeyframeTrack(".visible", [0, 1], [true, false]);
  const booleans: boolean[] = boolTrack.values;
  assert.deepEqual(booleans, [true, false]);
  boolTrack.values = [false, true];
  assert.deepEqual(boolTrack.clone().values, [false, true]);
  for (const track of [base, stringTrack, boolTrack]) {
    assert.deepEqual(Object.getOwnPropertyDescriptor(track, "values"), {
      value: track.values,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    assert.equal(Object.keys(track).includes("values"), true);
    assert.equal(Object.hasOwn(track, "_values"), false);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(stringTrack)).values, ["new", "value"]);
});

test("Bezier tangent interpolation, time transforms, cloning and serialization match upstream", () => {
  const json = {
    name: "curve",
    duration: 2,
    uuid: "bezier-fixture",
    blendMode: 2500,
    tracks: [
      {
        name: ".position[x]",
        type: "number",
        times: [0, 1, 2],
        values: [0, 2, 1],
        interpolation: InterpolateBezier,
        settings: { inTangents: [0, 0, 0.7, 2, 1.6, 1], outTangents: [0.3, 0, 1.4, 2, 2, 1] },
      },
    ],
  };
  const actual = AnimationClip.parse(structuredClone(json));
  const expected = UpstreamClip.parse(structuredClone(json)) as unknown as AnimationClip;
  for (const clip of [actual, expected]) {
    assert.equal(clip.validate(), true);
    const clone = clip.clone();
    assert.notEqual(clone.tracks[0].settings!.inTangents, clip.tracks[0].settings!.inTangents);
    clone.tracks[0].shift(2).scale(0.5);
    assert.deepEqual(Array.from(clone.tracks[0].times), [1, 1.5, 2]);
    assert.deepEqual(samples(AnimationClip.parse(clip.toJSON()).tracks[0]), samples(clip.tracks[0]));
  }
  assert.deepEqual(samples(actual.tracks[0]), samples(expected.tracks[0]));
  assert.deepEqual(data(actual), data(expected));
  actual.tracks[0].shift(-0.5).scale(2);
  expected.tracks[0].shift(-0.5).scale(2);
  assert.deepEqual(data(actual), data(expected));
  assert.deepEqual(samples(actual.tracks[0]), samples(expected.tracks[0]));
});

test("track validation, trimming, optimization and one-key tracks retain upstream boundaries", () => {
  for (const Track of [NumberKeyframeTrack, UpstreamNumber as unknown as typeof NumberKeyframeTrack]) {
    assert.throws(() => new Track(".position[x]", [], []), /no keyframes/);
    assert.throws(() => new Track(undefined as unknown as string, [0], [1]), /undefined/);
    const track = new Track(".position[x]", [0, 1, 1, 2, 3], [0, 0, 0, 0, 3]);
    track.optimize();
    assert.deepEqual(Array.from(track.times), [0, 2, 3]);
    track.trim(10, 20);
    assert.deepEqual(Array.from(track.times), [3]);
    assert.deepEqual(
      samples(track),
      Array.from({ length: 11 }, () => [3]),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      assert.equal(new Track(".x", [1, 0], [1, 2]).validate(), false);
      assert.equal(new Track(".x", [0, 1], [1, NaN]).validate(), false);
      assert.equal(new Track(".x", [0, 1], [1, 2]).setInterpolation(-1).getInterpolation(), InterpolateLinear);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  }
  const abstract = new Interpolant([0, 1], [0, 1], 1);
  assert.throws(() => abstract.evaluate(0.5), /abstract method/);
});

test("clip round-trips every track, legacy keys, fps, userdata and malformed track boundaries", () => {
  const clip = new AnimationClip("mixed", -1, [
    new NumberKeyframeTrack(".position[x]", [0, 2], [0, 3]),
    new VectorKeyframeTrack(".position", [0, 2], [0, 0, 0, 1, 2, 3]),
    new ColorKeyframeTrack(".color", [0, 2], [0, 0, 0, 1, 1, 1]),
    new QuaternionKeyframeTrack(".quaternion", [0, 2], [0, 0, 0, 1, 0, 1, 0, 0]),
    new BooleanKeyframeTrack(".visible", [0, 2], [true, false]),
    new StringKeyframeTrack(".name", [0, 2], ["a", "b"]),
  ]);
  clip.userData = { nested: { value: 1 } };
  assert.equal(clip.duration, 2);
  assert.equal(clip.validate(), true);
  const clone = clip.clone();
  assert.notEqual(clone.userData, clip.userData);
  assert.notEqual(clone.userData.nested, clip.userData.nested);
  const roundtrip = AnimationClip.parse(clip.toJSON());
  assert.deepEqual(roundtrip.toJSON(), clip.toJSON());
  assert.deepEqual(
    roundtrip.tracks.map((track) => track.constructor),
    clip.tracks.map((track) => track.constructor),
  );
  assert.equal(AnimationClip.findByName([clip], "mixed"), clip);
  assert.equal(AnimationClip.findByName([clip], "missing"), null);
  for (const Clip of [AnimationClip, UpstreamClip as unknown as typeof AnimationClip]) {
    const legacy = Clip.parse({
      name: "legacy",
      fps: 30,
      tracks: [
        {
          name: ".position[x]",
          type: "scalar",
          keys: [
            { time: 0, value: 2 },
            { time: 30, value: 4 },
          ],
        },
      ],
    });
    assert.deepEqual(Array.from(legacy.tracks[0].times), [0, 1]);
    assert.deepEqual(Array.from(legacy.tracks[0].values), [2, 4]);
    assert.throws(
      () => Clip.parse({ tracks: [{ name: ".x", type: "unknown", times: [0], values: [1] }] }),
      /Unsupported typeName/,
    );
    assert.throws(() => Clip.parse({ tracks: [{ name: ".x", times: [0], values: [1] }] }), /type undefined/);
    const trimmed = clip.clone();
    trimmed.duration = 1;
    trimmed.trim().optimize().resetDuration();
    assert.equal(trimmed.duration, 0);
  }
});

test("defining animation utility functions preserve sorting, flattening and array ownership", () => {
  const typed = new Float32Array([1, 2]);
  assert.equal(convertArray(typed, Float32Array), typed);
  assert.deepEqual(convertArray(typed, Array), [1, 2]);
  assert.deepEqual(convertArray([1, 2], Float32Array), typed);
  assert.deepEqual(getKeyframeOrder([2, 0, 1]), [1, 2, 0]);
  assert.deepEqual(
    sortedArray(new Float32Array([20, 21, 0, 1, 10, 11]), 2, [1, 2, 0]),
    new Float32Array([0, 1, 10, 11, 20, 21]),
  );
  const times: number[] = [],
    values: number[] = [];
  flattenJSON([{ time: 0, value: [1, 2] }, { time: 1 }, { time: 2, value: [3, 4] }], times, values, "value");
  assert.deepEqual(times, [0, 2]);
  assert.deepEqual(values, [1, 2, 3, 4]);
  assert.equal(hasTangents(undefined), false);
  assert.equal(hasTangents({ inTangents: typed, outTangents: typed }), true);
});

test("subclip, additive conversion and morph sequence creation match upstream without mutating source", () => {
  const clip = new AnimationClip("source", -1, [
    new NumberKeyframeTrack(".position[x]", [0, 1, 2, 3], [2, 4, 8, 10]),
    new QuaternionKeyframeTrack(".quaternion", [0, 1, 2, 3], [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1, 0]),
    new BooleanKeyframeTrack(".visible", [0, 3], [true, false]),
  ]);
  const original = clip.toJSON();
  assert.deepEqual(data(subclip(clip, "part", 30, 90)), data(upstreamSubclip(clip, "part", 30, 90)));
  const cut = subclip(clip, "part", 30, 90);
  assert.deepEqual(Array.from(cut.tracks[0].times), [0, 1]);
  assert.equal(cut.tracks.length, 2);
  for (const frame of [-1, 15, 120]) {
    const actual = makeClipAdditive(clip.clone(), frame, clip);
    const expected = upstreamMakeAdditive(clip.clone(), frame, clip);
    assert.equal(actual.blendMode, AdditiveAnimationBlendMode);
    assert.deepEqual(data(actual), data(expected));
    assert.deepEqual(Array.from(actual.tracks[2].values), [true, false]);
  }
  assert.deepEqual(clip.toJSON(), original);
  for (const noLoop of [false, true]) {
    const sequence = [{ name: "walk01" }, { name: "walk02" }, { name: "walk03" }];
    assert.deepEqual(
      data(AnimationClip.CreateFromMorphTargetSequence("walk", sequence, 30, noLoop)),
      data(UpstreamClip.CreateFromMorphTargetSequence("walk", sequence, 30, noLoop)),
    );
    assert.deepEqual(
      AnimationClip.CreateClipsFromMorphTargetSequences(sequence, 30, noLoop).map(data),
      UpstreamClip.CreateClipsFromMorphTargetSequences(sequence, 30, noLoop).map(data),
    );
  }
});
