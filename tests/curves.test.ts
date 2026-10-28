import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { Vector2 } from "../src/math/Vector2";
import { Vector3 } from "../src/math/Vector3";
import { type Curve, type CurveJSON } from "../src/extras/core/Curve";
import { CurvePath } from "../src/extras/core/CurvePath";
import { Path } from "../src/extras/core/Path";
import { Shape } from "../src/extras/core/Shape";
import { ShapePath } from "../src/extras/core/ShapePath";
import { ArcCurve } from "../src/extras/curves/ArcCurve";
import { EllipseCurve } from "../src/extras/curves/EllipseCurve";
import { LineCurve } from "../src/extras/curves/LineCurve";
import { LineCurve3 } from "../src/extras/curves/LineCurve3";
import { QuadraticBezierCurve } from "../src/extras/curves/QuadraticBezierCurve";
import { QuadraticBezierCurve3 } from "../src/extras/curves/QuadraticBezierCurve3";
import { CubicBezierCurve } from "../src/extras/curves/CubicBezierCurve";
import { CubicBezierCurve3 } from "../src/extras/curves/CubicBezierCurve3";
import { SplineCurve } from "../src/extras/curves/SplineCurve";
import { CatmullRomCurve3 } from "../src/extras/curves/CatmullRomCurve3";
import { Vector2 as UVector2 } from "../upstream/three.js/src/math/Vector2.js";
import { Vector3 as UVector3 } from "../upstream/three.js/src/math/Vector3.js";
import { CurvePath as UCurvePath } from "../upstream/three.js/src/extras/core/CurvePath.js";
import { Path as UPath } from "../upstream/three.js/src/extras/core/Path.js";
import { Shape as UShape } from "../upstream/three.js/src/extras/core/Shape.js";
import { ShapePath as UShapePath } from "../upstream/three.js/src/extras/core/ShapePath.js";
import { ArcCurve as UArc } from "../upstream/three.js/src/extras/curves/ArcCurve.js";
import { EllipseCurve as UEllipse } from "../upstream/three.js/src/extras/curves/EllipseCurve.js";
import { LineCurve as ULine } from "../upstream/three.js/src/extras/curves/LineCurve.js";
import { LineCurve3 as ULine3 } from "../upstream/three.js/src/extras/curves/LineCurve3.js";
import { QuadraticBezierCurve as UQuadratic } from "../upstream/three.js/src/extras/curves/QuadraticBezierCurve.js";
import { QuadraticBezierCurve3 as UQuadratic3 } from "../upstream/three.js/src/extras/curves/QuadraticBezierCurve3.js";
import { CubicBezierCurve as UCubic } from "../upstream/three.js/src/extras/curves/CubicBezierCurve.js";
import { CubicBezierCurve3 as UCubic3 } from "../upstream/three.js/src/extras/curves/CubicBezierCurve3.js";
import { SplineCurve as USpline } from "../upstream/three.js/src/extras/curves/SplineCurve.js";
import { CatmullRomCurve3 as UCatmullRom } from "../upstream/three.js/src/extras/curves/CatmullRomCurve3.js";

function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, entry: unknown) => (key === "uuid" ? undefined : entry)));
}

type SampleCurve = {
  getPoints(divisions: number): ({ toArray(): number[] } | null)[];
  getSpacedPoints(divisions: number): ({ toArray(): number[] } | null)[];
  getLength(): number;
};

function samples(curve: SampleCurve) {
  return {
    points: curve.getPoints(9).map((point) => point?.toArray()),
    spaced: curve.getSpacedPoints(11).map((point) => point?.toArray()),
    length: curve.getLength(),
  };
}

function createCurve(json: CurveJSON): Curve<Vector2 | null> {
  switch (json.type) {
    case "CurvePath":
      return new CurvePath<Vector2>().fromJSON(json, createCurve);
    case "Path":
      return new Path().fromJSON(json, createCurve);
    case "Shape":
      return new Shape().fromJSON(json, createCurve);
    case "LineCurve":
      return new LineCurve().fromJSON(json);
    case "ArcCurve":
      return new ArcCurve().fromJSON(json);
    case "EllipseCurve":
      return new EllipseCurve().fromJSON(json);
    case "QuadraticBezierCurve":
      return new QuadraticBezierCurve().fromJSON(json);
    case "CubicBezierCurve":
      return new CubicBezierCurve().fromJSON(json);
    case "SplineCurve":
      return new SplineCurve().fromJSON(json);
    default:
      throw new Error(`Unsupported curve: ${json.type}`);
  }
}

