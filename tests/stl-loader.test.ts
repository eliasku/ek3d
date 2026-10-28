import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { STLGeometry, STLLoader } from "../src/addons/loaders/STLLoader";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { ColorSpace } from "../src/constants";
import { LoadingManager } from "../src/loaders/LoadingManager";
import { Color } from "../src/math/Color";

afterEach(() => vi.unstubAllGlobals());

interface Facet {
  normal: [number, number, number];
  vertices: [number, number, number][];
  attribute?: number;
}

function binarySTL(facets: Facet[], header = "ek3d binary stl"): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + facets.length * 50);
  const view = new DataView(buffer);
  for (let i = 0; i < header.length && i < 80; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, facets.length, true);
  facets.forEach((facet, face) => {
    const start = 84 + face * 50;
    facet.normal.forEach((value, component) => view.setFloat32(start + component * 4, value, true));
    facet.vertices.forEach((vertex, index) =>
      vertex.forEach((value, component) => view.setFloat32(start + 12 + index * 12 + component * 4, value, true)),
    );
    view.setUint16(start + 48, facet.attribute ?? 0, true);
  });
  return buffer;
}

const facet: Facet = {
  normal: [0, 0, 1],
  vertices: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ],
};

function attribute(geometry: STLGeometry, name: string): BufferAttribute {
  const found = geometry.getAttribute(name);
  assert.ok(found instanceof BufferAttribute, `missing ${name} attribute`);
  return found;
}

function asciiSolid(name: string, normal: [number, number, number], offset: number): string {
  return `solid ${name}
facet normal ${normal.join(" ")}
outer loop
vertex ${offset} 0 0
vertex ${offset + 1} 0 0
vertex ${offset} 1 0
endloop
endfacet
endsolid ${name}
`;
}

test("ASCII solids become material groups with names and per-facet normals", () => {
  const text = asciiSolid("first", [0, 0, 1], 0) + asciiSolid("second", [0, 1, 0], 3);
  const loader = new STLLoader();

  for (const input of [text, new TextEncoder().encode(text).buffer]) {
    const geometry = loader.parse(input);
    assert.deepEqual(geometry.groups, [
      { start: 0, count: 3, materialIndex: 0 },
      { start: 3, count: 3, materialIndex: 1 },
    ]);
    assert.deepEqual(geometry.userData.groupNames, ["first", "second"]);
    const positions = Array.from(attribute(geometry, "position").array);
    const normals = Array.from(attribute(geometry, "normal").array);
    assert.deepEqual(positions, [0, 0, 0, 1, 0, 0, 0, 1, 0, 3, 0, 0, 4, 0, 0, 3, 1, 0]);
    assert.deepEqual(normals, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  }

  // A UTF-8 byte order mark shifts the leading "solid", so detection must scan for it.
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(asciiSolid("bom", [0, 0, 1], 0))]);
  assert.equal(loader.parse(bom.buffer).groups.length, 1);
});

test("binary color headers set hasColors, alpha and sRGB facet colors, defaulting packed-high facets", () => {
  const header = "COLOR=" + String.fromCharCode(10, 20, 30, 128) + " stl";
  const geometry = new STLLoader().parse(
    binarySTL(
      [
        { ...facet, attribute: 0x001f }, // unique facet color: full red, no green/blue
        { ...facet, normal: [0, 1, 0], attribute: 0x8000 }, // high bit selects the header default
      ],
      header,
    ),
  );

  assert.equal(geometry.hasColors, true);
  assert.equal(geometry.alpha, 128 / 255);
  const normals = Array.from(attribute(geometry, "normal").array);
  assert.deepEqual(normals, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

  const colors = Array.from(attribute(geometry, "color").array);
  const unique = new Color().setRGB(1, 0, 0, ColorSpace.SRGB);
  const fallback = new Color().setRGB(10 / 255, 20 / 255, 30 / 255, ColorSpace.SRGB);
  assert.deepEqual(colors.slice(0, 3), [unique.r, unique.g, unique.b]);
  assert.deepEqual(colors.slice(9, 12), [Math.fround(fallback.r), Math.fround(fallback.g), Math.fround(fallback.b)]);
});

test("binary detection trusts the declared face count even when the header starts with solid", () => {
  const geometry = new STLLoader().parse(binarySTL([facet], "solid but binary header"));
  assert.equal(attribute(geometry, "position").count, 3);
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  assert.deepEqual(geometry.groups, []);
  assert.equal(geometry.userData.groupNames, undefined);
});

test("load delivers parsed geometry and routes parse failures through onError and the manager", async () => {
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
  const manager = new LoadingManager();
  const managerError = vi.fn();
  manager.onError = managerError;

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (request: Request) =>
        new Response(
          request.url.endsWith("ok.stl")
            ? new TextEncoder().encode(asciiSolid("ok", [0, 0, 1], 0))
            : new Uint8Array([1, 2, 3]),
          { status: 200 },
        ),
    ),
  );

  const loader = new STLLoader(manager);
  const geometry = await loader.loadAsync("https://example.test/ok.stl");
  assert.deepEqual(Array.from(attribute(geometry, "position").array), [0, 0, 0, 1, 0, 0, 0, 1, 0]);

  // Three bytes cannot even hold the binary face count at offset 80, so parsing throws.
  await assert.rejects(loader.loadAsync("https://example.test/broken.stl"), RangeError);
  assert.deepEqual(managerError.mock.calls, [["https://example.test/broken.stl"]]);
  assert.deepEqual(Object.keys(manager.fileRequests), []);
});
