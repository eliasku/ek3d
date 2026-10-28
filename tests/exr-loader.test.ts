import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { EXRLoader } from "../src/addons/loaders/EXRLoader";
import type { EXRTextureData, EXRZlibDecoder } from "../src/addons/loaders/EXRLoader";
import { TextureType, TextureFilter, ColorSpace, PixelFormat } from "../src/constants";
import { fromHalfFloat, toHalfFloat } from "../src/extras/DataUtils";

interface ChannelSpec {
  name: string;
  pixelType: number;
  pLinear?: number;
  xSampling?: number;
  ySampling?: number;
}

interface FixtureOptions {
  width: number;
  height: number;
  channels: ChannelSpec[];
  compression?: number;
  data?: Uint8Array;
  dataBlocks?: Uint8Array[];
  version?: number;
  specFlags?: number;
}

const PIXEL_HALF = 1;
const PIXEL_FLOAT = 2;

function writeNullTerminated(bytes: number[], value: string): void {
  for (const char of new TextEncoder().encode(value)) bytes.push(char);
  bytes.push(0);
}

function writeUint32(bytes: number[], value: number): void {
  const buffer = new DataView(new ArrayBuffer(4));
  buffer.setUint32(0, value, true);
  for (let i = 0; i < 4; i++) bytes.push(buffer.getUint8(i));
}

function writeInt32(bytes: number[], value: number): void {
  const buffer = new DataView(new ArrayBuffer(4));
  buffer.setInt32(0, value, true);
  for (let i = 0; i < 4; i++) bytes.push(buffer.getUint8(i));
}

function writeUint8(bytes: number[], value: number): void {
  bytes.push(value & 0xff);
}

function attribute(name: string, type: string, payload: number[]): number[] {
  const bytes: number[] = [];
  writeNullTerminated(bytes, name);
  writeNullTerminated(bytes, type);
  writeUint32(bytes, payload.length);
  bytes.push(...payload);
  return bytes;
}

function chlist(channels: ChannelSpec[]): number[] {
  const bytes: number[] = [];

  for (const channel of channels) {
    writeNullTerminated(bytes, channel.name);
    writeInt32(bytes, channel.pixelType);
    writeUint8(bytes, channel.pLinear ?? 0);
    bytes.push(0, 0, 0);
    writeInt32(bytes, channel.xSampling ?? 1);
    writeInt32(bytes, channel.ySampling ?? 1);
  }

  bytes.push(0);

  return bytes;
}

function buildHeader(options: FixtureOptions): number[] {
  const bytes: number[] = [];
  writeUint32(bytes, 20000630); // magic
  writeUint8(bytes, options.version ?? 2);
  writeUint8(bytes, options.specFlags ?? 0);
  bytes.push(0, 0);

  bytes.push(...attribute("channels", "chlist", chlist(options.channels)));
  bytes.push(...attribute("compression", "compression", [options.compression ?? 0]));

  const window: number[] = [];
  writeInt32(window, 0);
  writeInt32(window, 0);
  writeInt32(window, options.width - 1);
  writeInt32(window, options.height - 1);
  bytes.push(...attribute("dataWindow", "box2i", window));

  const display: number[] = [];
  writeInt32(display, 0);
  writeInt32(display, 0);
  writeInt32(display, options.width - 1);
  writeInt32(display, options.height - 1);
  bytes.push(...attribute("displayWindow", "box2i", display));

  const lineOrder: number[] = [];
  writeUint8(lineOrder, 0);
  bytes.push(...attribute("lineOrder", "lineOrder", lineOrder));

  const pixelAspect: number[] = [];
  writeUint32(pixelAspect, 0x3f800000); // 1.0f
  bytes.push(...attribute("pixelAspectRatio", "float", pixelAspect));

  const screenWindowCenter: number[] = [];
  writeUint32(screenWindowCenter, 0);
  writeUint32(screenWindowCenter, 0);
  bytes.push(...attribute("screenWindowCenter", "v2f", screenWindowCenter));

  const screenWindowWidth: number[] = [];
  writeUint32(screenWindowWidth, 0x3f800000);
  bytes.push(...attribute("screenWindowWidth", "float", screenWindowWidth));

  bytes.push(0); // end of header

  return bytes;
}

