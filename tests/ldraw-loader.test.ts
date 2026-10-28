import { assert, test } from "vitest";
import { LDrawLoader } from "../src/addons/loaders/LDrawLoader";
import { LDrawConditionalLineMaterial } from "../src/addons/materials/LDrawConditionalLineMaterial";
import fs from "node:fs";

const carPath = "public/examples/models/ldraw/officialLibrary/models/car.ldr_Packed.mpd";
const carText = fs.readFileSync(carPath, "utf8");

/** Reads the position attribute of a mesh-like object without DOM. */
function readPositions(group: unknown): number[] {
  const out: number[] = [];
  (group as { traverse(fn: (c: unknown) => void): void }).traverse((c) => {
    const holder = c as { geometry?: { attributes: { position?: { array: Float32Array } } } };
    const positions = holder.geometry?.attributes.position as { array?: Float32Array } | undefined;
    if (positions?.array) for (const v of positions.array) out.push(v);
  });
  return out;
}

test("car model parses without fetch and yields geometry", async () => {
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);

  const partsCache = (loader as unknown as { partsCache: { parseModel(text: string): Promise<unknown> } }).partsCache;
  const group = await partsCache.parseModel(carText);
  assert.ok(group, "parseModel returned nothing");

  const positions = readPositions(group);
  assert.ok(positions.length > 0, "no positions parsed");
  for (let i = 0; i < positions.length; i++) {
    assert.ok(Number.isFinite(positions[i]), "non-finite position");
  }
});

test("addDefaultMaterials builds the main colour library through meta parsing", () => {
  const loader = new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);

  loader.addDefaultMaterials();

  const main = loader.getMaterial("16") as { name?: string; color?: { getHex(): number } } | null;
  assert.ok(main !== null, "main colour 16 missing");
  // #FF8080 parsed through the LDraw color space
  assert.ok(main.color !== undefined);

  const edge = loader.getMaterial("24") as { name?: string } | null;
  assert.ok(edge !== null, "edge colour 24 missing");
});
