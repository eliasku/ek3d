import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { IESLoader } from "../src/addons/loaders/IESLoader";
import { TextureType } from "../src/constants";
import { fromHalfFloat } from "../src/extras/DataUtils";

function profile(horizontal: number[], rows: number[][]): string {
  return [
    "IESNA:LM-63-1995",
    "TILT=NONE",
    `1 1000 2 2 ${horizontal.length} 1 1 0 0 0`,
    "1 1 10",
    "0 180",
    horizontal.join(" "),
    ...rows.map((row) => row.join(" ")),
  ].join("\n");
}

test("IES samples rotationally symmetric profiles and encodes each supported texture type", () => {
  const loader = new IESLoader();
  for (const type of [TextureType.Float, TextureType.HalfFloat, TextureType.UnsignedByte]) {
    loader.type = type;
    const texture = loader.parse(profile([0], [[10, 0]]));
    assert.equal(texture.image.width, 180);
    assert.equal(texture.image.height, 1);
    const data = texture.image.data!;
    assert.equal(
      type === TextureType.HalfFloat ? fromHalfFloat(data[0]) : data[0],
      type === TextureType.UnsignedByte ? 255 : 1,
    );
    assert.equal(data[179], 0);
    const sample =
      type === TextureType.HalfFloat
        ? fromHalfFloat(data[90])
        : type === TextureType.UnsignedByte
          ? data[90] / 255
          : data[90];
    assert.ok(Math.abs(sample - 89 / 179) < (type === TextureType.UnsignedByte ? 1 / 255 : 0.001));
    texture.dispose();
  }
});

test("IES mirrors partial horizontal ranges and shifts nonzero starting angles", () => {
  const loader = new IESLoader();
  loader.type = TextureType.Float;
  const texture = loader.parse(
    profile(
      [90, 180],
      [
        [10, 10],
        [0, 0],
      ],
    ),
  );
  const data = texture.image.data!;
  for (const [angle, expected] of [
    [0, 1],
    [45, 0.5],
    [90, 0],
    [135, 0.5],
    [180, 1],
    [270, 0],
  ]) {
    assert.equal(data[angle * 180], expected);
  }
  texture.dispose();
});

test("IES closes asymmetric profiles that omit the final repeated horizontal angle", () => {
  const loader = new IESLoader();
  loader.type = TextureType.Float;
  const texture = loader.parse(
    profile(
      [0, 180, 270],
      [
        [10, 10],
        [0, 0],
        [5, 5],
      ],
    ),
  );
  const data = texture.image.data!;
  assert.equal(data[315 * 180], 0.75);
  assert.ok(Math.abs(data[359 * 180] - (0.5 + (0.5 * 89) / 90)) < 1e-6);
  texture.dispose();
});

test("IES rejects missing, truncated and unsupported records instead of hanging", () => {
  const loader = new IESLoader();
  assert.throws(() => loader.parse("no photometric data"), /Missing TILT/);
  assert.throws(() => loader.parse("TILT=NONE\n1 2"), /truncated/);
  assert.throws(() => loader.parse("TILT=external.tlt"), /External tilt/);
  // @ts-expect-error Exercise rejection of an unsupported texture type.
  loader.type = 0;
  assert.throws(() => loader.parse(profile([0], [[1, 0]])), /Unsupported type/);
});