function buildSinglePart(options: FixtureOptions): ArrayBuffer {
  const bytes = buildHeader(options);

  const blocks = options.dataBlocks ?? [options.data ?? new Uint8Array(0)];

  // one 64-bit offset per block
  const offsetTable: number[] = [];
  for (let i = 0; i < blocks.length; i++) offsetTable.push(0, 0, 0, 0, 0, 0, 0, 0);

  const headerLength = bytes.length + offsetTable.length;
  let cursor = headerLength;

  const chunks: number[][] = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    // 64-bit little endian offset
    for (let i = 0; i < 8; i++) offsetTable[index * 8 + i] = (cursor >> (8 * i)) & 0xff;

    const chunk: number[] = [];
    writeInt32(chunk, index); // scanline y
    writeUint32(chunk, block.length);
    chunk.push(...block);
    chunks.push(chunk);

    cursor += chunk.length;
  }

  bytes.push(...offsetTable);
  for (const chunk of chunks) bytes.push(...chunk);

  return new Uint8Array(bytes).buffer;
}

function halfPixels(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, toHalfFloat(value), true));
  return bytes;
}

/** Scanline-interleaved payload for one row: channel by channel, one value per pixel. */
function scanlineRow(width: number, values: number[][]): Uint8Array {
  const parts = values.map((channel) => halfPixels(channel));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Inverse of the loader's interleaveScalar traversal, used to fake a zlib payload. */
function inverseInterleave(source: Uint8Array): Uint8Array {
  const out = new Uint8Array(source.length);
  let t1 = 0;
  let t2 = Math.floor((source.length + 1) / 2);
  for (let s = 0; s < source.length;) {
    out[t1++] = source[s++];
    if (s >= source.length) break;
    out[t2++] = source[s++];
  }
  return out;
}

/** Inverse of the loader's predictor pass: raw[t] = target[t] - target[t-1] + 128. */
function inversePredictor(target: Uint8Array): Uint8Array {
  const raw = new Uint8Array(target.length);
  raw[0] = target[0];
  for (let t = 1; t < target.length; t++) raw[t] = (target[t] - target[t - 1] + 128) & 0xff;
  return raw;
}

function pixels(data: EXRTextureData): NonNullable<EXRTextureData["data"]> {
  const value = data.data;
  assert.ok(value !== undefined, "expected pixel data");
  return value;
}

function readHalf(data: EXRTextureData, index: number): number {
  const value = pixels(data);
  assert.ok(value instanceof Uint16Array, "expected half-float pixel data");
  return fromHalfFloat(value[index]);
}

test("EXRLoader rejects a buffer whose magic number is not OpenEXR", () => {
  const loader = new EXRLoader();
  assert.throws(
    () => loader.parse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).buffer),
    /doesn't appear to be in OpenEXR format/,
  );
});

test("EXRLoader rejects a header without a channel list", () => {
  const bytes: number[] = [];
  writeUint32(bytes, 20000630);
  writeUint32(bytes, 2);

  const window: number[] = [];
  writeInt32(window, 0);
  writeInt32(window, 0);
  writeInt32(window, 0);
  writeInt32(window, 0);
  bytes.push(...attribute("dataWindow", "box2i", window));

  const compression: number[] = [];
  writeUint8(compression, 0);
  bytes.push(...attribute("compression", "compression", compression));

  bytes.push(0);

  assert.throws(() => new EXRLoader().parse(new Uint8Array(bytes).buffer), /missing a channel list/);
});

test("EXRLoader rejects a header without a compression attribute", () => {
  const bytes: number[] = [];
  writeUint32(bytes, 20000630);
  writeUint32(bytes, 2);
  bytes.push(...attribute("channels", "chlist", chlist([{ name: "Y", pixelType: PIXEL_HALF }])));

  const window: number[] = [];
  writeInt32(window, 0);
  writeInt32(window, 0);
  writeInt32(window, 0);
  writeInt32(window, 0);
  bytes.push(...attribute("dataWindow", "box2i", window));

  bytes.push(0);

  assert.throws(() => new EXRLoader().parse(new Uint8Array(bytes).buffer), /missing the compression attribute/);
});

