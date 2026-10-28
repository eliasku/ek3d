import type { ShapePath } from "../../extras/core/ShapePath";
import { LineCurve } from "../../extras/curves/LineCurve";
import { CubicBezierCurve } from "../../extras/curves/CubicBezierCurve";
import { QuadraticBezierCurve } from "../../extras/curves/QuadraticBezierCurve";
import { EllipseCurve } from "../../extras/curves/EllipseCurve";
import { Matrix3 } from "../../math/Matrix3";
import { Vector2 } from "../../math/Vector2";
import { Vector3 } from "../../math/Vector3";

export function parseSVGTransform(text: string): Matrix3 {
  const transform = new Matrix3();
  const current = new Matrix3();
  const temp1 = new Matrix3();
  const temp2 = new Matrix3();
  const parts = text.split(")");
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    const open = part.indexOf("(");
    if (open <= 0 || open >= part.length) continue;
    const values = (part.slice(open + 1).match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi) || []).map(Number);
    current.identity();
    switch (part.slice(0, open)) {
      case "translate":
        if (values.length >= 1) current.makeTranslation(values[0], values.length >= 2 ? values[1] : 0);
        break;
      case "rotate":
        if (values.length >= 1) {
          const cx = values.length >= 3 ? values[1] : 0;
          const cy = values.length >= 3 ? values[2] : 0;
          temp1.makeTranslation(-cx, -cy);
          temp2.makeRotation((values[0] * Math.PI) / 180).multiply(temp1);
          current.makeTranslation(cx, cy).multiply(temp2);
        }
        break;
      case "scale":
        if (values.length >= 1) current.makeScale(values[0], values.length >= 2 ? values[1] : values[0]);
        break;
      case "skewX":
        if (values.length === 1) current.set(1, Math.tan((values[0] * Math.PI) / 180), 0, 0, 1, 0, 0, 0, 1);
        break;
      case "skewY":
        if (values.length === 1) current.set(1, 0, 0, Math.tan((values[0] * Math.PI) / 180), 1, 0, 0, 0, 1);
        break;
      case "matrix":
        if (values.length === 6) current.set(values[0], values[2], values[4], values[1], values[3], values[5], 0, 0, 1);
        break;
    }
    transform.premultiply(current);
  }
  return transform;
}

function isFlipped(matrix: Matrix3): boolean {
  const e = matrix.elements;
  return e[0] * e[4] - e[1] * e[3] < 0;
}

function scaleX(matrix: Matrix3): number {
  const e = matrix.elements;
  return Math.sqrt(e[0] * e[0] + e[1] * e[1]);
}

function scaleY(matrix: Matrix3): number {
  const e = matrix.elements;
  return Math.sqrt(e[3] * e[3] + e[4] * e[4]);
}

function isSkewed(matrix: Matrix3): boolean {
  const e = matrix.elements;
  const dot = e[0] * e[3] + e[1] * e[4];
  return dot !== 0 && Math.abs(dot / (scaleX(matrix) * scaleY(matrix))) > Number.EPSILON;
}

export function getSVGTransformScale(matrix: Matrix3): number {
  const e = matrix.elements;
  return Math.sqrt(Math.abs(e[0] * e[4] - e[1] * e[3]));
}

function eigenDecomposition(a: number, b: number, c: number): { rt1: number; rt2: number; cs: number; sn: number } {
  let rt1 = NaN,
    rt2: number,
    cs: number,
    sn: number,
    t: number;
  const sm = a + c,
    df = a - c;
  const rt = Math.sqrt(df * df + 4 * b * b);
  if (sm > 0) {
    rt1 = 0.5 * (sm + rt);
    t = 1 / rt1;
    rt2 = a * t * c - b * t * b;
  } else if (sm < 0) {
    rt2 = 0.5 * (sm - rt);
  } else {
    rt1 = 0.5 * rt;
    rt2 = -0.5 * rt;
  }
  cs = df > 0 ? df + rt : df - rt;
  if (Math.abs(cs) > 2 * Math.abs(b)) {
    t = (-2 * b) / cs;
    sn = 1 / Math.sqrt(1 + t * t);
    cs = t * sn;
  } else if (Math.abs(b) === 0) {
    cs = 1;
    sn = 0;
  } else {
    t = (-0.5 * cs) / b;
    cs = 1 / Math.sqrt(1 + t * t);
    sn = t * cs;
  }
  if (df > 0) {
    t = cs;
    cs = -sn;
    sn = t;
  }
  return { rt1, rt2, cs, sn };
}

