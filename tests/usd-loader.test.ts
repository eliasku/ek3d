import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { USDLoader } from "../src/addons/loaders/USDLoader";
import { Group } from "../src/objects/Group";

const zipHeader = new Uint8Array([0x50, 0x4b]).buffer;

test("USDZ requires an injected ZIP runtime", () => {
  assert.throws(() => new USDLoader().parse(zipHeader), /ZIP runtime is required/);
});

test("USDZ uses the first entry as its root layer", () => {
  const layer = new TextEncoder().encode('#usda 1.0\ndef Xform "Root"\n{\n}\n');
  const loader = new USDLoader().setZipRuntime({ unzipSync: () => ({ "nested/root.USDA": layer }) });
  assert.ok(loader.parse(zipHeader) instanceof Group);
  loader.setZipRuntime({ unzipSync: () => ({ "image.png": new Uint8Array(), "root.usda": layer }) });
  assert.throws(() => loader.parse(zipHeader), /first ZIP entry/);
});
