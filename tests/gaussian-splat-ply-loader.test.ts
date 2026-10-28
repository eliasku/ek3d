import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { GaussianSplatPLYLoader } from "../src/addons/loaders/GaussianSplatPLYLoader";
import type { BufferAttribute } from "../src/core/BufferAttribute";
import type { BufferGeometry } from "../src/core/BufferGeometry";

const baseProperties = [
  "x",
  "y",
  "z",
  "scale_0",
  "scale_1",
  "scale_2",
  "rot_0",
  "rot_1",
  "rot_2",
  "rot_3",
  "f_dc_0",
  "f_dc_1",
  "f_dc_2",
  "opacity",
];
const restCounts = [0, 9, 24, 45];

type Format = "ascii" | "binary_little_endian" | "binary_big_endian";
function fixture(degree: number, format: Format): string | ArrayBuffer {
  const restCount = restCounts[degree];
  const names = [...baseProperties, ...Array.from({ length: restCount }, (_, i) => `f_rest_${i}`)];
  const header = `ply\nformat ${format} 1.0\nelement vertex 2\n${names.map((name) => `property float ${name}`).join("\n")}\nend_header\n`;
  const rest = Array.from({ length: restCount }, (_, i) => (i - 16) / 64);
  const rows = [
    [1, 2, 3, 0, Math.log(2), Math.log(3), 1, 0, 0, 0, 0, 0, 0, 0, ...rest],
    [-1, -2, -3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ...rest.map((x) => -x)],
  ];
  if (format === "ascii") return header + rows.map((row) => row.join(" ")).join("\n") + "\n";
  const headerBytes = new TextEncoder().encode(header);
  const buffer = new ArrayBuffer(headerBytes.length + rows.length * names.length * 4);
  new Uint8Array(buffer).set(headerBytes);
  const view = new DataView(buffer);
  let offset = headerBytes.length;
  for (const row of rows)
    for (const value of row) {
      view.setFloat32(offset, value, format === "binary_little_endian");
      offset += 4;
    }
  return buffer;
}

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const result = geometry.getAttribute(name);
  assert.ok(result);
  return result as BufferAttribute;
}

for (const format of ["ascii", "binary_little_endian", "binary_big_endian"] as const) {
  for (let degree = 0; degree <= 3; degree++) {
    test(`parses ${format} Gaussian PLY with SH degree ${degree}`, () => {
      const geometry = new GaussianSplatPLYLoader().parse(fixture(degree, format));
      assert.deepEqual(Array.from(attribute(geometry, "position").array), [1, 2, 3, -1, -2, -3]);
      const covariance = Array.from(attribute(geometry, "covariance").array);
      const expected = [1, 0, 0, 4, 0, 9, 1, 0, 0, 1, 0, 1];
      covariance.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-5));
      const color = attribute(geometry, "color");
      assert.equal(color.normalized, true);
      assert.deepEqual(Array.from(color.array), [128, 128, 128, 128, 128, 128, 128, 128]);
      for (let band = 1; band <= 3; band++) {
        const sh = geometry.getAttribute(`sphericalHarmonics${band}`) as BufferAttribute | undefined;
        if (band > degree) {
          assert.equal(sh, undefined);
          continue;
        }
        assert.ok(sh);
        assert.ok(sh.array instanceof Uint32Array);
        const words = [0, 3, 4, 6][band];
        const components = [0, 9, 15, 21][band];
        const bandOffset = [0, 0, 3, 8][band];
        const stride = restCounts[degree] / 3;
        const bytes = new Uint8Array(sh.array.buffer, sh.array.byteOffset, sh.array.byteLength);
        assert.equal(sh.itemSize, words);
        for (let row = 0; row < 2; row++) {
          for (let j = 0; j < components; j++) {
            const sourceIndex = bandOffset + Math.floor(j / 3) + (j % 3) * stride;
            const coefficient = ((sourceIndex - 16) / 64) * (row === 0 ? 1 : -1);
            assert.equal(bytes[row * words * 4 + j], coefficient * 128 + 128);
          }
          for (let j = components; j < words * 4; j++) assert.equal(bytes[row * words * 4 + j], 128);
        }
      }
    });
  }
}

test("rejects missing headers, required properties and unsupported SH counts", () => {
  const loader = new GaussianSplatPLYLoader();
  assert.throws(() => loader.parse("not a PLY"), /Missing PLY header/);
  const data = fixture(0, "ascii") as string;
  assert.throws(
    () => loader.parse(data.replace("property float opacity\n", "")),
    /requires position, scale, rotation, f_dc and opacity/,
  );
  assert.throws(
    () => loader.parse(data.replace("end_header", "property float f_rest_0\nend_header")),
    /Unsupported number of f_rest.*\(1\)/,
  );
});

test("decodes buffered ASCII, rotated covariance, color and opacity", () => {
  const lines = (fixture(0, "ascii") as string).split("\n");
  const row = lines.indexOf("end_header") + 1;
  lines[row] = [
    1,
    2,
    3,
    Math.log(2),
    0,
    0,
    Math.cos(Math.PI / 8),
    0,
    0,
    Math.sin(Math.PI / 8),
    1,
    -1,
    0,
    Math.log(3),
  ].join(" ");
  const geometry = new GaussianSplatPLYLoader().parse(new TextEncoder().encode(lines.join("\n")).buffer);
  const covariance = Array.from(attribute(geometry, "covariance").array).slice(0, 6);
  const expected = [2.5, 1.5, 0, 2.5, 0, 1];
  covariance.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-5));
  assert.deepEqual(Array.from(attribute(geometry, "color").array).slice(0, 4), [199, 56, 128, 191]);
});
