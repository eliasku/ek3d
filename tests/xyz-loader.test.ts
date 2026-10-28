import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { XYZLoader } from "../src/addons/loaders/XYZLoader";
import { LoadingManager } from "../src/loaders/LoadingManager";
import { BufferAttribute } from "../src/core/BufferAttribute";
import type { BufferGeometry } from "../src/core/BufferGeometry";

afterEach(() => vi.unstubAllGlobals());

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const value = geometry.getAttribute(name);
  assert.ok(value instanceof BufferAttribute);
  return value;
}

test("XYZ parses whitespace, scientific notation and comments without creating color data", () => {
  const geometry = new XYZLoader().parse(" # comment\r\n1\t-2 3e2\r\n\n4 5 6\nignored row\n1 2 3 4");
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, -2, 300, 4, 5, 6]);
  assert.equal(geometry.hasAttribute("color"), false);
  geometry.dispose();
});

test("XYZRGB converts byte sRGB colors to linear working colors", () => {
  const geometry = new XYZLoader().parse("1 2 3 255 128 0\n4 5 6 0 255 255");
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, 2, 3, 4, 5, 6]);
  const colors = attribute(geometry, "color").array;
  assert.equal(colors[0], 1);
  assert.ok(Math.abs(colors[1] - 0.2158605) < 1e-6);
  assert.deepEqual(Array.from(colors).slice(2), [0, 0, 1, 1]);
  geometry.dispose();
});

test("XYZ loadAsync returns parsed geometry and reports parse failures to the manager", async () => {
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
  const url = "data:text/plain,1%202%203";
  const geometry = await new XYZLoader().loadAsync(url);
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, 2, 3]);
  geometry.dispose();
  const manager = new LoadingManager();
  const failed: string[] = [];
  manager.onError = (path) => failed.push(path);
  const error = new Error("parse failed");
  class BrokenXYZLoader extends XYZLoader {
    override parse(): never {
      throw error;
    }
  }
  await assert.rejects(new BrokenXYZLoader(manager).loadAsync(url), (value) => value === error);
  assert.deepEqual(failed, [url]);
});
