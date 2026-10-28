import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { SPLATLoader } from "../src/addons/loaders/SPLATLoader";
import type { BufferGeometry } from "../src/core/BufferGeometry";
import { LoadingManager } from "../src/loaders/LoadingManager";
import {
  createGaussianSplatGeometry,
  createPackedSphericalHarmonicsBand,
  getSphericalHarmonicsDegree,
  writeCovariance,
} from "../src/addons/utils/GaussianSplatUtils";

function arrayOf(geometry: BufferGeometry, name: string): ArrayLike<number> {
  const attribute = geometry.getAttribute(name);
  assert.ok(attribute && "array" in attribute);
  return attribute.array;
}

test("SPLAT decodes rows, color, quaternion covariance and rejects partial rows", () => {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  [1, 2, 3, 2, 3, 4].forEach((value, i) => view.setFloat32(i * 4, value, true));
  new Uint8Array(buffer).set([10, 20, 30, 40, 255, 128, 128, 128], 24);
  const loader = new SPLATLoader();
  const geometry = loader.parse(buffer);
  assert.deepEqual(Array.from(arrayOf(geometry, "position")), [1, 2, 3]);
  assert.deepEqual(Array.from(arrayOf(geometry, "color")), [10, 20, 30, 40]);
  assert.deepEqual(Array.from(arrayOf(geometry, "covariance")), [4, 0, 0, 9, 0, 16]);
  assert.throws(() => loader.parse(new ArrayBuffer(31)), /Invalid .splat byte length/);
});

test("SH packing preserves band padding and geometry validation; rotated covariance is symmetric", () => {
  const band1 = createPackedSphericalHarmonicsBand(1, 1);
  const band2 = createPackedSphericalHarmonicsBand(1, 2);
  assert.equal(band1.bytes.length, 12);
  assert.deepEqual(Array.from(band1.bytes), Array(12).fill(128));
  band1.bytes[0] = 255;
  const geometry = createGaussianSplatGeometry(new Float32Array([0, 0, 0]), new Float32Array(6), new Uint8Array(4), {
    sh1: band1.packed,
    sh2: band2.packed,
  });
  assert.equal(getSphericalHarmonicsDegree(geometry), 2);
  assert.equal((arrayOf(geometry, "sphericalHarmonics1") as Uint32Array)[0], band1.packed[0]);
  assert.throws(
    () =>
      createGaussianSplatGeometry(new Float32Array([0, 0, 0]), new Float32Array(6), new Uint8Array(4), {
        sh2: band2.packed,
      }),
    /contiguous/,
  );
  const covariance = new Float32Array(6);
  writeCovariance(covariance, 0, 2, 1, 1, 0, 0, Math.SQRT1_2, Math.SQRT1_2);
  assert.ok(Math.abs(covariance[0] - 1) < 1e-6);
  assert.ok(Math.abs(covariance[3] - 4) < 1e-6);
  assert.ok(Math.abs(covariance[1]) < 1e-6);
});

test("SPLAT loadAsync forwards parse errors to the loading manager", async () => {
  vi.stubGlobal(
    "ProgressEvent",
    class extends Event {
      readonly lengthComputable: boolean = false;
      readonly loaded: number = 0;
      readonly total: number = 0;
    },
  );
  try {
    const manager = new LoadingManager();
    const failures: string[] = [];
    manager.onError = (url) => failures.push(url);
    const url = "data:application/octet-stream;base64,AA==";
    await assert.rejects(new SPLATLoader(manager).loadAsync(url), /Invalid .splat byte length/);
    assert.deepEqual(failures, [url]);
  } finally {
    vi.unstubAllGlobals();
  }
});