test("curve families preserve upstream sampling, tangents, targets, JSON and independent control points", () => {
  const p2 = [new Vector2(-2, 1), new Vector2(-0.5, 3), new Vector2(2, -1), new Vector2(4, 2)];
  const u2 = p2.map((p) => new UVector2(p.x, p.y));
  const p3 = p2.map((p, i) => new Vector3(p.x, p.y, i % 2 ? 2 : -1));
  const u3 = p3.map((p) => new UVector3(p.x, p.y, p.z));
  const cases = [
    [new ArcCurve(1, -2, 3, 0.4, 5.2, true), new UArc(1, -2, 3, 0.4, 5.2, true)],
    [new EllipseCurve(1, -2, 3, 1.2, -0.7, 4.1, false, 0.6), new UEllipse(1, -2, 3, 1.2, -0.7, 4.1, false, 0.6)],
    [new EllipseCurve(0, 0, 2, 1, 0, Math.PI * 2, true), new UEllipse(0, 0, 2, 1, 0, Math.PI * 2, true)],
    [new EllipseCurve(0, 0, 2, 1, 0.3, 0.3), new UEllipse(0, 0, 2, 1, 0.3, 0.3)],
    [new LineCurve(p2[0], p2[3]), new ULine(u2[0], u2[3])],
    [new LineCurve3(p3[0], p3[3]), new ULine3(u3[0], u3[3])],
    [new QuadraticBezierCurve(p2[0], p2[1], p2[3]), new UQuadratic(u2[0], u2[1], u2[3])],
    [new QuadraticBezierCurve3(p3[0], p3[1], p3[3]), new UQuadratic3(u3[0], u3[1], u3[3])],
    [new CubicBezierCurve(p2[0], p2[1], p2[2], p2[3]), new UCubic(u2[0], u2[1], u2[2], u2[3])],
    [new CubicBezierCurve3(p3[0], p3[1], p3[2], p3[3]), new UCubic3(u3[0], u3[1], u3[2], u3[3])],
    [new SplineCurve(p2), new USpline(u2)],
  ] as const;
  const catmullCases = (["centripetal", "chordal", "catmullrom"] as const).flatMap((type) =>
    [false, true].map(
      (closed) =>
        [
          new CatmullRomCurve3([p3[0], p3[1], p3[1].clone(), p3[2], p3[3]], closed, type, 0.3),
          new UCatmullRom([u3[0], u3[1], u3[1].clone(), u3[2], u3[3]], closed, type, 0.3),
        ] as const,
    ),
  );
  for (const [actual, expected] of [...cases, ...catmullCases]) {
    actual.arcLengthDivisions = expected.arcLengthDivisions = 64;
    assert.deepEqual(samples(actual), samples(expected), actual.type);
    for (const t of [0, 0.17, 0.5, 0.83, 1]) {
      assert.deepEqual(actual.getTangent(t).toArray(), expected.getTangent(t).toArray(), actual.type);
      assert.deepEqual(actual.getTangentAt(t).toArray(), expected.getTangentAt(t).toArray(), actual.type);
      assert.equal(actual.getUtoTmapping(t), expected.getUtoTmapping(t));
    }
    assert.equal(
      actual.getUtoTmapping(0, actual.getLength() * 0.4),
      expected.getUtoTmapping(0, expected.getLength() * 0.4),
    );
    assert.deepEqual(jsonValue(actual.toJSON()), jsonValue(expected.toJSON()));
    const clone = actual.clone();
    assert.equal(clone.constructor, actual.constructor);
    assert.deepEqual(samples(clone), samples(actual));
    assert.deepEqual(samples(clone.fromJSON(JSON.parse(JSON.stringify(actual.toJSON())))), samples(actual));
    const before = jsonValue(actual.toJSON());
    for (const key of ["v0", "v1", "v2", "v3", "points"]) {
      const value: unknown = Reflect.get(clone, key);
      const original: unknown = Reflect.get(actual, key);
      if (value instanceof Vector2 || value instanceof Vector3) {
        assert.notEqual(value, original);
        value.x += 10;
      } else if (Array.isArray(value)) {
        assert.notEqual(value, original);
        for (const point of value) point.x += 10;
      }
    }
    assert.deepEqual(jsonValue(actual.toJSON()), before);
  }
  const target2 = new Vector2();
  const target3 = new Vector3();
  const line2 = new LineCurve(p2[0], p2[3]);
  const cubic3 = new CubicBezierCurve3(p3[0], p3[1], p3[2], p3[3]);
  assert.equal(line2.getPoint(0.3, target2), target2);
  assert.equal(line2.getTangentAt(0.3, target2), target2);
  assert.equal(cubic3.getPointAt(0.3, target3), target3);
  assert.equal(cubic3.getTangent(0.3, target3), target3);
});

