import { afterEach, test, vi } from "vite-plus/test";
import assert from "node:assert/strict";
import { Font, FontLoader } from "../src/addons/loaders/FontLoader";
import type { FontData } from "../src/addons/loaders/FontLoader";
import { TextGeometry } from "../src/addons/geometries/TextGeometry";
import type { TextGeometryJSON } from "../src/addons/geometries/TextGeometry";
import type { Path } from "../src/extras/core/Path";
import { BufferAttribute } from "../src/core/BufferAttribute";
import { LineCurve3 } from "../src/extras/curves/LineCurve3";
import { Vector3 } from "../src/math/Vector3";
import { LoadingManager } from "../src/loaders/LoadingManager";
import type { CurveJSON } from "../src/extras/core/Curve";

afterEach(() => vi.unstubAllGlobals());

function syntheticFont(glyphs: FontData["glyphs"]): Font {
  return new Font({
    glyphs,
    familyName: "Synthetic",
    ascender: 8,
    descender: -2,
    underlinePosition: -1,
    underlineThickness: 1,
    boundingBox: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
    resolution: 10,
  });
}

const font = syntheticFont({
  A: { x_min: 0, x_max: 10, ha: 10, o: "m 0 0 l 10 0 l 10 10 l 0 10 m 2 2 l 2 8 l 8 8 l 8 2" },
  B: { x_min: 0, x_max: 4, ha: 4, o: "m 0 0 l 4 0 l 4 10 l 0 10" },
  "?": { x_min: 0, x_max: 5, ha: 5, o: "m 0 0 l 5 0 l 5 5 l 0 5" },
  " ": { x_min: 0, x_max: 0, ha: 3 },
});

function points(shape: Path): number[][] {
  return shape.getPoints(0).map((point) => [point.x, point.y]);
}

function bounds(geometry: TextGeometry): { min: number[]; max: number[] } {
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox);
  return { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() };
}

function positionArray(geometry: TextGeometry): BufferAttribute {
  const attribute = geometry.getAttribute("position");
  assert.ok(attribute instanceof BufferAttribute);
  return attribute;
}

test("font shapes honor resolution scale, advances, holes, newlines and all directions", () => {
  // resolution 10 and size 20 scale every glyph unit by 2; line height is (10 - 0 + 1) * 2.
  const single = font.generateShapes("A", 20);
  assert.equal(single.length, 1);
  assert.deepEqual(points(single[0]), [
    [0, 0],
    [20, 0],
    [20, 20],
    [0, 20],
  ]);
  assert.equal(single[0].holes.length, 1);
  assert.deepEqual(points(single[0].holes[0]), [
    [4, 4],
    [4, 16],
    [16, 16],
    [16, 4],
  ]);

  const ltr = font.generateShapes("AB", 20);
  assert.equal(ltr.length, 2);
  assert.deepEqual(points(ltr[1]), [
    [20, 0],
    [28, 0],
    [28, 20],
    [20, 20],
  ]);

  const spaces = font.generateShapes("A B", 20);
  assert.equal(spaces.length, 2);
  assert.deepEqual(points(spaces[1])[0], [26, 0]);

  const b = font.generateShapes("B", 20)[0];
  const rtl = font.generateShapes("AB", 20, "rtl");
  assert.deepEqual(points(rtl[0]), points(b));
  assert.deepEqual(points(rtl[1])[0], [8, 0]);
  assert.deepEqual(points(rtl[1])[2], [28, 20]);

  const tb = font.generateShapes("AB", 20, "tb");
  assert.deepEqual(points(tb[0]), points(b));
  assert.deepEqual(points(tb[1])[0], [0, 16]);
  assert.deepEqual(points(tb[1])[2], [20, 36]);

  const lines = font.generateShapes("A\nB", 20);
  assert.deepEqual(points(lines[1])[0], [0, -22]);

  const unicode = font.generateShapes("😀", 20);
  assert.equal(unicode.length, 1);
  assert.deepEqual(points(unicode[0]), points(font.generateShapes("?", 20)[0]));
  assert.deepEqual(points(font.generateShapes("#", 20)[0]), points(font.generateShapes("?", 20)[0]));
});

