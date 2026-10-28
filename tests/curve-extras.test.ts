import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import {
  GrannyKnot,
  HeartCurve,
  VivianiCurve,
  KnotCurve,
  HelixCurve,
  TrefoilKnot,
  TorusKnot,
  CinquefoilKnot,
  TrefoilPolynomialKnot,
  FigureEightPolynomialKnot,
  DecoratedTorusKnot4a,
  DecoratedTorusKnot4b,
  DecoratedTorusKnot5a,
  DecoratedTorusKnot5c,
} from "../src/addons/curves/CurveExtras";
import { Vector3 } from "../src/math/Vector3";

function near(actual: Vector3, expected: number[]): void {
  for (const [i, value] of actual.toArray().entries())
    assert.ok(Math.abs(value - expected[i]) < 1e-9, `${value} != ${expected[i]}`);
}

test("extra curves evaluate their upstream start points and reuse the target", () => {
  const cases = [
    [new GrannyKnot(), [-13.2, 5.6, 14]],
    [new HeartCurve(), [0, 25, 0]],
    [new VivianiCurve(), [70, 0, 0]],
    [new KnotCurve(), [0, 60, 0]],
    [new HelixCurve(), [30, 0, 0]],
    [new TrefoilKnot(), [30, 0, 0]],
    [new TorusKnot(), [30, 0, 0]],
    [new CinquefoilKnot(), [30, 0, 0]],
    [new TrefoilPolynomialKnot(), [-20, 0, -24]],
    [new FigureEightPolynomialKnot(), [-86.4, 48, -134.4]],
    [new DecoratedTorusKnot4a(), [82, 0, 0]],
    [new DecoratedTorusKnot4b(), [74, 0, 0]],
    [new DecoratedTorusKnot5a(), [72, 0, 0]],
    [new DecoratedTorusKnot5c(), [68, 0, 0]],
  ] as const;
  for (const [curve, expected] of cases) {
    const target = new Vector3();
    assert.equal(curve.getPoint(0, target), target);
    near(target, [...expected]);
  }
});

test("scaled curves preserve their shape and periodic knots close", () => {
  const constructors = [
    HeartCurve,
    VivianiCurve,
    TrefoilKnot,
    TorusKnot,
    CinquefoilKnot,
    TrefoilPolynomialKnot,
    FigureEightPolynomialKnot,
    DecoratedTorusKnot4a,
    DecoratedTorusKnot4b,
    DecoratedTorusKnot5a,
    DecoratedTorusKnot5c,
  ];
  for (const Constructor of constructors) {
    const base = new Constructor(1),
      scaled = new Constructor(3);
    for (const t of [0, 0.125, 0.37, 0.75, 1]) near(scaled.getPoint(t), base.getPoint(t).multiplyScalar(3).toArray());
  }
  for (const curve of [
    new GrannyKnot(),
    new HeartCurve(),
    new VivianiCurve(),
    new KnotCurve(),
    new TrefoilKnot(),
    new TorusKnot(),
    new CinquefoilKnot(),
    new DecoratedTorusKnot4a(),
    new DecoratedTorusKnot4b(),
    new DecoratedTorusKnot5a(),
    new DecoratedTorusKnot5c(),
  ])
    near(curve.getPoint(1), curve.getPoint(0).toArray());
  near(new HelixCurve().getPoint(1), [30, 0, 150]);
});