test("curve and composite length caches update after edits and closing preserves dimensionality", () => {
  const curve = new QuadraticBezierCurve(new Vector2(), new Vector2(1, 2), new Vector2(3, 0));
  const upstream = new UQuadratic(new UVector2(), new UVector2(1, 2), new UVector2(3, 0));
  const path = new CurvePath<Vector2>();
  const upstreamPath = new UCurvePath();
  path.add(curve);
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamPath.add(upstream);
  const before = path.getLength();
  assert.equal(path.getLength(), upstreamPath.getLength());
  curve.v1.y = upstream.v1.y = 5;
  curve.updateArcLengths();
  upstream.updateArcLengths();
  path.updateArcLengths();
  upstreamPath.updateArcLengths();
  assert.notEqual(path.getLength(), before);
  assert.deepEqual(samples(path), samples(upstreamPath));
  assert.deepEqual(curve.getLengths(7), upstream.getLengths(7));
  assert.deepEqual(curve.getLengths(17), upstream.getLengths(17));
  path.add(new LineCurve(new Vector2(3, 0), new Vector2(4, 2)));
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamPath.add(new ULine(new UVector2(3, 0), new UVector2(4, 2)));
  assert.deepEqual(samples(path), samples(upstreamPath));
  path.autoClose = upstreamPath.autoClose = true;
  assert.deepEqual(samples(path), samples(upstreamPath));
  path.closePath().closePath();
  upstreamPath.closePath().closePath();
  assert.equal(path.curves.length, 3);
  assert.deepEqual(samples(path), samples(upstreamPath));
  const spatial = new CurvePath<Vector3>();
  const upstreamSpatial = new UCurvePath();
  spatial.add(new LineCurve3(new Vector3(), new Vector3(2, 1, 3)));
  // @ts-expect-error Upstream's abstract getPoint JSDoc omits its arguments.
  upstreamSpatial.add(new ULine3(new UVector3(), new UVector3(2, 1, 3)));
  spatial.closePath();
  upstreamSpatial.closePath();
  assert.equal(spatial.curves[1].type, "LineCurve3");
  assert.deepEqual(samples(spatial), samples(upstreamSpatial));
  assert.equal(new CurvePath().getPoint(0.5), null);
});

