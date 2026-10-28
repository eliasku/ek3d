import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { DDSLoader } from "../src/addons/loaders/DDSLoader";
import { KTXLoader } from "../src/addons/loaders/KTXLoader";
import { PVRLoader } from "../src/addons/loaders/PVRLoader";
import { TGALoader } from "../src/addons/loaders/TGALoader";
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

function ktxContainer(internalFormat: number, width: number, height: number, imageSize: number): ArrayBuffer {
  const buffer = new ArrayBuffer(64 + 4 + imageSize);
  new Uint8Array(buffer, 0, 12).set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = new Uint32Array(buffer, 12, 13);
  header[0] = 0x04030201;
  header[4] = internalFormat;
  header[6] = width;
  header[7] = height;
  header[10] = 1;
  header[11] = 1;
  new DataView(buffer).setUint32(64, imageSize, true);
  new Uint8Array(buffer, 68, imageSize).fill(0x7e);
  return buffer;
}

test("KTX reports the stored internal format and rejects uncompressed, array and truncated containers", () => {
  const parsed = new KTXLoader().parse(ktxContainer(0x83f0, 4, 4, 8));
  assert.equal(parsed.format, 0x83f0);
  assert.deepEqual([parsed.width, parsed.height, parsed.mipmapCount], [4, 4, 1]);
  assert.equal(parsed.isCubemap, false);
  assert.equal(parsed.mipmaps.length, 1);
  assert.equal(parsed.mipmaps[0].data.byteLength, 8);
  assert.equal(parsed.mipmaps[0].data[0], 0x7e);
  assert.throws(() => new KTXLoader().parse(ktxContainer(0xdead, 4, 4, 8)), /Unsupported internal format/);

  const uncompressed = ktxContainer(0x83f0, 4, 4, 8);
  new DataView(uncompressed).setUint32(16, 0x1401, true);
  assert.throws(() => new KTXLoader().parse(uncompressed), /Only compressed formats are supported/);

  const arrayTexture = ktxContainer(0x83f0, 4, 4, 8);
  new DataView(arrayTexture).setUint32(12 + 9 * 4, 2, true);
  assert.throws(() => new KTXLoader().parse(arrayTexture), /Texture arrays are not supported/);

  const cubemap = ktxContainer(0x83f0, 4, 4, 8);
  new DataView(cubemap).setUint32(12 + 10 * 4, 6, true);
  assert.throws(() => new KTXLoader().parse(cubemap), /Number of faces expected 1, but found 6/);

  const truncated = ktxContainer(0x83f0, 4, 4, 8);
  new DataView(truncated).setUint32(64, 1024, true);
  assert.throws(() => new KTXLoader().parse(truncated), /Truncated KTX image data/);

  assert.throws(() => new KTXLoader().parse(new ArrayBuffer(8)), /File too short/);
  assert.throws(() => new KTXLoader().parse(new ArrayBuffer(128)), /missing KTX identifier/);
});

test("PVR v2 and v3 map PVRTC variants and clamp small levels to two blocks per axis", () => {
  const header = Array.from<number>({ length: 13 }).fill(0);
  header[0] = 52;
  header[1] = 8;
  header[2] = 8;
  header[3] = 1;
  header[4] = 24;
  header[11] = 0x21525650;
  header[12] = 1;
  const v2 = words(header, 32 + 32);
  const parsedV2 = new PVRLoader().parse(v2);
  assert.equal(parsedV2.format, PixelFormat.RGB_PVRTC_2BPPV1);
  assert.equal(parsedV2.mipmapCount, 2);
  assert.deepEqual(
    parsedV2.mipmaps.map(({ width, height, data }) => [width, height, data.byteLength]),
    [
      [8, 8, 32],
      [4, 4, 32],
    ],
  );
  assert.equal(parsedV2.mipmaps[1].data.byteOffset, 84);

  const v3 = Array.from<number>({ length: 13 }).fill(0);
  v3[0] = 0x03525650;
  v3[2] = 3;
  v3[6] = 4;
  v3[7] = 4;
  v3[10] = 1;
  v3[11] = 1;
  const parsedV3 = new PVRLoader().parse(words(v3, 32));
  assert.equal(parsedV3.format, PixelFormat.RGBA_PVRTC_4BPPV1);
  assert.equal(parsedV3.mipmaps[0].data.byteOffset, 52);
  // PVRTC4 still needs the minimum 2x2 block grid, so a 4x4 level is 32 bytes.
  assert.equal(parsedV3.mipmaps[0].data.byteLength, 32);

  const unknownV3 = words(v3, 32);
  new Uint32Array(unknownV3, 0, 13)[2] = 9;
  assert.throws(() => new PVRLoader().parse(unknownV3), /Unsupported PVR format: 9/);

  const unknownV2 = words(header, 64);
  new Uint32Array(unknownV2, 0, 13)[4] = 40;
  assert.throws(() => new PVRLoader().parse(unknownV2), /Unknown PVR format: 40/);

  assert.throws(() => new PVRLoader().parse(new ArrayBuffer(12)), /Not enough data/);
  assert.throws(
    () => new PVRLoader().parse(words(Array.from<number>({ length: 13 }).fill(0), 0)),
    /Unknown PVR format/,
  );
});

