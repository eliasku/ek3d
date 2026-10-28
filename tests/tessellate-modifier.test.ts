import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { TessellateModifier } from "../src/addons/modifiers/TessellateModifier";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";

test("tessellation splits the longest edge and interpolates attributes", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 4, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const result = new TessellateModifier(2, 1).modify(geometry);
  assert.deepEqual(
    Array.from((result.getAttribute("position") as Float32BufferAttribute).array),
    [0, 0, 0, 4, 0, 0, 2, 0.5, 0, 2, 0.5, 0, 0, 1, 0, 0, 0, 0],
  );
  assert.deepEqual(
    Array.from((result.getAttribute("uv") as Float32BufferAttribute).array),
    [0, 0, 1, 0, 0.5, 0.5, 0.5, 0.5, 0, 1, 0, 0],
  );
});
