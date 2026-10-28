import { assert, test } from "vitest";
import * as Upstream from "../upstream/three.js/examples/jsm/libs/ktx-parse.module.js";
import { read } from "../src/addons/loaders/KTX2Container";
import fs from "node:fs";

const dir = "upstream/three.js/examples/textures/ktx2/";
const files: string[] = fs.existsSync(dir)
  ? fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ktx2"))
      .map((f) => dir + f)
  : [];

type ParsedContainer = ReturnType<typeof read>;

function readUpstream(data: Uint8Array): ParsedContainer {
  return Upstream.read(data) as unknown as ParsedContainer;
}

function assertContainer(
  actual: ReturnType<typeof read>,
  expected: ReturnType<typeof readUpstream>,
  label: string,
): void {
  for (const key of [
    "vkFormat",
    "typeSize",
    "pixelWidth",
    "pixelHeight",
    "pixelDepth",
    "layerCount",
    "faceCount",
    "levelCount",
    "supercompressionScheme",
  ] as const) {
    assert.equal(actual[key], expected[key], `${label}.${key}`);
  }
  assert.equal(actual.levels.length, expected.levels.length, `${label}.levels.length`);
  for (let i = 0; i < expected.levels.length; i++) {
    const actualLevel = actual.levels[i];
    const expectedLevel = expected.levels[i];
    assert.equal(actualLevel.levelData.byteOffset, expectedLevel.levelData.byteOffset, `${label}.levels[${i}].offset`);
    assert.equal(
      actualLevel.levelData.byteLength,
      expectedLevel.levelData.byteLength,
      `${label}.levels[${i}].byteLength`,
    );
    assert.equal(
      actualLevel.uncompressedByteLength,
      expectedLevel.uncompressedByteLength,
      `${label}.levels[${i}].uncompressedByteLength`,
    );
  }
  assert.equal(actual.dataFormatDescriptor.length, 1, `${label}.dataFormatDescriptor.length`);
  const actualDFD = actual.dataFormatDescriptor[0];
  const expectedDFD = expected.dataFormatDescriptor[0];
  for (const key of [
    "vendorId",
    "descriptorType",
    "versionNumber",
    "colorModel",
    "colorPrimaries",
    "transferFunction",
    "flags",
  ] as const) {
    assert.equal(actualDFD[key], expectedDFD[key], `${label}.dfd.${key}`);
  }
  assert.equal(actualDFD.samples.length, expectedDFD.samples.length, `${label}.dfd.samples.length`);
  for (let i = 0; i < expectedDFD.samples.length; i++) {
    for (const key of ["bitOffset", "bitLength", "channelType", "sampleLower", "sampleUpper"] as const) {
      assert.equal(actualDFD.samples[i][key], expectedDFD.samples[i][key], `${label}.dfd.samples[${i}].${key}`);
    }
  }
  assert.equal(Object.keys(actual.keyValue).length, Object.keys(expected.keyValue).length, `${label}.keyValue`);
}

test("container parser matches vendored ktx-parse on shipped example textures", () => {
  assert.ok(files.length > 0, "no ktx2 fixtures found");
  for (const file of files) {
    const data = new Uint8Array(fs.readFileSync(file));
    assertContainer(read(data), readUpstream(data), file);
  }
});

test("container parser matches on synthetic cube, array and 3D containers", () => {
  const cubeData = new Uint8Array(fs.readFileSync("tests/fixtures/ktx2/syn_cube.ktx2"));
  assertContainer(read(cubeData), readUpstream(cubeData), "cube");
  const arrayData = new Uint8Array(fs.readFileSync("tests/fixtures/ktx2/syn_array.ktx2"));
  assertContainer(read(arrayData), readUpstream(arrayData), "array");
  const volumeData = new Uint8Array(fs.readFileSync("tests/fixtures/ktx2/syn_3d.ktx2"));
  assertContainer(read(volumeData), readUpstream(volumeData), "3d");
});

test("container parser rejects bad magic and truncated data like vendored ktx-parse", () => {
  assert.ok(files.length > 0, "no ktx2 fixtures found");
  const good = new Uint8Array(fs.readFileSync(files[0]));
  const badMagic = new Uint8Array(good);
  badMagic.fill(0, 0, 6);
  assert.throws(() => read(badMagic), /Missing KTX 2.0 identifier/);
  assert.throws(() => read(good.slice(0, 100)), Error);
});
