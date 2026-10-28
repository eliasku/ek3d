import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { USDAParser } from "../src/addons/loaders/usd/USDAParser";

test("USDA parser composes metadata, mesh attributes, relationships and samples", () => {
  const parser = new USDAParser();
  const text = `#usda 1.0
(
    upAxis = "Y"
    defaultPrim = "Root"
    metersPerUnit = 0.01
)
def Xform "Root"
{
    def Mesh "Mesh"
    {
        point3f[] points = [
            (0, 0, 0), # first point
            (1, 2, 3)
        ]
        int[] primvars:skel:jointIndices = [0, 1, 1, 0]
        float[] primvars:skel:jointWeights = [0.75, 0.25, 0.5, 0.5]
        quatf orientation = (1, 2, 3, 4)
        float inputs:roughness.connect = </Root/Shader.outputs:result>
        float inputs:roughness = 0.5
        rel material:binding = </Root/Material> (
            bindMaterialAs = "strongerThanDescendants"
        )
        float3 translate.timeSamples = {
            2: (2, 3, 4)
            1: (1, 2, 3)
        }
    }
}`;
  const data = parser.parseData(text).specsByPath;
  assert.deepEqual(data["/"].fields, { upAxis: "Y", defaultPrim: "Root", metersPerUnit: 0.01, primChildren: ["Root"] });
  assert.deepEqual(data["/Root"].fields, { typeName: "Xform", primChildren: ["Mesh"] });
  assert.deepEqual(data["/Root/Mesh.points"].fields.default, [0, 0, 0, 1, 2, 3]);
  assert.equal(data["/Root/Mesh.primvars:skel:jointIndices"].fields.elementSize, 2);
  assert.equal(data["/Root/Mesh.primvars:skel:jointWeights"].fields.elementSize, 2);
  assert.deepEqual(data["/Root/Mesh.orientation"].fields.default, [2, 3, 4, 1]);
  assert.deepEqual(data["/Root/Mesh.inputs:roughness"].fields, {
    typeName: "float",
    connectionPaths: ["/Root/Shader.outputs:result"],
    default: 0.5,
  });
  assert.deepEqual(data["/Root/Mesh.material:binding"], {
    specType: 8,
    fields: { targetPaths: ["/Root/Material"], bindMaterialAs: "strongerThanDescendants" },
  });
  assert.deepEqual(data["/Root/Mesh.translate"].fields.timeSamples, {
    times: [1, 2],
    values: [
      [1, 2, 3],
      [2, 3, 4],
    ],
  });
});

test("USDA parser preserves quoted comment markers and multiline strings", () => {
  const parser = new USDAParser();
  const text = `#usda 1.0
/* ignored */
def Scope "Text"
{
    string label = "a#b = c /* intact */" # ignored
    string description = """first
second"""
    asset file = @textures/image.png@
}`;
  const raw = parser.parseText(text);
  assert.equal((raw['def Scope "Text"'] as Record<string, string>)["string label"], '"a#b = c /* intact */"');
  const specs = parser.parseData(text).specsByPath;
  assert.equal(specs["/Text.label"].fields.default, "a#b = c /* intact */");
  assert.equal(specs["/Text.description"].fields.default, '""first\nsecond""');
  assert.equal(specs["/Text.file"].fields.default, "textures/image.png");
});
