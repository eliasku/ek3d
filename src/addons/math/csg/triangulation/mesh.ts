import { inCircle } from "./predicates";

export class Triangulation {
  stars: number[][];
  edges: number[][];

  constructor(count: number, edges: number[][]) {
    this.stars = Array.from({ length: count }, () => []);
    this.edges = edges;
  }

  isConstraint(i: number, j: number): boolean {
    const a = Math.min(i, j),
      b = Math.max(i, j);
    let lo = 0,
      hi = this.edges.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1,
        edge = this.edges[mid];
      if (edge[0] < a || (edge[0] === a && edge[1] < b)) lo = mid + 1;
      else hi = mid;
    }
    return lo < this.edges.length && this.edges[lo][0] === a && this.edges[lo][1] === b;
  }

  removeTriangle(i: number, j: number, k: number): void {
    for (const [a, b, c] of [
      [i, j, k],
      [j, k, i],
      [k, i, j],
    ]) {
      const list = this.stars[a];
      for (let n = 1; n < list.length; n += 2) {
        if (list[n - 1] === b && list[n] === c) {
          list[n - 1] = list[list.length - 2];
          list[n] = list[list.length - 1];
          list.length -= 2;
          break;
        }
      }
    }
  }

  addTriangle(i: number, j: number, k: number): void {
    this.stars[i].push(j, k);
    this.stars[j].push(k, i);
    this.stars[k].push(i, j);
  }

  opposite(j: number, i: number): number {
    const list = this.stars[i];
    for (let k = 1; k < list.length; k += 2) if (list[k] === j) return list[k - 1];
    return -1;
  }

  flip(i: number, j: number): void {
    const a = this.opposite(i, j),
      b = this.opposite(j, i);
    this.removeTriangle(i, j, a);
    this.removeTriangle(j, i, b);
    this.addTriangle(i, b, a);
    this.addTriangle(j, a, b);
  }

  cells(): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < this.stars.length; i++) {
      const list = this.stars[i];
      for (let j = 0; j < list.length; j += 2) {
        const s = list[j],
          t = list[j + 1];
        if (i < Math.min(s, t)) result.push([i, s, t]);
      }
    }
    return result;
  }
}

function testFlip(points: number[][], mesh: Triangulation, stack: number[], a: number, b: number, x: number): void {
  let y = mesh.opposite(a, b);
  if (y < 0) return;
  if (b < a) {
    [a, b] = [b, a];
    [x, y] = [y, x];
  }
  if (!mesh.isConstraint(a, b) && inCircle(points[a], points[b], points[x], points[y]) < 0) stack.push(a, b);
}

export function delaunayRefine(points: number[][], mesh: Triangulation): void {
  const stack: number[] = [],
    stars = mesh.stars;
  for (let a = 0; a < points.length; a++) {
    const star = stars[a];
    for (let j = 1; j < star.length; j += 2) {
      const b = star[j];
      if (b < a || mesh.isConstraint(a, b)) continue;
      const x = star[j - 1];
      let y = -1;
      for (let k = 1; k < star.length; k += 2) {
        if (star[k - 1] === b) {
          y = star[k];
          break;
        }
      }
      if (y >= 0 && inCircle(points[a], points[b], points[x], points[y]) < 0) stack.push(a, b);
    }
  }
  while (stack.length > 0) {
    const b = stack.pop()!,
      a = stack.pop()!,
      star = stars[a];
    let x = -1,
      y = -1;
    for (let i = 1; i < star.length; i += 2) {
      const s = star[i - 1],
        t = star[i];
      if (s === b) y = t;
      else if (t === b) x = s;
    }
    if (x < 0 || y < 0 || inCircle(points[a], points[b], points[x], points[y]) >= 0) continue;
    mesh.flip(a, b);
    testFlip(points, mesh, stack, x, a, y);
    testFlip(points, mesh, stack, a, y, x);
    testFlip(points, mesh, stack, y, b, x);
    testFlip(points, mesh, stack, b, x, y);
  }
}
