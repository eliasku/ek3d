import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { parseSVGPath } from "../src/addons/loaders/SVGPath";
import { SVGLoader } from "../src/addons/loaders/SVGLoader";

test("relative commands and close restart at the initial point", () => {
  const path = parseSVGPath("M1 2 l4 0 0 3 z l2 1")!;
  assert.equal(path.subPaths.length, 2);
  assert.equal(path.subPaths[0].autoClose, true);
  assert.deepEqual(
    path.subPaths[1].getPoints().map(({ x, y }) => [x, y]),
    [
      [1, 2],
      [3, 3],
    ],
  );
});

test("arc flags can be adjacent and evenodd paths form holes", () => {
  const arc = parseSVGPath("M0 0 A10 10 0 0110 10")!;
  const points = arc.subPaths[0].getPoints();
  assert.ok(Math.abs(points[points.length - 1].x - 10) < 1e-9);
  assert.ok(Math.abs(points[points.length - 1].y - 10) < 1e-9);
  const path = parseSVGPath("M0 0 H10 V10 H0 Z M2 2 H8 V8 H2 Z")!;
  path.userData.style = { fillRule: "evenodd" };
  const shapes = SVGLoader.createShapes(path);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].holes.length, 1);
});

test("consecutive semicircular arcs preserve curve and sample structure", () => {
  const path = parseSVGPath("M1 0 A1 1 0 0 1 -1 0 1 1 0 0 1 1 0")!;
  assert.equal(path.subPaths[0].curves.length, 2);
  assert.equal(path.subPaths[0].getPoints().length, 49);
});

test("SVG paths reject a repeated separator", () => {
  assert.throws(() => parseSVGPath("M1,,2"), SyntaxError);
});
