import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { earcut, deviation, flatten, refine } from "../src/extras/lib/earcut";

test("touching holes preserve polygon area in every axis-aligned rotation", () => {
  const rings = [
    [
      [0, 0],
      [20, 0],
      [20, 25],
      [0, 25],
      [0, 0],
    ],
    [
      [3, 3],
      [2, 12],
      [9, 15],
      [3, 3],
    ],
    [
      [9, 21],
      [2, 12],
      [7, 22],
      [9, 21],
    ],
  ];
  for (const [xx, xy, yx, yy] of [
    [1, 0, 0, 1],
    [0, -1, 1, 0],
    [-1, 0, 0, -1],
    [0, 1, -1, 0],
  ]) {
    const rotated = rings.map((ring) => ring.map(([x, y]) => [xx * x + xy * y, yx * x + yy * y]));
    const { vertices, holes, dimensions } = flatten(rotated);
    const triangles = earcut(vertices, holes, dimensions);
    assert.equal(triangles.length / 3, 10);
    assert.equal(deviation(vertices, holes, dimensions, triangles), 0);
  }
});

test("hashed triangulation includes the first vertex in its bounds across repeated calls", () => {
  const vertices = [0, 200];
  for (let x = 5; x <= 200; x += 5) vertices.push(x, 200);
  vertices.push(200, 100);
  for (let x = 205; x <= 400; x += 5) vertices.push(x, 100);
  vertices.push(400, 200);
  for (const data of [vertices, vertices.map((value) => -value), vertices]) {
    const triangles = earcut(new Float64Array(data));
    assert.equal(triangles.length / 3, 41);
    assert.equal(deviation(data, null, 2, triangles), 0);
    const steiner = [0, 0, 4, 0, 4, 4, 0, 4, 2, 2];
    const withSteiner = earcut(steiner, [4]);
    assert.ok(withSteiner.includes(4));
    assert.equal(deviation(steiner, [4], 2, withSteiner), 0);
  }
});

test("deviation distinguishes collinear roundoff from missing polygon coverage", () => {
  const vertices = [0.1, 0.2, 1.3, 2.6, 2.5, 5, 3.7, 7.4];
  const triangles = earcut(vertices);
  assert.deepEqual(triangles, []);
  assert.equal(deviation(vertices, null, 2, triangles), 0);
  assert.equal(deviation([0, 0, 1, 0, 0, 1], null, 2, []), 1);
});

test("refine replaces a bad interior diagonal without changing polygon coverage", () => {
  const vertices = [0, 0, 3, 0, 10, 1, 0, 2];
  const triangles = [2, 3, 0, 2, 0, 1];
  refine(triangles, new Float64Array(vertices));
  assert.deepEqual(triangles, [2, 3, 1, 3, 0, 1]);
  assert.equal(deviation(vertices, null, 2, triangles), 0);
  const refined = triangles.slice();
  refine(triangles, vertices);
  assert.deepEqual(triangles, refined);
});

test("refine terminates on near-cocircular points and preserves their area", () => {
  const vertices = [
    127.65906365022843, 9.336137742499535, 124.21725103117963, 30.888097161477972, 91.35514946628345, 89.65621376119454,
    40.10446780041529, 121.5550560957686, -110.83205604043928, 64.03323632184248, -127.20394987965459,
    -14.253249980770189, 61.074962259031416, -112.48932831632469, 127.37846573978545, -12.598669206638515,
    127.77010311801033, -7.668164657400608,
  ];
  const triangles = earcut(vertices);
  refine(triangles, vertices);
  assert.equal(triangles.length / 3, 7);
  assert.ok(deviation(vertices, null, 2, triangles) < 1e-15);
}, 5000);
