import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { Volume } from "../src/addons/misc/Volume";

const makeVolume = (): Volume => new Volume(2, 2, 3, "uint8", Uint8Array.from({ length: 12 }, (_, i) => i).buffer);

test("volume typed data, indexing, mapping and extrema", () => {
  const volume = new Volume(2, 1, 1, "short", new Int16Array([-3, 7]).buffer);
  assert.ok(volume.data instanceof Int16Array);
  assert.equal(volume.getData(1, 0, 0), 7);
  assert.deepEqual(volume.reverseAccess(volume.access(1, 0, 0)), [1, 0, 0]);
  assert.deepEqual(volume.computeMinMax(), [-3, 7]);
  assert.equal(
    volume.map((value) => value * 2),
    volume,
  );
  assert.deepEqual(volume.computeMinMax(), [-6, 14]);
  assert.throws(() => new Volume(2, 1, 1, "uint8", new ArrayBuffer(1)), /lengths/);
  assert.throws(() => new Volume(1, 1, 1, "int64", new ArrayBuffer(8)), /not supported/);
});

test("perpendicular planes preserve voxel order, spacing and transforms", () => {
  const volume = makeVolume();
  volume.spacing = [2, 3, 4];
  const x = volume.extractPerpendicularPlane("x", 1);
  const y = volume.extractPerpendicularPlane("y", 1);
  const z = volume.extractPerpendicularPlane("z", 1);
  const values = (plane: typeof x): number[] =>
    Array.from(
      { length: plane.iLength * plane.jLength },
      (_, n) => volume.data[plane.sliceAccess(n % plane.iLength, Math.floor(n / plane.iLength))],
    );
  assert.deepEqual([x.iLength, x.jLength, x.planeWidth, x.planeHeight], [3, 2, 12, 6]);
  assert.deepEqual(values(x), [11, 7, 3, 9, 5, 1]);
  assert.deepEqual(values(y), [2, 3, 6, 7, 10, 11]);
  assert.deepEqual(values(z), [6, 7, 4, 5]);
  assert.equal(z.matrix.elements[14], 0);
  volume.inverseMatrix.makeScale(-1, 1, 1);
  assert.deepEqual(values(volume.extractPerpendicularPlane("z", 1)), [7, 6, 5, 4]);
});

test("slice repaint applies window, thresholds and index changes", () => {
  let pixels: Uint8ClampedArray = new Uint8ClampedArray();
  const contexts = () => ({
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      pixels = image.data;
    },
    drawImage: () => {},
  });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: contexts }) });
  try {
    const volume = makeVolume();
    volume.windowLow = 0;
    volume.windowHigh = 10;
    const slice = volume.extractSlice("z", 0);
    assert.deepEqual(Array.from(pixels), [51, 51, 51, 255, 76, 76, 76, 255, 0, 0, 0, 255, 25, 25, 25, 255]);
    volume.lowerThreshold = 5;
    assert.equal(slice.geometryNeedsUpdate, true);
    slice.index = 1;
    volume.repaintAllSlices();
    assert.deepEqual(
      Array.from(pixels),
      [153, 153, 153, 255, 178, 178, 178, 255, 102, 102, 102, 0, 127, 127, 127, 255],
    );
    assert.equal(slice.geometryNeedsUpdate, false);
    assert.equal(slice.mesh.matrix.elements[14], 0);
  } finally {
    vi.unstubAllGlobals();
  }
});
