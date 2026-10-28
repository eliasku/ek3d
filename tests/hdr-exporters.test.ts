import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import { test } from "vite-plus/test";
import {
  EXRExporter,
  NO_COMPRESSION,
  RLE_COMPRESSION,
  ZIPS_COMPRESSION,
  ZIP_COMPRESSION,
  PIZ_COMPRESSION,
} from "../src/addons/exporters/EXRExporter";
import { KTX2Exporter } from "../src/addons/exporters/KTX2Exporter";
import type { KTX2Writer } from "../src/addons/exporters/KTX2Exporter";
import { EXRLoader } from "../src/addons/loaders/EXRLoader";
import { read as readKTX2 } from "../src/addons/loaders/KTX2Container";
import { FloatType, HalfFloatType, RGBAFormat, SRGBColorSpace } from "../src/constants";
import { DataTexture } from "../src/textures/DataTexture";
import { Data3DTexture } from "../src/textures/Data3DTexture";
import type { WebGLRenderer } from "../src/renderers/WebGLRenderer";
import { WebGLRenderTarget } from "../src/renderers/WebGLRenderTarget";

const zlib = { zlibSync: (data: Uint8Array) => deflateSync(data), unzlibSync: (data: Uint8Array) => inflateSync(data) };

test("EXR compression modes round-trip real scanline data", async () => {
  const width = 32,
    height = 40;
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(i / (width * 4)) % 2 === 0 ? 0.25 : 0.5;
    data[i + 1] = 0.5;
    data[i + 2] = 0.75;
    data[i + 3] = 1;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  const exporter = new EXRExporter(zlib);
  const loader = new EXRLoader().setZlibDecoder(zlib).setDataType(FloatType);
  for (const compression of [NO_COMPRESSION, RLE_COMPRESSION, ZIPS_COMPRESSION, ZIP_COMPRESSION, PIZ_COMPRESSION]) {
    for (const type of [HalfFloatType, FloatType]) {
      const bytes = await exporter.parse(texture, { compression, type });
      assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true), 20000630);
      const decoded = loader.parse(Uint8Array.from(bytes).buffer);
      assert.equal(decoded.width, width);
      assert.ok(decoded.data);
      assert.equal(decoded.height, height);
      assert.deepEqual(Array.from(decoded.data), Array.from(data));
    }
  }
});

test("EXR accepts false render target kind flags and rejects true ones", async () => {
  const target = new WebGLRenderTarget(1, 1, { type: FloatType });
  const flags = Object.assign(target, { isWebGLCubeRenderTarget: false });
  const renderer = {
    isWebGLRenderer: true,
    readRenderTargetPixelsAsync: async (
      _target: unknown,
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      data: Float32Array,
    ) => {
      data.set([0.25, 0.5, 0.75, 1]);
      return data;
    },
  } as unknown as WebGLRenderer;
  const exporter = new EXRExporter(zlib);
  const bytes = await exporter.parse(renderer, flags, { type: FloatType, compression: NO_COMPRESSION });
  const decoded = new EXRLoader().setZlibDecoder(zlib).setDataType(FloatType).parse(Uint8Array.from(bytes).buffer);
  assert.ok(decoded.data);
  assert.deepEqual(Array.from(decoded.data), [0.25, 0.5, 0.75, 1]);
  flags.isWebGLCubeRenderTarget = true;
  await assert.rejects(exporter.parse(renderer, flags), /Unsupported render target type/);
});

test("KTX2 writer preserves byte offsets, descriptor and 3D dimensions", async () => {
  const source = await readFile(
    new URL("../examples/public/examples/libs/ktx-parse.module.js", import.meta.url),
    "utf8",
  );
  // Node imports the same public runtime the browser example loads, without bundling it.
  const runtime = (await import(
    /* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  )) as KTX2Writer;
  const exporter = new KTX2Exporter(runtime);
  const backing = new Uint8Array([99, 98, 1, 2, 3, 4, 97]);
  const texture = new DataTexture(backing.subarray(2, 6), 1, 1);
  texture.colorSpace = SRGBColorSpace;
  const bytes = await exporter.parse(texture);
  const parsed = readKTX2(bytes);
  assert.equal(parsed.vkFormat, runtime.VK_FORMAT_R8G8B8A8_SRGB);
  assert.deepEqual(Array.from(parsed.levels[0].levelData), [1, 2, 3, 4]);
  assert.equal(parsed.dataFormatDescriptor[0].samples.length, 4);
  assert.equal(
    parsed.dataFormatDescriptor[0].samples[3].channelType,
    runtime.KHR_DF_CHANNEL_RGBSDA_ALPHA | runtime.KHR_DF_SAMPLE_DATATYPE_LINEAR,
  );
  const volume = new Data3DTexture(new Uint8Array(16), 1, 2, 2);
  const parsedVolume = readKTX2(await exporter.parse(volume));
  assert.equal(parsedVolume.pixelDepth, 2);
  assert.equal(parsedVolume.pixelHeight, 2);
  assert.equal(parsedVolume.levels[0].levelData.byteLength, 16);
  const crossRealmVolume = {
    isData3DTexture: true,
    format: volume.format,
    type: volume.type,
    colorSpace: volume.colorSpace,
    image: volume.image,
  } as unknown as Data3DTexture;
  assert.equal(readKTX2(await exporter.parse(crossRealmVolume)).pixelDepth, 2);
  const target = new WebGLRenderTarget(1, 1);
  const renderer = {
    isWebGLRenderer: true,
    readRenderTargetPixelsAsync: async (
      _target: unknown,
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      data: Uint8Array,
    ) => {
      data.set([5, 6, 7, 8]);
      return data;
    },
  } as unknown as WebGLRenderer;
  assert.deepEqual(Array.from(readKTX2(await exporter.parse(renderer, target)).levels[0].levelData), [5, 6, 7, 8]);
});