test("EXRLoader truncation errors instead of producing a texture", () => {
  const buffer = buildSinglePart({
    width: 2,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(2, [
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
    ]),
  });

  // Drop the pixel payload but keep the header and offset table.
  const truncated = new Uint8Array(buffer, 0, buffer.byteLength - 12).slice();

  assert.throws(() => new EXRLoader().parse(truncated.buffer));
});

test("EXRLoader decodes uncompressed half RGB scanlines into RGBA half floats", () => {
  const buffer = buildSinglePart({
    width: 2,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(2, [
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
    ]),
  });

  const data = new EXRLoader().parse(buffer);

  assert.equal(data.width, 2);
  assert.equal(data.height, 1);
  assert.equal(data.format, PixelFormat.RGBA);
  assert.equal(data.type, TextureType.HalfFloat);
  assert.equal(data.colorSpace, ColorSpace.LinearSRGB);
  assert.equal(data.minFilter, TextureFilter.Linear);
  assert.equal(data.magFilter, TextureFilter.Linear);
  assert.equal(data.generateMipmaps, false);
  assert.equal(data.flipY, false);
  assert.equal(data.header.compression, "NO_COMPRESSION");
  assert.deepEqual(
    data.header.channels.map((channel) => channel.name),
    ["R", "G", "B"],
  );
  const rgba = pixels(data);
  assert.ok(rgba instanceof Uint16Array);
  assert.equal(rgba.length, 2 * 1 * 4);

  // Row 0 is the top row, stored at output row height - 1 - y.
  assert.equal(Math.abs(readHalf(data, 0) - 0.1) < 0.001, true);
  assert.equal(Math.abs(readHalf(data, 1) - 0.3) < 0.001, true);
  assert.equal(Math.abs(readHalf(data, 2) - 0.5) < 0.001, true);
  assert.equal(readHalf(data, 3), 1); // missing alpha is filled with 1
  assert.equal(Math.abs(readHalf(data, 4) - 0.2) < 0.001, true);
});

test("EXRLoader returns float pixels when the data type is FloatType", () => {
  const loader = new EXRLoader().setDataType(TextureType.Float);
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(1, [[0.25], [0.5], [0.75]]),
  });

  const data = loader.parse(buffer);

  assert.equal(data.type, TextureType.Float);
  assert.ok(data.data instanceof Float32Array);
  assert.equal(Math.abs((data.data as Float32Array)[0] - 0.25) < 0.001, true);
  assert.equal(Math.abs((data.data as Float32Array)[1] - 0.5) < 0.001, true);
  assert.equal(Math.abs((data.data as Float32Array)[2] - 0.75) < 0.001, true);
  assert.equal((data.data as Float32Array)[3], 1);
});

test("EXRLoader keeps full float channel precision when reading FloatType", () => {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  [0.1, 0.2, 0.3].forEach((value, index) => view.setFloat32(index * 4, value, true));

  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_FLOAT },
      { name: "G", pixelType: PIXEL_FLOAT },
      { name: "B", pixelType: PIXEL_FLOAT },
    ],
    data: payload,
  });

  const data = new EXRLoader().setDataType(TextureType.Float).parse(buffer);

  assert.ok(data.data instanceof Float32Array);
  assert.equal((data.data as Float32Array)[0], Math.fround(0.1));
  assert.equal((data.data as Float32Array)[1], Math.fround(0.2));
  assert.equal((data.data as Float32Array)[2], Math.fround(0.3));
  assert.equal(data.header.channels[0].pixelType, PIXEL_FLOAT);

  // Half output rounds the same FLOAT channel file instead of keeping full precision.
  const halfData = new EXRLoader().parse(buffer);
  assert.equal(Math.abs(readHalf(halfData, 0) - 0.1) < 0.001, true);
});