function tga(width: number, height: number, imageType: number, pixelSize: number, flags: number): Uint8Array {
  const header = new Uint8Array(18);
  header[2] = imageType;
  header[12] = width & 0xff;
  header[13] = width >> 8;
  header[14] = height & 0xff;
  header[15] = height >> 8;
  header[16] = pixelSize;
  header[17] = flags;
  return header;
}

function concat(parts: Uint8Array[]): ArrayBuffer {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes.buffer;
}

test("TGA decodes BGR rows into RGBA and honours the bottom-left origin", () => {
  const header = tga(2, 2, 2, 24, 0x20);
  const pixels = new Uint8Array([0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255]);
  const parsed = new TGALoader().parse(concat([header, pixels]));
  assert.deepEqual([parsed.width, parsed.height], [2, 2]);
  assert.equal(parsed.flipY, true);
  assert.equal(parsed.generateMipmaps, true);
  assert.deepEqual(
    Array.from(parsed.data as Uint8Array),
    [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
  );

  // A bottom-left origin flips rows on upload, so decoded rows are reversed vertically.
  const bottomLeft = tga(1, 2, 2, 24, 0x00);
  const flipped = new TGALoader().parse(concat([bottomLeft, new Uint8Array([1, 2, 3, 4, 5, 6])]));
  assert.deepEqual(Array.from(flipped.data as Uint8Array), [6, 5, 4, 255, 3, 2, 1, 255]);
});

test("TGA expands RLE packets, 8 bit grey and 16 bit grey-alpha pixels", () => {
  // A run that overshoots the image would write past the destination buffer.
  assert.throws(
    () => new TGALoader().parse(concat([tga(1, 1, 11, 8, 0x20), new Uint8Array([0x83, 0x40])])),
    /RLE packet exceeds the image size/,
  );
  const truncated = tga(2, 2, 11, 8, 0x20);
  assert.throws(() => new TGALoader().parse(concat([truncated, new Uint8Array([0x83])])), /Truncated RLE image data/);
  const rleGrey = tga(2, 2, 11, 8, 0x20);
  const parsedRle = new TGALoader().parse(concat([rleGrey, new Uint8Array([0x83, 0x40])]));
  assert.deepEqual(Array.from(parsedRle.data as Uint8Array), Array(4).fill([0x40, 0x40, 0x40, 255]).flat());

  const rawRle = tga(2, 1, 10, 24, 0x20);
  const parsedRaw = new TGALoader().parse(concat([rawRle, new Uint8Array([0x01, 1, 2, 3, 4, 5, 6])]));
  assert.deepEqual(Array.from(parsedRaw.data as Uint8Array), [3, 2, 1, 255, 6, 5, 4, 255]);

  const greyAlpha = tga(2, 1, 3, 16, 0x20);
  const parsedGreyAlpha = new TGALoader().parse(concat([greyAlpha, new Uint8Array([10, 200, 20, 100])]));
  assert.deepEqual(Array.from(parsedGreyAlpha.data as Uint8Array), [10, 10, 10, 200, 20, 20, 20, 100]);
});

test("TGA rejects malformed headers before allocating pixel storage", () => {
  assert.throws(() => new TGALoader().parse(new ArrayBuffer(10)), /Not enough data/);
  assert.throws(() => new TGALoader().parse(concat([tga(1, 1, 0, 24, 0x20), new Uint8Array(3)])), /No data/);
  assert.throws(() => new TGALoader().parse(concat([tga(0, 1, 2, 24, 0x20), new Uint8Array(3)])), /Invalid image size/);
  assert.throws(
    () => new TGALoader().parse(concat([tga(1, 1, 2, 12, 0x20), new Uint8Array(3)])),
    /Invalid pixel size 12/,
  );
  assert.throws(() => new TGALoader().parse(concat([tga(1, 1, 7, 24, 0x20), new Uint8Array(3)])), /Invalid type 7/);
  const indexed = tga(1, 1, 1, 8, 0x20);
  indexed[1] = 1;
  indexed[7] = 32;
  assert.throws(() => new TGALoader().parse(concat([indexed, new Uint8Array(4)])), /Invalid type colormap data/);
});

test("Malformed compressed data reaches onError from load and loadAsync", async () => {
  progressEvents();
  const bytes = new Uint8Array(128);
  const url = `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`;

  await assert.rejects(
    new DDSLoader().loadAsync(url),
    (error: unknown) => error instanceof Error && /Invalid magic number/.test(error.message),
  );
  const callbackErrors: unknown[] = [];
  await new Promise<void>((resolve) => {
    new KTXLoader().load(
      url,
      () => assert.fail("Malformed KTX data must not report success"),
      undefined,
      (error: unknown) => {
        callbackErrors.push(error);
        resolve();
      },
    );
  });
  assert.ok(callbackErrors[0] instanceof Error && /missing KTX identifier/.test(callbackErrors[0].message));

  const pvr = await new PVRLoader().loadAsync(url).then(
    () => assert.fail("Malformed PVR data must not resolve"),
    (error: unknown) => error,
  );
  assert.ok(pvr instanceof Error && /Unknown PVR format/.test(pvr.message));
});
