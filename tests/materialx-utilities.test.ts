import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { createArchiveResolver, isZipBuffer, readMtlxArchive } from "../src/addons/loaders/materialx/MaterialXArchive";
import {
  createStrictInterfaceValidator,
  type MaterialXValidationNode,
} from "../src/addons/loaders/materialx/MaterialXInterfaceValidation";
import { MaterialXLog } from "../src/addons/loaders/materialx/MaterialXLog";
import { getNodeDefNames, resolveNodeDef } from "../src/addons/loaders/materialx/MaterialXNodeDefs";
import { setKelvin } from "../src/addons/utils/ColorUtils";
import { Color } from "../src/math/Color";

test("MaterialX archives locate exactly one document and resolve cached resources", () => {
  const encoder = new TextEncoder();
  const zip = {
    unzipSync: () => ({
      "./materials/main.mtlx": encoder.encode("<materialx/>"),
      "materials/tex.png": new Uint8Array([1]),
    }),
  };
  const archive = readMtlxArchive(new Uint8Array([80, 75, 3, 4]), zip);
  assert.equal(isZipBuffer(new Uint8Array([80, 75, 3, 4])), true);
  assert.equal(archive.mtlxPath, "materials/main.mtlx");
  assert.equal(archive.text, "<materialx/>");
  const resolver = createArchiveResolver(archive.files);
  const url = resolver.resolve("tex.png");
  assert.ok(url);
  assert.equal(resolver.resolve("tex.png"), url);
  assert.equal(resolver.resolve("missing"), null);
  resolver.dispose();
  assert.throws(() => readMtlxArchive(new Uint8Array(), { unzipSync: () => ({}) }), /Missing/);
  assert.throws(
    () =>
      readMtlxArchive(new Uint8Array(), {
        unzipSync: () => ({ "a.mtlx": new Uint8Array(), "b.mtlx": new Uint8Array() }),
      }),
    /Exactly one/,
  );
});

test("MaterialX resolves definitions and validates input and connection types", () => {
  assert.ok(getNodeDefNames("multiply").includes("ND_multiply_float"));
  const def = resolveNodeDef({
    element: "multiply",
    type: "float",
    children: [{ element: "input", name: "in1", type: "float" }],
    materialX: { getDocumentNodeDefs: () => ({}) },
    getAttribute: () => null,
  });
  assert.equal(def?.name, "ND_multiply_float");
  const nodes = new Map<string, MaterialXValidationNode>();
  const materialX = { getMaterialXNode: (path: string) => nodes.get(path) };
  const makeNode = (element: string, name: string, type: string | null): MaterialXValidationNode => ({
    element,
    name,
    type,
    output: null,
    referencePath: null,
    hasReference: false,
    nodeDef: null,
    children: [],
    materialX,
    getAttribute: (key) => (key === "name" ? name : key === "type" ? type : null),
  });
  const source = makeNode("output", "source", "color3");
  nodes.set("source", source);
  const input = makeNode("input", "in1", "float");
  input.referencePath = "source";
  input.hasReference = true;
  const bad = makeNode("input", "unknown", "float");
  const parent = makeNode("multiply", "multiply1", "float");
  parent.nodeDef = def;
  parent.children.push(input, bad);
  const log = new MaterialXLog();
  createStrictInterfaceValidator()(parent, log);
  assert.deepEqual(
    log.errors.map((entry) => entry.code),
    ["type-mismatch", "unknown-input"],
  );
});

test("Kelvin colors clamp to the supported range", () => {
  const low = setKelvin(new Color(), 1);
  assert.deepEqual(low.toArray(), setKelvin(new Color(), 1000).toArray());
  assert.equal(low.b, 0);
  assert.deepEqual(setKelvin(new Color(), 50000).toArray(), setKelvin(new Color(), 40000).toArray());
});
