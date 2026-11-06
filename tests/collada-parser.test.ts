import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  ColladaParser,
  getElementsByTagName,
  parseFloats,
  parseId,
  parseInts,
  parseStrings,
} from "../src/addons/loaders/collada/ColladaParser";

function element(name: string, attributes: Record<string, string> = {}, text = "", children: Element[] = []): Element {
  return {
    nodeType: 1,
    nodeName: name,
    textContent: text,
    childNodes: children,
    getAttribute: (key: string) => attributes[key] ?? null,
    hasAttribute: (key: string) => key in attributes,
  } as unknown as Element;
}

test("Collada parser reads source arrays and animation channel addressing", () => {
  const parser = new ColladaParser();
  assert.deepEqual(parser.parseSource(element("source", {}, "", [element("float_array", {}, "1 2 3")])), {
    array: [1, 2, 3],
    stride: 3,
  });
  assert.deepEqual(parser.parseSource(element("source", {}, "", [element("Name_array", {}, "a b")])), {
    array: ["a", "b"],
    stride: 3,
  });
  assert.deepEqual(
    parser.parseAnimationChannel(element("channel", { target: "node/transform(2)(3)", source: "#sampler" })),
    {
      id: "node",
      sid: "transform",
      indices: [2, 3],
      arraySyntax: true,
      memberSyntax: false,
      sampler: "sampler",
    },
  );
  assert.deepEqual(
    parser.parseAnimationChannel(element("channel", { target: "node/rotation.ANGLE", source: "#sampler" })),
    {
      id: "node",
      sid: "rotation",
      member: "ANGLE",
      arraySyntax: false,
      memberSyntax: true,
      sampler: "sampler",
    },
  );
});

test("Collada parser retains direct-child and whitespace semantics", () => {
  const nested = element("item");
  const direct = element("item");
  assert.deepEqual(
    getElementsByTagName(element("root", {}, "", [element("group", {}, "", [nested]), direct]), "item"),
    [direct],
  );
  assert.deepEqual(parseStrings("  a\n b "), ["a", "b"]);
  assert.deepEqual(parseFloats("1 2.5"), [1, 2.5]);
  assert.deepEqual(parseInts("1 2"), [1, 2]);
  assert.equal(parseId("#target"), "target");
  assert.equal(new ColladaParser().parse(""), null);
});

test("Collada polygons retain each index list and use the full input stride", () => {
  const parser = new ColladaParser();
  const inputs = [
    element("input", { semantic: "VERTEX", source: "#positions", offset: "0" }),
    element("input", { semantic: "NORMAL", source: "#normals", offset: "1" }),
  ];
  const primitive = parser.parseGeometryPrimitive(
    element("polygons", { count: "2" }, "", [
      ...inputs,
      element("p", {}, "0 0 1 0 2 0"),
      element("p", {}, "3 1 4 1 5 1 6 1"),
    ]),
  );
  assert.deepEqual(primitive.vcount, [3, 4]);
  assert.deepEqual(primitive.p, [0, 0, 1, 0, 2, 0, 3, 1, 4, 1, 5, 1, 6, 1]);
  const triangles = parser.parseGeometryPrimitive(
    element("triangles", { count: "1" }, "", [...inputs, element("p", {}, "0 0 1 0 2 0")]),
  );
  assert.deepEqual(triangles.p, [0, 0, 1, 0, 2, 0]);
  assert.equal(triangles.vcount, undefined);
});
