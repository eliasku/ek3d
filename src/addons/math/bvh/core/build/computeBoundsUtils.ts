export type PrimitiveBounds = Float32Array & { offset: number };

export function getBounds(
  primitiveBounds: PrimitiveBounds,
  offset: number,
  count: number,
  target: Float32Array,
  centroidTarget: Float32Array,
): void {
  let minx = Infinity,
    miny = Infinity,
    minz = Infinity;
  let maxx = -Infinity,
    maxy = -Infinity,
    maxz = -Infinity;
  let cminx = Infinity,
    cminy = Infinity,
    cminz = Infinity;
  let cmaxx = -Infinity,
    cmaxy = -Infinity,
    cmaxz = -Infinity;
  const boundsOffset = primitiveBounds.offset || 0;
  for (let i = (offset - boundsOffset) * 6, end = (offset + count - boundsOffset) * 6; i < end; i += 6) {
    const cx = primitiveBounds[i],
      hx = primitiveBounds[i + 1];
    minx = Math.min(minx, cx - hx);
    maxx = Math.max(maxx, cx + hx);
    cminx = Math.min(cminx, cx);
    cmaxx = Math.max(cmaxx, cx);
    const cy = primitiveBounds[i + 2],
      hy = primitiveBounds[i + 3];
    miny = Math.min(miny, cy - hy);
    maxy = Math.max(maxy, cy + hy);
    cminy = Math.min(cminy, cy);
    cmaxy = Math.max(cmaxy, cy);
    const cz = primitiveBounds[i + 4],
      hz = primitiveBounds[i + 5];
    minz = Math.min(minz, cz - hz);
    maxz = Math.max(maxz, cz + hz);
    cminz = Math.min(cminz, cz);
    cmaxz = Math.max(cmaxz, cz);
  }
  target[0] = minx;
  target[1] = miny;
  target[2] = minz;
  target[3] = maxx;
  target[4] = maxy;
  target[5] = maxz;
  centroidTarget[0] = cminx;
  centroidTarget[1] = cminy;
  centroidTarget[2] = cminz;
  centroidTarget[3] = cmaxx;
  centroidTarget[4] = cmaxy;
  centroidTarget[5] = cmaxz;
}
