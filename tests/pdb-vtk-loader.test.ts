import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import { test } from "vite-plus/test";
import { PDBLoader } from "../src/addons/loaders/PDBLoader";
import { VTKLoader } from "../src/addons/loaders/VTKLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { SRGBColorSpace } from "../src/constants";
import { Color } from "../src/math/Color";
import type { BufferGeometry } from "../src/core/BufferGeometry";

function attribute(geometry: BufferGeometry, name: string): BufferAttribute {
  const result = geometry.getAttribute(name);
  assert.ok(result instanceof BufferAttribute);
  return result;
}

function atom(serial: number, element: string, x: number, y: number, z: number): string {
  const line = Array.from(" ".repeat(80));
  const put = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) line[offset + i] = text[i];
  };
  put(0, "HETATM");
  put(6, String(serial).padStart(5));
  put(30, x.toFixed(3).padStart(8));
  put(38, y.toFixed(3).padStart(8));
  put(46, z.toFixed(3).padStart(8));
  put(76, element.padStart(2));
  return line.join("");
}

test("PDB maps nonconsecutive atom serials and deduplicates reciprocal bonds", () => {
  const result = new PDBLoader().parse(
    [atom(2, "C", 1, 2, 3), atom(5, "O", 4, 5, 6), "CONECT    2    5", "CONECT    5    2"].join("\n"),
  );
  assert.deepEqual(Array.from(attribute(result.geometryAtoms, "position").array), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Array.from(attribute(result.geometryBonds, "position").array), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(
    result.json.atoms.map((value) => value[4]),
    ["C", "O"],
  );
  assert.equal(attribute(result.geometryAtoms, "color").count, 2);
});

test("VTK ASCII triangulates polygons and preserves vertex normals", () => {
  const text = [
    "# vtk DataFile Version 3.0",
    "quad",
    "ASCII",
    "DATASET POLYDATA",
    "POINTS 4 float",
    "0 0 0 1 0 0 1 1 0 0 1 0",
    "POLYGONS 1 5",
    "4 0 1 2 3",
    "POINT_DATA 4",
    "NORMALS normals float",
    "0 0 1 0 0 1 0 0 1 0 0 1",
  ].join("\n");
  const geometry = new VTKLoader().parse(new TextEncoder().encode(text).buffer as ArrayBuffer);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 1, 2, 0, 2, 3]);
  assert.equal(attribute(geometry, "normal").count, 4);
});

test("VTK ASCII preserves upstream cell-color conversion and expansion", () => {
  const text = [
    "# vtk DataFile Version 3.0",
    "triangle",
    "ASCII",
    "DATASET POLYDATA",
    "POINTS 3 float",
    "0 0 0 1 0 0 0 1 0",
    "POLYGONS 1 4",
    "3 0 1 2",
    "CELL_DATA 1",
    "COLOR_SCALARS color 3",
    "0.5 0.5 0.5",
  ].join("\n");
  const geometry = new VTKLoader().parse(new TextEncoder().encode(text).buffer as ArrayBuffer);
  const linear = new Color().setRGB(0.5, 0.5, 0.5, SRGBColorSpace);
  const twice = new Color().setRGB(linear.r, linear.g, linear.b, SRGBColorSpace);
  const colors = attribute(geometry, "color");
  assert.equal(geometry.index, null);
  assert.equal(colors.count, 3);
  assert.ok(Math.abs(colors.getX(0) - twice.r) < 1e-6);
});

test("VTK binary reads big-endian points and triangle strips", () => {
  const encoder = new TextEncoder();
  const prefix = encoder.encode("# vtk DataFile Version 3.0\nstrip\nBINARY\nDATASET POLYDATA\nPOINTS 4 float\n");
  const middle = encoder.encode("\nTRIANGLE_STRIPS 1 5\n");
  const bytes = new Uint8Array(prefix.length + 48 + middle.length + 20 + 1);
  bytes.set(prefix);
  const view = new DataView(bytes.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0].forEach((value, i) => view.setFloat32(prefix.length + i * 4, value));
  bytes.set(middle, prefix.length + 48);
  [4, 0, 1, 2, 3].forEach((value, i) => view.setInt32(prefix.length + 48 + middle.length + i * 4, value));
  bytes[bytes.length - 1] = 10;
  const geometry = new VTKLoader().parse(bytes.buffer);
  assert.deepEqual(Array.from(geometry.index!.array), [0, 1, 2, 1, 3, 2]);
  assert.equal(attribute(geometry, "position").count, 4);
});

test("VTK XML reads inline compressed and appended binary data with an injected decoder", () => {
  const floats = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const raw = new Uint8Array(floats.buffer);
  const zipped = deflateSync(raw);
  const compressedHeader = new Uint32Array([1, raw.length, 0, zipped.length]);
  const compressed = Buffer.from(compressedHeader.buffer).toString("base64") + zipped.toString("base64");
  const uncompressed = new Uint8Array(4 + raw.length);
  new DataView(uncompressed.buffer).setUint32(0, raw.length, true);
  uncompressed.set(raw, 4);
  const appended = Buffer.from(uncompressed).toString("base64");
  const previous = globalThis.DOMParser;
  let useCompressed = true;
  const make = (attributes: Record<string, string>, textContent = ""): Element =>
    ({
      textContent,
      getAttribute: (name: string) => attributes[name] ?? null,
      hasAttribute: (name: string) => name in attributes,
    }) as unknown as Element;
  globalThis.DOMParser = class {
    parseFromString(): Document {
      const array = make(
        {
          type: "Float32",
          NumberOfComponents: "3",
          format: useCompressed ? "binary" : "appended",
          ...(useCompressed ? {} : { offset: "0" }),
        },
        useCompressed ? compressed : "",
      );
      const piece = make({ NumberOfPoints: "3", NumberOfPolys: "0", NumberOfStrips: "0" });
      piece.querySelector = (selector: string): Element | null =>
        selector === ":scope > Points > DataArray" ? array : null;
      piece.querySelectorAll = () => [array] as unknown as NodeListOf<Element>;
      const root = make({
        header_type: "UInt32",
        byte_order: "LittleEndian",
        ...(useCompressed ? { compressor: "vtkZLibDataCompressor" } : {}),
      });
      root.querySelector = (selector: string): Element | null =>
        selector === "PolyData > Piece" ? piece : selector === "AppendedData" ? make({}, `_${appended}`) : null;
      return { documentElement: root } as Document;
    }
  } as typeof DOMParser;
  try {
    const input = new TextEncoder().encode('<?xml version="1.0"?>').buffer as ArrayBuffer;
    assert.throws(() => new VTKLoader().parse(input), /requires a zlib decoder/);
    const loader = new VTKLoader(undefined, {
      unzlibSync: (data) => {
        const inflated = inflateSync(data);
        const padded = new Uint8Array(inflated.length + 2);
        padded.set(inflated, 1);
        return padded.subarray(1, -1);
      },
    });
    assert.deepEqual(Array.from(attribute(loader.parse(input), "position").array), Array.from(floats));
    useCompressed = false;
    assert.deepEqual(Array.from(attribute(loader.parse(input), "position").array), Array.from(floats));
  } finally {
    globalThis.DOMParser = previous;
  }
});
