import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { VRMLLoader } from "../src/addons/loaders/VRMLLoader";
import type { ChevrotainRuntime } from "../src/addons/loaders/vrml-parser";
import { Mesh } from "../src/objects/Mesh";
import { MeshPhongMaterial } from "../src/materials/MeshPhongMaterial";
import { Side } from "../src/constants";

// Load the same public runtime the browser uses, without importing a publicDir asset through Vite.
const source = readFileSync("public/examples/libs/chevrotain.module.min.js");
const url = `data:text/javascript;base64,${source.toString("base64")}`;
const runtimeModule: { default: ChevrotainRuntime } = await import(/* @vite-ignore */ url);
const runtime = runtimeModule.default;
const header = "#VRML V2.0 utf8\n";

test("VRML builds transforms, DEF/USE geometry, and material properties", () => {
  const scene = new VRMLLoader(runtime).parse(
    header +
      `
Transform {
  translation 1 2 3
  children [
    Shape {
      appearance Appearance { material Material { diffuseColor 1 0 0 transparency 0.25 } }
      geometry DEF shared Box { size 2 4 6 }
    }
    Shape { geometry USE shared }
  ]
}`,
  );
  const group = scene.children[0];
  assert.deepEqual(group.position.toArray(), [1, 2, 3]);
  assert.equal(group.children.length, 2);
  const first = group.children[0];
  const second = group.children[1];
  assert.ok(first instanceof Mesh && second instanceof Mesh);
  assert.equal(first.geometry, second.geometry);
  assert.ok(first.material instanceof MeshPhongMaterial);
  assert.equal(first.material.opacity, 0.75);
  assert.equal(first.material.transparent, true);
});

test("VRML triangulates an indexed face set and honors the solid hint", () => {
  const scene = new VRMLLoader(runtime).parse(
    header +
      `
Shape {
  geometry IndexedFaceSet {
    solid FALSE
    coord Coordinate { point [ 0 0 0, 1 0 0, 1 1 0, 0 1 0 ] }
    coordIndex [ 0, 1, 2, 3, -1 ]
  }
}`,
  );
  const mesh = scene.children[0];
  assert.ok(mesh instanceof Mesh);
  const position = mesh.geometry.getAttribute("position");
  assert.ok(position);
  assert.equal(position.count, 6);
  assert.ok(!Array.isArray(mesh.material));
  assert.equal(mesh.material.side, Side.Double);
});

test("VRML reports malformed input", () => {
  assert.throws(() => new VRMLLoader(runtime).parse(header + "Shape { geometry Box {"), /Parsing errors detected/);
});
