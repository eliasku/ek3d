import { describe, it, expect } from "vitest";
import { radixSort } from "../src/addons/utils/SortUtils";

describe("radixSort", () => {
  it("sorts unsigned boundaries and duplicate keys across radix blocks in both directions", () => {
    const source = Array.from({ length: 400 }, (_, index) => (index * 2654435761) >>> 0);
    source.push(0, 0xffffffff, 0, 0xffffffff);
    for (const reversed of [false, true]) {
      const values = new Uint32Array(source);
      radixSort(values, { aux: new Uint32Array(values.length), reversed });
      expect(Array.from(values)).toEqual([...source].sort((a, b) => (reversed ? b - a : a - b)));
    }
  });
  it("keeps equal-key items stable with reusable object scratch storage", () => {
    const values = Array.from({ length: 160 }, (_, index) => ({ key: index % 4, index }));
    const expected = [...values].sort((a, b) => a.key - b.key);
    radixSort(values, { get: (item) => item.key, aux: [] });
    expect(values).toEqual(expected);
  });
});
