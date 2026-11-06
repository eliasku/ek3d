import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Lut } from "../src/addons/math/Lut";

test("lookup maps clamp and interpolate across the configured range", () => {
  const lut = new Lut("grayscale", 10).setMin(100).setMax(200);
  assert.equal(lut.lut.length, 11);
  assert.equal(lut.getColor(0).getHex(), 0x000000);
  assert.equal(lut.getColor(250).getHex(), 0xffffff);
  assert.ok(lut.getColor(150).r > 0.49 && lut.getColor(150).r < 0.51);
});

test("custom maps and copy preserve upstream lookup behavior", () => {
  const lut = new Lut()
    .addColorMap("test-linear", [
      [0, 0x000000],
      [1, 0xff0000],
    ])
    .setColorMap("test-linear", 4);
  assert.equal(lut.getColor(0.5).r, 0.5);
  const copied = new Lut().copy(lut);
  assert.notEqual(copied.getColor(0.5), lut.getColor(0.5));
  assert.deepEqual(copied.getColor(0.5), lut.getColor(0.5));
  copied.getColor(0.5).setRGB(0, 1, 0);
  assert.deepEqual(lut.getColor(0.5).toArray(), [0.5, 0, 0]);
  lut.getColor(0).setRGB(1, 1, 1);
  assert.deepEqual(copied.getColor(0).toArray(), [0, 0, 0]);
  assert.equal(new Lut("missing").map, new Lut("rainbow").map);
});
