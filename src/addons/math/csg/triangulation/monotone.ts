import { orient } from "./predicates";

interface Hull {
  a: number[];
  b: number[];
  idx: number;
  lowerIds: number[];
  upperIds: number[];
}
interface Event {
  a: number[];
  b: number[];
  type: number;
  idx: number;
}

function bound<T, U>(items: T[], value: U, compare: (a: T, b: U) => number, upper: boolean): number {
  let lo = 0,
    hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1,
      d = compare(items[mid], value);
    if (d < 0 || (upper && d === 0)) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function compareEvent(a: Event, b: Event): number {
  const d = a.a[0] - b.a[0] || a.a[1] - b.a[1] || a.type - b.type;
  if (d) return d;
  if (a.type !== 0) {
    const winding = orient(a.a, a.b, b.b);
    if (winding) return winding;
  }
  return a.idx - b.idx;
}

function findSplit(hull: Hull, edge: Event): number {
  let d = hull.a[0] < edge.a[0] ? orient(hull.a, hull.b, edge.a) : orient(edge.b, edge.a, hull.a);
  if (d) return d;
  d = edge.b[0] < hull.b[0] ? orient(hull.a, hull.b, edge.b) : orient(edge.b, edge.a, hull.b);
  return d || hull.idx - edge.idx;
}

export function monotoneTriangulate(points: number[][], edges: number[][]): number[][] {
  const events: Event[] = points.map((a, idx) => ({ a, b: [], type: 0, idx }));
  for (let i = 0; i < edges.length; i++) {
    const a = points[edges[i][0]],
      b = points[edges[i][1]];
    if (a[0] < b[0]) events.push({ a, b, type: 2, idx: i }, { a: b, b: a, type: 1, idx: i });
    else if (a[0] > b[0]) events.push({ a: b, b: a, type: 2, idx: i }, { a, b, type: 1, idx: i });
  }
  events.sort(compareEvent);
  const minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52);
  const hulls: Hull[] = [{ a: [minX, 1], b: [minX, 0], idx: -1, lowerIds: [], upperIds: [] }];
  const cells: number[][] = [];
  for (const event of events) {
    if (event.type === 0) {
      const comparePoint = (hull: Hull, p: number[]) => orient(hull.a, hull.b, p);
      const lo = bound(hulls, event.a, comparePoint, false) - 1;
      const hi = bound(hulls, event.a, comparePoint, true);
      for (let i = lo; i < hi; i++) {
        const hull = hulls[i],
          lower = hull.lowerIds,
          upper = hull.upperIds;
        let m = lower.length;
        while (m > 1 && orient(points[lower[m - 2]], points[lower[m - 1]], event.a) > 0) {
          cells.push([lower[m - 1], lower[m - 2], event.idx]);
          m--;
        }
        lower.length = m;
        lower.push(event.idx);
        m = upper.length;
        while (m > 1 && orient(points[upper[m - 2]], points[upper[m - 1]], event.a) < 0) {
          cells.push([upper[m - 2], upper[m - 1], event.idx]);
          m--;
        }
        upper.length = m;
        upper.push(event.idx);
      }
    } else if (event.type === 2) {
      const index = bound(hulls, event, findSplit, true) - 1;
      const hull = hulls[index],
        upper = hull.upperIds,
        x = upper[upper.length - 1];
      hull.upperIds = [x];
      hulls.splice(index + 1, 0, { a: event.a, b: event.b, idx: event.idx, lowerIds: [x], upperIds: upper });
    } else {
      [event.a, event.b] = [event.b, event.a];
      const index = bound(hulls, event, findSplit, false);
      hulls[index - 1].upperIds = hulls[index].upperIds;
      hulls.splice(index, 1);
    }
  }
  return cells;
}
