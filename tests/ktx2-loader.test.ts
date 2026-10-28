import { assert, test } from "vitest";
import { KTX2Loader } from "../src/addons/loaders/KTX2Loader";
import { DataTexture } from "../src/textures/DataTexture";
import { PixelFormat, TextureType, ColorSpace, TextureFilter } from "../src/constants";
import { read } from "../src/addons/loaders/KTX2Container";
import type { KTX2Container } from "../src/addons/loaders/KTX2Container";
import fs from "node:fs";

const file = "upstream/three.js/examples/textures/ktx2/2d_rgba8.ktx2";

test("KTX2Loader raw path creates a DataTexture with mipmaps and color space", async () => {
  const loader = new KTX2Loader();
  const bytes = fs.readFileSync(file);
  const container = read(new Uint8Array(bytes)) as KTX2Container;

  // raw path is createRawTexture — invoke through the loader's private surface
  const anyLoader = loader as unknown as {
    _createTexture(buffer: ArrayBuffer): Promise<DataTexture>;
  };
  // an owned copy: the worker path transfers ownership, so hand the loader a private buffer
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const texture = await anyLoader._createTexture(buffer as ArrayBuffer);
  assert.ok(texture instanceof DataTexture);
  assert.equal(texture.format, PixelFormat.RGBA);
  assert.equal(texture.type, TextureType.UnsignedByte);
  assert.equal(texture.colorSpace, ColorSpace.SRGB);
  assert.equal(texture.minFilter, TextureFilter.NearestMipmapNearest);
  assert.equal(texture.mipmaps.length, container.levels.length);
  // premultiply flag from DFD
  assert.equal(texture.premultiplyAlpha, false);
});

test("KTX2Loader rejects unsupported supercompression without a decoder", async () => {
  const loader = new KTX2Loader();
  loader.setZSTDDecoder(null);
  // forge a zstd container: flip the scheme field, the 9th u32 in the header
  const data = fs.readFileSync(file);
  const copy = Buffer.from(data);
  copy.writeUint32LE(2, 12 + 8 * 4);
  const anyLoader = loader as unknown as { _createTexture(buffer: ArrayBuffer): Promise<DataTexture> };
  const buffer = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  console.log(
    "scheme after forge:",
    read(new Uint8Array(copy as unknown as ArrayBuffer)).supercompressionScheme,
    "zstdDecoder:",
    loader.zstdDecoder,
  );
  let rejected = false;
  try {
    await anyLoader._createTexture(buffer as ArrayBuffer);
  } catch (error) {
    rejected = true;
    assert.match(String((error as Error).message), /setZSTDDecoder/);
  }
  assert.ok(rejected, "expected the zstd path to reject without a decoder");
});
