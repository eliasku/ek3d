import { ShapePath } from "../../extras/core/ShapePath";
import { Vector2 } from "../../math/Vector2";

function angle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const length = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  const value = Math.acos(Math.max(-1, Math.min(1, dot / length)));
  return ux * vy - uy * vx < 0 ? -value : value;
}

function arc(
  path: ShapePath,
  rx: number,
  ry: number,
  rotation: number,
  large: number,
  sweep: number,
  start: Vector2,
  end: Vector2,
): void {
  if (rx === 0 || ry === 0) {
    path.lineTo(end.x, end.y);
    return;
  }
  rotation = (rotation * Math.PI) / 180;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const cos = Math.cos(rotation),
    sin = Math.sin(rotation);
  const dx = (start.x - end.x) / 2,
    dy = (start.y - end.y) / 2;
  const xp = cos * dx + sin * dy,
    yp = -sin * dx + cos * dy;
  let rxs = rx * rx,
    rys = ry * ry;
  const xps = xp * xp,
    yps = yp * yp;
  const ratio = xps / rxs + yps / rys;
  if (ratio > 1) {
    const scale = Math.sqrt(ratio);
    rx *= scale;
    ry *= scale;
    rxs = rx * rx;
    rys = ry * ry;
  }
  const denominator = rxs * yps + rys * xps;
  let q = Math.sqrt(Math.max(0, (rxs * rys - denominator) / denominator));
  if (large === sweep) q = -q;
  const cxp = (q * rx * yp) / ry,
    cyp = (-q * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (start.x + end.x) / 2;
  const cy = sin * cxp + cos * cyp + (start.y + end.y) / 2;
  const theta = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  const delta = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry) % (Math.PI * 2);
  path.currentPath!.absellipse(cx, cy, rx, ry, theta, theta + delta, sweep === 0, rotation);
}

/** Parses SVG path data into a ShapePath. */
export function parseSVGPath(data: string): ShapePath | null {
  if (data === "" || data === "none") return null;
  const path = new ShapePath(),
    point = new Vector2(),
    control = new Vector2(),
    first = new Vector2();
  let closed = false;
  for (const command of data.match(/[a-df-z][^a-df-z]*/gi) || []) {
    const type = command[0],
      upper = type.toUpperCase(),
      relative = type !== upper;
    if (closed) {
      if (upper !== "M" && upper !== "Z") path.moveTo(first.x, first.y);
      closed = false;
    }
    if (upper === "Z") {
      if (path.currentPath) {
        path.currentPath.autoClose = true;
        if (path.currentPath.curves.length) {
          point.copy(first);
          path.currentPath.currentPoint.copy(point);
          closed = true;
        }
      }
      continue;
    }
    const stride =
      upper === "H" || upper === "V"
        ? 1
        : upper === "C"
          ? 6
          : upper === "S" || upper === "Q"
            ? 4
            : upper === "A"
              ? 7
              : 2;
    const text = command.slice(1),
      values: number[] = [];
    let index = 0,
      comma = false;
    while (index < text.length) {
      while (index < text.length && /\s/.test(text[index])) index++;
      if (text[index] === ",") {
        if (values.length === 0 || comma) throw new SyntaxError(`Invalid SVG path comma at ${index}`);
        comma = true;
        index++;
        continue;
      }
      if (index >= text.length) break;
      const flag = upper === "A" && (values.length % stride === 3 || values.length % stride === 4);
      const match = flag
        ? /^[01]/.exec(text.slice(index))
        : /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/i.exec(text.slice(index));
      if (!match) throw new SyntaxError(`Invalid SVG path number at ${index}`);
      if (match[0].endsWith(".") && text[index + match[0].length] === ".")
        throw new SyntaxError(`Invalid SVG path decimal at ${index}`);
      values.push(Number(match[0]));
      index += match[0].length;
      comma = false;
    }
    for (let i = 0; i + stride <= values.length; i += stride) {
      const x = point.x,
        y = point.y;
      const px = (offset: number): number => values[i + offset] + (relative ? x : 0);
      const py = (offset: number): number => values[i + offset] + (relative ? y : 0);
      switch (upper) {
        case "M":
          point.set(px(0), py(1));
          if (i === 0) {
            path.moveTo(point.x, point.y);
            first.copy(point);
          } else path.lineTo(point.x, point.y);
          control.copy(point);
          break;
        case "L":
          point.set(px(0), py(1));
          path.lineTo(point.x, point.y);
          control.copy(point);
          break;
        case "H":
          point.x = px(0);
          path.lineTo(point.x, point.y);
          control.copy(point);
          break;
        case "V":
          point.y = py(0);
          path.lineTo(point.x, point.y);
          control.copy(point);
          break;
        case "C":
          path.bezierCurveTo(px(0), py(1), px(2), py(3), px(4), py(5));
          control.set(px(2), py(3));
          point.set(px(4), py(5));
          break;
        case "S":
          path.bezierCurveTo(2 * x - control.x, 2 * y - control.y, px(0), py(1), px(2), py(3));
          control.set(px(0), py(1));
          point.set(px(2), py(3));
          break;
        case "Q":
          path.quadraticCurveTo(px(0), py(1), px(2), py(3));
          control.set(px(0), py(1));
          point.set(px(2), py(3));
          break;
        case "T": {
          const cx = 2 * x - control.x,
            cy = 2 * y - control.y;
          path.quadraticCurveTo(cx, cy, px(0), py(1));
          control.set(cx, cy);
          point.set(px(0), py(1));
          break;
        }
        case "A": {
          const end = new Vector2(px(5), py(6));
          if (!point.equals(end)) {
            arc(path, values[i], values[i + 1], values[i + 2], values[i + 3], values[i + 4], point, end);
            point.copy(end);
            control.copy(point);
          }
          break;
        }
        default:
          console.warn(command);
          break;
      }
    }
  }
  return path;
}