test("missing glyphs without a question mark fallback reject instead of fabricating shapes", () => {
  const bare = syntheticFont({ A: { x_min: 0, x_max: 10, ha: 10, o: "m 0 0 l 10 0 l 10 10 l 0 10" } });
  assert.throws(() => bare.generateShapes("#"), /character "#" does not exist in font family Synthetic/);
  assert.throws(() => new TextGeometry("#", { font: bare }), /character "#"/);
});

test("text geometry keeps size scaling, depth and hole-preserving output", () => {
  const geometry = new TextGeometry("A", { font, size: 20, depth: 4 });
  assert.deepEqual(bounds(geometry), { min: [0, 0, 0], max: [20, 20, 4] });
  assert.equal(geometry.groups.length, 2);
  const position = positionArray(geometry);
  const uv = geometry.getAttribute("uv");
  assert.ok(uv instanceof BufferAttribute);
  assert.equal(position.count % 3, 0);
  assert.equal(uv.count, position.count);
  assert.equal(font.generateShapes("A", 20)[0].holes.length, 1);

  const beveled = new TextGeometry("A", { font, size: 20, depth: 4, bevelEnabled: true });
  assert.ok(bounds(beveled).min[2] < 0);

  const lines = new TextGeometry("A\nA", { font, size: 20, depth: 4, bevelEnabled: false });
  assert.deepEqual(bounds(lines).min[1], -22);

  const empty = new TextGeometry("", { font });
  assert.equal(positionArray(empty).count, 0);
});

test("serialization preserves upstream options and requires explicit text and font input", () => {
  const geometry = new TextGeometry("A", { font, size: 20, depth: 4 });
  const serialized: TextGeometryJSON = JSON.parse(JSON.stringify(geometry.toJSON()));
  // `toJSON` has no source text; the consumer adds `options.text` to the serialized object.
  assert.equal("text" in serialized.options, false);
  assert.throws(() => TextGeometry.fromJSON(serialized), /serialized options must include text/);
  assert.throws(
    () =>
      TextGeometry.fromJSON({
        ...serialized,
        options: { ...serialized.options, text: "A", font: undefined },
      }),
    /serialized options must include a font/,
  );

  const restored = TextGeometry.fromJSON({ ...serialized, options: { ...serialized.options, text: "A" } });
  assert.deepEqual(bounds(restored), bounds(geometry));
  assert.deepEqual(Array.from(positionArray(restored).array), Array.from(positionArray(geometry).array));
});

test("text geometry fromJSON decodes a serialized extrusion path through an explicit factory", () => {
  const path = new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
  const geometry = new TextGeometry("A", { font, size: 20, depth: 4, extrudePath: path });
  const json = geometry.toJSON();
  assert.equal(json.options.extrudePath?.type, "LineCurve3");
  const serialized = JSON.parse(JSON.stringify(json));
  const data = { ...serialized, options: { ...serialized.options, text: "A" } };
  assert.throws(() => TextGeometry.fromJSON(data), /createCurve factory/);
  const restored = TextGeometry.fromJSON(data, undefined, (curve: CurveJSON) => new LineCurve3().fromJSON(curve));
  assert.deepEqual(bounds(restored), bounds(geometry));
});

test("font loading reports parse errors through the callback and loading manager", async () => {
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
  vi.stubGlobal("fetch", async () => new Response("{broken", { headers: { "Content-Length": "7" } }));
  const failed: string[] = [];
  const manager = new LoadingManager();
  manager.onError = (url) => failed.push(url);
  await assert.rejects(new FontLoader(manager).loadAsync("https://example.test/broken.typeface.json"), SyntaxError);
  assert.deepEqual(failed, ["https://example.test/broken.typeface.json"]);
  assert.deepEqual(Object.keys(manager.fileRequests), []);
});
