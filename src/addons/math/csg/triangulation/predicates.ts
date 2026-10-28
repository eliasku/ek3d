const SPLITTER = 134217729;

function product(a: number, b: number, result: number[] = [0, 0]): number[] {
  const x = a * b;
  const c = SPLITTER * a,
    abig = c - a,
    ahi = c - abig,
    alo = a - ahi;
  const d = SPLITTER * b,
    bbig = d - b,
    bhi = d - bbig,
    blo = b - bhi;
  const err1 = x - ahi * bhi,
    err2 = err1 - alo * bhi,
    err3 = err2 - ahi * blo;
  result[0] = alo * blo - err3;
  result[1] = x;
  return result;
}

function sum(e: number[], f: number[]): number[] {
  const ne = e.length,
    nf = f.length;
  if (ne === 1 && nf === 1) {
    const a = e[0],
      b = f[0],
      x = a + b,
      bv = x - a;
    const y = a - (x - bv) + (b - bv);
    return y ? [y, x] : [x];
  }
  const g: number[] = [];
  let count = 0,
    eptr = 0,
    fptr = 0;
  let ei = e[eptr],
    ea = Math.abs(ei),
    fi = f[fptr],
    fa = Math.abs(fi);
  let a: number, b: number;
  if (ea < fa) {
    b = ei;
    if (++eptr < ne) {
      ei = e[eptr];
      ea = Math.abs(ei);
    }
  } else {
    b = fi;
    if (++fptr < nf) {
      fi = f[fptr];
      fa = Math.abs(fi);
    }
  }
  if ((eptr < ne && ea < fa) || fptr >= nf) {
    a = ei;
    if (++eptr < ne) {
      ei = e[eptr];
      ea = Math.abs(ei);
    }
  } else {
    a = fi;
    if (++fptr < nf) {
      fi = f[fptr];
      fa = Math.abs(fi);
    }
  }
  let x = a + b,
    bv = x - a,
    q0 = b - bv,
    q1 = x;
  while (eptr < ne && fptr < nf) {
    if (ea < fa) {
      a = ei;
      if (++eptr < ne) {
        ei = e[eptr];
        ea = Math.abs(ei);
      }
    } else {
      a = fi;
      if (++fptr < nf) {
        fi = f[fptr];
        fa = Math.abs(fi);
      }
    }
    b = q0;
    x = a + b;
    bv = x - a;
    const y = b - bv;
    if (y) g[count++] = y;
    const next = q1 + x,
      nbv = next - q1;
    q0 = q1 - (next - nbv) + (x - nbv);
    q1 = next;
  }
  while (eptr < ne) {
    a = ei;
    b = q0;
    x = a + b;
    bv = x - a;
    const y = b - bv;
    if (y) g[count++] = y;
    const next = q1 + x,
      nbv = next - q1;
    q0 = q1 - (next - nbv) + (x - nbv);
    q1 = next;
    if (++eptr < ne) ei = e[eptr];
  }
  while (fptr < nf) {
    a = fi;
    b = q0;
    x = a + b;
    bv = x - a;
    const y = b - bv;
    if (y) g[count++] = y;
    const next = q1 + x,
      nbv = next - q1;
    q0 = q1 - (next - nbv) + (x - nbv);
    q1 = next;
    if (++fptr < nf) fi = f[fptr];
  }
  if (q0) g[count++] = q0;
  if (q1) g[count++] = q1;
  if (!count) g[count++] = 0;
  g.length = count;
  return g;
}

function diff(a: number[], b: number[]): number[] {
  return sum(
    a,
    b.map((value) => -value),
  );
}

function scale(e: number[], value: number): number[] {
  const n = e.length;
  if (n === 1) {
    const ts = product(e[0], value);
    return ts[0] ? ts : [ts[1]];
  }
  const g: number[] = [],
    q = [0, 0],
    t = [0, 0];
  let count = 0;
  product(e[0], value, q);
  if (q[0]) g[count++] = q[0];
  for (let i = 1; i < n; i++) {
    product(e[i], value, t);
    const pq = q[1],
      x = pq + t[0],
      bv = x - pq;
    q[0] = pq - (x - bv) + (t[0] - bv);
    q[1] = x;
    if (q[0]) g[count++] = q[0];
    const a = t[1],
      b = q[1],
      next = a + b,
      y = b - (next - a);
    q[1] = next;
    if (y) g[count++] = y;
  }
  if (q[1]) g[count++] = q[1];
  if (!count) g[count++] = 0;
  g.length = count;
  return g;
}

export function orient(a: number[], b: number[], c: number[]): number {
  const l = (a[1] - c[1]) * (b[0] - c[0]);
  const r = (a[0] - c[0]) * (b[1] - c[1]);
  const det = l - r;
  let s: number;
  if (l > 0) {
    if (r <= 0) return det;
    s = l + r;
  } else if (l < 0) {
    if (r >= 0) return det;
    s = -(l + r);
  } else return det;
  const tolerance = (3 + 16 * 1.1102230246251565e-16) * 1.1102230246251565e-16 * s;
  if (det >= tolerance || det <= -tolerance) return det;
  const p = sum(sum(product(b[1], c[0]), product(-c[1], b[0])), sum(product(a[1], b[0]), product(-b[1], a[0])));
  const n = sum(product(a[1], c[0]), product(-c[1], a[0]));
  const exact = diff(p, n);
  return exact[exact.length - 1];
}

export function inCircle(m0: number[], m1: number[], m2: number[], m3: number[]): number {
  const w0 = sum(product(m0[0], m0[0]), product(m0[1], m0[1]));
  const w1 = sum(product(m1[0], m1[0]), product(m1[1], m1[1]));
  const w2 = sum(product(m2[0], m2[0]), product(m2[1], m2[1]));
  const w3 = sum(product(m3[0], m3[0]), product(m3[1], m3[1]));
  const w0m1 = scale(w0, m1[0]),
    w0m2 = scale(w0, m2[0]),
    w0m3 = scale(w0, m3[0]);
  const w1m0 = scale(w1, m0[0]),
    w1m2 = scale(w1, m2[0]),
    w1m3 = scale(w1, m3[0]);
  const w2m0 = scale(w2, m0[0]),
    w2m1 = scale(w2, m1[0]),
    w2m3 = scale(w2, m3[0]);
  const w3m0 = scale(w3, m0[0]),
    w3m1 = scale(w3, m1[0]),
    w3m2 = scale(w3, m2[0]);
  const p = sum(
    sum(scale(diff(w3m2, w2m3), m1[1]), sum(scale(diff(w3m1, w1m3), -m2[1]), scale(diff(w2m1, w1m2), m3[1]))),
    sum(scale(diff(w3m1, w1m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m1[1]), scale(diff(w1m0, w0m1), m3[1]))),
  );
  const n = sum(
    sum(scale(diff(w3m2, w2m3), m0[1]), sum(scale(diff(w3m0, w0m3), -m2[1]), scale(diff(w2m0, w0m2), m3[1]))),
    sum(scale(diff(w2m1, w1m2), m0[1]), sum(scale(diff(w2m0, w0m2), -m1[1]), scale(diff(w1m0, w0m1), m2[1]))),
  );
  const exact = diff(p, n);
  return exact[exact.length - 1];
}
