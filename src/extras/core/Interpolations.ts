/**
 * Interpolations contains spline and Bézier functions internally used by concrete curve classes.
 *
 * Bezier Curves formulas obtained from: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 *
 * @module Interpolations
 */
/**
 * Computes a point on a Catmull-Rom spline.
 *
 * @param t - The interpolation factor.
 * @param p0 - The first control point.
 * @param p1 - The second control point.
 * @param p2 - The third control point.
 * @param p3 - The fourth control point.
 * @return The calculated point on a Catmull-Rom spline.
 */
export function CatmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}
//
function QuadraticBezierP0(t?: any, p?: any) {
  const k = 1 - t;
  return k * k * p;
}
function QuadraticBezierP1(t?: any, p?: any) {
  return 2 * (1 - t) * t * p;
}
function QuadraticBezierP2(t?: any, p?: any) {
  return t * t * p;
}
/**
 * Computes a point on a Quadratic Bezier curve.
 *
 * @param t - The interpolation factor.
 * @param p0 - The first control point.
 * @param p1 - The second control point.
 * @param p2 - The third control point.
 * @return The calculated point on a Quadratic Bezier curve.
 */
export function QuadraticBezier(t: number, p0: number, p1: number, p2: number): number {
  return QuadraticBezierP0(t, p0) + QuadraticBezierP1(t, p1) + QuadraticBezierP2(t, p2);
}
//
function CubicBezierP0(t?: any, p?: any) {
  const k = 1 - t;
  return k * k * k * p;
}
function CubicBezierP1(t?: any, p?: any) {
  const k = 1 - t;
  return 3 * k * k * t * p;
}
function CubicBezierP2(t?: any, p?: any) {
  return 3 * (1 - t) * t * t * p;
}
function CubicBezierP3(t?: any, p?: any) {
  return t * t * t * p;
}
/**
 * Computes a point on a Cubic Bezier curve.
 *
 * @param t - The interpolation factor.
 * @param p0 - The first control point.
 * @param p1 - The second control point.
 * @param p2 - The third control point.
 * @param p3 - The fourth control point.
 * @return The calculated point on a Cubic Bezier curve.
 */
export function CubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  return CubicBezierP0(t, p0) + CubicBezierP1(t, p1) + CubicBezierP2(t, p2) + CubicBezierP3(t, p3);
}