function transformEllipseGeneric(curve: EllipseCurve, matrix: Matrix3): void {
  const cos = Math.cos(curve.aRotation),
    sin = Math.sin(curve.aRotation);
  const f1 = new Vector3(curve.xRadius * cos, curve.xRadius * sin, 0).applyMatrix3(matrix);
  const f2 = new Vector3(-curve.yRadius * sin, curve.yRadius * cos, 0).applyMatrix3(matrix);
  const f = new Matrix3().set(f1.x, f2.x, 0, f1.y, f2.y, 0, 0, 0, 1);
  const inv = new Matrix3().copy(f).invert();
  const q = new Matrix3().copy(inv).transpose().multiply(inv).elements;
  const ed = eigenDecomposition(q[0], q[1], q[4]);
  const r1 = Math.sqrt(ed.rt1),
    r2 = Math.sqrt(ed.rt2);
  curve.xRadius = 1 / r1;
  curve.yRadius = 1 / r2;
  curve.aRotation = Math.atan2(ed.sn, ed.cs);
  const isFullEllipse = (curve.aEndAngle - curve.aStartAngle) % (2 * Math.PI) < Number.EPSILON;
  if (!isFullEllipse) {
    const drf = new Matrix3()
      .set(r1, 0, 0, 0, r2, 0, 0, 0, 1)
      .multiply(new Matrix3().set(ed.cs, ed.sn, 0, -ed.sn, ed.cs, 0, 0, 0, 1))
      .multiply(f);
    const transformAngle = (phi: number): number => {
      const v = new Vector3(Math.cos(phi), Math.sin(phi), 0).applyMatrix3(drf);
      return Math.atan2(v.y, v.x);
    };
    curve.aStartAngle = transformAngle(curve.aStartAngle);
    curve.aEndAngle = transformAngle(curve.aEndAngle);
    if (isFlipped(matrix)) curve.aClockwise = !curve.aClockwise;
  }
}

function transformEllipseNoSkew(curve: EllipseCurve, matrix: Matrix3): void {
  const sx = scaleX(matrix),
    sy = scaleY(matrix);
  curve.xRadius *= sx;
  curve.yRadius *= sy;
  const e = matrix.elements;
  curve.aRotation += sx > Number.EPSILON ? Math.atan2(e[1], e[0]) : Math.atan2(-e[3], e[4]);
  if (isFlipped(matrix)) {
    curve.aStartAngle *= -1;
    curve.aEndAngle *= -1;
    curve.aClockwise = !curve.aClockwise;
  }
}

export function transformSVGPath(path: ShapePath, matrix: Matrix3): void {
  const center = new Vector2();
  for (const subPath of path.subPaths) {
    for (const curve of subPath.curves) {
      if (curve instanceof LineCurve) {
        curve.v1.applyMatrix3(matrix);
        curve.v2.applyMatrix3(matrix);
      } else if (curve instanceof CubicBezierCurve) {
        curve.v0.applyMatrix3(matrix);
        curve.v1.applyMatrix3(matrix);
        curve.v2.applyMatrix3(matrix);
        curve.v3.applyMatrix3(matrix);
      } else if (curve instanceof QuadraticBezierCurve) {
        curve.v0.applyMatrix3(matrix);
        curve.v1.applyMatrix3(matrix);
        curve.v2.applyMatrix3(matrix);
      } else if (curve instanceof EllipseCurve) {
        center.set(curve.aX, curve.aY).applyMatrix3(matrix);
        curve.aX = center.x;
        curve.aY = center.y;
        if (isSkewed(matrix)) transformEllipseGeneric(curve, matrix);
        else transformEllipseNoSkew(curve, matrix);
      }
    }
  }
}
