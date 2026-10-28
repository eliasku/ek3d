import assert from "node:assert/strict";
import { gzipSync, gunzipSync } from "node:zlib";
import { test } from "vite-plus/test";
import { NRRDLoader } from "../src/addons/loaders/NRRDLoader";

function nrrd(header: string, payload: Uint8Array, newline = "\n"): ArrayBuffer {
  const prefix = new TextEncoder().encode(`NRRD0005${newline}${header.replaceAll("\n", newline)}${newline}${newline}`);
  const result = new Uint8Array(prefix.length + payload.length);
  result.set(prefix);
  result.set(payload, prefix.length);
  return result.buffer;
}

test("NRRD parses big-endian raw data and spatial metadata", () => {
  const buffer = nrrd(
    "type: ushort\ndimension: 3\nsizes: 2 1 1\nencoding: raw\nendian: big\nspace: left-posterior-superior\nspace directions: (2,0,0) (0,3,0) (0,0,4)",
    new Uint8Array([1, 2, 3, 4]),
    "\r\n",
  );
  const volume = new NRRDLoader().parse(buffer);
  assert.deepEqual(Array.from(volume.data), [258, 772]);
  assert.deepEqual(volume.spacing, [2, 3, 4]);
  assert.deepEqual(volume.RASDimensions, [4, 3, 4]);
  assert.equal(volume.getData(1, 0, 0), 772);
  assert.equal(volume.min, 258);
  assert.equal(volume.max, 772);
  assert.equal(volume.matrix.elements[0], -2);
});

test("NRRD handles text, hexadecimal, gzip views and missing decoders", () => {
  const loader = new NRRDLoader();
  const text = nrrd(
    "type: float\ndimension: 3\nsizes: 2 1 1\nencoding: text\nspacings: 2 1 1",
    new TextEncoder().encode("-1.5 2.25"),
  );
  const volume = loader.parse(text);
  assert.deepEqual(Array.from(volume.data), [-1.5, 2.25]);
  assert.deepEqual(volume.spacing, [2, 1, 1]);
  const hex = nrrd("type: uchar\ndimension: 3\nsizes: 2 1 1\nencoding: hex", new TextEncoder().encode("0a ff"));
  assert.deepEqual(Array.from(loader.parse(hex).data), [10, 255]);
  const compressed = gzipSync(new Uint8Array([7, 8]));
  const gz = nrrd("type: uchar\ndimension: 3\nsizes: 2 1 1\nencoding: gzip", compressed);
  assert.throws(() => loader.parse(gz), /Gzip decoder is required/);
  const decoder = {
    gunzipSync: (bytes: Uint8Array): Uint8Array => {
      const decoded = gunzipSync(bytes);
      const padded = new Uint8Array(decoded.length + 2);
      padded.set(decoded, 1);
      return padded.subarray(1, -1);
    },
  };
  assert.deepEqual(Array.from(new NRRDLoader(undefined, decoder).parse(gz).data), [7, 8]);
  assert.throws(
    () => loader.parse(nrrd("type: uchar\ndimension: 3\nsizes: 1 1 1\nencoding: bzip2", new Uint8Array())),
    /Bzip/,
  );
});

test("NRRD rejects invalid sizes and mismatched payloads", () => {
  const loader = new NRRDLoader();
  const bytes = new TextEncoder();
  for (const sizes of ["1 1", "1 1 1 1", "0 1 1", "-1 1 1", "1.5 1 1", "1x 1 1"]) {
    assert.throws(
      () => loader.parse(nrrd(`type: uchar\ndimension: 3\nsizes: ${sizes}\nencoding: raw`, new Uint8Array(1))),
      /sizes/,
    );
  }
  assert.throws(
    () => loader.parse(nrrd("type: uchar\ndimension: 4\nsizes: 1 1 1\nencoding: raw", new Uint8Array(1))),
    /sizes/,
  );
  for (const payload of [new Uint8Array(1), new Uint8Array(3)]) {
    assert.throws(
      () => loader.parse(nrrd("type: uchar\ndimension: 3\nsizes: 2 1 1\nencoding: raw", payload)),
      /sample count/,
    );
  }
  for (const payload of ["1", "1 2 3"]) {
    assert.throws(
      () => loader.parse(nrrd("type: uchar\ndimension: 3\nsizes: 2 1 1\nencoding: text", bytes.encode(payload))),
      /sample count/,
    );
  }
});
