import type { Font } from "ek3d/addons/loaders/FontLoader";
import { FontLoader } from "ek3d/addons/loaders/FontLoader";
import type { FontData, FontDirection, Glyph } from "ek3d/addons/loaders/FontLoader";
import { TextGeometry } from "ek3d/addons/geometries/TextGeometry";
import type { TextGeometryOptions, TextGeometryJSON } from "ek3d/addons/geometries/TextGeometry";
import type { ExtrudeGeometryJSON, ExtrudeGeometryOptions } from "ek3d/geometries/ExtrudeGeometry";
import { LoadingManager } from "ek3d/loaders/LoadingManager";

const glyph: Glyph = { x_min: 0, x_max: 10, ha: 10, o: "m 0 0 l 10 0 l 10 10 l 0 10" };
const data: FontData = {
  glyphs: { A: glyph, "?": glyph },
  familyName: "Synthetic",
  ascender: 8,
  descender: -2,
  underlinePosition: -1,
  underlineThickness: 1,
  boundingBox: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
  resolution: 10,
};
const font: Font = new FontLoader(new LoadingManager()).parse(data);
const pending: Promise<Font> = new FontLoader().loadAsync("font.typeface.json");
// Upstream keeps onLoad optional: loading without a callback must remain accepted.
new FontLoader().load("font.typeface.json");
const direction: FontDirection = "tb";
const textOptions: TextGeometryOptions = { font, size: 20, depth: 4, direction };
const extrudeOptions: ExtrudeGeometryOptions = textOptions;
const geometry = new TextGeometry("Text", extrudeOptions);
const json: TextGeometryJSON = geometry.toJSON();
const extrusionJSON: ExtrudeGeometryJSON = json;
const holes: number = font.generateShapes("A", 20, direction)[0].holes.length;

export async function fontTextConsumer() {
  const loaded = await pending;
  const restored = TextGeometry.fromJSON({ ...json, options: { ...json.options, text: "Text" } });
  return { loaded, restored, holes, extrusionJSON, font };
}

// @ts-expect-error Char direction is one of the supported layout modes.
font.generateShapes("A", 20, "btt");
// @ts-expect-error Text geometry requires text, not font data.
new TextGeometry(data, { font });
// @ts-expect-error A font is required to generate text shapes.
new TextGeometry("A", { font: data });
// @ts-expect-error Size is numeric.
new TextGeometry("A", { font, size: "20" });
// @ts-expect-error Serialized glyph outlines are strings.
const invalidGlyph: Glyph = { x_min: 0, x_max: 1, ha: 1, o: [0, 0] };
// @ts-expect-error A serialized font carries typeface data.
const invalidJSON: TextGeometryJSON = { ...json, options: { ...json.options, font: font.data } };
void [invalidGlyph, invalidJSON];