test("EXRLoader expands luminance files to RGB and honours RG/Red output formats", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [{ name: "Y", pixelType: PIXEL_HALF }],
    data: scanlineRow(1, [[0.5]]),
  });

  const rgba = new EXRLoader().parse(buffer);
  assert.equal(rgba.format, PixelFormat.RGBA);
  assert.equal(pixels(rgba).length, 4);
  assert.equal(readHalf(rgba, 0), readHalf(rgba, 1));
  assert.equal(readHalf(rgba, 1), readHalf(rgba, 2));
  assert.equal(readHalf(rgba, 3), 1);

  const rg = new EXRLoader().setOutputFormat(PixelFormat.RG).parse(buffer);
  assert.equal(rg.format, PixelFormat.RG);
  assert.equal(pixels(rg).length, 2);
  assert.equal(readHalf(rg, 0), readHalf(rg, 1));

  const red = new EXRLoader().setOutputFormat(PixelFormat.Red).parse(buffer);
  assert.equal(red.format, PixelFormat.Red);
  assert.equal(pixels(red).length, 1);
  assert.equal(Math.abs(readHalf(red, 0) - 0.5) < 0.001, true);
});

test("EXRLoader crops RGB output to RG and Red when asked for fewer channels", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(1, [[0.1], [0.2], [0.3]]),
  });

  const rg = new EXRLoader().setOutputFormat(PixelFormat.RG).parse(buffer);
  assert.equal(rg.format, PixelFormat.RG);
  assert.equal(pixels(rg).length, 2);
  assert.equal(Math.abs(readHalf(rg, 0) - 0.1) < 0.001, true);
  assert.equal(Math.abs(readHalf(rg, 1) - 0.2) < 0.001, true);

  const red = new EXRLoader().setOutputFormat(PixelFormat.Red).parse(buffer);
  assert.equal(red.format, PixelFormat.Red);
  assert.equal(pixels(red).length, 1);
  assert.equal(Math.abs(readHalf(red, 0) - 0.1) < 0.001, true);
});

test("EXRLoader converts luminance/chroma Y/RY/BY data to Rec.709 RGB", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "Y", pixelType: PIXEL_HALF },
      { name: "RY", pixelType: PIXEL_HALF, xSampling: 2, ySampling: 2 },
      { name: "BY", pixelType: PIXEL_HALF, xSampling: 2, ySampling: 2 },
    ],
    // Y/RY/BY are stored one after another for a single pixel row.
    data: scanlineRow(1, [[0.5], [0.1], [-0.1]]),
    compression: 0,
  });

  const data = new EXRLoader().parse(buffer);
  const Y = 0.5;
  const RY = 0.1;
  const BY = -0.1;
  const R = (1 + RY) * Y;
  const B = (1 + BY) * Y;
  const G = (Y - R * 0.2126 - B * 0.0722) / 0.7152;

  assert.equal(data.format, PixelFormat.RGBA);
  assert.equal(data.header.compression, "NO_COMPRESSION");
  assert.equal(Math.abs(readHalf(data, 0) - R) < 0.002, true);
  assert.equal(Math.abs(readHalf(data, 1) - G) < 0.002, true);
  assert.equal(Math.abs(readHalf(data, 2) - B) < 0.002, true);
  assert.equal(readHalf(data, 3), 1);
});

/** Minimal EXR RLE stream: literal blocks plus repeat runs, as the format allows. */
function rleEncode(source: Uint8Array): Uint8Array {
  const out: number[] = [];
  let index = 0;

  while (index < source.length) {
    let run = 1;
    while (index + run < source.length && source[index + run] === source[index] && run < 128) run++;

    if (run >= 3) {
      out.push(run - 1, source[index]);
      index += run;
      continue;
    }

    let literal = 1;
    while (
      index + literal < source.length &&
      literal < 127 &&
      !(
        index + literal + 2 < source.length &&
        source[index + literal] === source[index + literal + 1] &&
        source[index + literal] === source[index + literal + 2]
      )
    ) {
      literal++;
    }

    out.push((256 - literal) & 0xff);
    for (let i = 0; i < literal; i++) out.push(source[index + i]);
    index += literal;
  }

  return new Uint8Array(out);
}

test("EXRLoader decodes RLE-compressed scanlines without a zlib runtime", () => {
  // 2 pixels x 3 half channels of 0.0: RLE turns the 12 raw bytes into 4 stored bytes.
  const stored = inversePredictor(inverseInterleave(new Uint8Array(12)));
  const encoded = rleEncode(stored);
  assert.ok(encoded.length < 12, "fixture must be smaller than the raw block to take the RLE path");

  const buffer = buildSinglePart({
    width: 2,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    compression: 1, // RLE_COMPRESSION
    data: encoded,
  });

  const data = new EXRLoader().parse(buffer);

  assert.equal(data.header.compression, "RLE_COMPRESSION");
  assert.equal(pixels(data).length, 8);

  // Output is RGBA, so slots 3 and 7 are the filled alpha values between the colour triples.
  for (const index of [0, 1, 2, 4, 5, 6]) assert.equal(readHalf(data, index), 0);
  assert.equal(readHalf(data, 3), 1);
  assert.equal(readHalf(data, 7), 1);
});

