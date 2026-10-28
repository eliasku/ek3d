import { Vector3 } from "../../math/Vector3";

/** Generates a Hilbert curve in the XZ plane. */
export function hilbert2D(
  center = new Vector3(),
  size = 10,
  iterations = 1,
  v0 = 0,
  v1 = 1,
  v2 = 2,
  v3 = 3,
): Vector3[] {
  const half = size / 2;
  const corners = [
    new Vector3(center.x - half, center.y, center.z - half),
    new Vector3(center.x - half, center.y, center.z + half),
    new Vector3(center.x + half, center.y, center.z + half),
    new Vector3(center.x + half, center.y, center.z - half),
  ];
  const points = [corners[v0], corners[v1], corners[v2], corners[v3]];
  if (--iterations < 0) return points;
  return [
    ...hilbert2D(points[0], half, iterations, v0, v3, v2, v1),
    ...hilbert2D(points[1], half, iterations, v0, v1, v2, v3),
    ...hilbert2D(points[2], half, iterations, v0, v1, v2, v3),
    ...hilbert2D(points[3], half, iterations, v2, v1, v0, v3),
  ];
}

/** Generates the 3D Hilbert curve used by the line examples. */
export function hilbert3D(
  center = new Vector3(),
  size = 10,
  iterations = 1,
  v0 = 0,
  v1 = 1,
  v2 = 2,
  v3 = 3,
  v4 = 4,
  v5 = 5,
  v6 = 6,
  v7 = 7,
): Vector3[] {
  const h = size / 2;
  const corners = [
    new Vector3(center.x - h, center.y + h, center.z - h),
    new Vector3(center.x - h, center.y + h, center.z + h),
    new Vector3(center.x - h, center.y - h, center.z + h),
    new Vector3(center.x - h, center.y - h, center.z - h),
    new Vector3(center.x + h, center.y - h, center.z - h),
    new Vector3(center.x + h, center.y - h, center.z + h),
    new Vector3(center.x + h, center.y + h, center.z + h),
    new Vector3(center.x + h, center.y + h, center.z - h),
  ];
  const vec = [corners[v0], corners[v1], corners[v2], corners[v3], corners[v4], corners[v5], corners[v6], corners[v7]];
  if (--iterations < 0) return vec;
  return [
    ...hilbert3D(vec[0], h, iterations, v0, v3, v4, v7, v6, v5, v2, v1),
    ...hilbert3D(vec[1], h, iterations, v0, v7, v6, v1, v2, v5, v4, v3),
    ...hilbert3D(vec[2], h, iterations, v0, v7, v6, v1, v2, v5, v4, v3),
    ...hilbert3D(vec[3], h, iterations, v2, v3, v0, v1, v6, v7, v4, v5),
    ...hilbert3D(vec[4], h, iterations, v2, v3, v0, v1, v6, v7, v4, v5),
    ...hilbert3D(vec[5], h, iterations, v4, v3, v2, v5, v6, v1, v0, v7),
    ...hilbert3D(vec[6], h, iterations, v4, v3, v2, v5, v6, v1, v0, v7),
    ...hilbert3D(vec[7], h, iterations, v6, v5, v2, v1, v0, v3, v4, v7),
  ];
}

/** Generates a four-step Gosper curve in the XY plane. */
export function gosper(size = 1): number[] {
  const rules: Record<string, string> = {
    A: "A+BF++BF-FA--FAFA-BF+",
    B: "-FA+BFBF++BF+FA--FA-B",
  };
  let input = "A";
  for (let step = 0; step < 4; step++) {
    let output = "";
    for (const char of input) output += rules[char] ?? char;
    input = output;
  }
  let x = 0,
    y = 0,
    angle = 0;
  const points = [0, 0, 0];
  for (const char of input) {
    if (char === "+") angle += Math.PI / 3;
    else if (char === "-") angle -= Math.PI / 3;
    else if (char === "F") {
      x += size * Math.cos(angle);
      y -= size * Math.sin(angle);
      points.push(x, y, 0);
    }
  }
  return points;
}
