import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { catalogURL, defaultVariant } from "../examples/gltf-catalog";

test("catalog selection prefers binary and falls back to regular glTF", () => {
  const model = { name: "model", label: "Model", variants: { glTF: "scene.gltf", "glTF-Binary": "scene.glb" } };
  assert.equal(defaultVariant(model), "glTF-Binary");
  assert.equal(defaultVariant({ ...model, variants: { glTF: "scene.gltf" } }), "glTF");
});

test("catalog paths preserve variant directories and escape model names", () => {
  const model = { name: "Box With Spaces", label: "Box", variants: { "glTF-Draco": "Box With Spaces.gltf" } };
  assert.equal(defaultVariant(model), "glTF-Draco");
  assert.equal(
    catalogURL(model, "glTF-Draco"),
    "/examples/models/gltf-catalog/Box%20With%20Spaces/glTF-Draco/Box%20With%20Spaces.gltf",
  );
  assert.throws(() => catalogURL(model, "glTF"), /Unknown variant/);
});