test("EXRLoader requires a zlib runtime only for zlib-compressed blocks", () => {
  const payload = scanlineRow(1, [[0.5], [0.25], [0.75]]);
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    compression: 3, // ZIP_COMPRESSION
    // A shorter-than-raw block marks the chunk as compressed, so the ZIP path is taken.
    data: new Uint8Array([1, 2, 3, 4]),
  });

  assert.throws(() => new EXRLoader().parse(buffer), /call setZlibDecoder\(\)/);

  const calls: Uint8Array[] = [];
  const inflated = inversePredictor(inverseInterleave(payload));
  const decoder: EXRZlibDecoder = {
    unzlibSync(data: Uint8Array): Uint8Array {
      calls.push(data);
      // The loader applies predictor + interleave after inflating, so feed their inverse.
      return inflated.slice();
    },
  };

  const data = new EXRLoader().setZlibDecoder(decoder).parse(buffer);
  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(calls[0]), [1, 2, 3, 4]);
  assert.equal(data.header.compression, "ZIP_COMPRESSION");
  assert.equal(Math.abs(readHalf(data, 0) - 0.5) < 0.001, true);
  assert.equal(Math.abs(readHalf(data, 1) - 0.25) < 0.001, true);
  assert.equal(Math.abs(readHalf(data, 2) - 0.75) < 0.001, true);
});

test("EXRLoader rejects unsupported data channels and pixel types", () => {
  const unsupportedChannels = buildSinglePart({
    width: 1,
    height: 1,
    channels: [{ name: "Z", pixelType: PIXEL_HALF }],
    data: new Uint8Array(2),
  });

  assert.throws(() => new EXRLoader().parse(unsupportedChannels), /unsupported data channels/);

  const unsupportedType = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: 0 },
      { name: "G", pixelType: 0 },
      { name: "B", pixelType: 0 },
    ],
    data: new Uint8Array(12),
  });

  assert.throws(() => new EXRLoader().parse(unsupportedType), /unsupported pixelType/);
});

test("EXRLoader rejects invalid output formats for the file's channels", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(1, [[0.1], [0.2], [0.3]]),
  });

  const loader = new EXRLoader().setOutputFormat(0x9999);

  assert.throws(() => loader.parse(buffer), /invalid output format/);
});

test("EXRLoader reads the data window height and offsets rows accordingly", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 2,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    // NO_COMPRESSION keeps one block per scanline: row 0 then row 1.
    dataBlocks: [scanlineRow(1, [[0.1], [0.2], [0.3]]), scanlineRow(1, [[0.4], [0.5], [0.6]])],
  });

  const data = new EXRLoader().parse(buffer);

  assert.equal(data.height, 2);
  assert.equal(pixels(data).length, 8);

  // Rows are stored bottom-up: scanline 0 lands at output row 1.
  assert.equal(Math.abs(readHalf(data, 4) - 0.1) < 0.001, true);
  assert.equal(Math.abs(readHalf(data, 0) - 0.4) < 0.001, true);
});

test("EXRLoader applies the requested part index and reports the parsed header", () => {
  const buffer = buildSinglePart({
    width: 1,
    height: 1,
    channels: [
      { name: "R", pixelType: PIXEL_HALF },
      { name: "G", pixelType: PIXEL_HALF },
      { name: "B", pixelType: PIXEL_HALF },
    ],
    data: scanlineRow(1, [[0.1], [0.2], [0.3]]),
  });

  const data = new EXRLoader().setPart(5).parse(buffer);

  // A single-part file clamps any part index to the only part.
  assert.equal(data.header.version, 2);
  assert.equal(data.header.spec.multiPart, false);
  assert.equal(data.header.spec.deepFormat, false);
  assert.equal(data.header.dataWindow.xMax, 0);
});
