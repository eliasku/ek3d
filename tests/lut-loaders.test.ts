import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { LUT3dlLoader } from "../src/addons/loaders/LUT3dlLoader";
import { LUTCubeLoader } from "../src/addons/loaders/LUTCubeLoader";
import { FloatType } from "../src/constants";
import { LoadingManager } from "../src/loaders/LoadingManager";

afterEach(() => vi.unstubAllGlobals());

test("3DL reorders blue-fastest rows and scales the declared texture type", () => {
  const loader = new LUT3dlLoader().setType(FloatType);
  const lut = loader.parse("0 1\n0 0 0\n4 0 0\n0 4 0\n4 4 0\n0 0 4\n4 0 4\n0 4 4\n4 4 4\n");
  assert.equal(lut.size, 2);
  assert.deepEqual(
    Array.from(lut.texture3D.image.data!),
    [0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  );
  assert.throws(() => loader.parse("no grid"), /Missing grid/);
  assert.throws(() => loader.parse("0 1 3\n"), /Inconsistent grid/);
  lut.texture3D.dispose();
});

test("Cube metadata, data and domain errors are visible to consumers", () => {
  const loader = new LUTCubeLoader();
  const lut = loader.parse('TITLE "test"\nLUT_3D_SIZE 2\nDOMAIN_MIN -1 0 0\nDOMAIN_MAX 1 1 1\n0.5 1 0\n');
  assert.equal(lut.title, "test");
  assert.equal(lut.domainMin.x, -1);
  assert.deepEqual(Array.from(lut.texture3D.image.data!).slice(0, 4), [127, 255, 0, 255]);
  assert.throws(() => loader.parse("0 0 0"), /Missing LUT_3D_SIZE/);
  assert.throws(() => loader.parse("LUT_3D_SIZE 2\nDOMAIN_MIN 2 0 0"), /Invalid input domain/);
  lut.texture3D.dispose();
});

test("loadAsync rejects parse errors and reports the failing URL to the loading manager", async () => {
  vi.stubGlobal(
    "ProgressEvent",
    class extends Event {
      readonly lengthComputable: boolean;
      readonly loaded: number;
      readonly total: number;
      constructor(type: string, init: ProgressEventInit = {}) {
        super(type);
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    },
  );
  const manager = new LoadingManager();
  const errors: string[] = [];
  manager.onError = (url) => errors.push(url);
  const url = "data:text/plain,not-a-lut";
  await assert.rejects(new LUT3dlLoader(manager).loadAsync(url), /Missing grid/);
  assert.deepEqual(errors, [url]);
});
