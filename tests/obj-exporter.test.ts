import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { OBJExporter } from "../src/addons/exporters/OBJExporter";
import { Float32BufferAttribute } from "../src/core/BufferAttribute";
import { BufferGeometry } from "../src/core/BufferGeometry";
import { Object3D } from "../src/core/Object3D";
import { LineBasicMaterial } from "../src/materials/LineBasicMaterial";
import { MeshBasicMaterial } from "../src/materials/MeshBasicMaterial";
import { PointsMaterial } from "../src/materials/PointsMaterial";
import { Line } from "../src/objects/Line";
import { LineSegments } from "../src/objects/LineSegments";
import { Mesh } from "../src/objects/Mesh";
import { Points } from "../src/objects/Points";

function geometry(): BufferGeometry {
  return new BufferGeometry().setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
}

test("exports indexed and non-indexed lines and segments with shared vertex offsets", () => {
  const root = new Object3D();
  const indexed = geometry().setIndex([0, 1, 2, 0]);
  root.add(new Line(indexed, new LineBasicMaterial()));
  root.add(new LineSegments(geometry().setIndex([0, 1, 1, 2]), new LineBasicMaterial()));
  root.add(new Line(geometry(), new LineBasicMaterial()));
  root.add(new LineSegments(geometry(), new LineBasicMaterial()));
  const result = new OBJExporter().parse(root);
  assert.deepEqual(result.match(/^l .*$/gm), ["l 1 2 3 1 ", "l 4 5", "l 5 6", "l 7 8 9 ", "l 10 11"]);
});

test("exports transformed meshes, normals, UVs, materials and independent face indices", () => {
  const root = new Object3D();
  const first = geometry();
  first.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  first.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  first.setIndex([2, 1, 0]);
  const material = new MeshBasicMaterial();
  material.name = "paint";
  const mesh = new Mesh(first, material);
  mesh.name = "triangle";
  mesh.position.set(2, 3, 4);
  root.add(mesh, new Mesh(geometry(), new MeshBasicMaterial()));
  root.updateMatrixWorld(true);
  const result = new OBJExporter().parse(root);
  assert.match(result, /^o triangle\nusemtl paint\nv 2 3 4\nv 3 3 4\nv 2 4 4\n/);
  assert.deepEqual(result.match(/^vn .*$/gm), ["vn 0 0 1", "vn 0 0 1", "vn 0 0 1"]);
  assert.deepEqual(result.match(/^vt .*$/gm), ["vt 0 0", "vt 1 0", "vt 0 1"]);
  assert.deepEqual(result.match(/^f .*$/gm), ["f 3/3/3 2/2/2 1/1/1", "f 4 5 6"]);
});

test("exports vertex colors and point indices after a mesh", () => {
  const root = new Object3D();
  const colored = geometry();
  colored.setAttribute("color", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  root.add(new Mesh(colored, new MeshBasicMaterial()));
  const points = new Points(colored, new PointsMaterial());
  points.name = "points";
  root.add(points);
  const result = new OBJExporter().parse(root);
  assert.match(result, /v 0 0 0 0\.9999999999999999 0 0/);
  assert.match(result, /o points\n/);
  assert.match(result, /p 4 5 6 \n$/);
});

test("keeps UV and normal offsets independent across meshes", () => {
  const root = new Object3D();
  const uvOnly = geometry();
  uvOnly.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const normalOnly = geometry();
  normalOnly.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const both = geometry();
  both.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  both.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const material = new MeshBasicMaterial();
  root.add(new Mesh(uvOnly, material), new Mesh(normalOnly, material), new Mesh(both, material));
  assert.deepEqual(new OBJExporter().parse(root).match(/^f .*$/gm), [
    "f 1/1 2/2 3/3",
    "f 4//1 5//2 6//3",
    "f 7/4/4 8/5/5 9/6/6",
  ]);
});