test("paths and shapes preserve construction, independent holes and recursive caller-owned JSON dispatch", () => {
  const path = new Path();
  const upstream = new UPath();
  for (const value of [path, upstream]) {
    value.moveTo(-2, 0).lineTo(-1, 1).quadraticCurveTo(0, 3, 1, 1).bezierCurveTo(2, 2, 3, -1, 4, 0);
    value.arc(0.5, 0, 0.5, Math.PI, 0, false).absarc(5, 2, 0.7, 0, Math.PI, true);
    value.ellipse(0, 1, 1, 0.5, 0, Math.PI, false, 0.2).absellipse(1, 2, 2, 1, 0.2, 3, true, 0.4);
  }
  path.splineThru([new Vector2(0, 2), new Vector2(-2, 0)]);
  upstream.splineThru([new UVector2(0, 2), new UVector2(-2, 0)]);
  assert.deepEqual(samples(path), samples(upstream));
  assert.deepEqual(jsonValue(path.toJSON()), jsonValue(upstream.toJSON()));
  assert.deepEqual(
    samples(new Path().fromJSON(JSON.parse(JSON.stringify(path.toJSON())), createCurve)),
    samples(upstream),
  );
  const shape = new Shape([
    new Vector2(0, 0),
    new Vector2(0, 6),
    new Vector2(6, 6),
    new Vector2(6, 0),
    new Vector2(0, 0),
  ]);
  const hole = new Path([
    new Vector2(1, 1),
    new Vector2(2, 1),
    new Vector2(2, 2),
    new Vector2(1, 2),
    new Vector2(1, 1),
  ]);
  shape.holes.push(hole);
  const upstreamShape = new UShape().fromJSON(JSON.parse(JSON.stringify(shape.toJSON())));
  assert.deepEqual(jsonValue(shape.extractPoints(7)), jsonValue(upstreamShape.extractPoints(7)));
  const clone = shape.clone();
  assert.notEqual(clone.uuid, shape.uuid);
  assert.notEqual(clone.currentPoint, shape.currentPoint);
  assert.notEqual(clone.holes[0], hole);
  assert.notEqual(clone.holes[0].curves[0], hole.curves[0]);
  const original = jsonValue(shape.toJSON());
  const clonedLine = clone.holes[0].curves[0];
  assert.ok(clonedLine instanceof LineCurve);
  clonedLine.v1.x += 10;
  clone.currentPoint.x += 10;
  assert.deepEqual(jsonValue(shape.toJSON()), original);
  clone.copy(shape);
  assert.deepEqual(jsonValue(clone.toJSON()), original);
  const nested = new CurvePath<Vector2>();
  nested.add(new LineCurve(new Vector2(-1, 0), new Vector2()));
  nested.add(path);
  const outer = new CurvePath<Vector2>();
  outer.add(nested);
  const restored = new CurvePath<Vector2>().fromJSON(JSON.parse(JSON.stringify(outer.toJSON())), createCurve);
  assert.deepEqual(samples(restored), samples(outer));
  assert.ok(restored.curves[0] instanceof CurvePath);
  const shapeJSON = JSON.parse(JSON.stringify(shape.toJSON()));
  const restoredShape = new Shape().fromJSON(shapeJSON, createCurve);
  assert.deepEqual(restoredShape.toJSON(), shape.toJSON());
  assert.deepEqual(samples(restoredShape.holes[0]), samples(hole));
  shapeJSON.holes[0].curves[0].type = "Unsupported";
  assert.throws(() => new Shape().fromJSON(shapeJSON, createCurve), /Unsupported curve: Unsupported/);
  const failure = new Error("consumer decoder failed");
  assert.throws(
    () =>
      new CurvePath().fromJSON(outer.toJSON(), () => {
        throw failure;
      }),
    (error) => error === failure,
  );
});

test("shape paths honor SVG fill rules, reversed winding, nested islands and degenerate contours", () => {
  for (const fillRule of [undefined, "nonzero", "evenodd"] as const) {
    for (const sameWinding of [false, true]) {
      for (const reverseAll of [false, true]) {
        const actual = new ShapePath();
        const expected = new UShapePath();
        for (const value of [actual, expected]) {
          value.userData = { style: { fillRule } };
          const rectangles = [
            { min: 0, max: 10, reverse: false },
            { min: 2, max: 8, reverse: !sameWinding },
            { min: 3, max: 7, reverse: false },
            { min: 20, max: 22, reverse: true },
          ];
          for (const { min, max, reverse } of rectangles.reverse()) {
            const points = [
              [min, min],
              [max, min],
              [max, max],
              [min, max],
            ];
            if (reverse !== reverseAll) points.reverse();
            value.moveTo(points[0][0], points[0][1]);
            for (const [x, y] of points.slice(1)) value.lineTo(x, y);
            value.lineTo(points[0][0], points[0][1]);
          }
          value.moveTo(30, 0).lineTo(31, 0).lineTo(32, 0);
          value.moveTo(40, 0).lineTo(40, 0);
        }
        const shapes = actual.toShapes();
        assert.deepEqual(
          jsonValue(shapes.map((shape) => shape.toJSON())),
          jsonValue(expected.toShapes().map((shape) => shape.toJSON())),
        );
        const hasHole = fillRule === "evenodd" || !sameWinding;
        assert.equal(shapes.length, hasHole ? 3 : 2);
        assert.equal(
          shapes.reduce((sum, shape) => sum + shape.holes.length, 0),
          hasHole ? 1 : 0,
        );
      }
    }
  }
  assert.deepEqual(new ShapePath().toShapes(), []);
});
