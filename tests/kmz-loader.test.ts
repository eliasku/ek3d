import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { KMZLoader } from "../src/addons/loaders/KMZLoader";
import { Scene } from "../src/scenes/Scene";

test("KMZ requires an injected ZIP decoder", () => {
  assert.throws(() => new KMZLoader().parse(new ArrayBuffer(0)), /ZIP runtime is required/);
});

test("KMZ falls back to a case-insensitive DAE entry when doc.kml is absent", () => {
  const input = new Uint8Array([1, 2, 3]);
  let received: Uint8Array | undefined;
  const loader = new KMZLoader().setZipRuntime({
    unzipSync(data) {
      received = data;
      return { "models/empty.DAE": new Uint8Array() };
    },
  });
  const result = loader.parse(input.buffer);
  assert.deepEqual(received, input);
  assert.ok(result?.scene instanceof Scene);
});
