import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { HDRCubeTextureLoader } from "../src/addons/loaders/HDRCubeTextureLoader";
import { TIFFLoader } from "../src/addons/loaders/TIFFLoader";
import type { TIFFRuntime } from "../src/addons/loaders/TIFFLoader";
import { TextureType, ColorSpace } from "../src/constants";
import { LoadingManager } from "../src/loaders/LoadingManager";

afterEach(() => vi.unstubAllGlobals());

test("TIFF loader rejects missing directories and preserves decoder failures", () => {
  const buffer = new ArrayBuffer(4);
  const runtime: TIFFRuntime = {
    decode: () => [],
    decodeImage: () => {
      throw new Error("Unsupported TIFF compression");
    },
    toRGBA8: () => new Uint8Array(),
  };
  assert.throws(() => new TIFFLoader(runtime).parse(buffer), /No image directory/);
  assert.throws(
    () => new TIFFLoader({ ...runtime, decode: () => [{ width: 1, height: 1 }] }).parse(buffer),
    /Unsupported TIFF compression/,
  );
});

test("HDR cube loader creates six float faces and reports invalid RGBE", async () => {
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
  const urls = Array.from({ length: 6 }, (_, i) => {
    const header = new TextEncoder().encode("#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n");
    const data = new Uint8Array(header.length + 4);
    data.set(header);
    data.set([10 * (i + 1), 64, 32, 128], header.length);
    return `data:application/octet-stream;base64,${Buffer.from(data).toString("base64")}`;
  });
  const loader = new HDRCubeTextureLoader().setDataType(TextureType.Float);
  const cube = await loader.loadAsync(urls);
  for (let i = 0; i < 6; i++) {
    const face = cube.images[i];
    assert.equal(face.image.width, 1);
    assert.equal(face.image.height, 1);
    assert.ok(Math.abs(face.image.data[0] - (10 * (i + 1)) / 255) < 1e-7);
  }
  assert.equal(cube.type, TextureType.Float);
  assert.equal(cube.colorSpace, ColorSpace.LinearSRGB);
  assert.equal(cube.generateMipmaps, false);
  assert.ok(
    cube.images.every(
      (face: { image: { data: unknown }; type: number }) =>
        face.image.data instanceof Float32Array && face.type === TextureType.Float,
    ),
  );
  const manager = new LoadingManager();
  const failures: string[] = [];
  manager.onError = (url) => failures.push(url);
  const bad = "data:application/octet-stream;base64,AA==";
  await assert.rejects(new HDRCubeTextureLoader(manager).loadAsync(Array(6).fill(bad)));
  assert.deepEqual(failures, [bad]);
});
