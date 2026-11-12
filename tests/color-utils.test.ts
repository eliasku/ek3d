import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { setKelvin } from "../src/addons/utils/ColorUtils";
import { Color } from "../src/math/Color";

test("Kelvin colors clamp to the supported range", () => {
  const low = setKelvin(new Color(), 1);
  assert.deepEqual(low.toArray(), setKelvin(new Color(), 1000).toArray());
  assert.equal(low.b, 0);
  assert.deepEqual(setKelvin(new Color(), 50000).toArray(), setKelvin(new Color(), 40000).toArray());
});
