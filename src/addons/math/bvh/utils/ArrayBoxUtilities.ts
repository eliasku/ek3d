import type { Box3 } from "../../../../math/Box3";

export function arrayToBox(nodeIndex32: number, array: ArrayLike<number>, target: Box3) {
  target.min.x = array[nodeIndex32];
  target.min.y = array[nodeIndex32 + 1];
  target.min.z = array[nodeIndex32 + 2];

  target.max.x = array[nodeIndex32 + 3];
  target.max.y = array[nodeIndex32 + 4];
  target.max.z = array[nodeIndex32 + 5];

  return target;
}

export function makeEmptyBounds(target: Float32Array | Float64Array | number[]) {
  target[0] = target[1] = target[2] = Infinity;
  target[3] = target[4] = target[5] = -Infinity;
}

export function getLongestEdgeIndex(bounds: ArrayLike<number>) {
  let splitDimIdx = -1;
  let splitDist = -Infinity;

  for (let i = 0; i < 3; i++) {
    const dist = bounds[i + 3] - bounds[i];
    if (dist > splitDist) {
      splitDist = dist;
      splitDimIdx = i;
    }
  }

  return splitDimIdx;
}

// copies bounds a into bounds b
export function copyBounds(source: ArrayLike<number>, target: Float32Array | Float64Array) {
  target.set(source);
}

// sets bounds target to the union of bounds a and b
export function unionBounds(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  target: Float32Array | Float64Array | number[],
) {
  let aVal, bVal;
  for (let d = 0; d < 3; d++) {
    const d3 = d + 3;

    // set the minimum values
    aVal = a[d];
    bVal = b[d];
    target[d] = aVal < bVal ? aVal : bVal;

    // set the max values
    aVal = a[d3];
    bVal = b[d3];
    target[d3] = aVal > bVal ? aVal : bVal;
  }
}

// expands the given bounds by the provided primitive bounds
export function expandByPrimitiveBounds(
  startIndex: number,
  primitiveBounds: ArrayLike<number>,
  bounds: Float32Array | Float64Array | number[],
) {
  for (let d = 0; d < 3; d++) {
    const tCenter = primitiveBounds[startIndex + 2 * d];
    const tHalf = primitiveBounds[startIndex + 2 * d + 1];

    const tMin = tCenter - tHalf;
    const tMax = tCenter + tHalf;

    if (tMin < bounds[d]) {
      bounds[d] = tMin;
    }

    if (tMax > bounds[d + 3]) {
      bounds[d + 3] = tMax;
    }
  }
}

// compute bounds surface area
export function computeSurfaceArea(bounds: ArrayLike<number>) {
  const d0 = bounds[3] - bounds[0];
  const d1 = bounds[4] - bounds[1];
  const d2 = bounds[5] - bounds[2];

  return 2 * (d0 * d1 + d1 * d2 + d2 * d0);
}
