import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { SVGStroke } from "../src/addons/utils/SVGStroke";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { Vector2 } from "../src/math/Vector2";

test("stroke tessellation produces a centered rectangle with normals and UVs", () => {
  const style = SVGStroke.getStrokeStyle(2, "red");
  assert.deepEqual(style, {
    strokeColor: "red",
    strokeWidth: 2,
    strokeLineJoin: "miter",
    strokeLineCap: "butt",
    strokeMiterLimit: 4,
  });
  const geometry = SVGStroke.pointsToStroke([new Vector2(0, 0), new Vector2(10, 0)], style)!;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  assert.ok(position instanceof BufferAttribute);
  assert.ok(normal instanceof BufferAttribute);
  assert.ok(uv instanceof BufferAttribute);
  assert.deepEqual(Array.from(position.array), [0, 1, 0, 0, -1, 0, 10, -1, 0, 0, 1, 0, 10, -1, 0, 10, 1, 0]);
  assert.equal(normal.count, 6);
  assert.equal(uv.count, 6);
  geometry.dispose();
  assert.equal(SVGStroke.pointsToStroke([new Vector2()], style), null);
});

test("closed contours, duplicate points, joins and caps generate finite geometry", () => {
  const corners = [new Vector2(0, 0), new Vector2(10, 0), new Vector2(10, 10), new Vector2(0, 0)];
  for (const join of ["miter", "miter-clip", "bevel", "round"]) {
    const style = SVGStroke.getStrokeStyle(2, "black", join, "butt", 1);
    const geometry = SVGStroke.pointsToStroke(corners, style)!;
    const position = geometry.getAttribute("position");
    assert.ok(position instanceof BufferAttribute);
    assert.ok(position.count >= 18);
    assert.ok(Array.from(position.array).every(Number.isFinite));
    geometry.dispose();
  }
  const open = [new Vector2(0, 0), new Vector2(5, 0), new Vector2(5, 0), new Vector2(10, 0)];
  const rounded = SVGStroke.pointsToStroke(open, SVGStroke.getStrokeStyle(2, "black", "round", "round"))!;
  const position = rounded.getAttribute("position");
  assert.ok(position instanceof BufferAttribute);
  assert.ok(position.count > 12);
  assert.ok(Array.from(position.array).every(Number.isFinite));
  rounded.dispose();
});
