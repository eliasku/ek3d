import assert from "node:assert/strict";
import { afterEach, test, vi } from "vite-plus/test";
import { Font } from "../src/addons/loaders/FontLoader";
import { TTFLoader } from "../src/addons/loaders/TTFLoader";
import type { TTFCommand, TTFFont, TTFParser } from "../src/addons/loaders/TTFLoader";
import { LoadingManager } from "../src/loaders/LoadingManager";

afterEach(() => vi.unstubAllGlobals());

function parserFor(commands: TTFCommand[]): TTFParser {
  const font: TTFFont = {
    unitsPerEm: 100000 / 72,
    ascender: 800,
    descender: -200,
    encoding: { cmap: { glyphIndexMap: { "65": 1, "128512": 1 } } },
    glyphs: { get: () => ({ advanceWidth: 500, xMin: 0, xMax: 400, path: { commands } }) },
    tables: {
      post: { underlinePosition: -20, underlineThickness: 10 },
      head: { xMin: 0, xMax: 400, yMin: -200, yMax: 800 },
      name: {},
    },
    getEnglishName: () => "Test",
  };
  return { parse: () => font };
}

test("TTF conversion retains cubic controls, aliases and contour winding without mutating the parser", () => {
  const commands: TTFCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "C", x: 10, y: 20, x1: 1, y1: 2, x2: 3, y2: 4 },
    { type: "Z" },
    { type: "M", x: 20, y: 20 },
    { type: "Q", x: 30, y: 30, x1: 25, y1: 26 },
    { type: "Z" },
  ];
  const loader = new TTFLoader(parserFor(commands));
  const data = loader.parse(new ArrayBuffer(0));
  assert.equal(data.glyphs.A?.o, "m 0 0 b 10 20 1 2 3 4 z m 20 20 q 30 30 25 26 z ");
  assert.equal(data.glyphs["😀"]?.o, data.glyphs.A?.o);
  loader.reversed = true;
  assert.equal(loader.parse(new ArrayBuffer(0)).glyphs.A?.o, "m 10 20 b 0 0 3 4 1 2 m 30 30 q 20 20 25 26 ");
  assert.equal(commands[1].type, "C");
});

test("TTF contours generate the expected outer shape and hole", () => {
  const commands: TTFCommand[] = [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: 100, y: 0 },
    { type: "L", x: 100, y: 100 },
    { type: "L", x: 0, y: 100 },
    { type: "L", x: 0, y: 0 },
    { type: "Z" },
    { type: "M", x: 20, y: 20 },
    { type: "L", x: 20, y: 80 },
    { type: "L", x: 80, y: 80 },
    { type: "L", x: 80, y: 20 },
    { type: "L", x: 20, y: 20 },
    { type: "Z" },
  ];
  const data = new TTFLoader(parserFor(commands)).parse(new ArrayBuffer(0));
  const shapes = new Font(data).generateShapes("A", 1000);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].holes.length, 1);
  assert.deepEqual(
    shapes[0].getPoints().map(({ x, y }) => [x, y]),
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ],
  );
  assert.deepEqual(
    shapes[0].holes[0].getPoints().map(({ x, y }) => [x, y]),
    [
      [20, 20],
      [20, 80],
      [80, 80],
      [80, 20],
      [20, 20],
    ],
  );
});

test("TTF loadAsync forwards parse errors to the loading manager", async () => {
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
  const failures: string[] = [];
  manager.onError = (url) => failures.push(url);
  const failure = new Error("bad font");
  const loader = new TTFLoader(
    {
      parse: () => {
        throw failure;
      },
    },
    manager,
  );
  const url = "data:application/octet-stream;base64,AA==";
  await assert.rejects(loader.loadAsync(url), (cause) => cause === failure);
  assert.deepEqual(failures, [url]);
});
