import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { DDSLoader } from "../src/addons/loaders/DDSLoader";
import { PixelFormat } from "../src/constants";

afterEach(() => vi.unstubAllGlobals());

function progressEvents(): void {
  if (typeof ProgressEvent !== "undefined") return;
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
}

/** Writes 32-bit integers into a fresh buffer, reserving `bytesAfter` extra zero bytes. */
function words(values: number[], bytesAfter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(values.length * 4 + bytesAfter);
  const view = new Uint32Array(buffer, 0, values.length);
  view.set(values);
  return buffer;
}

function ascii(value: string): number {
  return value.charCodeAt(0) + (value.charCodeAt(1) << 8) + (value.charCodeAt(2) << 16) + (value.charCodeAt(3) << 24);
}

function ddsHeader(fourCC: string, width: number, height: number, mipmapCount: number): number[] {
  const header = Array.from<number>({ length: 31 }).fill(0);
  header[0] = 0x20534444;
  header[1] = 124;
  header[2] = mipmapCount > 1 ? 0x21007 : 0x81007;
  header[3] = height;
  header[4] = width;
  header[7] = mipmapCount;
  header[21] = ascii(fourCC);
  return header;
}

test("DDS reads each S3TC level and reports an unsupported FourCC instead of an empty texture", () => {
  const header = ddsHeader("DXT1", 8, 8, 2);
  // The pixel payload starts after the fixed 128 byte DDS header.
  const buffer = words(header, 44);
  new Uint8Array(buffer, 128, 40).fill(0x5a);

  const parsed = new DDSLoader().parse(buffer);
  assert.equal(parsed.format, PixelFormat.RGB_S3TC_DXT1);
  assert.equal(parsed.width, 8);
  assert.equal(parsed.mipmapCount, 2);
  assert.equal(parsed.isCubemap, false);
  assert.deepEqual(
    parsed.mipmaps.map(({ width, height, data }) => [width, height, data.byteLength]),
    [
      [8, 8, 32],
      [4, 4, 8],
    ],
  );
  assert.deepEqual(Array.from(parsed.mipmaps[1].data), Array(8).fill(0x5a));

  const single = new DDSLoader().parse(buffer, false);
  assert.equal(single.mipmaps.length, 1);

  const dxt3 = new DDSLoader().parse(words(ddsHeader("DXT3", 4, 4, 1), 20));
  assert.equal(dxt3.format, PixelFormat.RGBA_S3TC_DXT3);

  assert.throws(() => new DDSLoader().parse(words(ddsHeader("ATI2", 4, 4, 1), 20)), /Unsupported FourCC code ATI2/);
  const wrongMagic = ddsHeader("DXT1", 4, 4, 1);
  wrongMagic[0] = 0x12345678;
  assert.throws(() => new DDSLoader().parse(words(wrongMagic, 20)), /Invalid magic number/);
  assert.throws(() => new DDSLoader().parse(new ArrayBuffer(8)), /Not enough data/);
});

test("DDS DX10 BC6H reads the extended header and rejects other DXGI formats", () => {
  const header = ddsHeader("DX10", 4, 4, 1);
  const buffer = words(header, 40);
  const extended = new Uint32Array(buffer, 128, 5);
  extended[0] = 95;
  const parsed = new DDSLoader().parse(buffer);
  assert.equal(parsed.format, PixelFormat.RGB_BPTC_UNSIGNED);
  assert.equal(parsed.mipmaps[0].data.byteOffset, 148);
  assert.equal(parsed.mipmaps[0].data.byteLength, 16);

  const unsupported = words(header, 40);
  new Uint32Array(unsupported, 128, 5)[0] = 71;
  assert.throws(() => new DDSLoader().parse(unsupported), /Unsupported DXGI_FORMAT code 71/);
});

test("Malformed DDS data reaches onError from load and loadAsync", async () => {
  progressEvents();
  const bytes = new Uint8Array(128);
  const url = `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`;

  await assert.rejects(
    new DDSLoader().loadAsync(url),
    (error: unknown) => error instanceof Error && /Invalid magic number/.test(error.message),
  );
  const callbackErrors: unknown[] = [];
  await new Promise<void>((resolve) => {
    new DDSLoader().load(
      url,
      () => assert.fail("Malformed DDS data must not report success"),
      undefined,
      (error: unknown) => {
        callbackErrors.push(error);
        resolve();
      },
    );
  });
  assert.ok(callbackErrors[0] instanceof Error && /Invalid magic number/.test(callbackErrors[0].message));
});
