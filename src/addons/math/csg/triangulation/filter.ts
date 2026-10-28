import type { Triangulation } from "./mesh";

function compareCell(a: number[], b: number[]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function locate(cells: number[][], a: number, b: number, c: number): number {
  let x = a,
    y = b,
    z = c;
  if (b < c) {
    if (b < a) {
      x = b;
      y = c;
      z = a;
    }
  } else if (c < a) {
    x = c;
    y = a;
    z = b;
  }
  if (x < 0) return -1;
  const key = [x, y, z];
  let lo = 0,
    hi = cells.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1,
      d = compareCell(cells[mid], key);
    if (d === 0) return mid;
    if (d < 0) lo = mid + 1;
    else hi = mid;
  }
  return -1;
}

export function classifyFaces(mesh: Triangulation, target: number, infinity = false): number[][] {
  const cells = mesh.cells();
  for (const c of cells) {
    const [x, y, z] = c;
    if (y < z) {
      if (y < x) {
        c[0] = y;
        c[1] = z;
        c[2] = x;
      }
    } else if (z < x) {
      c[0] = z;
      c[1] = x;
      c[2] = y;
    }
  }
  cells.sort(compareCell);
  const flags = Array.from({ length: cells.length }, () => 0);
  const neighbor: number[] = [];
  const constraint: boolean[] = [];
  const boundary: number[][] = [];
  let active: number[] = [],
    next: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    for (let j = 0; j < 3; j++) {
      const x = c[j],
        y = c[(j + 1) % 3];
      const a = (neighbor[3 * i + j] = locate(cells, y, x, mesh.opposite(y, x)));
      const b = (constraint[3 * i + j] = mesh.isConstraint(x, y));
      if (a < 0) {
        if (b) next.push(i);
        else {
          active.push(i);
          flags[i] = 1;
        }
        if (infinity) boundary.push([y, x, -1]);
      }
    }
  }
  if (target === 0) return infinity ? cells.concat(boundary) : cells;
  let side = 1;
  while (active.length > 0 || next.length > 0) {
    while (active.length > 0) {
      const t = active.pop()!;
      if (flags[t] === -side) continue;
      flags[t] = side;
      for (let j = 0; j < 3; j++) {
        const f = neighbor[3 * t + j];
        if (f >= 0 && flags[f] === 0) {
          if (constraint[3 * t + j]) next.push(f);
          else {
            active.push(f);
            flags[f] = side;
          }
        }
      }
    }
    [active, next] = [next, active];
    next.length = 0;
    side = -side;
  }
  const result = cells.filter((_, i) => flags[i] === target);
  return infinity ? result.concat(boundary) : result;
}
